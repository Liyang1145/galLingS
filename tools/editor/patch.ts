import { assembleAuthorProject, authorLocation } from "../content/source.ts";
import type { AuthorNode, AuthorProject } from "../content/source.ts";
import { authorJson } from "../content/json.ts";
import type { StringToken } from "../content/json.ts";
import { AUTHOR_NODE_FIELDS, authorChoiceField, readAuthorTextPatch } from "../../packages/story-model/src/author.ts";
import type { AuthorFieldValue, AuthorTextField } from "../../packages/story-model/src/author.ts";
import { reject } from "../../packages/story-model/src/read.ts";

/** Resolve approved string targets from the current raw node, never from a client path. */
function nodeTextFields(node: AuthorNode): ReadonlyMap<AuthorTextField, { path: (string | number)[]; value: string }> {
  const fields = new Map<AuthorTextField, { path: (string | number)[]; value: string }>();
  for (const field of AUTHOR_NODE_FIELDS) {
    const value = node.record[field];
    if (typeof value === "string") fields.set(field, { path: [field], value });
  }
  if (!Array.isArray(node.record.choices)) reject("AUTHOR_FIELD", "作者选项列表无效", node.where);
  node.record.choices.forEach((value: unknown, index: number) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)
      || !("id" in value) || typeof value.id !== "string"
      || !("text" in value) || typeof value.text !== "string") {
      reject("AUTHOR_FIELD", "选项须有稳定身份和已有文字字符串", { ...node.where, field: `${node.where.field}.choices.${index}` });
    }
    if (fields.has(authorChoiceField(value.id))) reject("AUTHOR_FIELD", "节点的选项身份重复，拒绝有歧义的修改", node.where);
    for (const property of ["text", "cond", "set", "target"] as const) {
      const raw = Object.hasOwn(value, property) ? Reflect.get(value, property) as unknown : undefined;
      if (typeof raw === "string") fields.set(authorChoiceField(value.id, property), { path: ["choices", index, property], value: raw });
    }
  });
  return fields;
}

export function authorFields(project: AuthorProject): Record<string, AuthorFieldValue[]> {
  return Object.fromEntries(project.nodes.map(node => [String(node.record.id),
    [...nodeTextFields(node)].map(([field, target]) => ({ field, value: target.value })),
  ]));
}

/** Prepare exact author-byte replacements in memory. No lock, file write or resource loading. */
export function prepareAuthorPatch(original: AuthorProject, input: unknown): {
  updated: AuthorProject; changed: ReadonlyMap<string, Uint8Array>;
} {
  const patch = readAuthorTextPatch(input);
  if (original.sourceSha256 !== patch.sourceSha256) {
    reject("AUTHOR_CONFLICT", "作者源已改变；先导出草稿，再重新读取并处理冲突", authorLocation("project.json"));
  }
  const ids = new Map(original.nodes.map(node => [node.record.id, node]));
  if (ids.size !== original.nodes.length) reject("AUTHOR_NODE", "作者节点 ID 重复", authorLocation("project.json"));
  const documents = new Map<string, ReturnType<typeof authorJson>>();
  const changes = new Map<string, (StringToken & { after: string })[]>();
  for (const edit of patch.edits) {
    const node = ids.get(edit.nodeId);
    const target = node ? nodeTextFields(node).get(edit.field) : undefined;
    if (!node || !target || target.value !== edit.before) {
      reject("AUTHOR_CONFLICT", "原字段缺失、类型不符或已改变", node
        ? { ...node.where, field: `${node.where.field}.${edit.field}` }
        : { ...authorLocation("project.json"), nodeId: edit.nodeId });
    }
    let document = documents.get(node.file);
    if (!document) {
      document = authorJson(original.files.get(node.file)!, authorLocation(node.file).file);
      documents.set(node.file, document);
    }
    const span = document.strings.get(JSON.stringify(["nodes", node.index, ...target.path]));
    if (!span || span.value !== edit.before) reject("AUTHOR_CONFLICT", "原字符串位置无法明确定位，拒绝写回", node.where);
    if (edit.before === edit.after) continue;
    const edits = changes.get(node.file) ?? [];
    edits.push({ ...span, after: edit.after });
    changes.set(node.file, edits);
  }
  const files = new Map(original.files);
  const changed = new Map<string, Uint8Array>();
  for (const [file, edits] of changes) {
    let text = documents.get(file)!.text;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      text = text.slice(0, edit.start) + JSON.stringify(edit.after) + text.slice(edit.end);
    }
    const bytes = Buffer.from(text, "utf8");
    files.set(file, bytes);
    changed.set(file, bytes);
  }
  return { updated: assembleAuthorProject(files), changed };
}
