// Explicit native trial initialization only. No filesystem paths, domain merges or story commands.
((enabled, workId, platform) => {
  const origin = platform === "windows-trial" ? "https://tauri.localhost"
    : platform === "android-trial" ? "https://appassets.androidplatform.net" : null;
  if (!origin || window.top !== window || window.location.origin !== origin) return;
  Object.defineProperty(window, "__HAIFENG_RECORD_MODE__", {
    configurable: false, writable: false, value: enabled ? "native-files" : "indexeddb",
  });
  if (!enabled) return;
  const protocol = "haifeng.native-records/1";
  let owner = null;
  try { owner = crypto.randomUUID(); } catch { /* Selected storage must fail visibly, never fall back. */ }
  let nextId = 0;
  let head = null;
  let queue = [];
  let registered = false;
  let closed = false;
  let issue = owner ? null : "无法创建原生记录页面身份，请重开宿主。";
  const changed = () => window.dispatchEvent(new Event("haifeng:records-state"));
  const fields = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === keys;
  const fail = (message, code = "NATIVE_STORAGE_CHANNEL") => Object.assign(new Error(message), { code });
  const start = () => {
    if (closed || head || !queue.length) return;
    head = queue.shift();
    const current = head;
    current.timer = window.setTimeout(() => {
      if (closed || head !== current) return;
      current.expired = true;
      issue = "等待原生记录回执超时，提交状态未确认；等待原回执前不会发送后续操作。";
      current.reject(fail(issue, "NATIVE_STORAGE_UNCONFIRMED"));
      for (const waiting of queue) waiting.reject(fail("原生记录通道等待原回执，本次排队操作尚未发送。"));
      queue = [];
      changed();
    }, 12000);
    changed();
  };
  const bridge = Object.freeze({
    protocol,
    read: () => ({ protocol, workId, owner, pending: head?.id ?? null, issue }),
    ready: (expectedProtocol, expectedWork) => {
      if (closed || !owner || expectedProtocol !== protocol || expectedWork !== workId) {
        throw fail("原生记录能力与当前页面不匹配。");
      }
      registered = true;
    },
    request: operation => {
      if (closed || !registered || !owner) return Promise.reject(fail("原生记录页面尚未就绪或已经离开。"));
      if (head?.expired) return Promise.reject(fail("原写入回执仍未确认，请等待后查看原记录，不会另开存储来源。", "NATIVE_STORAGE_UNCONFIRMED"));
      const keys = operation?.op === "read" ? "key,op" : operation?.op === "scan" ? "after,limit,op,prefix"
        : operation?.op === "replace" ? "key,op,value" : operation?.op === "cas" ? "expected,key,op,value" : "";
      if (!keys || !fields(operation, keys)
        || (operation.op === "scan"
          ? typeof operation.prefix !== "string" || (operation.after !== null && typeof operation.after !== "string")
            || !Number.isSafeInteger(operation.limit) || operation.limit < 1 || operation.limit > 100
          : typeof operation.key !== "string" || operation.key.length > 4096)
        || (operation.op === "cas" && (!Number.isSafeInteger(operation.expected) || operation.expected < 0))) {
        return Promise.reject(fail("原生记录操作格式无效。"));
      }
      if (queue.length >= 32 || nextId >= Number.MAX_SAFE_INTEGER) return Promise.reject(fail("原生记录队列或请求身份已达上限。"));
      const id = ++nextId;
      let json;
      try {
        json = JSON.stringify({ format: "haifeng.native-record-request/1", owner, id, workId, operation });
        if (new TextEncoder().encode(json).byteLength > 3 * 1024 * 1024) throw fail("原生记录请求超过容量。");
      } catch (error) { return Promise.reject(error); }
      issue = null;
      return new Promise((resolve, reject) => {
        queue.push({ id, json, resolve, reject, timer: null, expired: false });
        start();
      });
    },
    // The host repeats this same immutable request until receive() acknowledges its receipt.
    readRequest: () => !closed && registered && head ? head.json : null,
    receive: response => {
      if (closed || !head) return false;
      // A repeated/late receipt for an older head must not mark the current operation as failed.
      if (!response || typeof response !== "object" || Array.isArray(response)
        || response.owner !== owner || response.id !== head.id) return false;
      if (!fields(response, response?.ok === true ? "format,id,ok,owner,result,warnings" : "error,format,id,ok,owner,warnings")
        || response.format !== "haifeng.native-record-reply/1"
        || typeof response.ok !== "boolean" || !Array.isArray(response.warnings) || response.warnings.length > 16
        || response.warnings.some(message => typeof message !== "string" || message.length > 1024)
        || (!response.ok && (!fields(response.error, "code,message") || typeof response.error.code !== "string"
          || response.error.code.length > 128 || typeof response.error.message !== "string" || response.error.message.length > 2048))) {
        issue = "原生记录回执格式或归属无效，仍等待本次原回执。";
        changed();
        return false;
      }
      const current = head;
      head = null;
      window.clearTimeout(current.timer);
      issue = current.expired ? "原回执已返回；此前操作已报告超时，请查看原记录或显式重试。" : null;
      if (!current.expired) {
        if (response.ok) current.resolve({ result: response.result, warnings: response.warnings });
        else current.reject(fail(`${response.error.code}：${response.error.message}`, response.error.code));
      }
      changed();
      start();
      return true;
    },
  });
  Object.defineProperty(window, "__HAIFENG_RECORDS__", { configurable: false, writable: false, value: bridge });
  window.addEventListener("pagehide", () => {
    closed = true;
    if (head) {
      window.clearTimeout(head.timer);
      head.reject(fail("页面已离开，已经开始的原生写入仍可能完成。", "NATIVE_STORAGE_UNCONFIRMED"));
    }
    for (const waiting of queue) waiting.reject(fail("页面已离开，本次排队操作尚未发送。"));
    head = null;
    queue = [];
  }, { once: true });
})(__HAIFENG_FILE_RECORDS__, __HAIFENG_RECORD_WORK__, "__HAIFENG_RECORD_PLATFORM__");
