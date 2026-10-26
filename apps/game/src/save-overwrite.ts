import type { SaveTargetState } from "../../../packages/player/src/saves.ts";

interface Request {
  entryLabel: string;
  target: Extract<SaveTargetState, { kind: "occupied" }>;
  nodeId: string;
  savedAt: number;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}

/** One inline prompt in the original save panel. No repository, checkpoint or write capability. */
export class SaveOverwritePrompt {
  readonly #root: HTMLElement;
  readonly #fallback: HTMLElement;
  #pending: { cancel(): void } | null = null;
  #closed = false;

  constructor(root: HTMLElement, fallback: HTMLElement) {
    this.#root = root;
    this.#fallback = fallback;
    root.hidden = true;
  }

  ask(request: Request, signal: AbortSignal): Promise<boolean> {
    if (this.#closed || signal.aborted) return Promise.resolve(false);
    if (this.#pending) return Promise.reject(new Error("已有原槽位覆盖确认，请先完成或取消"));
    const heading = text("h4", "覆盖这个存档？");
    heading.id = `${this.#root.id}-heading`;
    const target = text("p", `${request.entryLabel} · 槽位 ${JSON.stringify(request.target.slotId)}`);
    target.id = `${this.#root.id}-target`;
    target.className = "save-overwrite-target";
    const { summary } = request.target;
    const previous = text("p", summary.kind === "readable"
      ? `原进度：${summary.chapter || "未标注章节"} · ${new Date(summary.savedAt).toLocaleString()} · 节点 ${summary.nodeId}`
      : `该名称下已有记录，但无法读取：${summary.code}：${summary.message}`);
    previous.id = `${this.#root.id}-previous`;
    const excerpt = text("p", summary.kind === "readable"
      ? `${summary.speaker ? `${summary.speaker}：` : ""}${summary.text.slice(0, 160) || "演出节点"}${summary.text.length > 160 ? "…" : ""}`
      : "原记录仍保留；确认覆盖将用本次进度替换它。");
    excerpt.className = "save-overwrite-excerpt";
    const replacement = text("p", `本次进度：节点 ${request.nodeId} · ${new Date(request.savedAt).toLocaleString()}`);
    replacement.id = `${this.#root.id}-replacement`;
    const note = text("p", "确认后替换这个名称下的剧情进度；周目、结局和鉴赏成果分别保留。");
    const actions = document.createElement("div");
    actions.className = "controls save-overwrite-actions";
    const cancel = text("button", "取消这次保存");
    const confirm = text("button", "确认覆盖原槽位");
    cancel.type = confirm.type = "button";
    for (const button of [cancel, confirm]) {
      button.setAttribute("aria-describedby", `${target.id} ${previous.id} ${replacement.id}`);
    }
    actions.append(cancel, confirm);
    return new Promise(resolve => {
      const events = new AbortController();
      const finish = (accepted: boolean): void => {
        if (this.#pending !== pending) return;
        this.#pending = null;
        events.abort();
        resolve(accepted);
        const ownedFocus = this.#root.contains(document.activeElement);
        try {
          this.#root.hidden = true;
          this.#root.replaceChildren();
          if (ownedFocus && this.#fallback.isConnected && this.#fallback.getClientRects().length
            && !this.#fallback.closest("[inert]")) this.#fallback.focus({ preventScroll: true });
        } catch { /* Presentation cleanup cannot change the already settled explicit choice. */ }
      };
      const pending = { cancel: (): void => finish(false) };
      this.#pending = pending;
      cancel.addEventListener("click", () => finish(false), { signal: events.signal });
      confirm.addEventListener("click", () => finish(!signal.aborted), { signal: events.signal });
      signal.addEventListener("abort", pending.cancel, { signal: events.signal, once: true });
      try {
        this.#root.setAttribute("role", "group");
        this.#root.setAttribute("aria-labelledby", heading.id);
        this.#root.replaceChildren(heading, target, previous, excerpt, replacement, note, actions);
        this.#root.hidden = false;
        // Enter on arrival must not default to replacement; keyboard focus starts on cancellation.
        cancel.focus();
      } catch {
        // A presentation failure never becomes replacement consent.
        finish(false);
      }
    });
  }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#pending?.cancel();
    this.#root.hidden = true;
    this.#root.replaceChildren();
  }
}
