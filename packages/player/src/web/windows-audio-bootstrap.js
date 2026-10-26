// Windows initialization only. Permission transport, never audio rendering or story execution.
(() => {
  const bridge = window.__HAIFENG_HOST__;
  const owner = window.__HAIFENG_WINDOWS_PAGE_ID__;
  if (window.top !== window || window.location.origin !== "https://tauri.localhost"
    || bridge?.protocol !== "haifeng.host-bridge/3" || typeof owner !== "string" || !/^[a-f0-9]{32}$/.test(owner)) return;
  let closed = false;
  let sequence = 0;
  let generation = null;
  let ready = false;
  let issue = null;
  let request = null;
  let requestId = 0;
  let timeout = null;
  let failure = null;
  let startup = true;
  let trusted = false;
  let suppressed = false;
  let restricted = "not-requested";
  let focusSequence = bridge.readAudio().sequence;
  const changed = () => window.dispatchEvent(new Event("haifeng:host-state"));
  const audio = status => {
    if (focusSequence >= Number.MAX_SAFE_INTEGER) throw new Error("声音许可序号已耗尽，请重开页面");
    bridge.receiveAudio({ format: "haifeng.audio-focus/1", sequence: ++focusSequence, status });
  };
  const send = action => {
    if (closed) return;
    if (request !== null && request.action === action && request.generation === generation) return;
    // Windows holds no exclusive focus lease. Leaving a completed same-page
    // audition need not revoke an already confirmed unchanged output.
    if (action === "release" && trusted && !suppressed && request === null) return;
    if (action === "release") {
      suppressed = true;
      trusted = false;
      restricted = "not-requested";
      audio(restricted);
    }
    if (!ready || generation === null) {
      if (action === "release") return;
      throw new Error("Windows 声音输出尚未就绪，请稍后显式重试。");
    }
    if (requestId >= Number.MAX_SAFE_INTEGER) throw new Error("声音请求标识已耗尽，请重开页面");
    if (timeout !== null) window.clearTimeout(timeout);
    const captured = { id: ++requestId, owner, generation, action };
    request = captured;
    failure = null;
    if (action === "request") {
      // Keep the previous restriction until this exact request is confirmed.
      suppressed = true;
      trusted = false;
      audio(restricted);
    }
    timeout = window.setTimeout(() => {
      if (request !== captured || closed) return;
      request = null;
      timeout = null;
      failure = "等待 Windows 声音确认超时；没有采用迟到许可，请确认设备后显式重试。";
      changed();
    }, 8000);
    changed();
  };
  const driver = Object.freeze({
    protocol: "haifeng.audio-output/1",
    read: () => ({
      supported: sequence > 0, ready, generation,
      pending: request?.id ?? null, issue: failure ?? issue,
    }),
    request: () => send("request"),
    release: () => send("release"),
    readRequest: () => request ? { ...request } : null,
    receive: value => {
      if (closed) return;
      if (!value || typeof value !== "object" || Array.isArray(value)
        || Object.keys(value).sort().join(",") !== "format,generation,issue,ready,requestId,requestOwner,sequence,status"
        || value.format !== "haifeng.audio-output-state/1"
        || !Number.isSafeInteger(value.sequence) || value.sequence < 1
        || !Number.isSafeInteger(value.generation) || value.generation < 1
        || typeof value.ready !== "boolean"
        || !["not-requested", "granted", "interrupted", "denied"].includes(value.status)
        || (value.requestId !== null && (!Number.isSafeInteger(value.requestId) || value.requestId < 1))
        || (value.requestOwner !== null && (typeof value.requestOwner !== "string" || !/^[a-f0-9]{32}$/.test(value.requestOwner)))
        || ((value.requestId === null) !== (value.requestOwner === null))
        || (value.issue !== null && (typeof value.issue !== "string" || value.issue.length > 1024))
        || (!value.ready && value.status !== "not-requested")) {
        throw new Error("Windows 声音输出消息无效");
      }
      if (value.sequence <= sequence || (generation !== null && value.generation < generation)) return;
      const captured = request;
      const confirmed = captured !== null && captured.id === value.requestId && value.requestOwner === owner;
      const exactGrant = confirmed && captured.action === "request" && captured.generation === value.generation
        && value.ready && value.status === "granted" && value.issue === null;
      const initialGrant = startup && value.ready && value.status === "granted" && value.issue === null && !suppressed;
      if (generation !== null && value.generation > generation) trusted = false;
      sequence = value.sequence;
      generation = value.generation;
      ready = value.ready;
      issue = value.issue;
      if (value.status !== "granted") {
        trusted = false;
        restricted = value.status;
      }
      if (exactGrant || initialGrant) {
        trusted = true;
        suppressed = false;
        restricted = "not-requested";
      }
      if (ready) startup = false;
      if (confirmed) {
        request = null;
        if (timeout !== null) window.clearTimeout(timeout);
        timeout = null;
        if (!exactGrant && captured.action === "request") {
          failure = issue ?? "本次声音请求未获准，可静音继续或再次确认设备。";
        } else if (captured.action === "release") {
          suppressed = true;
          trusted = false;
          restricted = "not-requested";
        } else failure = null;
      }
      audio(trusted && !suppressed && value.status === "granted" ? "granted" : restricted);
    },
  });
  Object.defineProperty(window, "__HAIFENG_WINDOWS_AUDIO__", { value: driver, configurable: false, writable: false });
  audio("not-requested");
  window.addEventListener("pagehide", () => {
    closed = true;
    if (timeout !== null) window.clearTimeout(timeout);
    timeout = null;
    request = null;
  }, { once: true });
})();
