import type { CompletionReference } from "../../story-model/src/completion.ts";
import type { ClearedContextReader } from "./context.ts";
import { CHAT_LIMITS, ChatError, chatRequest, readChatDestination, readChatEvent, readChatInput } from "./protocol.ts";
import type { ChatDestination, ChatErrorCode, ChatMessage, ChatProvider, ChatRequest } from "./protocol.ts";

export interface ChatTurn {
  readonly requestId: string;
  readonly input: string;
  readonly reply: string;
  readonly status: "sending" | "complete" | "failed" | "cancelled";
  readonly error: ChatErrorCode | null;
}

export interface ChatView {
  readonly phase: "idle" | "preparing" | "confirmation" | "sending" | "failed" | "cancelled" | "disposed";
  readonly destination: ChatDestination;
  readonly turns: readonly ChatTurn[];
  /** Exact proposed upload. Creating it does not call the provider. */
  readonly confirmation: ChatRequest | null;
  readonly error: ChatErrorCode | null;
}

interface Active {
  readonly epoch: number;
  readonly controller: AbortController;
  readonly request: ChatRequest;
  sequence: number;
  terminal: boolean;
  reply: string;
}

/**
 * One conversation = one explicitly selected clear + one destination + one character revision.
 * Lifetime-only memory. No mainline writes, automatic retry, fallback provider or tools.
 */
export class ChatSession {
  readonly #reader: ClearedContextReader;
  readonly #selection: CompletionReference;
  readonly #provider: ChatProvider;
  readonly #destination: ChatDestination;
  readonly #conversationId: string;
  readonly #timeoutMs: number;
  readonly #listeners = new Set<(view: ChatView) => void>();
  #phase: ChatView["phase"] = "idle";
  #turns: readonly ChatTurn[] = Object.freeze([]);
  #pending: ChatRequest | null = null;
  #active: Active | null = null;
  #error: ChatErrorCode | null = null;
  #epoch = 0;

