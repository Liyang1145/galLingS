// Native initialization only; not a second game runtime or a filesystem bridge.
((platform) => {
  const origin = platform === "windows-trial" ? "https://tauri.localhost"
    : platform === "linux-trial" ? "tauri://localhost"
    : platform === "android-trial" ? "https://appassets.androidplatform.net" : null;
  if (!origin || window.top !== window || window.location.origin !== origin) return;
  let backHandler = null;
  // Before app registration there are no player writes and title buttons stay disabled.
  let exitHandler = () => Promise.resolve();
  let exit = null;
  let audio = Object.freeze({
    format: "haifeng.audio-focus/1", sequence: 0,
    status: platform === "android-trial" ? "not-requested" : "granted",
  });
  let state = Object.freeze({
    format: "haifeng.host-state/1", platform, sequence: 0, paused: true,
  });
  // Optional display extension. Older /3 hosts can keep playing without this capability.
  const displayOwner = (() => { try { return crypto.randomUUID(); } catch { return null; } })();
  let display = Object.freeze({
    format: "haifeng.fullscreen-state/1", sequence: 0, active: false, requestId: null, requestOwner: null, issue: null,
  });
  let displayRequest = null;
  let displayId = 0;
  let displayTimeout = null;
  let displayFailure = null;
  const displayChanged = () => window.dispatchEvent(new Event("haifeng:fullscreen"));
  const fullscreen = Object.freeze({
    protocol: "haifeng.fullscreen/1",
    identity: displayOwner,
    read: () => ({ ...display, issue: displayFailure?.issue ?? (displayRequest ? null : display.issue),
      supported: display.sequence > 0 && displayOwner !== null, pending: displayRequest?.id ?? null }),
    readRequest: () => displayRequest ? { ...displayRequest } : null,
    request: active => {
      if (typeof active !== "boolean" || display.sequence === 0 || displayOwner === null) throw new Error("宿主尚未提供全屏控制");
      if (displayId >= Number.MAX_SAFE_INTEGER) throw new Error("全屏请求标识已耗尽，请重开页面");
      if (displayTimeout !== null) window.clearTimeout(displayTimeout);
      const request = { id: ++displayId, active, owner: displayOwner };
      displayRequest = request;
      displayFailure = null;
      display = Object.freeze({ ...display, issue: null });
      displayTimeout = window.setTimeout(() => {
        if (displayRequest !== request) return;
        displayRequest = null;
        displayTimeout = null;
        displayFailure = { id: request.id, issue: "等待宿主全屏确认超时，请查看当前窗口后重试。" };
        displayChanged();
      }, 8000);
      if (platform === "android-trial") {
        try {
          const native = window.__HAIFENG_NATIVE_DISPLAY__;
          if (!native || typeof native.postMessage !== "function") throw new Error("原生全屏接口不可用");
          native.postMessage(JSON.stringify({ format: "haifeng.fullscreen-request/1", ...request }));
        } catch (error) {
          window.clearTimeout(displayTimeout);
          displayTimeout = null;
          displayRequest = null;
          displayFailure = { id: request.id, issue: "原生全屏请求未送达，请重试。" };
          displayChanged();
          throw error;
        }
      }
      displayChanged();
      return request.id;
    },
    receive: value => {
      if (!value || typeof value !== "object" || Array.isArray(value)
        || Object.keys(value).sort().join(",") !== "active,format,issue,requestId,requestOwner,sequence"
        || value.format !== "haifeng.fullscreen-state/1"
        || !Number.isSafeInteger(value.sequence) || value.sequence < 1
        || typeof value.active !== "boolean"
        || (value.requestId !== null && (!Number.isSafeInteger(value.requestId) || value.requestId < 1))
        || (value.requestOwner !== null && (typeof value.requestOwner !== "string" || !/^[a-f0-9-]{36}$/.test(value.requestOwner)))
        || ((value.requestId === null) !== (value.requestOwner === null))
        || (value.issue !== null && (typeof value.issue !== "string" || value.issue.length > 1024))) {
        throw new Error("宿主全屏状态无效");
      }
      if (value.sequence <= display.sequence) return;
      display = Object.freeze({ ...value });
      if (value.requestOwner === displayOwner && displayFailure?.id === value.requestId) displayFailure = null;
      if (displayRequest && value.requestOwner === displayOwner && value.requestId === displayRequest.id) {
        displayRequest = null;
        if (displayTimeout !== null) window.clearTimeout(displayTimeout);
        displayTimeout = null;
      }
      displayChanged();
    },
  });
  window.addEventListener("pagehide", () => {
    if (displayTimeout !== null) window.clearTimeout(displayTimeout);
    displayTimeout = null;
    displayRequest = null;
  }, { once: true });
  Object.defineProperty(window, "__HAIFENG_HOST__", {
    configurable: false, writable: false,
    value: Object.freeze({
      protocol: "haifeng.host-bridge/3",
      fullscreen,
      read: () => ({ ...state }),
      setExitHandler: handler => {
        if (handler !== null && typeof handler !== "function") throw new Error("退出处理器无效");
        if (exit) {
          exit.status = "cancelled";
          exit.controller.abort();
        }
        exitHandler = handler;
      },
      beginExit: id => {
        if (!Number.isSafeInteger(id) || id < 1) throw new Error("退出请求标识无效");
        if (exit && exit.id >= id) return { id: exit.id, status: exit.status };
        if (exit) {
          exit.status = "cancelled";
          exit.controller.abort();
        }
        const request = { id, status: "pending", controller: new AbortController() };
        exit = request;
        if (!exitHandler) request.status = "unavailable";
        else {
          const handler = exitHandler;
          void Promise.resolve().then(() => handler(request.controller.signal)).then(() => {
            if (exit === request && !request.controller.signal.aborted) request.status = "ready";
          }, () => {
            if (exit === request && !request.controller.signal.aborted) {
              request.status = "failed";
              request.controller.abort();
            }
          });
        }
        return { id: request.id, status: request.status };
      },
      cancelExit: id => {
        if (!exit || exit.id !== id || exit.status === "cancelled") return;
        exit.status = "cancelled";
        exit.controller.abort();
      },
      cancelCurrentExit: () => {
        if (!exit || exit.status !== "pending") return;
        exit.status = "cancelled";
        exit.controller.abort();
      },
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
  if (platform === "android-trial") {
    window.addEventListener("haifeng:audio-interrupted", () => {
      const native = window.__HAIFENG_NATIVE_AUDIO__;
      if (audio.status === "granted" && native && typeof native.postMessage === "function") {
        native.postMessage("haifeng.audio.interrupted/1");
      }
    });
    window.addEventListener("haifeng:audio-resumed", () => {
      const native = window.__HAIFENG_NATIVE_AUDIO__;
      if (audio.status === "interrupted" && native && typeof native.postMessage === "function") {
        native.postMessage("haifeng.audio.resumed/1");
      }
    });
  }
})("__HAIFENG_PLATFORM__");
