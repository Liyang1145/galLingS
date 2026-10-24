import { readSaveSlotId } from "../../../packages/player/src/saves.ts";
import type { SaveRepository, SaveSlotSummary } from "../../../packages/player/src/saves.ts";

export type SaveEntry = "main" | "timed";
interface Options {
  root: HTMLElement;
  repositories: Readonly<Record<SaveEntry, SaveRepository>>;
  label(entry: SaveEntry): string;
  blocked(): boolean;
  changed(): void;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}
function button(text: string): HTMLButtonElement {
  const result = element("button", text);
  result.type = "button";
  return result;
}

/** Selection and read-only catalogue. Saving and restoring stay with the application. */
export class SaveSlots {
  readonly #options: Options;
  readonly #events = new AbortController();
  #viewEvents = new AbortController();
  readonly #namespace = element("select");
  readonly #name = element("input");
  readonly #use = button("使用此槽位名称");
  readonly #refresh = button("刷新槽位目录");
  readonly #previous = button("上一页");
  readonly #nextButton = button("下一页");
  readonly #status = element("p", "尚未读取槽位目录；两个入口原有的 manual 槽位继续保留。");
  readonly #selection = element("p");
  readonly #page = element("span");
  readonly #rows = element("fieldset");
  readonly #list = element("ol");
  readonly #empty = element("p", "还没有保存的进度。开始游戏后，选择一个名称，把这一刻留下。");
  readonly #cards: { row: HTMLLIElement; select: HTMLButtonElement; slotId: string }[] = [];
  readonly #selected: Record<SaveEntry, string> = { main: "manual", timed: "manual" };
  #entry: SaveEntry = "main";
  #after: string | null = null;
  #back: (string | null)[] = [];
  #next: string | null = null;
  #epoch = 0;
  #loading = false;
  #closed = false;

