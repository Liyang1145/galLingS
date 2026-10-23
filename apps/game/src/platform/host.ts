export interface HostState {
  platform: "browser" | "windows-trial";
  paused: boolean;
  issue: string | null;
}

interface NativeState {
  format: "haifeng.host-state/1";
  platform: "windows-trial";
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
    || data.format !== "haifeng.host-state/1" || data.platform !== "windows-trial"
    || typeof data.sequence !== "number" || !Number.isSafeInteger(data.sequence) || data.sequence < 0
    || typeof data.paused !== "boolean") throw new Error("宿主状态格式或字段无效");
  return { format: data.format, platform: data.platform, sequence: data.sequence, paused: data.paused };
}

/** Platform messages only pause/resume the existing session; they cannot advance story state. */
export function connectHost(changed: (state: HostState) => void): {
  state(): HostState;
  dispose(): void;
} {
  const injected: unknown = Reflect.get(window, "__HAIFENG_HOST__");
  let state: HostState = { platform: "browser", paused: false, issue: null };
  let sequence = -1;
  let disposed = false;
  const update = (): void => {
    if (disposed) return;
    try {
      const bridge = record(injected);
      if (typeof bridge.read !== "function") throw new Error("缺少宿主状态读取接口");
      const next = readState(Reflect.apply(bridge.read, injected, []));
      if (next.sequence < sequence) throw new Error("宿主状态序号倒退");
      sequence = next.sequence;
      state = { platform: next.platform, paused: next.paused, issue: null };
    } catch (error: unknown) {
      state = {
        platform: "windows-trial", paused: true,
        issue: error instanceof Error ? error.message : "宿主状态读取失败",
      };
    }
    changed({ ...state });
  };
  // A missing bridge in this native origin is an integration error, not browser mode.
  const native = injected !== undefined || window.location.origin === "https://tauri.localhost";
  if (native) {
    window.addEventListener("haifeng:host-state", update);
    update();
  } else changed({ ...state });
  return {
    state: () => ({ ...state }),
    dispose: () => {
      disposed = true;
      window.removeEventListener("haifeng:host-state", update);
    },
  };
}
