import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { JsonObject, SourceLocation } from "../../packages/story-model/src/model.ts";
import { canonical } from "../../packages/story-model/src/integrity.ts";
import { nonempty } from "../../packages/story-model/src/content.ts";
import { array, at, jsonObject, knownFields, object, reject, string } from "../../packages/story-model/src/read.ts";
import { authorJson } from "./json.ts";

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const AUTHOR_DIRECTORY = "content/story";
export const AUTHOR_FILE = `${AUTHOR_DIRECTORY}/project.json`;
export const AUTHOR_ROOT = resolve(REPOSITORY_ROOT, AUTHOR_DIRECTORY);
export const AUTHOR_LOCK = resolve(AUTHOR_ROOT, ".author-lock");
export const RESOURCE_FILES = [
  "resources/backgrounds.json", "resources/characters.json", "resources/music.json",
  "resources/sounds.json", "resources/voices.json",
] as const;
const FIXED_FILES = ["project.json", "variables.json", "settings.json", "origins.json", "resources/index.json", ...RESOURCE_FILES];
const MAX_BYTES = 16 * 1024 * 1024;
export const authorHash = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export const authorLocation = (file: string, field = ""): SourceLocation => ({ file: `${AUTHOR_DIRECTORY}/${file}`, field });
export type AuthorFiles = ReadonlyMap<string, Uint8Array>;
export interface AuthorNode {
  record: Record<string, unknown>;
  where: SourceLocation;
  chapter: string;
  file: string;
  index: number;
}
export interface AuthorProject {
  workId: string;
  title: string;
  entryNodeId: string;
  variables: unknown[];
  assets: { key: string; record: Record<string, unknown>; where: SourceLocation }[];
  settings: JsonObject;
  metadata: JsonObject;
  nodes: AuthorNode[];
  files: AuthorFiles;
  sourceSha256: string;
}

function document(files: AuthorFiles, file: string): unknown {
  const bytes = files.get(file);
  if (!bytes) return reject("AUTHOR_MISSING", "作品清单登记的作者文件不存在", authorLocation(file));
  return authorJson(bytes, authorLocation(file).file).value;
}

function manifest(value: unknown): { workId: string; title: string; entryNodeId: string; chapters: { id: string; file: string }[] } {
  const source = authorLocation("project.json");
  const data = object(value, source);
  knownFields(data, ["format", "workId", "title", "entryNodeId", "chapters"], source);
  if (data.format !== "haifeng.author-project/1") reject("AUTHOR_FORMAT", "不支持的分章作者格式", source);
  const ids = new Set<string>();
  const paths = new Set<string>();
  const chapters = array(data.chapters, at(source, "chapters")).map((value, index) => {
    const where = at(source, `chapters.${index}`);
    const chapter = object(value, where);
    knownFields(chapter, ["id", "file"], where);
    const id = nonempty(chapter.id, at(where, "id"));
    const file = string(chapter.file, at(where, "file"));
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(id) || ids.has(id)
      || !/^chapters\/[a-z0-9][a-z0-9-]*\.json$/u.test(file) || paths.has(file)) {
      reject("AUTHOR_CHAPTER", "章节身份或文件重复/无效，只允许 chapters/ 下的独立 JSON 文件", where);
    }
    ids.add(id);
    paths.add(file);
    return { id, file };
  });
  if (!chapters.length || chapters.length > 1000) reject("AUTHOR_LIMIT", "作品须登记 1～1000 个章节文件", source);
  return {
    workId: nonempty(data.workId, at(source, "workId")), title: string(data.title, at(source, "title")),
    entryNodeId: nonempty(data.entryNodeId, at(source, "entryNodeId")), chapters,
  };
}

/** File names and exact raw bytes participate; sorting never changes chapter or node order. */
export function authorSourceHash(files: AuthorFiles): string {
  return authorHash(canonical([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([file, bytes]) => ({ file, sha256: authorHash(bytes) }))));
}
export function authorFileDigests(files: AuthorFiles): { file: string; sha256: string; bytes: number }[] {
  return [...files].map(([file, bytes]) => ({ file: `${AUTHOR_DIRECTORY}/${file}`, sha256: authorHash(bytes), bytes: bytes.byteLength }));
}

