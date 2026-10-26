import type { RollbackTarget } from "../../../packages/player/src/rollback.ts";

/** Displays detached locations only; checkpoint adoption remains with the application. */
export class RollbackLocations {
  readonly #select: HTMLSelectElement;
  readonly #details: HTMLElement;
  readonly #count: HTMLElement;
  #targets: Readonly<RollbackTarget>[] = [];
  #detailKey = "";

  constructor(select: HTMLSelectElement, details: HTMLElement, count: HTMLElement) {
    this.#select = select;
    this.#details = details;
    this.#count = count;
  }

  setTargets(targets: readonly RollbackTarget[]): void {
    this.#targets = targets.map(target => ({ ...target }));
    const selected = this.#select.value;
    const options = document.createDocumentFragment();
    options.append(new Option("请选择本次回退位置", ""));
    let group: HTMLOptGroupElement | null = null;
    let chapter: string | null = null;
    for (const target of this.#targets) {
      // Group consecutive visits without sorting or merging a return to an earlier chapter.
      if (!group || chapter !== target.chapter) {
        group = document.createElement("optgroup");
        group.label = target.chapter || "未标注章节";
        options.append(group);
        chapter = target.chapter;
      }
      const text = target.text.replace(/\s+/gu, " ").trim();
      const excerpt = text.length > 65 ? `${text.slice(0, 65)}…` : text || "无对白正文";
      const label = `访问 ${target.id} · ${target.crossesChoice ? "跨选择 · " : ""}`
        + `${target.speaker ? `${target.speaker}：` : ""}${excerpt}`;
      group.append(new Option(label, String(target.id)));
    }
    this.#select.replaceChildren(options);
    this.#select.value = this.#targets.some(target => String(target.id) === selected) ? selected : "";
    this.#count.textContent = this.#targets.length
      ? `当前可选 ${this.#targets.length} 处，按访问先后排列；访问编号用于区分同一节点的多次到访。`
      : "本次会话尚无可选的回退位置；当前访问不列为回退目标。";
    this.#detailKey = "";
  }

  refresh(boundary: string): boolean {
    const target = this.#targets.find(item => String(item.id) === this.#select.value);
    const key = JSON.stringify([target?.id ?? null, boundary]);
    if (key === this.#detailKey) return !!target;
    this.#detailKey = key;
    if (!target) {
      const hint = document.createElement("p");
      hint.textContent = "选择位置后可查看完整对白。浏览和选择不会改变当前进度。";
      this.#details.replaceChildren(hint);
      return false;
    }

    const heading = document.createElement("h3");
    heading.textContent = "选定位置";
    const identity = document.createElement("dl");
    for (const [label, value] of [
      ["章节", target.chapter || "未标注章节"],
      ["说话人", target.speaker || "未标注说话人"],
      ["节点", target.nodeId],
      ["本次访问", String(target.id)],
    ] as const) {
      const row = document.createElement("div");
      const name = document.createElement("dt");
      const text = document.createElement("dd");
      name.textContent = label;
      text.textContent = value;
      row.append(name, text);
      identity.append(row);
    }
    const dialogue = document.createElement("p");
    dialogue.className = "rollback-location-text";
    dialogue.textContent = target.text || "此位置没有对白正文。";
    const scope = document.createElement("p");
    scope.className = "rollback-location-scope";
    scope.dataset.crossesChoice = String(target.crossesChoice);
    scope.textContent = !target.crossesChoice
      ? "此位置与当前访问之间没有选择边界；本次范围与语音方式仍需明确选择。"
      : boundary === "within"
        ? "此位置跨越选择边界。本次选择了「仅当前选择之后的片段」，确认回退时会被拒绝，当前进度保留。"
        : boundary === "across"
          ? "此位置跨越选择边界。本次已允许跨选择回退，确认后仍需通过原检查点校验。"
          : "此位置跨越选择边界，请明确选择本次回退范围。";
    this.#details.replaceChildren(heading, identity, dialogue, scope);
    return true;
  }
}