  constructor(
    reader: ClearedContextReader, selection: CompletionReference, provider: ChatProvider,
    options: { readonly timeoutMs?: number } = {},
  ) {
    this.#reader = reader;
    this.#selection = Object.freeze({ factId: selection.factId, endingId: selection.endingId });
    this.#provider = provider;
    this.#destination = readChatDestination(provider.destination);
    this.#conversationId = crypto.randomUUID();
    this.#timeoutMs = options.timeoutMs ?? 60000;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 1000 || this.#timeoutMs > 300000) {
      throw new ChatError("protocol");
    }
  }

  view(): ChatView {
    return Object.freeze({
      phase: this.#phase, destination: this.#destination, turns: this.#turns,
      confirmation: this.#pending, error: this.#error,
    });
  }

  subscribe(listener: (view: ChatView) => void): () => void {
    this.assertLive();
    this.#listeners.add(listener);
    this.notify(listener);
    return () => { this.#listeners.delete(listener); };
  }

  private notify(listener: (view: ChatView) => void): void {
    // A display failure cannot turn a completed request into a retry or mutate conversation history.
    try { listener(this.view()); } catch { /* Display owns its own diagnostics; never log chat text. */ }
  }

  private publish(): void {
    for (const listener of this.#listeners) this.notify(listener);
  }

  private assertLive(): void {
    if (this.#phase === "disposed") throw new ChatError("cancelled");
  }

  private current(active: Active): boolean {
    return this.#active === active && active.epoch === this.#epoch && this.#phase === "sending";
  }

  /** Explicit disclosure preparation; re-reads real committed facts, with no network side effect. */
  async prepare(input: unknown): Promise<ChatRequest | null> {
    this.assertLive();
    if (this.#phase === "sending" || this.#phase === "preparing") throw new ChatError("busy");
    const value = readChatInput(input);
    if (this.#turns.length >= CHAT_LIMITS.turns) throw new ChatError("limit");
    const epoch = ++this.#epoch;
    this.#pending = null;
    this.#error = null;
    this.#phase = "preparing";
    this.publish();
    try {
      const context = await this.#reader.read(this.#selection);
      if (epoch !== this.#epoch) return null;
      const history: ChatMessage[] = [];
      for (const turn of this.#turns) {
        if (turn.status !== "complete") continue;
        history.push({ role: "user", text: turn.input }, { role: "assistant", text: turn.reply });
      }
      history.push({ role: "user", text: value });
      const request = chatRequest(crypto.randomUUID(), this.#conversationId, this.#destination, context, history);
      this.#pending = request;
      this.#phase = "confirmation";
      this.publish();
      return request;
    } catch (error: unknown) {
      if (epoch !== this.#epoch) return null;
      this.#phase = "failed";
      this.#error = error instanceof ChatError ? error.code : "context";
      this.publish();
      return null;
    }
  }

  /**
   * Adopt only the exact disclosed request. Confirmation is single-use.
   * A retry is a NEW preparation/confirmation/request ID, never an implicit replay.
   */
  async confirm(requestId: string): Promise<void> {
    this.assertLive();
    const request = this.#pending;
    if (!request || request.requestId !== requestId || this.#phase !== "confirmation") throw new ChatError("context");
    const input = request.messages.at(-1);
    if (!input) throw new ChatError("protocol");
    this.#pending = null;
    this.#phase = "sending";
    this.#error = null;
    const active: Active = {
      epoch: ++this.#epoch, controller: new AbortController(), request, sequence: 0, terminal: false, reply: "",
    };
    this.#active = active;
    this.#turns = Object.freeze([...this.#turns, Object.freeze({
      requestId: request.requestId, input: input.text,
      reply: "", status: "sending", error: null,
    } satisfies ChatTurn)]);
    // Includes the post-confirmation committed-fact read and the whole stream.
    const timer = setTimeout(() => active.controller.abort(new ChatError("timeout")), this.#timeoutMs);
    let abortListener: () => void = () => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      abortListener = () => reject(active.controller.signal.reason);
      active.controller.signal.addEventListener("abort", abortListener, { once: true });
    });
    this.publish();
    try {
      await Promise.race([this.execute(active), aborted]);
      if (!this.current(active)) return;
      if (!active.terminal || !active.reply.trim()) throw new ChatError("protocol");
      this.finish(active, "complete", null);
    } catch (error: unknown) {
      if (!this.current(active)) return;
      const code = error instanceof ChatError ? error.code : "network";
      this.finish(active, code === "cancelled" ? "cancelled" : "failed", code);
    } finally {
      clearTimeout(timer);
      active.controller.signal.removeEventListener("abort", abortListener);
    }
  }

  private async execute(active: Active): Promise<void> {
    const context = await this.#reader.read(this.#selection).catch(() => { throw new ChatError("context"); });
    if (!this.current(active) || active.controller.signal.aborted) return;
    // A confirmation cannot adopt a different source/scope, even if an application swaps readers.
    if (JSON.stringify(context) !== JSON.stringify(active.request.context)) throw new ChatError("context");
    const destination = readChatDestination(this.#provider.destination);
    if (JSON.stringify(destination) !== JSON.stringify(this.#destination)) throw new ChatError("context");
    await this.#provider.stream(active.request, active.controller.signal, value => {
      if (!this.current(active) || active.controller.signal.aborted) return;
      try {
        const event = readChatEvent(value);
        if (event.requestId !== active.request.requestId || event.sequence !== active.sequence || active.terminal) {
          throw new ChatError("protocol");
        }
        ++active.sequence;
        if (event.type === "error") throw new ChatError(event.code);
        if (event.type === "done") { active.terminal = true; return; }
        if (active.reply.length + event.text.length > CHAT_LIMITS.reply) throw new ChatError("limit");
        active.reply += event.text;
        this.replaceTurn(active, "sending", null);
        this.publish();
      } catch (error: unknown) {
        // Latch protocol failures even if a broken provider swallows callback exceptions.
        const failure = error instanceof ChatError ? error : new ChatError("protocol");
        active.controller.abort(failure);
        throw failure;
      }
    });
    if (active.controller.signal.aborted) throw active.controller.signal.reason;
  }

  private replaceTurn(active: Active, status: ChatTurn["status"], error: ChatErrorCode | null): void {
    this.#turns = Object.freeze(this.#turns.map(turn => turn.requestId !== active.request.requestId ? turn : Object.freeze({
      requestId: turn.requestId, input: turn.input, reply: active.reply, status, error,
    })));
  }

  private finish(active: Active, status: "complete" | "failed" | "cancelled", error: ChatErrorCode | null): void {
    this.replaceTurn(active, status, error);
    this.#active = null;
    ++this.#epoch;
    this.#phase = status === "complete" ? "idle" : status;
    this.#error = error;
    active.controller.abort(new ChatError("cancelled"));
    this.publish();
  }

  /** Cancels both pending disclosure and in-flight reads/streams; late callbacks are inert. */
  cancel(): void {
    if (this.#phase === "disposed") return;
    const active = this.#active;
    if (active) {
      this.finish(active, "cancelled", "cancelled");
      return;
    }
    ++this.#epoch;
    this.#pending = null;
    this.#phase = "idle";
    this.#error = null;
    this.publish();
  }

  /** Context/character/service changes must dispose and create another independent instance. */
  dispose(): void {
    if (this.#phase === "disposed") return;
    const active = this.#active;
    this.#active = null;
    ++this.#epoch;
    this.#pending = null;
    this.#turns = Object.freeze([]);
    this.#phase = "disposed";
    this.#error = null;
    active?.controller.abort(new ChatError("cancelled"));
    this.publish();
    this.#listeners.clear();
  }
}
