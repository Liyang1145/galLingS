import { HOST_BRIDGE_PROTOCOL } from "../../../../packages/story-model/src/host.ts";

type NativePlatform = "windows-trial" | "android-trial";

export interface HostState {
  platform: "browser" | NativePlatform;
  paused: boolean;
  issue: string | null;
  audioAllowed: boolean;
  audioIssue: string | null;
}

interface NativeState {
  format: "haifeng.host-state/1";
  platform: NativePlatform;
  sequence: number;
  paused: boolean;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("宿主消息需要对象");
  return value as Record<string, unknown>;
}

function readState(value: unknown): NativeState {
  const data = record(value);
  if (Object.keys(data).sort().join(",") !== "format,paused,platform,sequence"
    || data.format !== "haifeng.host-state/1" || (data.platform !== "windows-trial" && data.platform !== "android-trial")
    || typeof data.sequence !== "number" || !Number.isSafeInteger(data.sequence) || data.sequence < 0
    || typeof data.paused !== "boolean") throw new Error("宿主状态格式或字段无效");
  return { format: data.format, platform: data.platform, sequence: data.sequence, paused: data.paused };
}

/** Platform messages only pause/resume the existing session; they cannot advance story state. */
export function connectHost(
  changed: (state: HostState) => void,
  backRequested: () => boolean,
  exitRequested: (signal: AbortSignal) => Promise<void>,
): {
  state(): HostState;
  requestAudio(): void;
  releaseAudio(): void;
  cancelExit(): void;
  dispose(): void;
} {
  const injected: unknown = Reflect.get(window, "__HAIFENG_HOST__");
  let state: HostState = { platform: "browser", paused: false, issue: null, audioAllowed: true, audioIssue: null };
  let sequence = -1;
  let audioSequence = -1;
  let receivedAt = performance.now();
  let requestedAt = -Infinity;
  let disposed = false;
  let installed = false;
  const expected: NativePlatform | null = window.location.origin === "https://tauri.localhost" ? "windows-trial"
    : window.location.origin === "https://appassets.androidplatform.net" ? "android-trial" : null;
  const handleBack = (): boolean => {
    if (disposed) return false;
    try { return backRequested(); }
    catch (error: unknown) {
      state = {
        ...state, platform: expected ?? "windows-trial", paused: true,
        issue: error instanceof Error ? error.message : "返回键处理失败",
      };
      changed({ ...state });
      return true;
    }
  };
  const update = (): void => {
    if (disposed) return;
    try {
      const bridge = record(injected);
      if (!expected) throw new Error("当前页面来源不接受宿主桥");
      if (bridge.protocol !== HOST_BRIDGE_PROTOCOL) throw new Error("宿主桥与前端协议不匹配，请重新构建并准备完整游戏包");
      if (typeof bridge.read !== "function" || typeof bridge.setBackHandler !== "function"
        || typeof bridge.readAudio !== "function" || typeof bridge.setExitHandler !== "function"
        || typeof bridge.cancelCurrentExit !== "function") throw new Error("缺少宿主状态、音频、返回键或退出接口");
      const next = readState(Reflect.apply(bridge.read, injected, []));
      const audio = record(Reflect.apply(bridge.readAudio, injected, []));
      if (Object.keys(audio).sort().join(",") !== "format,sequence,status" || audio.format !== "haifeng.audio-focus/1"
        || typeof audio.sequence !== "number" || !Number.isSafeInteger(audio.sequence) || audio.sequence < 0
        || (audio.status !== "not-requested" && audio.status !== "granted"
          && audio.status !== "interrupted" && audio.status !== "denied")) throw new Error("音频焦点状态无效");
      if (next.platform !== expected) throw new Error("宿主消息平台与页面来源不一致");
      if (next.sequence < sequence || audio.sequence < audioSequence) throw new Error("宿主状态序号倒退");
      if (!installed) {
        Reflect.apply(bridge.setBackHandler, injected, [handleBack]);
        Reflect.apply(bridge.setExitHandler, injected, [(signal: AbortSignal) => {
          if (disposed) return Promise.reject(new Error("页面已离开"));
          return exitRequested(signal);
        }]);
        installed = true;
      }
      if (next.sequence > sequence && next.sequence > 0) receivedAt = performance.now();
      sequence = next.sequence;
      audioSequence = audio.sequence;
      const stale = performance.now() - receivedAt > 3500;
      state = {
        platform: next.platform, paused: next.paused || stale, issue: stale ? "宿主状态已超时，等待重新同步" : null,
        audioAllowed: audio.status === "granted" && !stale,
        audioIssue: audio.status === "denied" ? "尚未获准播放声音，可点击“启用声音”重试；主线可静音继续。"
          : audio.status === "interrupted" ? "声音焦点或播放设备发生变化，当前游玩已暂停；可等待临时焦点恢复，或确认设备后点击“启用声音”重试。"
          : null,
      };
    } catch (error: unknown) {
      state = {
        ...state, platform: expected ?? "windows-trial", paused: true, audioAllowed: false,
        issue: error instanceof Error ? error.message : "宿主状态读取失败",
      };
    }
    changed({ ...state });
  };
  // A missing bridge in this native origin is an integration error, not browser mode.
  const native = injected !== undefined || expected !== null;
  const watchdog = native ? window.setInterval(() => {
    if (disposed || performance.now() - receivedAt <= 3500) return;
    state = { ...state, paused: true, audioAllowed: false, issue: "宿主状态已超时，等待重新同步" };
    changed({ ...state });
  }, 1000) : null;
  if (native) {
    window.addEventListener("haifeng:host-state", update);
    update();
  } else changed({ ...state });
  return {
    state: () => ({ ...state }),
    cancelExit: () => {
      if (disposed || !native) return;
      const bridge = record(injected);
      if (typeof bridge.cancelCurrentExit !== "function") throw new Error("缺少退出取消接口");
      Reflect.apply(bridge.cancelCurrentExit, injected, []);
    },
    requestAudio: () => {
      if (disposed || state.platform !== "android-trial" || state.audioAllowed || performance.now() - requestedAt < 500) return;
      requestedAt = performance.now();
      try {
        const bridge = record(injected);
        if (typeof bridge.requestAudio !== "function") throw new Error("缺少音频焦点请求接口");
        Reflect.apply(bridge.requestAudio, injected, []);
      } catch (error: unknown) {
        state = { ...state, audioAllowed: false, audioIssue: error instanceof Error ? error.message : "音频焦点请求失败" };
        changed({ ...state });
      }
    },
    releaseAudio: () => {
      if (disposed || state.platform !== "android-trial") return;
      try {
        const bridge = record(injected);
        if (typeof bridge.releaseAudio !== "function") throw new Error("缺少音频焦点释放接口");
        Reflect.apply(bridge.releaseAudio, injected, []);
      } catch (error: unknown) {
        state = { ...state, audioAllowed: false, audioIssue: error instanceof Error ? error.message : "音频焦点释放失败" };
        changed({ ...state });
      }
    },
    dispose: () => {
      disposed = true;
      window.removeEventListener("haifeng:host-state", update);
      if (watchdog !== null) window.clearInterval(watchdog);
      if (installed) {
        const bridge = record(injected);
        if (typeof bridge.setBackHandler === "function") Reflect.apply(bridge.setBackHandler, injected, [null]);
        if (typeof bridge.setExitHandler === "function") Reflect.apply(bridge.setExitHandler, injected, [null]);
      }
    },
  };
}

