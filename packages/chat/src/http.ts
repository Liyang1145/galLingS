import { at, array, knownFields, object, string } from "../../story-model/src/read.ts";
import { ChatError, readChatDestination, readChatEvent } from "./protocol.ts";
import type { ChatCharacter, ChatDestination, ChatEvent, ChatProvider, ChatRequest } from "./protocol.ts";

export interface ChatServiceCharacter extends ChatCharacter {
  /** Explicit service configuration, never "any ending". Not proof of server entitlement. */
  readonly endingIds: readonly string[];
}

export interface ChatServiceInfo {
  readonly format: "haifeng.chat-service/1";
  readonly serviceId: string;
  readonly name: string;
  readonly scopeKinds: readonly ("development" | "game")[];
  readonly characters: readonly ChatServiceCharacter[];
}

const SOURCE = { file: "chat-service", field: "" };
const MAX_FRAME = 65536;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_FRAMES = 32768;

function value(input: unknown, maximum: number, field: string): string {
  const result = string(input, at(SOURCE, field));
  if (!result.trim() || result.length > maximum) throw new ChatError("protocol");
  return result;
}

function readInfo(input: unknown): ChatServiceInfo {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "serviceId", "name", "scopeKinds", "characters"], SOURCE);
  if (data.format !== "haifeng.chat-service/1") throw new ChatError("protocol");
  const kinds = array(data.scopeKinds, at(SOURCE, "scopeKinds")).map((kind): "development" | "game" => {
    if (kind !== "development" && kind !== "game") throw new ChatError("protocol");
    return kind;
  });
  const raw = array(data.characters, at(SOURCE, "characters"));
  if (kinds.length > 2 || new Set(kinds).size !== kinds.length || raw.length > 32) throw new ChatError("protocol");
  const characters = raw.map((item, index): ChatServiceCharacter => {
    const field = `characters.${index}`;
    const character = object(item, at(SOURCE, field));
    knownFields(character, ["id", "revision", "name", "endingIds"], at(SOURCE, field));
    const endings = array(character.endingIds, at(SOURCE, `${field}.endingIds`))
      .map((ending, n) => value(ending, 512, `${field}.endingIds.${n}`));
    if (endings.length > 1024 || new Set(endings).size !== endings.length) throw new ChatError("protocol");
    return Object.freeze({
      id: value(character.id, 128, `${field}.id`),
      revision: value(character.revision, 128, `${field}.revision`),
      name: value(character.name, 128, `${field}.name`), endingIds: Object.freeze(endings),
    });
  });
  if (new Set(characters.map(character => character.id)).size !== characters.length) throw new ChatError("protocol");
  return Object.freeze({
    format: "haifeng.chat-service/1", serviceId: value(data.serviceId, 512, "serviceId"),
    name: value(data.name, 128, "name"), scopeKinds: Object.freeze(kinds), characters: Object.freeze(characters),
  });
}

/** No query credentials, arbitrary path, redirects, cookies, implicit discovery or remote cleartext. */
function serviceOrigin(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new ChatError("unavailable"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local))
      || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new ChatError("unavailable");
  }
  return url.origin;
}

function status(code: number): ChatError {
  if (code === 401 || code === 403) return new ChatError("auth");
  if (code === 402 || code === 429) return new ChatError("quota");
  if (code === 408 || code === 504) return new ChatError("timeout");
  if (code === 409 || code === 422) return new ChatError("context");
  if (code === 413) return new ChatError("limit");
  if (code === 400 || code === 415) return new ChatError("protocol");
  if (code === 503) return new ChatError("unavailable");
  return new ChatError("network");
}

/**
 * Explicit connection to the supplier-independent chat service, NOT a model API.
 * Credential is an in-memory service token; it is never a query, payload, log or saved preference.
 */
export class HttpChatConnection {
  readonly origin: string;
  #token: string;
  #info: ChatServiceInfo | null = null;
  #disposed = false;
  readonly #requests = new Set<AbortController>();

  constructor(origin: string, token: string) {
    this.origin = serviceOrigin(origin);
    if (!/^[A-Za-z0-9_-]{24,256}$/u.test(token)) throw new ChatError("auth");
    this.#token = token;
  }

