import {
  authorChoiceId, authorChoiceProperty, authorTextLabel, readAuthorTextPatch,
} from "../../../packages/story-model/src/author.ts";
import type { AuthorTextEdit, AuthorTextField, AuthorTextPatch } from "../../../packages/story-model/src/author.ts";
import { authorTextKey } from "../../../packages/story-model/src/author-draft.ts";
import {
  compileAuthorWorkspace, readAuthorWorkspace, readAuthorWorkspacePatch, workspaceFields,
} from "../../../packages/story-model/src/author-workspace.ts";
import type { AuthorWorkspaceModel, AuthorWorkspacePatch } from "../../../packages/story-model/src/author-workspace.ts";
import type { JsonObject, StoryContent } from "../../../packages/story-model/src/model.ts";
import { canonical } from "../../../packages/story-model/src/integrity.ts";
import type { AuthorDocument } from "./document.ts";

interface Entry { before: AuthorWorkspaceModel; after: AuthorWorkspaceModel; label: string; units: number; nodeId: string | null }
interface Change { changed: boolean; overflow: boolean }

// Keep unchanged subtrees shared between history entries, including after structural operations.
function share(before: unknown, after: unknown): unknown {
  if (before === after) return before;
  if (Array.isArray(before) && Array.isArray(after)) {
    const result = after.map((value, index) => share(before[index], value));
    return before.length === result.length && result.every((value, index) => value === before[index]) ? before : result;
  }
  if (before && after && typeof before === "object" && typeof after === "object"
    && !Array.isArray(before) && !Array.isArray(after)) {
    const old = before as Record<string, unknown>;
    const next = after as Record<string, unknown>;
    const entries = Object.entries(next).map(([key, value]) => [key, share(old[key], value)] as const);
    return Object.keys(old).length === entries.length && entries.every(([key, value]) => Object.hasOwn(old, key) && old[key] === value)
      ? before : Object.fromEntries(entries);
  }
  return after;
}
function units(before: unknown, after: unknown): number {
  if (before === after) return 0;
  if (Array.isArray(before) && Array.isArray(after)) {
    return 16 + Math.max(before.length, after.length)
      + Array.from({ length: Math.max(before.length, after.length) }, (_, index) => units(before[index], after[index])).reduce((a, b) => a + b, 0);
  }
  if (before && after && typeof before === "object" && typeof after === "object") {
    const old = before as Record<string, unknown>, next = after as Record<string, unknown>;
    return [...new Set([...Object.keys(old), ...Object.keys(next)])].reduce((sum, key) => sum + units(old[key], next[key]), 16);
  }
  return (JSON.stringify(before)?.length ?? 0) + (JSON.stringify(after)?.length ?? 0) + 16;
}
function setField(node: JsonObject, field: AuthorTextField, value: string): JsonObject {
  const id = authorChoiceId(field);
  if (id === null) return { ...node, [field]: value };
  const property = authorChoiceProperty(field)!;
  const choices = node.choices as JsonObject[];
  if (!choices.some(choice => choice.id === id)) throw new Error("选项已不存在");
  return { ...node, choices: choices.map(choice => choice.id === id ? { ...choice, [property]: value } : choice) };
}
function replaceNode(model: AuthorWorkspaceModel, id: string, update: (node: JsonObject) => JsonObject): AuthorWorkspaceModel {
  let found = false;
  const chapters = model.chapters.map(chapter => {
    if (!chapter.nodes.some(node => node.id === id)) return chapter;
    found = true;
    return { ...chapter, nodes: chapter.nodes.map(node => node.id === id ? update(node) : node) };
  });
  if (!found) throw new Error("节点已不存在");
  return { ...model, chapters };
}
function outlineModel(model: AuthorWorkspaceModel): AuthorWorkspaceModel {
  return { ...model, chapters: model.chapters.map(chapter => ({ ...chapter, nodes: chapter.nodes.map(node => ({
    ...node, set: "", jump: "", jumpIf: "", ending: "", ctime: 0, cdef: "",
    choices: (node.choices as JsonObject[]).map(choice => ({ ...choice, set: "", cond: "", target: "" })),
  })) })) };
}

