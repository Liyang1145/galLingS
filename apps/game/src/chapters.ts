import type { StoryContent } from "../../../packages/story-model/src/model.ts";
import { chapterCatalog } from "../../../packages/player/src/chapters.ts";
import type { ChapterEntry } from "../../../packages/player/src/chapters.ts";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = text;
  result.className = className;
  return result;
}

/** Read-only chapter selection. Starting and cancelling a trial belong to the application. */
export class ChapterPanel {
  readonly #root: HTMLElement;
  readonly #content: StoryContent;
  readonly #choose: (entry: ChapterEntry) => void;
  #events: AbortController | null = null;

  constructor(root: HTMLElement, content: StoryContent, choose: (entry: ChapterEntry) => void) {
    this.#root = root;
    this.#content = content;
    this.#choose = choose;
  }

  open(): void {
    this.close();
    const events = new AbortController();
    this.#events = events;
    const note = element("p", "每次试阅从所选章节的声明初值开始，周目 1、结局数 0；不是此前真实路线进度。不读取或写入玩家存档、全局成果和聊天记录。试阅调整使用独立内存偏好，返回主页后恢复正常入口设置。");
    const initial = element("pre", JSON.stringify({
      variables: Object.fromEntries(this.#content.variables.map(variable => [variable.name, variable.initial])),
      player: { "周目": 1, "结局数": 0 },
    }, null, 2), "chapter-initial");
    initial.setAttribute("aria-label", "每次试阅的完整初始条件");
    const grid = element("div", "", "chapter-grid");
    for (const entry of chapterCatalog(this.#content)) {
      const button = element("button");
      button.type = "button";
      button.append(element("b", entry.title), element("small", `试阅起点：${entry.nodeId}`));
      button.addEventListener("click", () => {
        if (this.#events === events && !events.signal.aborted) this.#choose(entry);
      }, { signal: events.signal });
      grid.append(button);
    }
    if (!grid.childElementCount) grid.append(element("p", "当前作品没有登记章节起点，仍可从正常入口开始。"));
    this.#root.replaceChildren(note, initial, grid);
  }

  close(): void {
    this.#events?.abort();
    this.#events = null;
    this.#root.replaceChildren();
  }
}
