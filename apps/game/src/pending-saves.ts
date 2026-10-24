import type { TrackedWriteView } from "../../../packages/player/src/writes.ts";

interface SaveAttempt {
  view(): Readonly<TrackedWriteView>;
  location(): { nodeId: string; savedAt: number } | null;
  retry(): void;
}
interface Options {
  root: HTMLElement;
  fallback: HTMLElement;
  blocked(): boolean;
}
interface Row {
  attempt: SaveAttempt;
  root: HTMLLIElement;
  state: HTMLParagraphElement;
  location: HTMLParagraphElement;
  issue: HTMLParagraphElement;
  retry: HTMLButtonElement;
  events: AbortController;
}

function text(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

/** Retry intents only. Row identities never look up storage or the current game session. */
export class PendingSavesPanel {
  readonly #options: Options;
  readonly #list = document.createElement("ul");
  readonly #status = document.createElement("p");
  readonly #rows = new Map<string, Row>();
  #disposed = false;

  constructor(options: Options) {
    this.#options = options;
    this.#list.className = "pending-save-list";
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    options.root.append(this.#status, this.#list);
    options.root.hidden = true;
  }

  register(key: string, attempt: SaveAttempt): void {
    if (this.#disposed) return;
    const previous = this.#rows.get(key);
    if (previous) this.remove(key, previous);
    const root = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = attempt.view().label;
    const state = document.createElement("p");
    const location = document.createElement("p");
    const issue = document.createElement("p");
    issue.className = "pending-save-issue";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "重试这次存档";
    const events = new AbortController();
    const row: Row = { attempt, root, state, location, issue, retry, events };
    retry.addEventListener("click", () => {
      if (!this.#disposed && !this.#options.blocked() && this.#rows.get(key) === row
        && attempt.view().state === "failed" && attempt.location()) attempt.retry();
    }, { signal: events.signal });
    root.append(label, state, location, issue, retry);
    this.#rows.set(key, row);
    this.#list.append(root);
    this.refresh();
  }

  refresh(): void {
    if (this.#disposed) return;
    let pending = 0, failed = 0;
    for (const [key, row] of this.#rows) {
      const view = row.attempt.view();
      if (view.state === "completed" || view.state === "superseded") {
        this.remove(key, row);
        continue;
      }
      if (view.state === "pending") pending++;
      else failed++;
      row.root.dataset.state = view.state;
      const location = row.attempt.location();
      text(row.state, view.state === "pending" ? "原保存正在进行，请等待。"
        : location ? "本次保存没有取得完成确认，请查看原槽位或显式重试这一次操作。"
          : "本次检查点未捕获成功，不能重试持久写入；请回到稳定位置，向原槽位显式重新保存。");
      text(row.location, location
        ? `原检查点：${location.nodeId} · ${new Date(location.savedAt).toLocaleString()}`
        : view.state === "pending" ? "正在捕获本次请求的检查点。" : "没有已捕获的原检查点；原失败请求仍保留，退出时不会被当作已保存。");
      row.issue.hidden = view.issue === null;
      text(row.issue, view.issue ?? "");
      row.retry.disabled = this.#options.blocked() || view.state !== "failed" || !location;
    }
    this.#options.root.hidden = this.#rows.size === 0;
    text(this.#status, this.#rows.size ? `进行中 ${pending} 项 · 未提交 ${failed} 项。重试不采用当前游玩位置或后来选中的名称。` : "");
  }

  private remove(key: string, row: Row): void {
    if (row.root.contains(document.activeElement) && this.#options.fallback.getClientRects().length
      && !this.#options.fallback.closest("[inert]")) {
      this.#options.fallback.focus({ preventScroll: true });
    }
    row.events.abort();
    row.root.remove();
    this.#rows.delete(key);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const row of this.#rows.values()) {
      row.events.abort();
      row.root.remove();
    }
    this.#rows.clear();
    this.#options.root.hidden = true;
  }
}