  constructor(options: Options) {
    this.#options = options;
    const namespace = element("label", "浏览槽位所属入口");
    for (const entry of ["main", "timed"] as const) {
      const option = element("option", options.label(entry));
      option.value = entry;
      this.#namespace.append(option);
    }
    namespace.append(this.#namespace);
    const form = element("form");
    const name = element("label", "本入口的槽位名称");
    this.#name.type = "text";
    this.#name.maxLength = 128;
    this.#name.value = "manual";
    this.#name.autocomplete = "off";
    name.append(this.#name);
    this.#use.type = "submit";
    form.append(name, this.#use);
    const pager = element("div");
    pager.className = "controls save-pager";
    pager.setAttribute("aria-label", "槽位目录分页");
    pager.append(this.#refresh, this.#previous, this.#page, this.#nextButton);
    this.#list.className = "save-card-grid";
    this.#empty.className = "save-empty";
    this.#empty.hidden = true;
    this.#selection.className = "save-selection";
    this.#rows.append(element("legend", "本入口已保存槽位"), this.#list, this.#empty);
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    const note = element("p",
      "名称先用于选择目标，点击“保存”才写入。已有同名槽位会被本次手动保存替换；第一话与限时样例分别保存，查看或选择目录项不会读档。");
    note.className = "help";
    options.root.classList.add("save-slots");
    options.root.append(namespace, form, this.#selection, note, this.#status, this.#rows, pager);
    const { signal } = this.#events;
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (this.#closed || options.blocked()) return;
      try { this.use(this.#entry, readSaveSlotId(this.#name.value.trim())); }
      catch (error: unknown) { this.#status.textContent = error instanceof Error ? error.message : "槽位名称无效"; }
    }, { signal });
    this.#namespace.addEventListener("change", () => {
      const entry = this.#namespace.value;
      if (this.#closed || options.blocked() || (entry !== "main" && entry !== "timed")) return;
      this.browse(entry);
    }, { signal });
    this.#refresh.addEventListener("click", () => this.refresh(), { signal });
    this.#previous.addEventListener("click", () => {
      if (this.#back.length) void this.load(this.#back.at(-1) ?? null, this.#back.slice(0, -1));
    }, { signal });
    this.#nextButton.addEventListener("click", () => {
      if (this.#next !== null) void this.load(this.#next, [...this.#back, this.#after]);
    }, { signal });
    this.selection();
    this.refreshControls();
  }

  slot(entry: SaveEntry): string { return this.#selected[entry]; }

  /** Opening the shell directory selects its range only; it never adopts saved progress. */
  browse(entry: SaveEntry): void {
    if (this.#closed || this.#options.blocked()) return;
    this.#entry = entry;
    this.#namespace.value = entry;
    this.#name.value = this.#selected[entry];
    this.#after = this.#next = null;
    this.#back = [];
    this.clearRows();
    this.#page.textContent = "";
    this.selection();
    this.refresh();
  }

  private use(entry: SaveEntry, slotId: string): void {
    this.#name.value = slotId;
    if (this.#selected[entry] === slotId) return;
    this.#selected[entry] = slotId;
    this.selection();
    this.#options.changed();
  }

  private selection(): void {
    this.#selection.textContent = `${this.#options.label(this.#entry)}当前选择：${JSON.stringify(this.#selected[this.#entry])}。选择本身不写入或恢复进度。`;
    for (const card of this.#cards) {
      const selected = card.slotId === this.#selected[this.#entry];
      card.row.dataset.selected = String(selected);
      card.select.setAttribute("aria-pressed", String(selected));
      card.select.textContent = selected ? "已选中此槽位" : "选择此槽位";
    }
  }

  private clearRows(): void {
    this.#viewEvents.abort();
    this.#viewEvents = new AbortController();
    this.#cards.length = 0;
    this.#list.replaceChildren();
    this.#empty.hidden = true;
  }

  refreshControls(): void {
    const blocked = this.#closed || this.#options.blocked();
    if (blocked && this.#loading) {
      ++this.#epoch;
      this.#loading = false;
      this.#status.textContent = "槽位读取已失效，可在本次操作结束后刷新；已有存档未被修改。";
    }
    this.#namespace.disabled = this.#name.disabled = this.#use.disabled = blocked;
    this.#refresh.disabled = blocked;
    this.#previous.disabled = blocked || this.#loading || this.#back.length === 0;
    this.#nextButton.disabled = blocked || this.#loading || this.#next === null;
    this.#rows.disabled = blocked || this.#loading;
    this.#rows.setAttribute("aria-busy", String(this.#loading));
  }

  refresh(): void { void this.load(null, []); }

  saved(entry: SaveEntry): void {
    if (this.#closed || entry !== this.#entry) return;
    if (this.#options.blocked()) {
      ++this.#epoch;
      this.#loading = false;
      this.#status.textContent = "本入口槽位已有提交；本次操作结束后可刷新目录。";
      this.refreshControls();
    } else this.refresh();
  }

  private async load(after: string | null, back: (string | null)[]): Promise<void> {
    if (this.#closed || this.#options.blocked()) return;
    const entry = this.#entry;
    const epoch = ++this.#epoch;
    this.#loading = true;
    this.#status.textContent = `正在读取${this.#options.label(entry)}槽位目录……`;
    this.refreshControls();
    try {
      const page = await this.#options.repositories[entry].list({ after, limit: 20 });
      if (this.#closed || epoch !== this.#epoch || entry !== this.#entry) return;
      this.#after = after;
      this.#back = back;
      this.#next = page.next;
      this.clearRows();
      this.#list.replaceChildren(...page.items.map(item => this.row(entry, item)));
      this.#empty.hidden = page.items.length !== 0;
      this.selection();
      this.#page.textContent = `第 ${back.length + 1} 页`;
      this.#status.textContent = `本页 ${page.items.length} 个已保存槽位，按地址顺序显示。`
        + (page.items.length ? "查看和读档会重新读取，不直接采用目录摘要。" : "此页没有已保存槽位，可选择名称后手动保存。");
    } catch (error: unknown) {
      if (this.#closed || epoch !== this.#epoch) return;
      this.#status.textContent = `目录读取失败：${error instanceof Error ? error.message : "存储错误"}。已有存档未改，可刷新重试。`;
    } finally {
      if (!this.#closed && epoch === this.#epoch) { this.#loading = false; this.refreshControls(); }
    }
  }

  private row(entry: SaveEntry, item: Readonly<SaveSlotSummary>): HTMLLIElement {
    const row = element("li");
    row.className = "save-card";
    row.dataset.kind = item.kind;
    const heading = element("div");
    heading.className = "save-card-heading";
    heading.append(element("strong", item.slotId === null ? "无法识别的槽位地址" : JSON.stringify(item.slotId)));
    const badge = element("span", item.kind === "readable" ? "已保存" : "无法读取");
    badge.className = "save-card-badge";
    heading.append(badge);
    row.append(heading);
    if (item.kind === "readable") {
      const chapter = element("small", item.chapter || "未标注章节");
      chapter.className = "save-card-chapter";
      const text = item.text.replace(/\s+/gu, " ").trim();
      const excerpt = element("p", `${item.speaker ? `${item.speaker}：` : ""}${text.slice(0, 100) || "演出节点"}${text.length > 100 ? "…" : ""}`);
      excerpt.className = "save-card-excerpt";
      const phase = element("small", `${item.phase === "choosing" ? "等待选择" : "可继续"}${item.choiceRemainingMs === null ? "" : ` · 剩余 ${(item.choiceRemainingMs / 1000).toFixed(1)} 秒`}`);
      const time = element("time", new Date(item.savedAt).toLocaleString());
      time.dateTime = new Date(item.savedAt).toISOString();
      const location = element("small", `节点 ${item.nodeId}`);
      location.className = "save-card-location";
      row.append(chapter, excerpt, phase, time, location);
    } else {
      const diagnostic = element("p", `${item.code}：${item.message}`);
      diagnostic.className = "save-card-diagnostic";
      row.append(diagnostic);
      if (item.slotId === null) row.append(element("code", item.address));
      row.append(element("small", item.slotId === null
        ? "地址无法识别，不能选择；原记录保留。"
        : "原记录保留。选择只更改目标；手动保存到同名槽位会替换原记录。"));
    }
    if (item.slotId !== null) {
      const slotId = item.slotId;
      const select = button("选择此槽位");
      select.addEventListener("click", () => {
        if (!this.#closed && !this.#loading && !this.#options.blocked() && entry === this.#entry) this.use(entry, slotId);
      }, { signal: this.#viewEvents.signal });
      this.#cards.push({ row, select, slotId });
      row.append(select);
    }
    return row;
  }

  dispose(): void {
    this.#closed = true;
    ++this.#epoch;
    this.#events.abort();
    this.#viewEvents.abort();
    this.#options.root.replaceChildren();
  }
}