/** One assembly path for build, development, terminal and editor candidates. No story execution. */
export function assembleAuthorProject(files: AuthorFiles): AuthorProject {
  let total = 0;
  for (const bytes of files.values()) total += bytes.byteLength;
  if (total > MAX_BYTES) reject("AUTHOR_LIMIT", "作者源合计超过 16 MiB", authorLocation("project.json"));
  const project = manifest(document(files, "project.json"));
  const expected = [...FIXED_FILES, ...project.chapters.map(chapter => chapter.file)];
  if (files.size !== expected.length || [...files.keys()].some(file => !expected.includes(file))) {
    reject("AUTHOR_FILES", "候选文件集合与作品清单不一致", authorLocation("project.json"));
  }
  const nodes: AuthorNode[] = [];
  for (const chapter of project.chapters) {
    const where = authorLocation(chapter.file);
    const data = object(document(files, chapter.file), where);
    knownFields(data, ["format", "id", "title", "nodes"], where);
    if (data.format !== "haifeng.author-chapter/1" || data.id !== chapter.id) {
      reject("AUTHOR_CHAPTER", "章节格式或身份与作品清单不一致", where);
    }
    const title = string(data.title, at(where, "title"));
    const values = array(data.nodes, at(where, "nodes"));
    for (const [index, value] of values.entries()) {
      const source = { ...at(where, `nodes.${index}`), index };
      const record = object(value, source);
      const nodeId = nonempty(record.id, at(source, "id"));
      nodes.push({ record, where: { ...source, nodeId }, chapter: index === 0 ? title : "", file: chapter.file, index });
    }
  }
  const assets = new Map<string, AuthorProject["assets"][number]>();
  for (const [index, file] of RESOURCE_FILES.entries()) {
    const where = authorLocation(file);
    for (const [key, value] of Object.entries(object(document(files, file), where))) {
      const source = at(where, key);
      const record = object(value, source);
      if (assets.has(key) || record.type !== ["bg", "ch", "bgm", "se", "vo"][index]) {
        reject("ASSET_KIND", "资源身份重复或放入了错误的分类文件", source);
      }
      assets.set(key, { key, record, where: source });
    }
  }
  const orderWhere = authorLocation("resources/index.json");
  const order = array(document(files, "resources/index.json"), orderWhere).map((value, index) => nonempty(value, at(orderWhere, String(index))));
  if (order.length !== assets.size || new Set(order).size !== order.length || order.some(id => !assets.has(id))) {
    reject("ASSET_ORDER", "资源顺序须恰好包含所有分类中的资源身份，不能遗漏或重复", orderWhere);
  }
  const originsWhere = authorLocation("origins.json");
  const origins = object(document(files, "origins.json"), originsWhere);
  knownFields(origins, ["format", "migration", "metadata"], originsWhere);
  if (origins.format !== "haifeng.author-origins/1") reject("AUTHOR_FORMAT", "不支持的作者来源格式", originsWhere);
  jsonObject(origins.migration, at(originsWhere, "migration"));
  return {
    workId: project.workId, title: project.title, entryNodeId: project.entryNodeId,
    nodes, assets: order.map(id => assets.get(id)!),
    variables: array(document(files, "variables.json"), authorLocation("variables.json")),
    settings: jsonObject(document(files, "settings.json"), authorLocation("settings.json")),
    metadata: jsonObject(origins.metadata, at(originsWhere, "metadata")), files, sourceSha256: authorSourceHash(files),
  };
}

/** Refuse symlinks/junctions in the source path, including intermediate directories. */
export async function authorPath(file: string, allowMissing = false): Promise<string> {
  if (!FIXED_FILES.includes(file) && !/^chapters\/[a-z0-9][a-z0-9-]*\.json$/u.test(file)) {
    reject("AUTHOR_PATH", "不是作品清单支持的作者文件位置", authorLocation("project.json"));
  }
  const filename = resolve(AUTHOR_ROOT, file);
  const root = await realpath(REPOSITORY_ROOT);
  if (allowMissing) {
    if (await realpath(dirname(filename)) !== dirname(resolve(root, AUTHOR_DIRECTORY, file))) {
      reject("AUTHOR_PATH", "作者文件父目录不是本仓库原目录", authorLocation(file));
    }
    const status = await lstat(filename).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    });
    if (status === null) return filename;
  }
  if (await realpath(filename) !== resolve(root, AUTHOR_DIRECTORY, file) || !(await lstat(filename)).isFile()) {
    reject("AUTHOR_PATH", "作者文件必须保持在本仓库原目录中，不能使用链接或特殊文件", authorLocation(file));
  }
  return filename;
}
async function unlocked(): Promise<void> {
  const status = await lstat(AUTHOR_LOCK).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  });
  if (status) reject("AUTHOR_LOCK", "作者源正在写入或上次事务未完成，请先处理 .author-lock 内的恢复记录", authorLocation("project.json"));
}

/** Caller holding the cooperative lock may read candidates; other readers fail closed. */
export async function readAuthorProject(holdingLock = false): Promise<AuthorProject> {
  if (!holdingLock) await unlocked();
  const files = new Map<string, Uint8Array>();
  let total = 0;
  const read = async (file: string): Promise<void> => {
    const filename = await authorPath(file).catch(() => reject("AUTHOR_PATH", "作者文件缺失、越界或不是普通文件", authorLocation(file)));
    const size = (await lstat(filename)).size;
    if (size > MAX_BYTES || total + size > MAX_BYTES) reject("AUTHOR_LIMIT", "作者源合计超过 16 MiB", authorLocation(file));
    const bytes = await readFile(filename);
    total += bytes.byteLength;
    if (total > MAX_BYTES) reject("AUTHOR_LIMIT", "读取时作者源合计超过 16 MiB", authorLocation(file));
    files.set(file, bytes);
  };
  await read("project.json");
  const project = manifest(document(files, "project.json"));
  for (const file of [...FIXED_FILES.slice(1), ...project.chapters.map(chapter => chapter.file)]) await read(file);
  // Re-read all registered bytes, not just manifest mtime; direct chapter edits must invalidate a draft.
  for (const [file, bytes] of files) {
    if (authorHash(await readFile(await authorPath(file))) !== authorHash(bytes)) {
      reject("AUTHOR_CONFLICT", "读取期间作者文件改变，请重新读取", authorLocation(file));
    }
  }
  if (!holdingLock) await unlocked();
  return assembleAuthorProject(files);
}
