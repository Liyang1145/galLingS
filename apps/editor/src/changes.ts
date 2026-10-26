import type { AuthorTextEdit } from "../../../packages/story-model/src/author.ts";
import type { StoryContent } from "../../../packages/story-model/src/model.ts";

export interface ChangeSnapshot {
  readonly content: StoryContent;
  readonly sourceSha256: string;
  readonly revision: number;
  readonly edits: readonly Readonly<AuthorTextEdit>[];
}

interface Options {
  root: HTMLElement;
  capture(): ChangeSnapshot | null;
  current(snapshot: ChangeSnapshot): boolean;
  navigate(nodeId: string): void;
}

const PAGE_SIZE = 25;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, value = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = value;
  return result;
}
function button(value: string): HTMLButtonElement {
  const result = element("button", value);
  result.type = "button";
  return result;
}
const fieldName = (edit: Readonly<AuthorTextEdit>): string => edit.field === "speaker" ? "说话人" : "对白";
const excerpt = (value: string): string => value.length ? value.slice(0, 120) + (value.length > 120 ? "…" : "") : "（空字符串）";

/** Read-only snapshot of the existing draft delta. No draft mutator, repository or preview API. */
export class AuthorChanges {
  readonly #options: Options;
  readonly #events = new AbortController();
  #rowsEvents = new AbortController();
  readonly #refresh = button("按当前草稿刷新变更");
  readonly #status = element("p", "读取作者源后可查看草稿变更。");
  readonly #views = element("fieldset");
  readonly #query = element("input");
  readonly #field = element("select");
  readonly #rows = element("ol");
  readonly #previous = button("上一页");
  readonly #next = button("下一页");
  readonly #count = element("span");
  #snapshot: ChangeSnapshot | null = null;
  #chapters = new Map<string, string>();
  #page = 0;
  #version = 0;
  #available = false;
  #closed = false;