/** One draft and bounded undo chain for fields, structure and later production edits. No file I/O. */
export class EditorProjectDraft {
  #source: AuthorDocument | null = null;
  #model: AuthorWorkspaceModel | null = null;
  #past: Entry[] = [];
  #future: Entry[] = [];
  #group: string | null = null;
  #limited = false;
  #document: AuthorDocument | null = null;
  #fields: Map<string, AuthorTextEdit> | null = null;
  #extended: boolean | null = null;
  #locations: Record<string, string> = {};
  readonly #limits: { maxEntries: number; maxUnits: number };
  constructor(limits: { maxEntries: number; maxUnits: number }) { this.#limits = limits; }

  reset(source: AuthorDocument): void {
    this.clear();
    this.#source = source;
    this.#model = source.workspace;
    this.#document = source;
  }
  clear(): void {
    this.#source = null; this.#model = null; this.#document = null; this.#fields = null; this.#extended = null;
    this.#past = []; this.#future = []; this.#limited = false; this.closeGroup();
    this.#locations = {};
  }
  closeGroup(): void { this.#group = null; }
  get model(): AuthorWorkspaceModel {
    if (!this.#model) throw new Error("尚未读取作者工程");
    return this.#model;
  }
  get status() {
    return {
      undo: this.#past.at(-1)?.label ?? null, redo: this.#future.at(-1)?.label ?? null,
      undoSteps: this.#past.length, redoSteps: this.#future.length, limited: this.#limited,
    };
  }
  private fields(): Map<string, AuthorTextEdit> {
    if (this.#fields) return this.#fields;
    if (!this.#model) return new Map();
    const originals = this.#source?.editable ?? {};
    this.#fields = new Map();
    for (const [nodeId, fields] of Object.entries(workspaceFields(this.model))) {
      for (const entry of fields) {
        const original = originals[nodeId]?.find(item => item.field === entry.field)?.value;
        if (original !== undefined && original !== entry.value) {
          const edit = { nodeId, field: entry.field, before: original, after: entry.value };
          this.#fields.set(authorTextKey(nodeId, entry.field), edit);
        }
      }
    }
    return this.#fields;
  }
  values(): IterableIterator<AuthorTextEdit> { return this.fields().values(); }
  get(key: string): AuthorTextEdit | undefined { return this.fields().get(key); }
  has(key: string): boolean { return this.fields().has(key); }
  get extended(): boolean {
    if (this.#extended !== null) return this.#extended;
    if (!this.#source) return false;
    let restored = this.model;
    try {
      for (const edit of this.fields().values()) restored = replaceNode(restored, edit.nodeId, node => setField(node, edit.field, edit.before));
      this.#extended = canonical(restored) !== canonical(this.#source.workspace);
    } catch { this.#extended = true; }
    return this.#extended;
  }
  get size(): number { return this.fields().size + (this.extended ? 1 : 0); }
  summary(): string[] {
    if (!this.#source || !this.extended) return [];
    const before = this.#source.workspace, after = this.model;
    const result: string[] = [];
    const oldChapters = new Map(before.chapters.map(chapter => [chapter.id, chapter]));
    const newChapters = new Map(after.chapters.map(chapter => [chapter.id, chapter]));
    const oldNodes = new Map(before.chapters.flatMap(chapter => chapter.nodes.map(node => [String(node.id), { node, chapter: chapter.id }] as const)));
    const newNodes = new Map(after.chapters.flatMap(chapter => chapter.nodes.map(node => [String(node.id), { node, chapter: chapter.id }] as const)));
    if (before.entryNodeId !== after.entryNodeId) result.push(`作品入口：${before.entryNodeId} → ${after.entryNodeId}`);
    if (canonical(before.chapters.map(chapter => chapter.id)) !== canonical(after.chapters.map(chapter => chapter.id))) result.push("章节目录或顺序已改变");
    for (const chapter of after.chapters) {
      const original = oldChapters.get(chapter.id);
      if (!original) result.push(`新增章节：${chapter.title || chapter.id}（${chapter.nodes.length} 个节点）`);
      else {
        if (original.title !== chapter.title) result.push(`章节改名：${original.title} → ${chapter.title}`);
        if (canonical(original.nodes.map(node => node.id)) !== canonical(chapter.nodes.map(node => node.id))) result.push(`章节 ${chapter.title || chapter.id} 的节点目录或顺序已改变`);
      }
    }
    for (const chapter of before.chapters) if (!newChapters.has(chapter.id)) result.push(`移除章节：${chapter.title || chapter.id}`);
    for (const [id, value] of newNodes) {
      const original = oldNodes.get(id);
      if (!original) result.push(`新增节点：${id}`);
      else {
        if (original.chapter !== value.chapter) result.push(`移动节点：${id}，${original.chapter} → ${value.chapter}`);
        const oldChoices = original.node.choices as JsonObject[], newChoices = value.node.choices as JsonObject[];
        if (canonical(oldChoices.map(choice => choice.id)) !== canonical(newChoices.map(choice => choice.id))) result.push(`节点 ${id} 的选项目录或顺序已改变`);
      }
    }
    for (const id of oldNodes.keys()) if (!newNodes.has(id)) result.push(`删除节点：${id}`);
    if (!result.length) result.push("存在其他工程字段修改；完整工程草稿包含这些修改");
    return result;
  }
  textPatch(): AuthorTextPatch {
    if (!this.#source) throw new Error("尚未读取作者源");
    return { format: "haifeng.author-text-patch/4", sourceSha256: this.#source.sourceSha256, edits: [...this.fields().values()] };
  }
  patch(): AuthorWorkspacePatch {
    if (!this.#source) throw new Error("尚未读取作者源");
    return { format: "haifeng.author-workspace-patch/1", sourceSha256: this.#source.sourceSha256, workspace: this.model,
      replaceProject: this.model.workId !== this.#source.workspace.workId };
  }
  inspect(): StoryContent {
    if (!this.#source) throw new Error("尚未读取作者源");
    const content = compileAuthorWorkspace(this.model, this.#source.sourceSha256);
    content.revision = this.#source.content.revision;
    return content;
  }
  document(): AuthorDocument {
    if (!this.#source) throw new Error("尚未读取作者源");
    if (this.#document) return this.#document;
    // Editing outline only: invalid/incomplete expressions must remain editable.
    // Reference inspection, preview and saving always compile the actual unmodified draft.
    let content: StoryContent;
    try { content = compileAuthorWorkspace(this.model, this.#source.sourceSha256); }
    catch { content = compileAuthorWorkspace(outlineModel(this.model), this.#source.sourceSha256); }
    content.revision = this.#source.content.revision;
    this.#document = { ...this.#source, workspace: this.model, content, editable: workspaceFields(this.model),
      locations: { ...this.#source.locations, ...this.#locations } };
    return this.#document;
  }
  update(nodeId: string, field: AuthorTextField, after: string, group: string | null = null): Change {
    if (after.length > 100000) throw new Error("字段超过长度限制");
    const node = this.model.chapters.flatMap(chapter => chapter.nodes).find(node => node.id === nodeId);
    if (!node || !workspaceFields(this.model)[nodeId]?.some(entry => entry.field === field)) throw new Error("字段不可编辑");
    const previousView = this.#document;
    const result = this.commit(replaceNode(this.model, nodeId, node => setField(node, field, after)),
      `${nodeId} · ${authorTextLabel(field)}`, group, nodeId);
    if (result.changed && previousView) {
      const content = { ...previousView.content, nodes: previousView.content.nodes.map(node => {
        if (node.id !== nodeId) return node;
        if (field === "speaker" || field === "text") return { ...node, presentation: { ...node.presentation, [field]: after } };
        const choiceId = authorChoiceId(field);
        if (choiceId && authorChoiceProperty(field) === "text" && node.flow.kind === "choice") {
          return { ...node, flow: { ...node.flow, choices: node.flow.choices.map(choice => choice.id === choiceId ? { ...choice, text: after } : choice) } };
        }
        return node;
      }) };
      this.#document = { ...previousView, workspace: this.model, content, editable: workspaceFields(this.model) };
    }
    return result;
  }
  change(label: string, update: (model: AuthorWorkspaceModel) => void): Change {
    this.closeGroup();
    const next = structuredClone(this.model);
    update(next);
    readAuthorWorkspace(next);
    compileAuthorWorkspace(outlineModel(next), this.#source!.sourceSha256);
    return this.commit(next, label, null);
  }
  replaceWorkspace(input: unknown): Change {
    const patch = readAuthorWorkspacePatch(input);
    if (!this.#source || patch.sourceSha256 !== this.#source.sourceSha256
      || (patch.workspace.workId !== this.model.workId && !patch.replaceProject)) {
      throw new Error("工程草稿与当前作品或作者源摘要不一致，请先处理来源差异");
    }
    compileAuthorWorkspace(outlineModel(patch.workspace), this.#source.sourceSha256);
    this.closeGroup();
    return this.commit(patch.workspace, "采用工程草稿", null);
  }
  registerLocations(locations: Record<string, string>): void {
    for (const [id, value] of Object.entries(locations)) {
      const match = /^\/__editor\/media\/[a-f0-9]{64}\/([^/?#]+)$/u.exec(value);
      if (!match || match[1] !== encodeURIComponent(id)) throw new Error("导入资源位置未登记");
    }
    Object.assign(this.#locations, locations);
    this.#document = null;
  }
  replace(input: unknown): Change {
    const patch = readAuthorTextPatch(input);
    if (!this.#source || patch.sourceSha256 !== this.#source.sourceSha256) throw new Error("草稿与作者源不一致");
    let next = this.model;
    // Replace the text delta while retaining structural/media work.
    for (const edit of this.fields().values()) next = replaceNode(next, edit.nodeId, node => setField(node, edit.field, edit.before));
    const available = workspaceFields(next);
    for (const edit of patch.edits) {
      if (available[edit.nodeId]?.find(entry => entry.field === edit.field)?.value !== edit.before) throw new Error("导入字段原值不匹配");
      next = replaceNode(next, edit.nodeId, node => setField(node, edit.field, edit.after));
    }
    this.closeGroup();
    return this.commit(next, "采用文字草稿", null);
  }
  removeNode(nodeId: string): Change {
    const original = this.#source?.workspace.chapters.flatMap(chapter => chapter.nodes).find(node => node.id === nodeId);
    if (!original) throw new Error("新节点没有已保存的原稿，可撤销新增操作或删除节点");
    this.closeGroup();
    return this.commit(replaceNode(this.model, nodeId, () => original), `还原节点 ${nodeId}`, null);
  }
  undo(): { label: string; nodeId: string | null } | null { return this.move(this.#past, this.#future, true); }
  redo(): { label: string; nodeId: string | null } | null { return this.move(this.#future, this.#past, false); }
  private move(from: Entry[], to: Entry[], undo: boolean): { label: string; nodeId: string | null } | null {
    this.closeGroup();
    const entry = from.pop();
    if (!entry) return null;
    this.#model = undo ? entry.before : entry.after;
    to.push(entry);
    this.invalidate();
    return { label: entry.label, nodeId: entry.nodeId };
  }
  private invalidate(): void { this.#document = null; this.#fields = null; this.#extended = null; }
  private commit(input: AuthorWorkspaceModel, label: string, group: string | null, nodeId: string | null = null): Change {
    const before = this.model;
    const after = share(before, input) as AuthorWorkspaceModel;
    if (before === after) return { changed: false, overflow: false };
    let origin = before;
    if (group && group === this.#group && this.#past.length) origin = this.#past.pop()!.before;
    const entry = { before: origin, after, label, units: units(origin, after) + label.length, nodeId };
    this.#future = [];
    this.#model = after;
    this.invalidate();
    this.#group = group;
    if (entry.units > this.#limits.maxUnits) {
      this.#past = []; this.#limited = true; this.closeGroup();
      return { changed: true, overflow: true };
    }
    this.#past.push(entry);
    let used = this.#past.reduce((sum, item) => sum + item.units, 0);
    while (this.#past.length > this.#limits.maxEntries || used > this.#limits.maxUnits) {
      used -= this.#past.shift()!.units;
      this.#limited = true;
    }
    return { changed: true, overflow: false };
  }
}
