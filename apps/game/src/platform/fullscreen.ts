import { HOST_BRIDGE_PROTOCOL } from "../../../../packages/story-model/src/host.ts";
import type { FullscreenDriver, FullscreenState } from "../../../../packages/player/src/web/fullscreen.ts";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("宿主全屏接口需要对象");
  return value as Record<string, unknown>;
}

/** Undefined only in a normal browser. A missing native capability never falls back to DOM fullscreen. */
export function nativeFullscreenDriver(): FullscreenDriver | undefined {
  const injected: unknown = Reflect.get(window, "__HAIFENG_HOST__");
  const platform = location.origin === "https://tauri.localhost" ? "windows-trial"
    : location.origin === "tauri://localhost" ? "linux-trial"
    : location.origin === "https://appassets.androidplatform.net" ? "android-trial" : null;
  if (!platform && injected === undefined) return undefined;
  const listeners = new Set<() => void>();
  let current: FullscreenState = { supported: false, active: false, pending: false, issue: null };
  let sequence = -1;
  let receivedAt = performance.now();
  let disposed = false;
  const capability = () => {
    const bridge = object(injected);
    if (!platform || bridge.protocol !== HOST_BRIDGE_PROTOCOL) throw new Error("当前来源或宿主桥不接受全屏控制");
    const api = object(bridge.fullscreen);
    if (api.protocol !== "haifeng.fullscreen/1" || typeof api.read !== "function" || typeof api.request !== "function"
      || typeof api.identity !== "string" || !/^[a-f0-9-]{36}$/u.test(api.identity)) {
      throw new Error("当前宿主未接入全屏控制，可继续窗口游玩。");
    }
    return { owner: api, read: api.read, request: api.request };
  };
  const notify = (): void => { for (const listener of listeners) listener(); };
  const update = (): void => {
    if (disposed) return;
    try {
      const api = capability();
      const data = object(Reflect.apply(api.read, api.owner, []));
      const nullableId = (id: unknown): boolean => id === null || (typeof id === "number" && Number.isSafeInteger(id) && id > 0);
      if (Object.keys(data).sort().join(",") !== "active,format,issue,pending,requestId,requestOwner,sequence,supported"
        || data.format !== "haifeng.fullscreen-state/1" || typeof data.active !== "boolean"
        || typeof data.supported !== "boolean" || typeof data.sequence !== "number"
        || !Number.isSafeInteger(data.sequence) || data.sequence < 0 || data.sequence < sequence
        || !nullableId(data.requestId) || !nullableId(data.pending)
        || (data.requestOwner !== null && (typeof data.requestOwner !== "string" || !/^[a-f0-9-]{36}$/u.test(data.requestOwner)))
        || ((data.requestId === null) !== (data.requestOwner === null))
        || (data.issue !== null && (typeof data.issue !== "string" || data.issue.length > 1024))
        || data.supported !== (data.sequence > 0)) throw new Error("宿主全屏状态字段无效");
      if (data.sequence > sequence && data.sequence > 0) receivedAt = performance.now();
      sequence = data.sequence;
      current = { supported: data.supported, active: data.active, pending: data.pending !== null, issue: data.issue };
    } catch (error: unknown) {
      current = { ...current, supported: false, pending: false, issue: error instanceof Error ? error.message : "宿主全屏状态不可用" };
    }
    notify();
  };
  window.addEventListener("haifeng:fullscreen", update);
  const timer = window.setInterval(() => {
    if (disposed || sequence <= 0 || performance.now() - receivedAt <= 3500) return;
    current = { ...current, issue: "宿主全屏状态暂未同步；窗口恢复后可重试。" };
    notify();
  }, 1000);
  update();
  const request = (active: boolean): void => {
    if (disposed) return;
    try {
      const api = capability();
      const id: unknown = Reflect.apply(api.request, api.owner, [active]);
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) throw new Error("宿主全屏请求标识无效");
      update();
    } catch (error: unknown) {
      current = { ...current, pending: false, issue: error instanceof Error ? error.message : "宿主全屏请求失败" };
      notify();
    }
  };
  return {
    escapeExits: false,
    read: () => ({ ...current }),
    request,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    dispose: () => {
      if (disposed) return;
      // Supersede a pending enter with an explicit leave; do not leave a latent request for the next page.
      if (current.active || current.pending) request(false);
      disposed = true;
      window.removeEventListener("haifeng:fullscreen", update);
      window.clearInterval(timer);
      listeners.clear();
    },
  };
}
