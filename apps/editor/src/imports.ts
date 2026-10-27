import { prepareDraftImport, resolveDraftImport } from "../../../packages/story-model/src/author-draft.ts";
import type { AuthorDraftBase, DraftImportChoice, DraftImportPlan, DraftImportRow } from "../../../packages/story-model/src/author-draft.ts";
import type { AuthorTextPatch } from "../../../packages/story-model/src/author.ts";
import { authorTextLabel } from "../../../packages/story-model/src/author.ts";
import { downloadDraft } from "./download.ts";
import { readAuthorWorkspacePatch } from "../../../packages/story-model/src/author-workspace.ts";
import type { AuthorWorkspacePatch } from "../../../packages/story-model/src/author-workspace.ts";

export interface DraftImportSnapshot {
  revision: number;
  base: AuthorDraftBase;
  patch: AuthorTextPatch;
}

interface Options {
  input: HTMLInputElement;
  panel: HTMLElement;
  capture(): DraftImportSnapshot | null;
  current(snapshot: DraftImportSnapshot): boolean;
  apply(snapshot: DraftImportSnapshot, patch: AuthorTextPatch): void;
  applyWorkspace(snapshot: DraftImportSnapshot, patch: AuthorWorkspacePatch): void;
  changed(): void;
  notice(message: string): void;
}

const STATUS: Record<DraftImportRow["status"], string> = {
  ready: "可采用导入修改",
  same: "当前草稿已是导入新值",
  unchanged: "导入字段没有实际修改，默认保留当前草稿",
  "already-in-source": "作者源已有导入新值，默认保留本页的另行修改",
  conflict: "存在冲突，请明确选择",
  unavailable: "节点或原字符串字段不可编辑，只能跳过",
};

/** Local file comparison only. Applying affects the draft, never the author API. */
export class AuthorDraftImporter {
  readonly #options: Options;
  readonly #events = new AbortController();
  #viewEvents = new AbortController();
  #epoch = 0;
  #disposed = false;
  #enabled = false;
  #pending = false;
  #plan: DraftImportPlan | null = null;
  #workspace: AuthorWorkspacePatch | null = null;
  #applyButton: HTMLButtonElement | null = null;
  #unresolved = 0;

