// Native initialization only; not a second game runtime or a filesystem bridge.
((platform) => {
  const origin = platform === "windows-trial" ? "https://tauri.localhost"
    : platform === "android-trial" ? "https://appassets.androidplatform.net" : null;
  if (!origin || window.top !== window || window.location.origin !== origin) return;
  let backHandler = null;
  let audio = Object.freeze({
    format: "haifeng.audio-focus/1", sequence: 0,
    status: platform === "android-trial" ? "not-requested" : "granted",
  });
  let state = Object.freeze({
    format: "haifeng.host-state/1", platform, sequence: 0, paused: true,
  });
  Object.defineProperty(window, "__HAIFENG_HOST__", {
    configurable: false, writable: false,
    value: Object.freeze({
      protocol: "haifeng.host-bridge/2",
      read: () => ({ ...state }),
      readAudio: () => ({ ...audio }),
      requestAudio: () => {
        if (platform !== "android-trial") return;
        const native = window.__HAIFENG_NATIVE_AUDIO__;
        if (!native || typeof native.postMessage !== "function") throw new Error("原生音频焦点接口不可用");
        native.postMessage("haifeng.audio.request/1");
      },
      releaseAudio: () => {
        if (platform !== "android-trial") return;
        const native = window.__HAIFENG_NATIVE_AUDIO__;
        if (!native || typeof native.postMessage !== "function") throw new Error("原生音频焦点接口不可用");
        native.postMessage("haifeng.audio.release/1");
      },
      receiveAudio: value => {
        if (!value || typeof value !== "object" || Array.isArray(value)
          || Object.keys(value).sort().join(",") !== "format,sequence,status"
          || value.format !== "haifeng.audio-focus/1"
          || !Number.isSafeInteger(value.sequence) || value.sequence < 1
          || !["not-requested", "granted", "interrupted", "denied"].includes(value.status)) {
          throw new Error("音频焦点消息无效");
        }
        if (value.sequence <= audio.sequence) return;
        audio = Object.freeze({ ...value });
        window.dispatchEvent(new Event("haifeng:host-state"));
      },
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
