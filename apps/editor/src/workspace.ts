export interface WorkspaceNode {
  id: string;
  chapter: string;
  speaker: string;
  text: string;
  changed: boolean;
  pinned: boolean;
}
type Panel = "dialogue" | "structure" | "stage" | "performance" | "changes" | "source" | "checkpoints" | "story" | "flow" | "references";
interface Options {
  root: HTMLElement;
  timeline: HTMLFieldSetElement;
  cards: HTMLElement;
  empty: HTMLElement;
  select(nodeId: string): void;
}
interface Card {
  button: HTMLButtonElement;
  chapter: HTMLElement;
  speaker: HTMLElement;
  text: HTMLElement;
}

/** Workspace navigation only; drafts and playback remain owned by their existing modules. */
export class AuthorWorkspace {
  readonly #options: Options;
  readonly #events = new AbortController();
  readonly #cards = new Map<string, Card>();
  readonly #tabs: HTMLButtonElement[];
  #selected = "";

  constructor(options: Options) {
    this.#options = options;
    this.#tabs = [...options.root.querySelectorAll<HTMLButtonElement>("[data-workspace-tab]")];
    const { signal } = this.#events;
    for (const group of options.root.querySelectorAll<HTMLElement>("[data-workspace-tabs]")) {
      const tabs = this.#tabs.filter(tab => tab.parentElement === group);
      for (const tab of tabs) {
        tab.addEventListener("click", () => this.open(tab.dataset.workspaceTab as Panel), { signal });
        tab.addEventListener("keydown", event => {
          const index = tabs.indexOf(tab);
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
            : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
              : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          const target = tabs[next]!;
          this.open(target.dataset.workspaceTab as Panel);
          target.focus();
        }, { signal });
      }
    }
    options.cards.addEventListener("click", event => {
      if (options.timeline.disabled || !(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLButtonElement>("[data-node-id]");
      if (!target || !options.cards.contains(target)) return;
      options.select(target.dataset.nodeId!);
    }, { signal });
    options.cards.addEventListener("keydown", event => {
      if (options.timeline.disabled || !(event.target instanceof HTMLButtonElement)) return;
      const cards = [...options.cards.querySelectorAll<HTMLButtonElement>("[data-node-id]")];
      const index = cards.indexOf(event.target);
      if (index < 0) return;
      const next = event.key === "ArrowRight" ? Math.min(index + 1, cards.length - 1)
        : event.key === "ArrowLeft" ? Math.max(index - 1, 0)
          : event.key === "Home" ? 0 : event.key === "End" ? cards.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      const target = cards[next]!;
      options.select(target.dataset.nodeId!);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, { signal });
  }

  open(panel: Panel): void {
    const active = this.#tabs.find(tab => tab.dataset.workspaceTab === panel)!;
    for (const tab of this.#tabs.filter(tab => tab.parentElement === active.parentElement)) {
      const selected = tab === active;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      this.#options.root.querySelector<HTMLElement>(`#${tab.getAttribute("aria-controls")}`)!.hidden = !selected;
    }
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  setState(available: boolean, playing: boolean): void {
    this.#options.timeline.disabled = !available;
    this.#options.empty.hidden = playing || available;
  }

  nodes(nodes: readonly WorkspaceNode[], selected: string, reveal: boolean): void {
    const cards = this.#options.cards;
    const retained = new Set(nodes.map(node => node.id));
    for (const [id, card] of this.#cards) {
      if (!retained.has(id)) { card.button.remove(); this.#cards.delete(id); }
    }
    nodes.forEach((node, index) => {
      let card = this.#cards.get(node.id);
      if (!card) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "node-card";
        button.draggable = true;
        button.dataset.nodeId = node.id;
        const chapter = document.createElement("small");
        const speaker = document.createElement("strong");
        const text = document.createElement("span");
        button.append(chapter, speaker, text);
        card = { button, chapter, speaker, text };
        this.#cards.set(node.id, card);
      }
      const current = node.id === selected;
      const label = `${node.pinned ? "当前 · " : ""}${node.chapter || "未标章节"} · ${node.id}`;
      if (card.chapter.textContent !== label) card.chapter.textContent = label;
      const speaker = `${node.changed ? "＊ " : ""}${node.speaker || "旁白"}`;
      if (card.speaker.textContent !== speaker) card.speaker.textContent = speaker;
      const text = node.text.slice(0, 160) || "（无对白）";
      if (card.text.textContent !== text) card.text.textContent = text;
      card.button.classList.toggle("current", current);
      card.button.classList.toggle("has-draft", node.changed);
      card.button.setAttribute("aria-current", String(current));
      card.button.tabIndex = current || (!retained.has(selected) && index === 0) ? 0 : -1;
      if (cards.children[index] !== card.button) cards.insertBefore(card.button, cards.children[index] ?? null);
    });
    if (reveal || selected !== this.#selected) {
      this.#cards.get(selected)?.button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    this.#selected = selected;
  }

  dispose(): void {
    this.#events.abort();
    this.#cards.clear();
    this.#options.cards.replaceChildren();
  }
}
