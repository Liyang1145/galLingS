import { readAuthorTextPatch } from "./author.ts";
import type { AuthorTextEdit, AuthorTextPatch } from "./author.ts";
import { hash } from "./content.ts";
import { reject } from "./read.ts";

type Field = AuthorTextEdit["field"];
export type DraftImportChoice = "keep" | "incoming";

/** Existing raw author strings only; null means missing or outside this slice. */
export interface AuthorDraftBase {
  readonly sourceSha256: string;
  readonly nodes: readonly {
    readonly id: string;
    readonly speaker: string | null;
    readonly text: string | null;
  }[];
}

export interface DraftImportRow {
  readonly index: number;
  readonly edit: Readonly<AuthorTextEdit>;
  readonly source: string | null;
  readonly local: string | null;
  readonly status: "ready" | "same" | "unchanged" | "already-in-source" | "conflict" | "unavailable";
  readonly sourceChanged: boolean;
  readonly localChanged: boolean;
  readonly defaultChoice: DraftImportChoice | null;
}

export interface DraftImportPlan {
  readonly sourceSha256: string;
  readonly importedSha256: string;
  readonly existing: readonly Readonly<AuthorTextEdit>[];
  readonly rows: readonly DraftImportRow[];
}

const SOURCE = { file: "author-draft-import", field: "" };
export const authorTextKey = (nodeId: string, field: Field): string => JSON.stringify([nodeId, field]);

/** Compare strings by stable node/field identity; no fuzzy match or story execution. */
export function prepareDraftImport(
  base: AuthorDraftBase, currentInput: unknown, importedInput: unknown,
): DraftImportPlan {
  const sourceSha256 = hash(base.sourceSha256, SOURCE);
  const current = readAuthorTextPatch(currentInput);
  const imported = readAuthorTextPatch(importedInput);
  if (current.sourceSha256 !== sourceSha256) reject("DRAFT_BASE", "当前草稿与已读取作者源不一致", SOURCE);
  const nodes = new Map(base.nodes.map(node => [node.id, node]));
  if (nodes.size !== base.nodes.length) reject("DRAFT_NODE", "当前作者源节点标识重复", SOURCE);
  const existing = current.edits.map(edit => {
    const source = nodes.get(edit.nodeId)?.[edit.field];
    if (typeof source !== "string" || source !== edit.before) {
      reject("DRAFT_BASE", "当前草稿原值与可编辑字段不一致", { ...SOURCE, nodeId: edit.nodeId, field: edit.field });
    }
    return Object.freeze({ ...edit });
  });
  const localEdits = new Map(existing.map(edit => [authorTextKey(edit.nodeId, edit.field), edit]));
  const rows = imported.edits.map((value, index): DraftImportRow => {
    const edit = Object.freeze({ ...value });
    const source = nodes.get(edit.nodeId)?.[edit.field] ?? null;
    const local = source === null ? null : localEdits.get(authorTextKey(edit.nodeId, edit.field))?.after ?? source;
    const sourceChanged = source !== null && source !== edit.before;
    const localChanged = local !== null && local !== source;
    let status: DraftImportRow["status"];
    let defaultChoice: DraftImportChoice | null;
    if (source === null) { status = "unavailable"; defaultChoice = "keep"; }
    else if (local === edit.after) { status = "same"; defaultChoice = "keep"; }
    else if (edit.before === edit.after) { status = "unchanged"; defaultChoice = "keep"; }
    else if (source === edit.after) { status = "already-in-source"; defaultChoice = "keep"; }
    else if (!sourceChanged && !localChanged) { status = "ready"; defaultChoice = "incoming"; }
    else { status = "conflict"; defaultChoice = null; }
    return Object.freeze({ index, edit, source, local, status, sourceChanged, localChanged, defaultChoice });
  });
  return Object.freeze({
    sourceSha256, importedSha256: imported.sourceSha256,
    existing: Object.freeze(existing), rows: Object.freeze(rows),
  });
}

/** Explicit decisions produce a new draft against the current source; never write a file. */
export function resolveDraftImport(
  plan: DraftImportPlan, choices: ReadonlyMap<number, DraftImportChoice>,
): { patch: AuthorTextPatch; remaining: AuthorTextPatch } {
  if (choices.size !== plan.rows.length) reject("DRAFT_DECISION", "每个导入字段都需要明确的处理结果", SOURCE);
  const edits = new Map(plan.existing.map(edit => [authorTextKey(edit.nodeId, edit.field), { ...edit }]));
  const remaining: AuthorTextEdit[] = [];
  for (const row of plan.rows) {
    const choice = choices.get(row.index);
    if (choice !== "keep" && choice !== "incoming") reject("DRAFT_DECISION", "仍有未处理的字段冲突", {
      ...SOURCE, nodeId: row.edit.nodeId, field: row.edit.field,
    });
    const key = authorTextKey(row.edit.nodeId, row.edit.field);
    if (choice === "incoming") {
      if (row.source === null) reject("DRAFT_FIELD", "节点或原字符串字段不可编辑，不能采用导入值", {
        ...SOURCE, nodeId: row.edit.nodeId, field: row.edit.field,
      });
      if (row.edit.after === row.source) edits.delete(key);
      else edits.set(key, { nodeId: row.edit.nodeId, field: row.edit.field, before: row.source, after: row.edit.after });
    } else if (row.edit.after !== row.edit.before && row.edit.after !== row.local) {
      // Retain skipped imported work with its original base, not a fabricated new base.
      remaining.push({ ...row.edit });
    }
  }
  return {
    patch: readAuthorTextPatch({
      format: "haifeng.author-text-patch/1", sourceSha256: plan.sourceSha256, edits: [...edits.values()],
    }),
    remaining: readAuthorTextPatch({
      format: "haifeng.author-text-patch/1", sourceSha256: plan.importedSha256, edits: remaining,
    }),
  };
}
