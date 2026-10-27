import { prepareDraftImport, resolveDraftImport } from "../../../packages/story-model/src/author-draft.ts";
import type { AuthorDraftBase, DraftImportChoice, DraftImportPlan, DraftImportRow } from "../../../packages/story-model/src/author-draft.ts";
import type { AuthorTextPatch } from "../../../packages/story-model/src/author.ts";
import { authorTextLabel } from "../../../packages/story-model/src/author.ts";
import type { AuthorDocument } from "./document.ts";
import { downloadDraft } from "./download.ts";

export interface SourceComparisonSnapshot {
  readonly source: AuthorDocument;
  readonly revision: number;
  readonly patch: AuthorTextPatch;
}
interface Options {
  root: HTMLElement;
  current(snapshot: SourceComparisonSnapshot): boolean;
  apply(snapshot: SourceComparisonSnapshot, source: AuthorDocument, patch: AuthorTextPatch): void;
  changed(): void;
  notice(message: string): void;
}
interface Comparison {
  readonly snapshot: SourceComparisonSnapshot;
  readonly source: AuthorDocument;
  readonly plan: DraftImportPlan;
  readonly choices: Map<number, DraftImportChoice>;
}
const PAGE_SIZE = 25;
const STATUS: Record<DraftImportRow["status"], string> = {
  ready: "磁盘仍为原文，建议保留本页修改",
  same: "这次读取的磁盘源已有相同文字，不生成重复修改",
  unchanged: "本页未作实际修改，建议采用这次读取的磁盘文字",
  "already-in-source": "这次读取的磁盘源已有相同文字",
  conflict: "磁盘文字与原文不同，须明确选择",
  unavailable: "节点或已有字符串字段不可编辑，只能留待原摘要导出",
};
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function button(text: string, action: () => void, signal: AbortSignal): HTMLButtonElement {
  const node = element("button", text);
  node.type = "button";
  node.addEventListener("click", action, { signal });
  return node;
}

/** Explicit comparison only. Reading/choosing never adopts a source or writes a file. */
export class AuthorSourceComparison {
  readonly #options: Options;
  #events = new AbortController();
  #rowsEvents = new AbortController();
  #comparison: Comparison | null = null;
  #remaining = false;
  #enabled = false;
  #closed = false;
  #page = 0;
  #apply: HTMLButtonElement | null = null;
  #fields: HTMLFieldSetElement | null = null;