  constructor(options: Options) {
    this.#options = options;
    const header = element("div");
    header.className = "controls";
    header.append(element("h3", "当前草稿变更"), this.#refresh);
    this.#status.className = "help";
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    const query = element("label", "查找节点、章节、原值或新值");
    this.#query.type = "search";
    query.append(this.#query);
    const field = element("label", "修改字段");
    for (const [value, label] of [["", "全部字段"], ["speaker", "说话人"], ["text", "对白"]] as const) {
      const option = element("option", label);
      option.value = value;
      this.#field.append(option);
    }
    field.append(this.#field);
    const pager = element("div");
    pager.className = "controls changes-pager";
    pager.append(this.#previous, this.#count, this.#next);
    this.#views.append(element("legend", "只读差量"), query, field, pager, this.#rows);
    options.root.classList.add("changes-panel");
    options.root.append(header, element("p",
      "对照已读取作者源与本页草稿，不是磁盘最新状态或正在运行的预览。展开查看完整原值 / 新值；定位只打开已有编辑表单。",
    ), this.#status, this.#views);
    const { signal } = this.#events;
    this.#refresh.addEventListener("click", () => this.refresh(), { signal });
    const filter = (): void => {
      if (!this.valid()) return;
      this.#page = 0;
      this.render();
    };
    this.#query.addEventListener("input", filter, { signal });
    this.#field.addEventListener("change", filter, { signal });
    this.#previous.addEventListener("click", () => {
      if (!this.valid() || this.#page === 0) return;
      this.#page--;
      this.render();
    }, { signal });
    this.#next.addEventListener("click", () => {
      if (!this.valid()) return;
      this.#page++;
      this.render();
    }, { signal });
    this.enabled();
  }

  setAvailable(available: boolean): void {
    this.#available = available;
    this.enabled();
  }

  private enabled(): void {
    this.#refresh.disabled = this.#closed || !this.#available;
    this.#views.disabled = this.#closed || !this.#available || !this.#snapshot;
    this.#views.inert = this.#views.disabled;
  }

  private clearRows(): void {
    this.#version++;
    this.#rowsEvents.abort();
    this.#rowsEvents = new AbortController();
    const focused = this.#rows.contains(document.activeElement);
    this.#rows.replaceChildren();
    if (focused && !this.#refresh.disabled && this.#refresh.getClientRects().length
      && !this.#refresh.closest("[inert]")) this.#refresh.focus({ preventScroll: true });
  }

  invalidate(): void {
    if (this.#closed) return;
    this.#snapshot = null;
    this.#chapters.clear();
    this.clearRows();
    this.#rows.scrollTop = 0;
    this.#count.textContent = "待刷新";
    const message = "源或草稿已变化；刷新后查看当前差量。原草稿保留，查看不写入文件。";
    if (this.#status.textContent !== message) this.#status.textContent = message;
    this.enabled();
  }

  refresh(): void {
    if (this.#closed || !this.#available) return;
    const snapshot = this.#options.capture();
    if (!snapshot || !this.#options.current(snapshot)) { this.invalidate(); return; }
    this.#snapshot = snapshot;
    this.#chapters = new Map(snapshot.content.nodes.map(node => [node.id, node.chapter]));
    this.#status.textContent = `作者源 ${snapshot.sourceSha256}；本页草稿代次 ${snapshot.revision}；`
      + `${snapshot.edits.length} 个字段，${new Set(snapshot.edits.map(edit => edit.nodeId)).size} 个节点。`
      + "这是已读取源的对照；保存时仍会重新核对真实作者文件。";
    this.render();
    this.enabled();
  }

  private valid(): boolean {
    if (this.#closed || !this.#available || !this.#snapshot) return false;
    if (!this.#options.current(this.#snapshot)) { this.invalidate(); return false; }
    return true;
  }

  private render(): void {
    const snapshot = this.#snapshot;
    if (!snapshot || !this.valid()) return;
    const query = this.#query.value.trim().toLocaleLowerCase();
    const matches = snapshot.edits.filter(edit => (!this.#field.value || this.#field.value === edit.field)
      && [edit.nodeId, this.#chapters.get(edit.nodeId) ?? "", edit.before, edit.after]
        .some(value => value.toLocaleLowerCase().includes(query)));
    const pages = Math.ceil(matches.length / PAGE_SIZE);
    this.#page = Math.min(this.#page, Math.max(0, pages - 1));
    this.clearRows();
    this.#rows.scrollTop = 0;
    const version = this.#version;
    const current = (): boolean => version === this.#version && this.#snapshot === snapshot && this.valid();
    this.#previous.disabled = this.#page === 0;
    this.#next.disabled = (this.#page + 1) * PAGE_SIZE >= matches.length;
    this.#count.textContent = `${matches.length} 个匹配字段 · ${pages ? `第 ${this.#page + 1} / ${pages} 页` : "无匹配页"}`;
    this.#rows.start = this.#page * PAGE_SIZE + 1;
    if (!matches.length) {
      const empty = element("li", snapshot.edits.length ? "没有匹配的草稿变更，原草稿仍保留。" : "本页草稿没有字段变更。");
      empty.className = "help";
      this.#rows.append(empty);
      return;
    }
    const { signal } = this.#rowsEvents;
    for (const edit of matches.slice(this.#page * PAGE_SIZE, (this.#page + 1) * PAGE_SIZE)) {
      const row = element("li");
      row.append(element("h4", `${edit.nodeId} · ${fieldName(edit)} · ${this.#chapters.get(edit.nodeId) || "未标章节"}`));
      const locate = button(`定位 ${edit.nodeId} 的${fieldName(edit)}`);
      locate.addEventListener("click", () => {
        if (current()) this.#options.navigate(edit.nodeId);
      }, { signal });
      row.append(locate, element("p", `原值：${excerpt(edit.before)}`), element("p", `新值：${excerpt(edit.after)}`));
      const details = element("details");
      details.append(element("summary", "展开完整原值 / 新值"));
      const comparison = element("div");
      comparison.className = "draft-comparison";
      details.append(comparison);
      details.addEventListener("toggle", () => {
        if (!current()) return;
        if (!details.open) { comparison.replaceChildren(); return; }
        if (comparison.childElementCount) return;
        for (const [heading, value] of [["已读取作者源原值", edit.before], ["本页草稿新值", edit.after]] as const) {
          const section = element("section");
          section.append(element("h5", heading), element("p", `${value.length} 个 UTF-16 单元${value.length ? "" : " · 空字符串"}`),
            element("pre", value));
          comparison.append(section);
        }
      }, { signal });
      row.append(details);
      this.#rows.append(row);
    }
  }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#snapshot = null;
    this.#chapters.clear();
    this.#events.abort();
    this.#rowsEvents.abort();
    this.#options.root.replaceChildren();
  }
}
