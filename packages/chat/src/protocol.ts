import { readClearedContext } from "../../story-model/src/completion.ts";
import type { ClearedContext } from "../../story-model/src/completion.ts";
import { at, knownFields, numeric, object, reject, string } from "../../story-model/src/read.ts";

/** Resource limits, not a promise about a supplier's context window or price. */
export const CHAT_LIMITS = Object.freeze({
  input: 4000, reply: 16000, delta: 4096, turns: 20, conversation: 64000,
});

export const CHAT_ERROR_CODES = [
  "unavailable", "network", "timeout", "auth", "quota", "busy", "context", "protocol", "limit", "cancelled",
] as const;
export type ChatErrorCode = typeof CHAT_ERROR_CODES[number];

const MESSAGES: Readonly<Record<ChatErrorCode, string>> = Object.freeze({
  unavailable: "聊天服务尚未就绪。",
  network: "聊天连接失败或中断；服务器可能已经处理本次请求。",
  timeout: "聊天请求超时；停止接收不保证服务端停止生成或计费。",
  auth: "聊天服务凭据无效或没有访问权限。",
  quota: "聊天服务额度不足或请求过于频繁。",
  busy: "当前聊天操作尚未结束。",
  context: "所选通关事实无法重新确认，请重新选择通关记录。",
  protocol: "聊天服务返回了不支持或不完整的数据。",
  limit: "聊天内容达到本会话容量上限，请开始独立的新聊天。",
  cancelled: "已停止接收；停止不保证服务端停止生成或计费。",
});

/** Never include remote bodies, credentials or arbitrary provider exception messages. */
export class ChatError extends Error {
  readonly code: ChatErrorCode;
  constructor(code: ChatErrorCode) {
    super(MESSAGES[code]);
    this.name = "ChatError";
    this.code = code;
  }
}

export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface ChatCharacter {
  readonly id: string;
  readonly revision: string;
  readonly name: string;
}

/** A binding supplied by the application, not an unlock rule or a model credential. */
export interface ChatDestination {
  readonly serviceId: string;
  readonly label: string;
  readonly character: ChatCharacter;
}

export interface ChatRequest {
  readonly format: "haifeng.chat-request/1";
  readonly requestId: string;
  readonly conversationId: string;
  readonly character: ChatCharacter;
  readonly context: ClearedContext;
  readonly messages: readonly ChatMessage[];
}

interface EventBase {
  readonly format: "haifeng.chat-event/1";
  readonly requestId: string;
  readonly sequence: number;
}

export type ChatEvent = EventBase & (
  | { readonly type: "delta"; readonly text: string }
  | { readonly type: "done" }
  | { readonly type: "error"; readonly code: ChatErrorCode }
);

/** A provider gets a frozen request, cancellation and text events only. No game or tool capability. */
export interface ChatProvider {
  readonly destination: ChatDestination;
  stream(request: ChatRequest, signal: AbortSignal, receive: (event: unknown) => void): Promise<void>;
}

const SOURCE = { file: "chat-protocol", field: "" };

function text(input: unknown, maximum: number, field: string): string {
  const value = string(input, at(SOURCE, field));
  if (!value.trim() || value.length > maximum) reject("CHAT_TEXT", `需要非空且不超过 ${maximum} 字符的文字`, at(SOURCE, field));
  return value;
}

export function readChatDestination(input: unknown): ChatDestination {
  const data = object(input, SOURCE);
  knownFields(data, ["serviceId", "label", "character"], SOURCE);
  const character = object(data.character, at(SOURCE, "character"));
  knownFields(character, ["id", "revision", "name"], at(SOURCE, "character"));
  return Object.freeze({
    serviceId: text(data.serviceId, 512, "serviceId"), label: text(data.label, 256, "label"),
    character: Object.freeze({
      id: text(character.id, 128, "character.id"),
      revision: text(character.revision, 128, "character.revision"),
      name: text(character.name, 128, "character.name"),
    }),
  });
}

export function readChatInput(input: unknown): string {
  return text(input, CHAT_LIMITS.input, "input");
}

/** Builds a detached, deeply immutable, minimum upload payload. No system/tool roles. */
export function chatRequest(
  requestId: string, conversationId: string, destination: ChatDestination,
  context: ClearedContext, messages: readonly ChatMessage[],
): ChatRequest {
  if (messages.length < 1 || messages.length > CHAT_LIMITS.turns * 2 - 1 || messages.length % 2 !== 1) {
    throw new ChatError("limit");
  }
  let length = 0;
  const copy = messages.map((message, index): ChatMessage => {
    const role = index % 2 === 0 ? "user" : "assistant";
    if (message.role !== role) throw new ChatError("protocol");
    const value = text(message.text, role === "user" ? CHAT_LIMITS.input : CHAT_LIMITS.reply, `messages.${index}.text`);
    length += value.length;
    return Object.freeze({ role, text: value });
  });
  // Reserve space for the entire next reply. Never silently truncate an old turn.
  if (length + CHAT_LIMITS.reply > CHAT_LIMITS.conversation) throw new ChatError("limit");
  const cleared = readClearedContext(context);
  if (cleared.scope.kind === "preview") throw new ChatError("context");
  return Object.freeze({
    format: "haifeng.chat-request/1", requestId: text(requestId, 128, "requestId"),
    conversationId: text(conversationId, 128, "conversationId"), character: destination.character,
    context: cleared, messages: Object.freeze(copy),
  });
}

/** Only displayable text and terminal status cross this boundary. Unknown actions are errors. */
export function readChatEvent(input: unknown): ChatEvent {
  const data = object(input, SOURCE);
  if (data.format !== "haifeng.chat-event/1") throw new ChatError("protocol");
  const fields = ["format", "requestId", "sequence", "type"];
  if (data.type === "delta") fields.push("text");
  else if (data.type === "error") fields.push("code");
  else if (data.type !== "done") throw new ChatError("protocol");
  knownFields(data, fields, SOURCE);
  const sequence = numeric(data.sequence, at(SOURCE, "sequence"));
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new ChatError("protocol");
  const base = {
    format: "haifeng.chat-event/1" as const, requestId: text(data.requestId, 128, "requestId"), sequence,
  };
  if (data.type === "delta") {
    const delta = string(data.text, at(SOURCE, "text"));
    if (!delta.length || delta.length > CHAT_LIMITS.delta) throw new ChatError("protocol");
    return Object.freeze({ ...base, type: "delta", text: delta });
  }
  if (data.type === "error") {
    if (!CHAT_ERROR_CODES.includes(data.code as ChatErrorCode)) throw new ChatError("protocol");
    return Object.freeze({ ...base, type: "error", code: data.code as ChatErrorCode });
  }
  return Object.freeze({ ...base, type: "done" });
}
