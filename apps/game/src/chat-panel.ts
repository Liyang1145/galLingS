import type { CompletionReference } from "../../../packages/story-model/src/completion.ts";
import type { ClearedContextReader } from "../../../packages/chat/src/context.ts";
import { HttpChatConnection } from "../../../packages/chat/src/http.ts";
import type { ChatServiceInfo } from "../../../packages/chat/src/http.ts";
import { ChatError } from "../../../packages/chat/src/protocol.ts";
import { ChatSession } from "../../../packages/chat/src/session.ts";
import type { ChatView } from "../../../packages/chat/src/session.ts";

export interface ChatPanel {
  dispose(): void;
}

/** Development-only assembly; never gets a story session, record writer or host bridge. */
export function createChatPanel(
  root: HTMLElement, reader: ClearedContextReader, selected: CompletionReference,
): ChatPanel {
  const events = new AbortController();
  const { signal } = events;
  let disposed = false;
  let generation = 0;
  let connecting: AbortController | null = null;
  let connection: HttpChatConnection | null = null;
  let info: ChatServiceInfo | null = null;
  let session: ChatSession | null = null;
  let unsubscribe: (() => void) | null = null;

  function paragraph(text: string, className = "help"): HTMLParagraphElement {
    const element = document.createElement("p");
    element.className = className;
    element.textContent = text;
    return element;
  }

  function button(text: string): HTMLButtonElement {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = text;
    return element;
  }

  function labelled(text: string, control: HTMLElement): HTMLLabelElement {
    const element = document.createElement("label");
    element.append(document.createTextNode(text), control);
    return element;
  }

  const heading = document.createElement("h3");
  heading.textContent = "Agent 基础 · 独立聊天开发试用";
  const explanation = paragraph(
    "本入口不是正式解锁。连接只读取服务目录，不发送通关事实；每轮发送前另行展示并确认上传内容。"
    + "只有本页聊天，不落盘、不载入旧聊天或主线存档。关闭或切换通关记录会清空本页聊天。",
  );
  const origin = document.createElement("input");
  origin.type = "url";
  origin.placeholder = "显式填写独立聊天服务的源（协议、主机、端口）";
  origin.autocomplete = "off";
  const token = document.createElement("input");
  token.type = "password";
  token.autocomplete = "off";
  token.spellcheck = false;
  token.maxLength = 256;
  const connect = button("连接并读取角色目录");
  const disconnect = button("断开并清空本页聊天");
  disconnect.disabled = true;
  const status = paragraph("未连接。无需配置聊天，也可返回主页继续离线主线。");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const characters = document.createElement("select");
  characters.setAttribute("aria-label", "显式选择聊天角色");
  const newChat = button("清空本页聊天并新建");
  const transcript = document.createElement("section");
  transcript.className = "chat-transcript";
  transcript.setAttribute("aria-label", "本页独立聊天");
  const input = document.createElement("textarea");
  input.rows = 4;
  input.maxLength = 4000;
  input.spellcheck = false;
  const prepare = button("准备发送并查看上传内容");
  const stop = button("停止接收 / 取消准备");
  const disclosure = document.createElement("section");
  disclosure.className = "chat-disclosure";
  disclosure.setAttribute("aria-label", "本次发送确认");
  const controls = document.createElement("div");
  controls.className = "chat-actions";
  controls.append(connect, disconnect);
  const actions = document.createElement("div");
  actions.className = "chat-actions";
  actions.append(prepare, stop, newChat);
  root.replaceChildren(
    heading, explanation, labelled("独立聊天服务地址（不是模型 API）", origin),
    labelled("独立服务令牌（不是模型密钥，仅留内存）", token), controls, status,
    labelled("服务为当前结局明确配置的角色", characters), transcript,
    labelled("输入消息", input), actions, disclosure,
    paragraph("网络中断、超时或停止后，服务端仍可能已处理或计费；不自动重连、续流或重发。"
      + "需要重试时，重新准备并确认一笔新请求。失败或停止的片段不会作为后续完整回复发送。"),
  );

  function clearSession(): void {
    unsubscribe?.();
    unsubscribe = null;
    session?.dispose();
    session = null;
    input.value = "";
    transcript.replaceChildren();
    disclosure.replaceChildren();
    input.disabled = prepare.disabled = stop.disabled = true;
    newChat.disabled = !connection || !characters.value;
  }

  function clearConnection(): void {
    ++generation;
    connecting?.abort();
    connecting = null;
    clearSession();
    connection?.dispose();
    connection = null;
    info = null;
    characters.replaceChildren(new Option("请先连接并读取角色目录", ""));
    characters.disabled = true;
    disconnect.disabled = newChat.disabled = true;
    connect.disabled = false;
  }

  function render(owner: ChatSession, view: ChatView): void {
    if (disposed || session !== owner) return;
    const busy = view.phase === "sending" || view.phase === "preparing";
    input.disabled = busy || view.phase === "confirmation";
    prepare.disabled = busy || view.phase === "confirmation" || !input.value.trim();
    stop.disabled = !busy && view.phase !== "confirmation";
    transcript.replaceChildren();
    for (const turn of view.turns) {
      const card = document.createElement("article");
      card.className = "chat-turn";
      const user = paragraph("你", "chat-speaker");
      const message = paragraph(turn.input, "chat-text");
      const speaker = paragraph(view.destination.character.name, "chat-speaker");
      const reply = paragraph(turn.reply || (turn.status === "sending" ? "正在等待回复……" : "没有完整回复。"), "chat-text");
      const state = paragraph(
        turn.status === "complete" ? "回复完成" : turn.status === "sending" ? "接收中"
          : `${turn.status === "cancelled" ? "已停止" : "本轮失败"} · ${turn.error ? new ChatError(turn.error).message : ""}`,
      );
      card.append(user, message, speaker, reply, state);
      transcript.append(card);
    }
    disclosure.replaceChildren();
    const request = view.confirmation;
    if (request) {
      const title = document.createElement("h4");
      title.textContent = "确认后才上传";
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "查看将发送的完整载荷（不含服务令牌）";
      const json = document.createElement("pre");
      json.textContent = JSON.stringify(request, null, 2);
      details.append(summary, json);
      const confirm = button("我确认上传并发起本轮请求");
      const cancel = button("不发送，返回编辑");
      confirm.addEventListener("click", () => {
        // Re-check the exact session and single-use request, never whatever is selected later.
        if (session !== owner || disposed) return;
        void owner.confirm(request.requestId).catch(() => {
          if (session === owner && !disposed) status.textContent = "发送确认已失效，请重新准备。没有自动重发。";
        });
      }, { signal });
      cancel.addEventListener("click", () => { if (session === owner) owner.cancel(); }, { signal });
      const buttons = document.createElement("div");
      buttons.className = "chat-actions";
      buttons.append(confirm, cancel);
      disclosure.append(
        title, paragraph(`目的地：${view.destination.label}；角色：${request.character.name}（${request.character.revision}）。`),
        paragraph(`上传所选结局事实、当前内容引用、本会话的 ${request.messages.length - 1} 条完整历史消息和本次输入。`
          + "不上传整份存档、路线变量、CG、主线回看或模型密钥。独立服务会将上下文和对话交给配置的模型；"
          + "模型处理、保存与计费依所选供应方式而定，本入口不承诺免费或远程删除。"),
        details, buttons,
      );
    }
    status.textContent = view.error ? new ChatError(view.error).message
      : view.phase === "preparing" ? "正在重新确认已提交通关事实，尚未上传……"
      : view.phase === "sending" ? "本轮请求进行中；切换或离开会停止接收。"
      : view.phase === "confirmation" ? "请查看本次上传范围，再明确确认。"
      : "独立会话就绪。每轮都需准备和确认；当前只有结局事实，没有当次路线历史。";
  }

  function startChat(): void {
    clearSession();
    const characterId = characters.value;
    if (!connection || !characterId || disposed) return;
    try {
      const owner = new ChatSession(reader, selected, connection.provider(characterId));
      session = owner;
      newChat.disabled = false;
      unsubscribe = owner.subscribe(view => render(owner, view));
    } catch {
      status.textContent = "角色目录或连接已失效，请重新连接。";
    }
  }

  connect.addEventListener("click", () => {
    clearConnection();
    const request = generation;
    let candidate: HttpChatConnection;
    try { candidate = new HttpChatConnection(origin.value.trim(), token.value); } catch (error: unknown) {
      status.textContent = error instanceof ChatError ? error.message : "连接配置不符。";
      return;
    } finally { token.value = ""; }
    connection = candidate;
    const controller = new AbortController();
    connecting = controller;
    connect.disabled = true;
    disconnect.disabled = false;
    status.textContent = "正在读取角色目录；没有发送通关事实或对白……";
    void candidate.discover(controller.signal).then(result => {
      if (disposed || request !== generation || connection !== candidate) return;
      info = result;
      characters.replaceChildren(new Option("请明确选择一个角色", ""));
      const available = info.scopeKinds.includes("development")
        ? info.characters.filter(character => character.endingIds.includes(selected.endingId)) : [];
      for (const character of available) characters.add(new Option(character.name, character.id));
      characters.disabled = !available.length;
      status.textContent = available.length
        ? `已连接 ${info.name}。请选择角色，不会自动合并其他通关记录。`
        : "服务未为这条开发结局配置角色。没有默认放行任意结局，也没有发送聊天。";
    }).catch((error: unknown) => {
      if (disposed || request !== generation) return;
      clearConnection();
      status.textContent = error instanceof ChatError ? error.message : "聊天连接未能建立。";
    }).finally(() => {
      if (!disposed && request === generation) { connecting = null; connect.disabled = false; }
    });
  }, { signal });
  disconnect.addEventListener("click", () => {
    clearConnection();
    token.value = "";
    status.textContent = "已断开并清空本页聊天；没有删除主线记录或服务端数据。";
  }, { signal });
  for (const field of [origin, token]) field.addEventListener("input", () => {
    if (connection || connecting) {
      clearConnection();
      status.textContent = "连接配置已变更，原请求和确认已取消；请显式重新连接。";
    }
  }, { signal });
  characters.addEventListener("change", startChat, { signal });
  newChat.addEventListener("click", startChat, { signal });
  input.addEventListener("input", () => {
    if (session) render(session, session.view());
  }, { signal });
  prepare.addEventListener("click", () => {
    const owner = session;
    if (!owner) return;
    void owner.prepare(input.value).catch((error: unknown) => {
      if (session === owner && !disposed) status.textContent = error instanceof ChatError ? error.message : "输入为空或超过本次容量。";
    });
  }, { signal });
  stop.addEventListener("click", () => session?.cancel(), { signal });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) session?.cancel();
  }, { signal });
  clearConnection();
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearConnection();
      token.value = origin.value = input.value = "";
      events.abort();
      root.replaceChildren();
    },
  };
}
