import type { SourceLocation } from "./model.ts";
import { array, at, knownFields, object, reject, string } from "./read.ts";
import { hash } from "./content.ts";

export type AuthorChoiceProperty = "text" | "cond" | "set" | "target";
export const AUTHOR_NODE_FIELDS = ["speaker", "text", "set", "jump", "jumpIf", "ending", "cdef"] as const;
export type AuthorNodeField = (typeof AUTHOR_NODE_FIELDS)[number];
export type AuthorTextField = AuthorNodeField | `choice:${string}`
  | `choice-cond:${string}` | `choice-set:${string}` | `choice-target:${string}`;
export interface AuthorFieldValue { readonly field: AuthorTextField; readonly value: string }
const CHOICE_PREFIXES = {
  text: "choice:", cond: "choice-cond:", set: "choice-set:", target: "choice-target:",
} as const;

export function authorNodeField(field: string): AuthorNodeField | null {
  return AUTHOR_NODE_FIELDS.find(value => value === field) ?? null;
}

/** Choice fields use their stable author ID, never their label or array position. */
export function authorChoiceField(choiceId: string, property: AuthorChoiceProperty = "text"): AuthorTextField {
  return readAuthorTextField(`${CHOICE_PREFIXES[property]}${choiceId}`, SOURCE);
}

export function authorChoiceProperty(field: AuthorTextField): AuthorChoiceProperty | null {
  for (const property of ["text", "cond", "set", "target"] as const) {
    if (field.startsWith(CHOICE_PREFIXES[property])) return property;
  }
  return null;
}

export function authorChoiceId(field: AuthorTextField): string | null {
  const property = authorChoiceProperty(field);
  return property === null ? null : field.slice(CHOICE_PREFIXES[property].length);
}

export function authorTextLabel(field: AuthorTextField): string {
  const node = authorNodeField(field);
  if (node !== null) return {
    speaker: "说话人", text: "对白", set: "节点进入动作", jump: "节点跳转目标",
    jumpIf: "节点跳转条件", ending: "结局名称", cdef: "超时默认选项",
  }[node];
  const labels = { text: "文字", cond: "显示条件", set: "变量动作", target: "跳转目标" };
  return `选项 ${authorChoiceId(field)} · ${labels[authorChoiceProperty(field)!]}`;
}

export function readAuthorTextField(input: unknown, source: SourceLocation): AuthorTextField {
  const field = string(input, source);
  const node = authorNodeField(field);
  if (node !== null) return node;
  for (const property of ["text", "cond", "set", "target"] as const) {
    const prefix = CHOICE_PREFIXES[property];
    if (!field.startsWith(prefix)) continue;
    const id = field.slice(prefix.length);
    if (id.trim() && id.length <= 256) return `${prefix}${id}`;
  }
  return reject("AUTHOR_FIELD", "只允许已有对白、节点流转与按稳定 ID 定位的选项字段", source);
}

export interface AuthorTextEdit {
  nodeId: string;
  field: AuthorTextField;
  before: string;
  after: string;
}

export interface AuthorTextPatch {
  format: "haifeng.author-text-patch/4";
  sourceSha256: string;
  edits: AuthorTextEdit[];
}

const SOURCE: SourceLocation = { file: "author-text-patch", field: "" };

/** An editing command, not a second author source or a runtime instruction. */
export function readAuthorTextPatch(input: unknown): AuthorTextPatch {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "sourceSha256", "edits"], SOURCE);
  if (data.format !== "haifeng.author-text-patch/1" && data.format !== "haifeng.author-text-patch/2"
    && data.format !== "haifeng.author-text-patch/3" && data.format !== "haifeng.author-text-patch/4") {
    reject("AUTHOR_FORMAT", "不支持的作者字段修改格式", SOURCE);
  }
  const values = array(data.edits, at(SOURCE, "edits"));
  if (values.length > 1000) reject("AUTHOR_LIMIT", "单次最多修改 1000 个作者字段", SOURCE);
  const keys = new Set<string>();
  const edits = values.map((value, index): AuthorTextEdit => {
    const where = at(SOURCE, `edits.${index}`);
    const item = object(value, where);
    knownFields(item, ["nodeId", "field", "before", "after"], where);
    const nodeId = string(item.nodeId, at(where, "nodeId"));
    if (!nodeId || nodeId.length > 256) reject("AUTHOR_NODE", "节点标识无效", where);
    const field = readAuthorTextField(item.field, at(where, "field"));
    if (data.format !== "haifeng.author-text-patch/4" && authorNodeField(field) !== null
      && field !== "speaker" && field !== "text") {
      reject("AUTHOR_FIELD", "旧版草稿不支持节点动作、跳转、结局或默认选项", at(where, "field"));
    }
    if (data.format === "haifeng.author-text-patch/1" && field !== "speaker" && field !== "text") {
      reject("AUTHOR_FIELD", "旧版草稿仅支持说话人与对白字段", at(where, "field"));
    }
    if (data.format === "haifeng.author-text-patch/2" && authorChoiceProperty(field) !== null
      && authorChoiceProperty(field) !== "text") {
      reject("AUTHOR_FIELD", "第二版草稿不支持选项条件、动作或目标", at(where, "field"));
    }
    const before = string(item.before, at(where, "before"));
    const after = string(item.after, at(where, "after"));
    if (before.length > 100000 || after.length > 100000) reject("AUTHOR_LIMIT", "单个作者字段原文过长", where);
    const key = JSON.stringify([nodeId, field]);
    if (keys.has(key)) reject("AUTHOR_DUPLICATE", "同一字段包含重复修改", where);
    keys.add(key);
    return { nodeId, field, before, after };
  });
  return { format: "haifeng.author-text-patch/4", sourceSha256: hash(data.sourceSha256, at(SOURCE, "sourceSha256")), edits };
}
