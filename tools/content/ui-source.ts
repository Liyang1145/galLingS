import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError } from "../../packages/story-model/src/model.ts";
import type { JsonObject } from "../../packages/story-model/src/model.ts";
import { hash, localPath } from "../../packages/story-model/src/content.ts";
import { array, at, jsonObject, knownFields, object, reject, string } from "../../packages/story-model/src/read.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const WHALE_UI_SOURCE = "content/game-ui/whale.json";
export const COLLECTION_UI_SOURCE = "content/game-ui/collection.json";
const ORIGINS = "content/game-ui/origins.json";
export const uiSha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Fixed local UI definitions; no evaluation, legacy extraction or alternate source fallback. */
export async function readUiDefinition(file: typeof WHALE_UI_SOURCE | typeof COLLECTION_UI_SOURCE | typeof ORIGINS): Promise<{
  data: Record<string, unknown>; sha256: string;
}> {
  const source = { file, field: "" };
  const filename = resolve(ROOT, file);
  let bytes: Buffer;
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.size > 1024 * 1024 || await realpath(filename) !== filename) {
      reject("UI_SOURCE_PATH", "界面定义须为固定目录内的有界普通文件", source);
    }
    bytes = await readFile(filename);
  } catch (error: unknown) {
    if (error instanceof ContentError) throw error;
    return reject("UI_SOURCE_READ", "无法读取固定位置的界面定义", source);
  }
  if (bytes.length > 1024 * 1024) reject("UI_SOURCE_SIZE", "界面定义超过大小上限", source);
  let input: unknown;
  try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return reject("UI_SOURCE_JSON", "界面定义须为有效 UTF-8 JSON", source); }
  return { data: object(input, source), sha256: uiSha256(bytes) };
}

/** Historical attribution is packaged as data; original HTML/JS/CSS are never reopened. */
export async function readUiOrigins(): Promise<{ file: string; sha256: string; record: JsonObject }> {
  const { data, sha256 } = await readUiDefinition(ORIGINS);
  const source = { file: ORIGINS, field: "" };
  knownFields(data, ["commit", "sources", "targets", "notice"], source);
  if (!/^[a-f0-9]{40}$/u.test(string(data.commit, at(source, "commit")))) {
    reject("UI_ORIGIN_COMMIT", "界面迁移来源需要完整提交身份", at(source, "commit"));
  }
  for (const field of ["sources", "targets"] as const) {
    const entries = array(data[field], at(source, field));
    if (!entries.length || entries.length > 32) reject("UI_ORIGIN_COUNT", "界面来源数量超限或为空", at(source, field));
    const paths = new Set<string>();
    entries.forEach((entry, index) => {
      const where = at(source, `${field}.${index}`);
      const item = object(entry, where);
      knownFields(item, field === "sources" ? ["file", "sha256", "field", "blockSha256"] : ["file", "sha256"], where);
      const path = localPath(item.file, at(where, "file"));
      if (paths.has(path)) reject("UI_ORIGIN_PATH", "界面来源位置重复", at(where, "file"));
      paths.add(path);
      hash(item.sha256, at(where, "sha256"));
      if (field === "sources") {
        string(item.field, at(where, "field"));
        hash(item.blockSha256, at(where, "blockSha256"));
      }
    });
  }
  string(data.notice, at(source, "notice"));
  return { file: ORIGINS, sha256, record: jsonObject(data, source) };
}