  private async request<T>(
    path: string, signal: AbortSignal, payload: ChatRequest | undefined,
    read: (response: Response, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.#disposed || signal.aborted) throw new ChatError("cancelled");
    const controller = new AbortController();
    const abort = (): void => controller.abort(signal.reason instanceof ChatError ? signal.reason : new ChatError("cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    this.#requests.add(controller);
    const timer = setTimeout(() => controller.abort(new ChatError("timeout")), payload ? 300000 : 15000);
    let response: Response | null = null;
    try {
      response = await fetch(`${this.origin}${path}`, {
        method: payload ? "POST" : "GET",
        headers: {
          "X-Haifeng-Chat-Token": this.#token,
          Accept: payload ? "application/x-ndjson" : "application/json",
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: controller.signal, redirect: "error", credentials: "omit", cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) {
        // Do not read, display or log arbitrary error bodies.
        await response.body?.cancel().catch(() => {});
        throw status(response.status);
      }
      return await read(response, controller.signal);
    } catch (error: unknown) {
      if (controller.signal.aborted && controller.signal.reason instanceof ChatError) throw controller.signal.reason;
      if (error instanceof ChatError) throw error;
      throw new ChatError("network");
    } finally {
      await response?.body?.cancel().catch(() => {});
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      this.#requests.delete(controller);
    }
  }

  /** Explicit user action only. GET uploads no clear, chat history or character choice. */
  async discover(signal: AbortSignal): Promise<ChatServiceInfo> {
    return this.request("/api/aftergame/info", signal, undefined, async (response, current) => {
      const type = response.headers.get("content-type")?.split(";")[0]?.trim();
      if (type !== "application/json") throw new ChatError("protocol");
      const raw = await readBoundedBody(response, current, 131072);
      if (this.#disposed || current.aborted) throw new ChatError("cancelled");
      try { this.#info = readInfo(JSON.parse(raw)); } catch { throw new ChatError("protocol"); }
      return this.#info;
    });
  }

  /** Character selection remains explicit and is pinned to the discovered revision. */
  provider(characterId: string): ChatProvider {
    if (this.#disposed) throw new ChatError("cancelled");
    const info = this.#info;
    const character = info?.characters.find(item => item.id === characterId);
    if (!info || !character) throw new ChatError("unavailable");
    const destination: ChatDestination = readChatDestination({
      serviceId: `${this.origin}#${info.serviceId}`,
      label: `${info.name} · ${this.origin}`,
      character: { id: character.id, revision: character.revision, name: character.name },
    });
    return Object.freeze({
      destination,
      stream: async (request: ChatRequest, signal: AbortSignal, receive: (event: unknown) => void): Promise<void> => {
        if (request.context.scope.kind === "preview" || !info.scopeKinds.includes(request.context.scope.kind)
            || !character.endingIds.includes(request.context.completion.endingId)
            || request.character.id !== character.id || request.character.revision !== character.revision
            || request.character.name !== character.name) throw new ChatError("context");
        await this.request("/api/aftergame/chat", signal, request, async (response, current) => {
          if (response.headers.get("content-type")?.split(";")[0]?.trim() !== "application/x-ndjson") {
            throw new ChatError("protocol");
          }
          await streamEvents(response, current, receive);
        });
      },
    });
  }

  /** Existing provider closures become unusable too; no storage is involved. */
  dispose(): void {
    this.#disposed = true;
    this.#info = null;
    this.#token = "";
    for (const controller of this.#requests) controller.abort(new ChatError("cancelled"));
    this.#requests.clear();
  }
}

async function consume(
  response: Response, signal: AbortSignal, maximum: number, chunk: (text: string) => void,
): Promise<void> {
  if (!response.body) throw new ChatError("protocol");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const abort = (): void => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  let bytes = 0;
  try {
    if (signal.aborted) throw new ChatError("cancelled");
    while (true) {
      const result = await reader.read();
      if (signal.aborted) throw new ChatError("cancelled");
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maximum) throw new ChatError("limit");
      let decoded: string;
      try { decoded = decoder.decode(result.value, { stream: true }); } catch { throw new ChatError("protocol"); }
      chunk(decoded);
    }
    try { chunk(decoder.decode()); } catch (error: unknown) {
      throw error instanceof ChatError ? error : new ChatError("protocol");
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function readBoundedBody(response: Response, signal: AbortSignal, maximum: number): Promise<string> {
  let result = "";
  await consume(response, signal, maximum, text => { result += text; });
  return result;
}

async function streamEvents(response: Response, signal: AbortSignal, receive: (event: unknown) => void): Promise<void> {
  let buffer = "";
  let frames = 0;
  let terminal = false;
  let sequence = 0;
  let requestId: string | null = null;
  function line(value: string): void {
    if (!value || value.length > MAX_FRAME || terminal || ++frames > MAX_FRAMES) throw new ChatError("protocol");
    let event: ChatEvent;
    try { event = readChatEvent(JSON.parse(value)); } catch { throw new ChatError("protocol"); }
    if (event.sequence !== sequence++ || (requestId !== null && event.requestId !== requestId)) throw new ChatError("protocol");
    requestId = event.requestId;
    terminal = event.type !== "delta";
    receive(event);
  }
  await consume(response, signal, MAX_BYTES, text => {
    buffer += text;
    let end: number;
    while ((end = buffer.indexOf("\n")) !== -1) {
      const value = buffer.slice(0, end).replace(/\r$/u, "");
      buffer = buffer.slice(end + 1);
      line(value);
    }
    if (buffer.length > MAX_FRAME) throw new ChatError("limit");
  });
  // A final newline is part of the wire protocol; a truncated response is not success.
  if (buffer.length || !terminal) throw new ChatError("protocol");
}
