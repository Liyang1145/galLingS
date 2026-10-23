import type { SourceLocation } from "./model.ts";
import { array, at, knownFields, object, reject, string } from "./read.ts";
import { hash, oneOf } from "./content.ts";

export interface AuthorTextEdit {
  nodeId: string;
  field: "speaker" | "text";
  before: string;
  after: string;
}

export interface AuthorTextPatch {
  format: "haifeng.author-text-patch/1";
  sourceSha256: string;
  edits: AuthorTextEdit[];
}

const SOURCE: SourceLocation = { file: "author-text-patch", field: "" };

/** An editing command, not a second author source or a runtime instruction. */
export function readAuthorTextPatch(input: unknown): AuthorTextPatch {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "sourceSha256", "edits"], SOURCE);
  if (data.format !== "haifeng.author-text-patch/1") reject("AUTHOR_FORMAT", "不支持的对白修改格式", SOURCE);
  const values = array(data.edits, at(SOURCE, "edits"));
  if (values.length > 1000) reject("AUTHOR_LIMIT", "本片单次最多修改 1000 个对白字段", SOURCE);
  const keys = new Set<string>();
  const edits = values.map((value, index): AuthorTextEdit => {
    const where = at(SOURCE, `edits.${index}`);
    const item = object(value, where);
    knownFields(item, ["nodeId", "field", "before", "after"], where);
    const nodeId = string(item.nodeId, at(where, "nodeId"));
    if (!nodeId || nodeId.length > 256) reject("AUTHOR_NODE", "节点标识无效", where);
    const field = oneOf(item.field, ["speaker", "text"] as const, at(where, "field"));
    const before = string(item.before, at(where, "before"));
    const after = string(item.after, at(where, "after"));
    if (before.length > 100000 || after.length > 100000) reject("AUTHOR_LIMIT", "单个对白字段过长", where);
    const key = JSON.stringify([nodeId, field]);
    if (keys.has(key)) reject("AUTHOR_DUPLICATE", "同一字段包含重复修改", where);
    keys.add(key);
    return { nodeId, field, before, after };
  });
  return { format: "haifeng.author-text-patch/1", sourceSha256: hash(data.sourceSha256, at(SOURCE, "sourceSha256")), edits };
}
