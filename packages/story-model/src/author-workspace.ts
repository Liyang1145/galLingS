import type { JsonObject, SourceLocation, StoryContent } from "./model.ts";
import { array, at, jsonObject, knownFields, object, reject, string } from "./read.ts";
import { hash, nonempty } from "./content.ts";
import { compileAuthorProject } from "./author-compiler.ts";
import { AUTHOR_NODE_FIELDS, authorChoiceField } from "./author.ts";
import type { AuthorFieldValue } from "./author.ts";

import { authorLocation } from "./author-location.ts";
export { AUTHOR_FILE, authorLocation } from "./author-location.ts";
export interface AuthorCompilerInput {
  workId: string; title: string; entryNodeId: string; sourceSha256: string;
  variables: unknown[]; settings: JsonObject; metadata: JsonObject;
  assets: { key: string; record: Record<string, unknown>; where: SourceLocation }[];
  nodes: { record: Record<string, unknown>; where: SourceLocation; chapter: string }[];
}
export interface AuthorWorkspaceModel {
  workId: string;
  title: string;
  entryNodeId: string;
  chapters: { id: string; title: string; nodes: JsonObject[] }[];
  variables: JsonObject[];
  settings: JsonObject;
  metadata: JsonObject;
  migration: JsonObject;
  assets: { key: string; record: JsonObject }[];
}
export interface AuthorWorkspacePatch {
  format: "haifeng.author-workspace-patch/1";
  sourceSha256: string;
  workspace: AuthorWorkspaceModel;
  replaceProject: boolean;
}
const SOURCE = { file: "author-workspace", field: "" };
export function readAuthorWorkspace(input: unknown): AuthorWorkspaceModel {
  const data = object(input, SOURCE);
  knownFields(data, ["workId", "title", "entryNodeId", "chapters", "variables", "settings", "metadata", "migration", "assets"], SOURCE);
  const ids = new Set<string>();
  const nodes = new Set<string>();
  const choices = new Set<string>();
  const chapters = array(data.chapters, at(SOURCE, "chapters")).map((item, index) => {
    const where = at(SOURCE, `chapters.${index}`);
    const chapter = object(item, where);
    knownFields(chapter, ["id", "title", "nodes"], where);
    const id = string(chapter.id, at(where, "id"));
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/u.test(id) || ids.has(id)) reject("AUTHOR_CHAPTER", "章节 ID 无效或重复", where);
    ids.add(id);
    const records = array(chapter.nodes, at(where, "nodes")).map((value, nodeIndex) => {
      const source = at(where, `nodes.${nodeIndex}`);
      const record = jsonObject(value, source);
      const nodeId = nonempty(record.id, at(source, "id"));
      if (nodeId.length > 256 || nodes.has(nodeId)) reject("NODE_ID", "节点 ID 重复或过长", source);
      nodes.add(nodeId);
      for (const [choiceIndex, raw] of array(record.choices, at(source, "choices")).entries()) {
        const choiceSource = at(source, `choices.${choiceIndex}`);
        const choiceId = nonempty(object(raw, choiceSource).id, at(choiceSource, "id"));
        if (choiceId.length > 256 || choices.has(choiceId)) reject("CHOICE_ID", "选项 ID 重复或过长", choiceSource);
        choices.add(choiceId);
      }
      return record;
    });
    return { id, title: string(chapter.title, at(where, "title")), nodes: records };
  });
  if (!chapters.length || chapters.length > 1000 || !nodes.size || nodes.size > 100000) {
    reject("AUTHOR_LIMIT", "作品须有 1～1000 个章节和 1～100000 个节点", SOURCE);
  }
  const entryNodeId = nonempty(data.entryNodeId, at(SOURCE, "entryNodeId"));
  if (!nodes.has(entryNodeId)) reject("TARGET", "入口节点不存在，请先选择新的入口", at(SOURCE, "entryNodeId"));
  const assetIds = new Set<string>();
  const assets = array(data.assets, at(SOURCE, "assets")).map((item, index) => {
    const where = at(SOURCE, `assets.${index}`);
    const asset = object(item, where);
    knownFields(asset, ["key", "record"], where);
    const key = nonempty(asset.key, at(where, "key"));
    if (assetIds.has(key)) reject("ASSET_ID", "资源 ID 重复", where);
    assetIds.add(key);
    return { key, record: jsonObject(asset.record, at(where, "record")) };
  });
  return {
    workId: nonempty(data.workId, at(SOURCE, "workId")), title: string(data.title, at(SOURCE, "title")),
    entryNodeId, chapters, assets,
    variables: array(data.variables, at(SOURCE, "variables")).map((value, index) => jsonObject(value, at(SOURCE, `variables.${index}`))),
    settings: jsonObject(data.settings, at(SOURCE, "settings")), metadata: jsonObject(data.metadata, at(SOURCE, "metadata")),
    migration: jsonObject(data.migration, at(SOURCE, "migration")),
  };
}
export function readAuthorWorkspacePatch(input: unknown): AuthorWorkspacePatch {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "sourceSha256", "workspace", "replaceProject"], SOURCE);
  if (data.format !== "haifeng.author-workspace-patch/1") reject("AUTHOR_FORMAT", "不支持的工程草稿格式", SOURCE);
  if (data.replaceProject !== undefined && typeof data.replaceProject !== "boolean") reject("AUTHOR_FORMAT", "工程替换标记无效", SOURCE);
  return { format: data.format, sourceSha256: hash(data.sourceSha256, SOURCE), workspace: readAuthorWorkspace(data.workspace), replaceProject: data.replaceProject === true };
}
export function compileAuthorWorkspace(model: AuthorWorkspaceModel, sourceSha256: string): StoryContent {
  return compileAuthorProject({
    ...model, sourceSha256,
    assets: model.assets.map(asset => ({ ...asset, where: authorLocation("resources/index.json", asset.key) })),
    nodes: model.chapters.flatMap(chapter => chapter.nodes.map((record, index) => ({
      record, chapter: index === 0 ? chapter.title : "",
      where: { ...authorLocation(`chapters/${chapter.id}.json`, `nodes.${index}`), nodeId: String(record.id), index },
    }))),
  });
}
export function newAuthorNode(id: string): JsonObject {
  return {
    id, label: "", speaker: "", text: "", set: "", jump: "", jumpIf: "", ending: "",
    bg: "", sprites: [], choices: [], ctime: 0, cdef: "", acts: {},
  };
}
export function workspaceFields(model: AuthorWorkspaceModel): Record<string, AuthorFieldValue[]> {
  return Object.fromEntries(model.chapters.flatMap(chapter => chapter.nodes.map(node => {
    const fields: AuthorFieldValue[] = AUTHOR_NODE_FIELDS.flatMap(field =>
      typeof node[field] === "string" ? [{ field, value: node[field] as string }] : []);
    for (const raw of node.choices as JsonObject[]) {
      for (const property of ["text", "cond", "set", "target"] as const) {
        if (typeof raw[property] === "string") fields.push({ field: authorChoiceField(String(raw.id), property), value: raw[property] as string });
      }
    }
    return [String(node.id), fields];
  })));
}
