// Native initialization only; not a second game runtime or a filesystem bridge.
((platform) => {
  const origin = platform === "windows-trial" ? "https://tauri.localhost"
    : platform === "android-trial" ? "https://appassets.androidplatform.net" : null;
  if (!origin || window.top !== window || window.location.origin !== origin) return;
  let backHandler = null;
  let state = Object.freeze({
    format: "haifeng.host-state/1", platform, sequence: 0, paused: true,
  });
  Object.defineProperty(window, "__HAIFENG_HOST__", {
    configurable: false, writable: false,
    value: Object.freeze({
      read: () => ({ ...state }),
      setBackHandler: handler => {
        if (handler !== null && typeof handler !== "function") throw new Error("返回键处理器无效");
        backHandler = handler;
      },
      back: () => backHandler ? backHandler() === true : false,
      receive: value => {
        if (!value || typeof value !== "object" || Array.isArray(value)
          || Object.keys(value).sort().join(",") !== "format,paused,platform,sequence"
          || value.format !== "haifeng.host-state/1" || value.platform !== platform
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
})("__HAIFENG_PLATFORM__");
