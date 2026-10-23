import type { SessionToken, SessionView } from "../session.ts";

/** Renders only the choices accepted by the shared session; never evaluates or settles them. */
export class ChoicePanel {
  readonly #root: HTMLElement;
  readonly #choose: (token: SessionToken, choiceId: string) => void;
  #key = "";
  #events: AbortController | null = null;
  #progress: HTMLProgressElement | null = null;
  #closed = false;

  constructor(root: HTMLElement, choose: (token: SessionToken, choiceId: string) => void) {
    this.#root = root;
    this.#choose = choose;
    this.clear();
  }

  render(view: SessionView): void {
    if (this.#closed) return;
    const { story, token } = view;
    if (view.disposed || story.phase !== "choosing" || story.choices.length === 0) {
      if (this.#key) this.clear();
      return;
    }
    const key = JSON.stringify([token, story.choices, story.timeout]);
    if (key !== this.#key) {
      this.clear();
      this.#key = key;
      const events = new AbortController();
      this.#events = events;
      // Preserve the existing first-actor rule, including the no-actor left fallback.
      this.#root.dataset.side = (story.presentation.scene.sprites[0]?.x ?? 640) < 640 ? "right" : "left";
      this.#root.dataset.many = String(story.choices.length > 4);
      const list = document.createElement("div");
      list.className = "choice-list";
      list.setAttribute("role", "group");
      list.setAttribute("aria-label", "剧情选项");
      const originalToken = { ...token };
      for (const choice of story.choices) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = choice.text;
        button.addEventListener("click", event => {
          event.stopPropagation();
          if (!this.#closed && this.#key === key && !button.disabled) this.#choose(originalToken, choice.id);
        }, { signal: events.signal });
        list.append(button);
      }
      if (story.timeout) {
        this.#progress = document.createElement("progress");
        this.#progress.max = story.timeout.durationMs;
        this.#progress.setAttribute("aria-label", "选择剩余有效时间");
        list.append(this.#progress);
      }
      this.#root.append(list);
      this.#root.hidden = false;
    }
    const blocked = view.paused.length > 0;
    for (const button of this.#root.querySelectorAll("button")) button.disabled = blocked;
    if (this.#progress) {
      const remaining = view.choiceRemainingMs ?? 0;
      this.#progress.value = remaining;
      this.#progress.setAttribute("aria-valuetext", `剩余 ${(remaining / 1000).toFixed(1)} 秒`);
    }
  }

  clear(): void {
    this.#events?.abort();
    this.#events = null;
    this.#key = "";
    this.#progress = null;
    this.#root.replaceChildren();
    this.#root.hidden = true;
    delete this.#root.dataset.side;
    delete this.#root.dataset.many;
  }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.clear();
  }
}
