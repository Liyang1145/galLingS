import { authorTextLabel, readAuthorTextPatch } from "./author.ts";
import type { AuthorTextEdit, AuthorTextPatch } from "./author.ts";
import { authorDraftFields, authorTextKey } from "./author-draft.ts";
import type { AuthorDraftBase } from "./author-draft.ts";
import { hash } from "./content.ts";

type Field = AuthorTextEdit["field"];
type Edit = Readonly<AuthorTextEdit>;
interface Delta { readonly key: string; readonly before: Edit | null; readonly after: Edit | null }
interface Entry { readonly label: string; readonly deltas: readonly Delta[]; readonly units: number }
export interface DraftChange { readonly changed: boolean; readonly overflow: boolean }
export interface DraftHistoryStep { readonly label: string; readonly nodeId: string | null }

const same = (left: Edit | null, right: Edit | null): boolean => left === right
  || (left !== null && right !== null && left.nodeId === right.nodeId && left.field === right.field
    && left.before === right.before && left.after === right.after);
const unchanged: DraftChange = Object.freeze({ changed: false, overflow: false });
const SOURCE = { file: "author-draft-history", field: "" };

/** Bounded draft changes against one author source. No files, timers or story runtime. */
export class AuthorDraftHistory {
  readonly #maxEntries: number;
  readonly #maxUnits: number;
  #source: string | null = null;
  #base: ReadonlyMap<string, Readonly<Omit<AuthorTextEdit, "after">>> = new Map();
  #edits = new Map<string, Edit>();
  #past: Entry[] = [];
  #future: Entry[] = [];
  #units = 0;
  #group: string | null = null;
  #limited = false;

  constructor(limits: { maxEntries: number; maxUnits: number }) {
    if (!Number.isSafeInteger(limits.maxEntries) || limits.maxEntries < 1
      || !Number.isSafeInteger(limits.maxUnits) || limits.maxUnits < 1) {
      throw new Error("草稿历史容量必须是正的安全整数");
    }
    this.#maxEntries = limits.maxEntries;
    this.#maxUnits = limits.maxUnits;
  }

  reset(base: AuthorDraftBase): void {
    const source = hash(base.sourceSha256, SOURCE);
    const fields = authorDraftFields(base);
    this.clear();
    this.#source = source;
    this.#base = fields;
  }

  clear(): void {
    this.#source = null;
    this.#base = new Map();
    this.#edits.clear();
    this.#past = [];
    this.#future = [];
    this.#units = 0;
    this.#limited = false;
    this.closeGroup();
  }

