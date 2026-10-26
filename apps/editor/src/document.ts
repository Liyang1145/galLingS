import { hash, localPath, oneOf, readSourceLocation, readStoryContent } from "../../../packages/story-model/src/content.ts";
import type { Diagnostic, StoryContent } from "../../../packages/story-model/src/model.ts";
import { array, at, knownFields, object, reject, string } from "../../../packages/story-model/src/read.ts";

export interface AuthorDocument {
  sourceSha256: string;
  content: StoryContent;
  locations: Record<string, string>;
  editable: Record<string, ("speaker" | "text")[]>;
  backup: string | null;
}

/** Existing editor error response, not another content validator or a saved-write receipt. */
export class AuthorRequestError extends Error {
  readonly diagnostic: Diagnostic | null;
  constructor(message: string, diagnostic: Diagnostic | null) {
    super(message);
    this.name = "AuthorRequestError";
    this.diagnostic = diagnostic;
  }
}

export function readAuthorFailure(input: unknown): AuthorRequestError {
  const source = { file: "editor-error-response", field: "" };
  const data = object(input, source);
  knownFields(data, ["error", "diagnostic"], source);
  const message = string(data.error, at(source, "error"));
  let diagnostic: Diagnostic | null = null;
  if (Object.hasOwn(data, "diagnostic")) {
    const where = at(source, "diagnostic");
    const item = object(data.diagnostic, where);
    knownFields(item, ["code", "message", "source"], where);
    const code = string(item.code, at(where, "code"));
    if (!code.trim()) reject("AUTHOR_DIAGNOSTIC", "诊断代码不能为空", at(where, "code"));
    diagnostic = Object.freeze({
      code, message: string(item.message, at(where, "message")),
      source: Object.freeze(readSourceLocation(item.source, at(where, "source"))),
    });
  }
  return new AuthorRequestError(message, diagnostic);
}

export function readAuthorDocument(input: unknown): AuthorDocument {
  const source = { file: "editor-response", field: "" };
  const data = object(input, source);
  knownFields(data, ["sourceSha256", "content", "locations", "editable", "backup"], source);
  const content = readStoryContent(data.content, "editor-response.content");
  const sourceSha256 = hash(data.sourceSha256, at(source, "sourceSha256"));
  if (sourceSha256 !== content.source.sha256) reject("AUTHOR_HASH", "作者源摘要与内容来源不一致", source);
  const rawLocations = object(data.locations, at(source, "locations"));
  knownFields(rawLocations, content.resources.map(resource => resource.id), at(source, "locations"));
  const locations = Object.fromEntries(content.resources.map(resource => {
    const value = string(rawLocations[resource.id], at(source, `locations.${resource.id}`));
    const url = new URL(value, location.origin);
    const match = /^\/__editor\/media\/[a-f0-9]{64}\/([^/?#]+)$/u.exec(value);
    if (!match || match[1] !== encodeURIComponent(resource.id) || url.origin !== location.origin || url.search || url.hash) {
      reject("AUTHOR_RESOURCE", "预览只允许本机登记资源", at(source, `locations.${resource.id}`));
    }
    return [resource.id, value];
  }));
  const rawEditable = object(data.editable, at(source, "editable"));
  knownFields(rawEditable, content.nodes.map(node => node.id), at(source, "editable"));
  const editable = Object.fromEntries(content.nodes.map(node => {
    const where = at(source, `editable.${node.id}`);
    const fields = array(rawEditable[node.id], where).map(value => oneOf(value, ["speaker", "text"] as const, where));
    if (fields.length !== new Set(fields).size) reject("AUTHOR_FIELDS", "可编辑字段重复", where);
    return [node.id, fields];
  }));
  return {
    sourceSha256, content, locations, editable,
    backup: data.backup === null ? null : localPath(data.backup, at(source, "backup")),
  };
}
