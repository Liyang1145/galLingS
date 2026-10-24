import { HOST_BRIDGE_PROTOCOL, NATIVE_RECORD_PROTOCOL } from "../../../../packages/story-model/src/host.ts";
import { IndexedDbSaveStore } from "../../../../packages/player/src/web/saves.ts";
import { NativeRecordStore } from "../../../../packages/player/src/web/native-records.ts";
import type { GameRecordStore } from "../../../../packages/player/src/web/native-records.ts";
import { SaveStorageError } from "../../../../packages/player/src/saves.ts";

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("原生记录接口需要对象");
  return value as Record<string, unknown>;
}

/** One selected storage source for this page; a native failure never selects another source. */
export function connectGameStorage(workId: string, notice: HTMLElement): { store: GameRecordStore; dispose(): void } {
  const mode: unknown = Reflect.get(window, "__HAIFENG_RECORD_MODE__");
  const injected: unknown = Reflect.get(window, "__HAIFENG_RECORDS__");
  const platform = window.location.origin === "https://tauri.localhost" ? "windows-trial"
    : window.location.origin === "https://appassets.androidplatform.net" ? "android-trial" : null;
  if (mode === undefined || mode === "indexeddb") {
    if (injected !== undefined) throw new Error("原生记录能力与本页存储选择不一致");
    if (mode !== undefined && (window.top !== window || platform === null)) {
      throw new Error("当前页面来源不接受原生存储选择");
    }
    notice.textContent = "";
    return { store: new IndexedDbSaveStore(), dispose: () => {} };
  }
  if (mode !== "native-files" || window.top !== window || platform === null) {
    throw new Error("原生记录模式或页面来源无效");
  }
  const host = record(Reflect.get(window, "__HAIFENG_HOST__"));
  const bridge = record(injected);
  const read = bridge.read, ready = bridge.ready, request = bridge.request;
  if (host.protocol !== HOST_BRIDGE_PROTOCOL || bridge.protocol !== NATIVE_RECORD_PROTOCOL || typeof host.read !== "function"
    || typeof read !== "function" || typeof ready !== "function" || typeof request !== "function"
    || record(Reflect.apply(host.read, host, [])).platform !== platform) {
    throw new Error("已选择的原生记录接口不兼容，请重新构建并准备完整游戏包");
  }
  let disposed = false;
  let warnings: readonly string[] = [];
  const state = (): Record<string, unknown> => {
    const next = record(Reflect.apply(read, injected, []));
    if (Object.keys(next).sort().join(",") !== "issue,owner,pending,protocol,workId"
      || next.protocol !== NATIVE_RECORD_PROTOCOL || next.workId !== workId
      || typeof next.owner !== "string" || !/^[a-f0-9-]{36}$/u.test(next.owner)
      || (next.pending !== null && (typeof next.pending !== "number" || !Number.isSafeInteger(next.pending) || next.pending < 1))
      || (next.issue !== null && (typeof next.issue !== "string" || next.issue.length > 2048))) {
      throw new Error("原生记录页面身份、作品或状态无效");
    }
    return next;
  };
  const originalOwner = state().owner;
  const render = (): void => {
    if (disposed) return;
    try {
      const next = state();
      if (next.owner !== originalOwner) throw new Error("原生记录页面身份已改变");
      const text = [`本次使用独立的 ${platform === "android-trial" ? "Android" : "Windows"} 文件记录；浏览器记录未迁移。`,
        ...(typeof next.issue === "string" ? [next.issue] : []), ...warnings].join(" ");
      if (notice.textContent !== text) notice.textContent = text;
    } catch (error: unknown) {
      notice.textContent = `原生记录状态异常：${error instanceof Error ? error.message : "状态不可用"}。不会切换其他记录来源。`;
    }
  };
  Reflect.apply(ready, injected, [NATIVE_RECORD_PROTOCOL, workId]);
  const store = new NativeRecordStore({
    request: async operation => {
      if (disposed || state().owner !== originalOwner) throw new Error("原生记录页面已离开或身份改变");
      try {
        const task: unknown = Reflect.apply(request, injected, [operation]);
        if (!(task instanceof Promise)) throw new Error("原生记录请求没有返回有效回执任务");
        return await task as unknown;
      } catch (error: unknown) {
        const code: unknown = typeof error === "object" && error !== null ? Reflect.get(error, "code") : undefined;
        if (typeof code === "string" && /^NATIVE_STORAGE_[A-Z_]+$/u.test(code)) {
          throw new SaveStorageError(code, error instanceof Error ? error.message : "原生记录操作未完成");
        }
        throw new SaveStorageError("NATIVE_STORAGE_UNCONFIRMED",
          `原生操作没有取得有效回执，提交状态未确认：${error instanceof Error ? error.message : "回执不可用"}`);
      }
    },
  }, values => { warnings = [...values]; render(); });
  window.addEventListener("haifeng:records-state", render);
  render();
  return { store, dispose: () => { disposed = true; window.removeEventListener("haifeng:records-state", render); } };
}