  constructor(options: Options) { this.#options = options; }

  get active(): boolean { return this.#comparison !== null; }
  get hasRecovery(): boolean { return this.#remaining; }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled && !this.#closed;
    if (this.#fields) this.#fields.disabled = !this.#enabled;
    this.updateApply();
  }

  offer(snapshot: SourceComparisonSnapshot, source: AuthorDocument, base: AuthorDraftBase): void {
    if (this.#closed || this.#remaining) throw new Error("先导出或明确关闭上次未采用的修改，再开始新的磁盘比较。");
    const plan = prepareDraftImport(base, {
      format: "haifeng.author-text-patch/4", sourceSha256: base.sourceSha256, edits: [],
    }, snapshot.patch);
    this.clear();
    const choices = new Map<number, DraftImportChoice>();
    for (const row of plan.rows) if (row.defaultChoice !== null) choices.set(row.index, row.defaultChoice);
    this.#comparison = { snapshot, source, plan, choices };
    this.render();
  }

  invalidate(): void {
    if (!this.active) return;
    this.clear();
    this.#options.notice("本页草稿或作者源已改变，磁盘比较已取消；原草稿继续保留，请重新读取比较。");
  }

  private clear(): void {
    this.#events.abort();
    this.#rowsEvents.abort();
    this.#events = new AbortController();
    this.#rowsEvents = new AbortController();
    this.#comparison = null;
    this.#remaining = false;
    this.#page = 0;
    this.#apply = null;
    this.#fields = null;
    this.#options.root.replaceChildren();
    this.#options.root.hidden = true;
  }

  private updateApply(): void {
    if (this.#apply) this.#apply.disabled = !this.#enabled || !this.#comparison
      || this.#comparison.choices.size !== this.#comparison.plan.rows.length;
  }

  private render(): void {
    const comparison = this.#comparison;
    if (!comparison) return;
    const { snapshot, source, plan, choices } = comparison;
    const signal = this.#events.signal;
    const heading = element("h2", "保留草稿 · 与磁盘源比较");
    heading.tabIndex = -1;
    const identity = element("p", `本页原源摘要：${snapshot.source.sourceSha256}\n这次读取的磁盘摘要：${source.sourceSha256}`);
    const note = element("p", "原基线、草稿历史和运行预览尚未改变。逐项比较后，点击采用才更换本页基线；保存仍须另行点击。磁盘此后仍可能变化，保存端会再次核对摘要。这里不能确认此前保存请求是否成功。");
    const fields = element("fieldset");
    fields.append(element("legend", "选择新基线上的对白草稿"));
    this.#fields = fields;
    const rows = element("ol");
    rows.className = "draft-import-list";
    const paging = element("div");
    paging.className = "controls";
    const pageStatus = element("span");
    const status = element("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const update = (): void => {
      status.textContent = `共 ${plan.rows.length} 个原草稿字段，仍有 ${plan.rows.length - choices.size} 项须选择。`
        + "选择“采用磁盘文字”的不同修改或不可用字段，在采用后仍可按原摘要导出。";
      this.updateApply();
    };
    const renderRows = (): void => {
      this.#rowsEvents.abort();
      this.#rowsEvents = new AbortController();
      const rowSignal = this.#rowsEvents.signal;
      const pages = Math.max(1, Math.ceil(plan.rows.length / PAGE_SIZE));
      this.#page = Math.max(0, Math.min(this.#page, pages - 1));
      rows.start = this.#page * PAGE_SIZE + 1;
      rows.replaceChildren();
      for (const row of plan.rows.slice(this.#page * PAGE_SIZE, (this.#page + 1) * PAGE_SIZE)) {
        const item = element("li");
        const title = element("strong", `${row.edit.nodeId} · ${authorTextLabel(row.edit.field)}`);
        const state = element("p", STATUS[row.status]);
        const detail = element("details");
        const texts = element("div");
        texts.className = "draft-comparison";
        detail.append(element("summary", "对照原文、磁盘与本页修改"), texts);
        detail.addEventListener("toggle", () => {
          texts.replaceChildren();
          if (rowSignal.aborted || !detail.open || this.#comparison !== comparison
            || !this.#enabled || !this.#options.current(snapshot)) return;
          for (const [label, value] of [
            ["本页原基线文字", row.edit.before],
            ["这次读取的磁盘文字", row.source],
            ["本页需要保留的修改", row.edit.after],
          ] as const) {
            const group = element("section");
            group.append(element("h3", label), element("pre", value === null
              ? "（节点或原字符串字段不可编辑）" : value === "" ? "（空字符串）" : value));
            texts.append(group);
          }
        }, { signal: rowSignal });
        const choice = element("select");
        choice.setAttribute("aria-label", `${row.edit.nodeId} ${row.edit.field} 的磁盘比较处理方式`);
        choice.add(new Option("请选择处理方式", ""));
        choice.add(new Option(row.source === null
          ? "跳过不可用字段，保留旧修改用于导出" : "采用这次读取的磁盘文字", "keep"));
        if (row.source !== null) choice.add(new Option("保留本页修改到新基线", "incoming"));
        choice.value = choices.get(row.index) ?? "";
        choice.disabled = row.source === null;
        choice.addEventListener("change", () => {
          if (rowSignal.aborted || !this.#enabled || this.#comparison !== comparison
            || !this.#options.current(snapshot)) return;
          if (choice.value === "keep" || choice.value === "incoming") choices.set(row.index, choice.value);
          else choices.delete(row.index);
          update();
        }, { signal: rowSignal });
        item.append(title, state, detail, choice);
        rows.append(item);
      }
      pageStatus.textContent = `第 ${this.#page + 1} / ${pages} 页，每页 ${PAGE_SIZE} 项`;
      previous.disabled = this.#page === 0;
      next.disabled = this.#page + 1 >= pages;
      rows.scrollTop = 0;
    };
    const turn = (delta: number): void => {
      if (!this.#enabled || this.#comparison !== comparison || !this.#options.current(snapshot)) return;
      this.#page += delta;
      renderRows();
    };
    const previous = button("上一页", () => turn(-1), signal);
    const next = button("下一页", () => turn(1), signal);
    paging.append(previous, pageStatus, next);
    fields.append(rows, paging);
    const apply = button("采用所选草稿与这次读取的基线", () => {
      if (!this.#enabled || this.#comparison !== comparison || !this.#options.current(snapshot)) return;
      try {
        const result = resolveDraftImport(plan, choices);
        this.#options.apply(snapshot, source, result.patch);
        this.applied(snapshot.patch, result.remaining, result.patch);
        this.#options.changed();
      } catch (error: unknown) {
        status.textContent = `尚未采用：${error instanceof Error ? error.message : "比较结果无效"}。请保留或导出原草稿后重新处理。`;
      }
    }, signal);
    this.#apply = apply;
    const cancel = button("取消比较，保留原基线与草稿", () => {
      if (this.#comparison !== comparison) return;
      this.clear();
      this.#options.notice("已取消磁盘比较，原基线、草稿历史和预览继续保留。");
      this.#options.changed();
    }, signal);
    const exportOriginal = button("导出比较前的完整草稿", () => downloadDraft(snapshot.patch, "磁盘比较前对白草稿"), signal);
    this.#options.root.hidden = false;
    this.#options.root.append(heading, identity, note, fields, status, apply, cancel, exportOriginal);
    renderRows();
    update();
    this.setEnabled(this.#enabled);
    heading.focus();
  }

  private applied(original: AuthorTextPatch, remaining: AuthorTextPatch, patch: AuthorTextPatch): void {
    this.clear();
    this.#remaining = remaining.edits.length > 0;
    const signal = this.#events.signal;
    this.#options.root.hidden = false;
    const note = element("p", `已采用这次读取的源为本页基线，保留 ${patch.edits.length} 个字段修改；没有写作者文件。旧预览已停止，原基线历史已清空，重新预览后再显式保存。`
      + (remaining.edits.length ? `另有 ${remaining.edits.length} 个旧修改未采用，请导出保留；关闭此结果会释放它们在此处的副本。`
        : "原修改已采用或已存在于这次读取的源。"));
    note.setAttribute("role", "status");
    this.#options.root.append(note,
      button("导出比较前的完整草稿", () => downloadDraft(original, "磁盘比较前对白草稿"), signal));
    if (remaining.edits.length) this.#options.root.append(
      button("导出未采用的旧修改", () => downloadDraft(remaining, "磁盘比较未采用对白草稿"), signal));
    this.#options.root.append(button("关闭比较结果（已自行保留需要的修改）", () => {
      this.clear();
      this.#options.changed();
    }, signal));
  }

  dispose(): void {
    this.#closed = true;
    this.clear();
  }
}