  get size(): number { return this.#edits.size; }
  get(key: string): Edit | undefined { return this.#edits.get(key); }
  has(key: string): boolean { return this.#edits.has(key); }
  values(): IterableIterator<Edit> { return this.#edits.values(); }
  get status() {
    return Object.freeze({
      undo: this.#past.at(-1)?.label ?? null, redo: this.#future.at(-1)?.label ?? null,
      undoSteps: this.#past.length, redoSteps: this.#future.length, limited: this.#limited,
    });
  }

  closeGroup(): void { this.#group = null; }

  patch(): AuthorTextPatch {
    if (this.#source === null) throw new Error("尚未读取草稿基线");
    return {
      format: "haifeng.author-text-patch/4", sourceSha256: this.#source,
      edits: [...this.#edits.values()].map(edit => ({ ...edit })),
    };
  }

  update(nodeId: string, field: Field, after: string, group: string | null = null): DraftChange {
    const key = authorTextKey(nodeId, field);
    const base = this.#base.get(key);
    if (!base || this.#source === null) throw new Error("当前节点或字符串字段不可编辑");
    const before = this.#edits.get(key) ?? null;
    let next: Edit | null = null;
    if (after !== base.before) {
      const checked = readAuthorTextPatch({
        format: "haifeng.author-text-patch/4", sourceSha256: this.#source, edits: [{ ...base, after }],
      });
      next = Object.freeze({ ...checked.edits[0]! });
      if (before === null && this.#edits.size >= 1000) throw new Error("本片单次最多修改 1000 个字段；请先保存或导出已有草稿");
    }
    return this.commit([{ key, before, after: next }], `${nodeId} · ${authorTextLabel(field)}`, group);
  }

  removeNode(nodeId: string): DraftChange {
    this.closeGroup();
    return this.commit([...this.#edits].filter(([, edit]) => edit.nodeId === nodeId)
      .map(([key, before]) => ({ key, before, after: null })), `还原节点 ${nodeId}`, null);
  }

  replace(input: unknown): DraftChange {
    this.closeGroup();
    const patch = readAuthorTextPatch(input);
    if (this.#source === null || patch.sourceSha256 !== this.#source) throw new Error("导入草稿与当前源摘要不一致");
    const next = new Map<string, Edit>();
    for (const edit of patch.edits) {
      const key = authorTextKey(edit.nodeId, edit.field);
      const base = this.#base.get(key);
      if (!base || base.before !== edit.before) throw new Error(`导入原值与当前可编辑字段不一致：${edit.nodeId} · ${edit.field}`);
      if (edit.before !== edit.after) next.set(key, Object.freeze({ ...edit }));
    }
    const keys = new Set([...this.#edits.keys(), ...next.keys()]);
    const deltas = [...keys].map(key => ({ key, before: this.#edits.get(key) ?? null, after: next.get(key) ?? null }));
    return this.commit(deltas, "采用导入草稿", null);
  }

  undo(): DraftHistoryStep | null { return this.move(this.#past, this.#future, "undo"); }
  redo(): DraftHistoryStep | null { return this.move(this.#future, this.#past, "redo"); }

  private move(from: Entry[], to: Entry[], direction: "undo" | "redo"): DraftHistoryStep | null {
    this.closeGroup();
    const entry = from.at(-1);
    if (!entry) return null;
    const next = new Map(this.#edits);
    const nodes = new Set<string>();
    for (const delta of entry.deltas) {
      const expected = direction === "undo" ? delta.after : delta.before;
      const value = direction === "undo" ? delta.before : delta.after;
      if (!same(next.get(delta.key) ?? null, expected)) throw new Error("草稿历史与当前字段不一致，未采用历史结果");
      if (value) next.set(delta.key, value);
      else next.delete(delta.key);
      nodes.add((delta.after ?? delta.before)!.nodeId);
    }
    this.#edits = next;
    from.pop();
    to.push(entry);
    return Object.freeze({ label: entry.label, nodeId: nodes.size === 1 ? [...nodes][0]! : null });
  }

  private commit(input: readonly Delta[], label: string, group: string | null): DraftChange {
    const deltas = input.filter(delta => !same(delta.before, delta.after));
    if (!deltas.length) return unchanged;
    const next = new Map(this.#edits);
    for (const delta of deltas) {
      if (!same(next.get(delta.key) ?? null, delta.before)) throw new Error("草稿操作与当前字段不一致");
      if (delta.after) next.set(delta.key, delta.after);
      else next.delete(delta.key);
    }
    // Only repeated input to the same focused field may join one undo step.
    const previous = this.#past.at(-1);
    let retained = deltas;
    if (group !== null && group === this.#group && previous?.deltas.length === 1 && deltas.length === 1
      && previous.deltas[0]!.key === deltas[0]!.key) {
      const merged = { ...deltas[0]!, before: previous.deltas[0]!.before };
      retained = same(merged.before, merged.after) ? [] : [merged];
      this.#past.pop();
      this.#units -= previous.units;
    }
    for (const entry of this.#future) this.#units -= entry.units;
    this.#future = [];
    this.#edits = next;
    this.closeGroup();
    const cost = (edit: Edit | null): number => edit ? edit.nodeId.length + edit.field.length + edit.before.length + edit.after.length : 0;
    const units = label.length + retained.reduce((sum, delta) => sum + delta.key.length + cost(delta.before) + cost(delta.after), 0);
    if (retained.length && units > this.#maxUnits) {
      // An accepted large edit must not expose an older undo chain that skips it.
      this.#past = [];
      this.#units = 0;
      this.#limited = true;
      return Object.freeze({ changed: true, overflow: true });
    }
    if (retained.length) {
      const entry = Object.freeze({ label, units, deltas: Object.freeze(retained.map(delta => Object.freeze({ ...delta }))) });
      this.#past.push(entry);
      this.#units += units;
      while (this.#past.length > this.#maxEntries || this.#units > this.#maxUnits) {
        this.#units -= this.#past.shift()!.units;
        this.#limited = true;
      }
      this.#group = group;
    }
    return Object.freeze({ changed: true, overflow: false });
  }
}
