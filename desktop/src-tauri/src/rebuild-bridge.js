// Native initialization only; not a second game runtime or a filesystem bridge.
(() => {
  if (window.top !== window || window.location.origin !== "https://tauri.localhost") return;
  let state = Object.freeze({
    format: "haifeng.host-state/1", platform: "windows-trial", sequence: 0, paused: true,
  });
  Object.defineProperty(window, "__HAIFENG_HOST__", {
    configurable: false, writable: false,
    value: Object.freeze({
      read: () => ({ ...state }),
      receive: value => {
        if (!value || typeof value !== "object" || Array.isArray(value)
          || Object.keys(value).sort().join(",") !== "format,paused,platform,sequence"
          || value.format !== "haifeng.host-state/1" || value.platform !== "windows-trial"
          || !Number.isSafeInteger(value.sequence) || value.sequence < 1
          || typeof value.paused !== "boolean") {
          throw new Error("宿主状态消息无效");
        }
        if (value.sequence <= state.sequence) return;
        state = Object.freeze({ ...value });
        window.dispatchEvent(new Event("haifeng:host-state"));
      },
    }),
  });
})();