  constructor(options: Options) {
    this.#options = options;
    options.input.addEventListener("change", () => { void this.readFile(); }, { signal: this.#events.signal });
  }

  get active(): boolean { return this.#pending || this.#plan !== null || this.#workspace !== null; }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled && !this.#disposed;
    this.#options.input.disabled = !this.#enabled;
    this.updateApply();
  }

  private updateApply(): void {
    if (this.#applyButton) this.#applyButton.disabled = !this.#enabled || this.#unresolved > 0
      || (!this.#workspace && !this.#plan?.rows.length);
  }

  private view(): AbortSignal {
    this.#viewEvents.abort();
    this.#viewEvents = new AbortController();
    this.#applyButton = null;
    this.#options.panel.hidden = false;
    this.#options.panel.replaceChildren();
    return this.#viewEvents.signal;
  }

  invalidate(reason = "当前草稿或作者源已改变，原导入比较已取消；请重新选择草稿文件。"): void {
    if (!this.active) return;
    ++this.#epoch;
    this.#pending = false;
    this.#plan = null;
    this.#workspace = null;
    this.#viewEvents.abort();
    this.#applyButton = null;
    this.#options.panel.replaceChildren();
    this.#options.panel.hidden = true;
    this.#options.notice(reason);
    this.#options.changed();
  }

  private cancelButton(signal: AbortSignal): HTMLButtonElement {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消导入比较";
    cancel.addEventListener("click", () => this.invalidate("已取消导入，本页原有草稿保持原值。"), { signal });
    return cancel;
  }

  private async readFile(): Promise<void> {
    const file = this.#options.input.files?.[0];
    this.#options.input.value = "";
    if (!file || !this.#enabled || this.#disposed) return;
    const snapshot = this.#options.capture();
    if (!snapshot) return;
    const request = ++this.#epoch;
    this.#pending = true;
    this.#plan = null;
    this.#workspace = null;
    const signal = this.view();
    const loading = document.createElement("p");
    loading.setAttribute("role", "status");
    loading.textContent = "正在读取本机草稿文件；当前草稿与作者源尚未改变……";
    this.#options.panel.append(loading, this.cancelButton(signal));
    this.#options.changed();
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("导入文件超过 20 MiB，请分批处理修改。");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      if (this.#disposed || request !== this.#epoch) return;
      if (!this.#options.current(snapshot)) throw new Error("读取文件期间草稿已改变，请重新选择文件。");
      const input: unknown = JSON.parse(text);
      if (typeof input === "object" && input !== null && "format" in input && input.format === "haifeng.author-workspace-patch/1") {
        const patch = readAuthorWorkspacePatch(input);
        if (patch.sourceSha256 !== snapshot.base.sourceSha256) throw new Error("工程草稿来源与当前作者源不同，请先处理来源差异");
        this.#workspace = patch;
        this.#pending = false;
        this.renderWorkspace(snapshot, patch);
        return;
      }
      const plan = prepareDraftImport(snapshot.base, snapshot.patch, input);
      this.#plan = plan;
      this.#pending = false;
      this.renderPlan(snapshot, plan);
    } catch (error: unknown) {
      if (this.#disposed || request !== this.#epoch) return;
      this.#pending = false;
      this.#plan = null;
      this.#workspace = null;
      this.view();
      const problem = document.createElement("p");
      problem.className = "problem";
      problem.setAttribute("role", "alert");
      problem.textContent = `草稿未导入：${error instanceof Error ? error.message : "文件读取或格式无效"}。当前草稿和作者源保持原值。`;
      this.#options.panel.append(problem);
    } finally {
      if (!this.#disposed && request === this.#epoch) this.#options.changed();
    }
  }

  private renderWorkspace(snapshot: DraftImportSnapshot, patch: AuthorWorkspacePatch): void {
    const signal = this.view();
    this.#unresolved = 0;
    const heading = document.createElement("h2");
    heading.textContent = "导入完整工程草稿";
    const note = document.createElement("p");
    note.textContent = `包含 ${patch.workspace.chapters.length} 个章节、`
      + `${patch.workspace.chapters.reduce((sum, chapter) => sum + chapter.nodes.length, 0)} 个节点。`
      + "采用会替换本页当前草稿，可撤销；建议先导出需要保留的本页修改。采用不会写入作者文件，仍须明确保存。";
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "采用完整工程草稿，替换本页修改";
    this.#applyButton = apply;
    apply.addEventListener("click", () => {
      if (!this.#enabled || this.#workspace !== patch) return;
      try {
        if (!this.#options.current(snapshot)) throw new Error("本页草稿已变化，请重新导入");
        this.#options.applyWorkspace(snapshot, patch);
        this.#workspace = null;
        this.view();
        const status = document.createElement("p");
        status.textContent = "工程草稿已采用到本页，可预览、撤销或保存到作者源。";
        this.#options.panel.append(status);
        this.#options.changed();
      } catch (error: unknown) {
        note.textContent = `尚未采用：${error instanceof Error ? error.message : "工程草稿无效"}。当前草稿保留。`;
      }
    }, { signal });
    this.#options.panel.append(heading, note, apply, this.cancelButton(signal));
    this.updateApply();
  }

  private renderPlan(snapshot: DraftImportSnapshot, plan: DraftImportPlan): void {
    const signal = this.view();
    const heading = document.createElement("h2");
    heading.textContent = "导入比较";
    const identity = document.createElement("p");
    identity.className = "help";
    identity.textContent = plan.importedSha256 === plan.sourceSha256
      ? `导入草稿与当前源摘要相同：${plan.sourceSha256}`
      : `作者源与导出时不同。原摘要：${plan.importedSha256}；当前摘要：${plan.sourceSha256}。本次只按下列明确选择生成当前源上的草稿。`;
    const note = document.createElement("p");
    note.textContent = "非冲突字段已列出建议处理方式，冲突字段须逐项选择。采用后仍是本页草稿，“保存到作者源”才写文件。若编辑本页草稿，本次比较将取消，避免采用旧结果。";
    const rows = document.createElement("ol");
    rows.className = "draft-import-list";
    const choices = new Map<number, HTMLSelectElement>();
    for (const row of plan.rows) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = `${row.edit.nodeId} · ${authorTextLabel(row.edit.field)}`;
      const state = document.createElement("p");
      state.textContent = `${STATUS[row.status]}${row.status === "conflict"
        ? `（${row.sourceChanged ? "作者源与旧原文不同" : ""}${row.sourceChanged && row.localChanged ? "，" : ""}${row.localChanged ? "本页也有修改" : ""}）` : ""}`;
      const compare = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "对照四份文字";
      const texts = document.createElement("div");
      texts.className = "draft-comparison";
      compare.append(summary, texts);
      // Expand full texts on demand instead of copying every large source into DOM.
      compare.addEventListener("toggle", () => {
        texts.replaceChildren();
        if (!compare.open) return;
        for (const [name, value] of [
          ["导入文件里的旧原文", row.edit.before], ["当前作者源", row.source],
          ["本页当前草稿", row.local], ["导入新值", row.edit.after],
        ] as const) {
          const group = document.createElement("section");
          const label = document.createElement("h3");
          label.textContent = name;
          const pre = document.createElement("pre");
          pre.textContent = value === null ? "（当前节点或字符串字段不可用）" : value === "" ? "（空字符串）" : value;
          group.append(label, pre);
          texts.append(group);
        }
      }, { signal });
      const choice = document.createElement("select");
      choice.setAttribute("aria-label", `${row.edit.nodeId} ${row.edit.field} 的导入处理方式`);
      choice.add(new Option("请选择处理方式", ""));
      choice.add(new Option("保留本页当前值，跳过导入值", "keep"));
      if (row.source !== null) choice.add(new Option("采用导入新值", "incoming"));
      choice.value = row.defaultChoice ?? "";
      choice.disabled = row.source === null;
      choices.set(row.index, choice);
      item.append(title, state, compare, choice);
      rows.append(item);
    }
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const apply = document.createElement("button");
    apply.type = "button";
    apply.textContent = "采用本次选择到当前草稿";
    this.#applyButton = apply;
    const update = (): void => {
      this.#unresolved = [...choices.values()].filter(choice => !choice.value).length;
      status.textContent = `导入 ${plan.rows.length} 个字段，仍有 ${this.#unresolved} 个冲突待选择。原有 ${plan.existing.length} 个草稿字段会一并保留或按本次选择修改。`;
      this.updateApply();
    };
    for (const choice of choices.values()) choice.addEventListener("change", update, { signal });
    apply.addEventListener("click", () => {
      if (!this.#enabled || this.#plan !== plan) return;
      try {
        if (!this.#options.current(snapshot)) throw new Error("当前源或草稿已改变，不能采用旧比较；请重新导入。");
        const decisions = new Map<number, DraftImportChoice>();
        for (const [index, choice] of choices) {
          if (choice.value !== "keep" && choice.value !== "incoming") throw new Error("请先选择每个冲突字段的处理方式。");
          decisions.set(index, choice.value);
        }
        const result = resolveDraftImport(plan, decisions);
        // The callback checks the live revision again before replacing the whole draft.
        this.#options.apply(snapshot, result.patch);
        this.#plan = null;
        this.renderApplied(result.patch, result.remaining);
        this.#options.changed();
      } catch (error: unknown) {
        status.textContent = `尚未采用：${error instanceof Error ? error.message : "合并失败"}。当前草稿保持原值，可调整选择后重试。`;
      }
    }, { signal });
    this.#options.panel.append(heading, identity, note, rows, status, apply, this.cancelButton(signal));
    update();
  }

  private renderApplied(patch: AuthorTextPatch, remaining: AuthorTextPatch): void {
    const signal = this.view();
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = `本次选择生成了 ${patch.edits.length} 个字段的当前源草稿；导入动作没有写作者文件，保存结果请看页面顶部。`
      + (remaining.edits.length ? `另有 ${remaining.edits.length} 个导入修改未采用，可按原摘要单独导出；原导入文件未改动。` : "导入的实际修改已采用或已存在于当前值。");
    this.#options.panel.append(status);
    if (remaining.edits.length) {
      const exportRemaining = document.createElement("button");
      exportRemaining.type = "button";
      exportRemaining.textContent = "导出未采用的导入修改";
      exportRemaining.addEventListener("click", () => downloadDraft(remaining, "未采用对白草稿"), { signal });
      this.#options.panel.append(exportRemaining);
    }
  }

  dispose(): void {
    this.#disposed = true;
    ++this.#epoch;
    this.#pending = false;
    this.#plan = null;
    this.#workspace = null;
    this.#events.abort();
    this.#viewEvents.abort();
    this.#options.input.disabled = true;
    this.#options.panel.replaceChildren();
  }
}
