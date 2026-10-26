import type { SessionToken, SessionView } from "../session.ts";

/** Only committed summaries may describe saved achievements; the panel never reads or writes records. */
export type EndingRecordState =
  | { kind: "pending" }
  | { kind: "failed"; message: string }
  | { kind: "committed"; unlocked: number; total: number }
  | { kind: "preview"; message: string }
  | { kind: "unknown" };

interface Options {
  leaveLabel: string;
  leave(token: SessionToken): void;
  retry?(token: SessionToken): void;
}

/** Shared terminal view only. The session owns endings; the application owns persistence and leaving. */
export class EndingPanel {
  readonly #root = document.createElement("section");
  readonly #options: Options;
  #key = "";
  #events: AbortController | null = null;
  #status: HTMLParagraphElement | null = null;
  #leave: HTMLButtonElement | null = null;
  #retry: HTMLButtonElement | null = null;
  #closed = false;

  constructor(stage: HTMLElement, options: Options) {
    this.#options = options;
    this.#root.className = "ending-panel";
    this.#root.setAttribute("aria-label", "剧情结束");
    this.#root.hidden = true;
    stage.append(this.#root);
  }

  render(view: SessionView, record: EndingRecordState, blocked = false): void {
    if (this.#closed) return;
    const { story, token } = view;
    if (view.disposed || story.phase !== "ended" || !story.terminal) {
      if (this.#key) this.clear();
      return;
    }
    const key = JSON.stringify([token, story.terminal]);
    if (this.#key !== key) {
      this.clear();
      this.#key = key;
      this.#events = new AbortController();
      const { signal } = this.#events;
      const originalToken = { ...token };
      const content = document.createElement("div");
      content.className = "ending-content";
      const heading = document.createElement("h2");
      heading.textContent = story.terminal.kind === "ending" ? `— ${story.terminal.endingId} —` : "本段结束";
      this.#status = document.createElement("p");
      this.#status.setAttribute("role", "status");
      this.#status.setAttribute("aria-live", "polite");
      const controls = document.createElement("div");
      controls.className = "ending-controls";
      this.#retry = document.createElement("button");
      this.#retry.type = "button";
      this.#retry.textContent = "重试保存结局记录";
      this.#retry.addEventListener("click", event => {
        event.stopPropagation();
        if (!this.#closed && this.#key === key && this.#retry && !this.#retry.hidden && !this.#retry.disabled) {
          this.#options.retry?.(originalToken);
        }
      }, { signal });
      this.#leave = document.createElement("button");
      this.#leave.type = "button";
      this.#leave.textContent = this.#options.leaveLabel;
      this.#leave.addEventListener("click", event => {
        event.stopPropagation();
        if (!this.#closed && this.#key === key && this.#leave && !this.#leave.disabled) this.#options.leave(originalToken);
      }, { signal });
      controls.append(this.#retry, this.#leave);
      content.append(heading, this.#status, controls);
      this.#root.append(content);
      this.#root.hidden = false;
    }
    if (this.#status) {
      const message = story.terminal.kind === "script-end" ? "已到达本段内容末尾；本次结束没有新增结局记录。"
        : record.kind === "preview" ? record.message
        : record.kind === "pending" ? "结局已达成，正在保存全局记录；保存完成后可从主页鉴赏。"
        : record.kind === "failed" ? `结局记录尚未保存：${record.message}。可重试原记录；返回标题后仍可处理待保存记录。`
        : record.kind === "committed" ? `${view.newEnding ? "新结局达成，已保存！" : "本次结局记录已保存。"} 已收集 ${record.unlocked} / ${record.total}，可从主页鉴赏。`
        : "本次结局记录尚未确认；请查看全局记录状态，不能据此认定已保存。";
      if (this.#status.textContent !== message) this.#status.textContent = message;
    }
    const disabled = blocked || view.paused.some(reason => reason === "operation" || reason === "exit");
    if (this.#leave) this.#leave.disabled = disabled;
    if (this.#retry) {
      this.#retry.hidden = story.terminal.kind !== "ending" || record.kind !== "failed" || !this.#options.retry;
      this.#retry.disabled = disabled;
    }
  }

  clear(): void {
    this.#events?.abort();
    this.#events = null;
    this.#key = "";
    this.#status = this.#leave = this.#retry = null;
    this.#root.hidden = true;
    this.#root.replaceChildren();
  }

  dispose(): void {
    if (this.#closed) return;
    this.clear();
    this.#closed = true;
    this.#root.remove();
  }
}
