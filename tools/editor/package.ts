import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { hash, localPath } from "../../packages/story-model/src/content.ts";
import { array, at, knownFields, numeric, object, reject, string } from "../../packages/story-model/src/read.ts";
import { canonical } from "../../packages/story-model/src/integrity.ts";

export interface EditorFile { readonly path: string; readonly sha256: string; readonly bytes: number }
export interface EditorPackage {
  readonly format: "haifeng.editor-package/1";
  readonly purpose: "local-integration-trial";
  readonly entry: "index.html";
  readonly build: { readonly commit: string; readonly dirty: boolean; readonly lockSha256: string; readonly vite: string };
  readonly uiSkin: { readonly file: string; readonly sha256: string; readonly blockSha256: string };
  readonly frontend: readonly EditorFile[];
  readonly runtimeInputs: readonly EditorFile[];
}
export const editorSha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export const editorPackageId = (manifest: EditorPackage): string => editorSha256(canonical(manifest));
export function insideEditorRoot(root: string, filename: string): boolean {
  const child = relative(root, filename);
  return !!child && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}
const RUNTIME_DIRS = ["tools/editor", "tools/content", "packages/story-model/src"] as const;
const RUNTIME_FILES = ["package.json", "package-lock.json"] as const;
const runtimePath = (path: string): boolean => RUNTIME_FILES.some(file => path === file)
  || RUNTIME_DIRS.some(folder => path.startsWith(`${folder}/`) && path.endsWith(".ts"));

export function readEditorPackage(input: unknown): EditorPackage {
  const source = { file: "editor-package.json", field: "" };
  const data = object(input, source);
  knownFields(data, ["format", "purpose", "entry", "build", "uiSkin", "frontend", "runtimeInputs"], source);
  if (data.format !== "haifeng.editor-package/1" || data.purpose !== "local-integration-trial" || data.entry !== "index.html") {
    reject("EDITOR_PACKAGE", "不是受支持的本机编辑集成产物", source);
  }
  const stamp = object(data.build, at(source, "build"));
  knownFields(stamp, ["commit", "dirty", "lockSha256", "vite"], at(source, "build"));
  const commit = string(stamp.commit, at(source, "build.commit"));
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit)) reject("EDITOR_PACKAGE", "提交标识无效", at(source, "build.commit"));
  if (typeof stamp.dirty !== "boolean") reject("EDITOR_PACKAGE", "缺少工作区状态标记", at(source, "build.dirty"));
  const skin = object(data.uiSkin, at(source, "uiSkin"));
  knownFields(skin, ["file", "sha256", "blockSha256"], at(source, "uiSkin"));
  if (skin.file !== "海风与布丁/index.html" && skin.file !== "content/game-ui/whale.json") {
    reject("EDITOR_PACKAGE", "鲸鱼皮肤来源不符", at(source, "uiSkin.file"));
  }
  const files = (field: "frontend" | "runtimeInputs", limit: number): readonly EditorFile[] => {
    const entries = array(data[field], at(source, field));
    if (!entries.length || entries.length > limit) reject("EDITOR_PACKAGE", "文件数量超出本片集成范围", at(source, field));
    const paths = new Set<string>();
    return entries.map((value, index) => {
      const where = at(source, `${field}.${index}`);
      const item = object(value, where);
      knownFields(item, ["path", "sha256", "bytes"], where);
      const path = localPath(item.path, at(where, "path"));
      if (paths.has(path) || (field === "frontend" ? path !== "index.html" && !path.startsWith("assets/") : !runtimePath(path))) {
        reject("EDITOR_PACKAGE", "文件位置重复或不属于本片产物", at(where, "path"));
      }
      paths.add(path);
      const bytes = numeric(item.bytes, at(where, "bytes"));
      if (!Number.isSafeInteger(bytes) || bytes < 0) reject("EDITOR_PACKAGE", "文件大小无效", at(where, "bytes"));
      return { path, sha256: hash(item.sha256, at(where, "sha256")), bytes };
    });
  };
  const frontend = files("frontend", 10000);
  const runtimeInputs = files("runtimeInputs", 2000);
  if (!frontend.some(file => file.path === "index.html") || !RUNTIME_FILES.every(path => runtimeInputs.some(file => file.path === path))) {
    reject("EDITOR_PACKAGE", "缺少编辑入口或固定运行输入", source);
  }
  const lockSha256 = hash(stamp.lockSha256, at(source, "build.lockSha256"));
  if (runtimeInputs.find(file => file.path === "package-lock.json")?.sha256 !== lockSha256) {
    reject("EDITOR_PACKAGE", "依赖锁与运行输入摘要不符", source);
  }
  return {
    format: "haifeng.editor-package/1", purpose: "local-integration-trial", entry: "index.html",
    build: { commit, dirty: stamp.dirty, lockSha256, vite: string(stamp.vite, at(source, "build.vite")) },
    uiSkin: { file: skin.file, sha256: hash(skin.sha256, at(source, "uiSkin.sha256")), blockSha256: hash(skin.blockSha256, at(source, "uiSkin.blockSha256")) },
    frontend, runtimeInputs,
  };
}

/** No links or special files in a local integration artifact or its fixed runtime source. */
export async function editorFileBytes(root: string, path: string): Promise<Buffer> {
  const expected = resolve(root, path);
  const actual = await realpath(expected);
  if (!insideEditorRoot(root, actual) || actual !== expected || !(await stat(actual)).isFile()) {
    throw new Error(`编辑集成文件越界或不是原普通文件：${path}`);
  }
  return readFile(actual);
}
export async function checkedEditorFile(root: string, file: EditorFile): Promise<Buffer> {
  const bytes = await editorFileBytes(root, file.path);
  if (bytes.byteLength !== file.bytes || editorSha256(bytes) !== file.sha256) {
    throw new Error(`编辑集成文件大小或摘要不一致：${file.path}`);
  }
  return bytes;
}
export async function editorFiles(root: string, folder = root, typescriptOnly = false): Promise<EditorFile[]> {
  if (await realpath(folder) !== folder || (folder !== root && !insideEditorRoot(root, folder))) {
    throw new Error("编辑集成目录位置已改变");
  }
  const entries = await readdir(folder, { withFileTypes: true });
  entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const result: EditorFile[] = [];
  for (const entry of entries) {
    const filename = resolve(folder, entry.name);
    if (entry.isDirectory()) result.push(...await editorFiles(root, filename, typescriptOnly));
    else if (entry.isFile()) {
      if (typescriptOnly && !entry.name.endsWith(".ts")) continue;
      const path = relative(root, filename).split(sep).join("/");
      const bytes = await editorFileBytes(root, path);
      result.push({ path, sha256: editorSha256(bytes), bytes: bytes.byteLength });
    } else throw new Error("编辑集成范围中不能包含符号链接或特殊文件");
  }
  return result;
}
export async function editorRuntimeInputs(root: string): Promise<EditorFile[]> {
  const result: EditorFile[] = [];
  for (const folder of RUNTIME_DIRS) result.push(...await editorFiles(root, resolve(root, folder), true));
  for (const path of RUNTIME_FILES) {
    const bytes = await editorFileBytes(root, path);
    result.push({ path, sha256: editorSha256(bytes), bytes: bytes.byteLength });
  }
  return result.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}
