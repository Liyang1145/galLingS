import { extname, resolve } from "node:path";
import { realpath } from "node:fs/promises";
import type { AuthorProject } from "../content/source.ts";
import { assembleAuthorProject, authorHash, REPOSITORY_ROOT } from "../content/source.ts";
import type { ResourceFile } from "../content/build.ts";
import { compileAuthorProject } from "../content/compile.ts";
import { authorWorkspace } from "./workspace.ts";
import { ProjectArchive, writeArchive } from "./archive.ts";
import type { ArchiveEntry } from "./archive.ts";
import { array, at, knownFields, numeric, object, string } from "../../packages/story-model/src/read.ts";
import { hash, localPath } from "../../packages/story-model/src/content.ts";
import type { AuthorWorkspaceModel } from "../../packages/story-model/src/author-workspace.ts";
import { installMedia, localDirectory, mediaExtension } from "./assets.ts";
import { insideEditorRoot } from "./package.ts";

interface PortableFile { path: string; sha256: string; bytes: number }
interface PortableResource extends PortableFile { assetId: string; sourcePath: string }
interface PortableManifest {
  format: "haifeng.editor-project-archive/1";
  workId: string;
  sourceSha256: string;
  files: PortableFile[];
  resources: PortableResource[];
}
const SOURCE = { file: "project-manifest.json", field: "" };
function readManifest(input: unknown): PortableManifest {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "workId", "sourceSha256", "files", "resources"], SOURCE);
  if (data.format !== "haifeng.editor-project-archive/1") throw new Error("不是完整编辑项目包");
  const row = (value: unknown, index: number, resource: boolean): PortableFile | PortableResource => {
    const where = at(SOURCE, `${resource ? "resources" : "files"}.${index}`), entry = object(value, where);
    knownFields(entry, resource ? ["path", "sha256", "bytes", "assetId", "sourcePath"] : ["path", "sha256", "bytes"], where);
    const path = localPath(entry.path, at(where, "path")), bytes = numeric(entry.bytes, at(where, "bytes"));
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("项目文件大小无效");
    const result = { path, bytes, sha256: hash(entry.sha256, at(where, "sha256")) };
    if (!resource) {
      if (!path.startsWith("author/")) throw new Error("作者文件不在项目包作者目录");
      return result;
    }
    const assetId = string(entry.assetId, at(where, "assetId")), sourcePath = localPath(entry.sourcePath, at(where, "sourcePath"));
    if (!assetId || path !== `media/${result.sha256}${extname(sourcePath).toLowerCase()}`) throw new Error("项目资源位置与摘要不一致");
    return { ...result, assetId, sourcePath };
  };
  const files = array(data.files, at(SOURCE, "files")).map((value, index) => row(value, index, false) as PortableFile);
  const resources = array(data.resources, at(SOURCE, "resources")).map((value, index) => row(value, index, true) as PortableResource);
  if (files.length > 1100 || resources.length > 100000) throw new Error("项目包条目过多");
  if (new Set(files.map(file => file.path)).size !== files.length || new Set(resources.map(file => file.assetId)).size !== resources.length) throw new Error("项目清单包含重复身份");
  return { format: data.format, workId: string(data.workId, at(SOURCE, "workId")),
    sourceSha256: hash(data.sourceSha256, at(SOURCE, "sourceSha256")), files, resources };
}

export async function writeProjectArchive(project: AuthorProject, resources: readonly ResourceFile[], filename: string,
  options: { gameRoot?: string; progress?(done: number, total: number): void } = {}): Promise<{ bytes: number; sha256: string }> {
  const game = await realpath(options.gameRoot ?? resolve(REPOSITORY_ROOT, "海风与布丁"));
  const manifest: PortableManifest = {
    format: "haifeng.editor-project-archive/1", workId: project.workId, sourceSha256: project.sourceSha256,
    files: [...project.files].map(([path, bytes]) => ({ path: `author/${path}`, sha256: authorHash(bytes), bytes: bytes.byteLength })),
    resources: resources.map(file => ({ ...file, sourcePath: file.path, path: `media/${file.sha256}${extname(file.path).toLowerCase()}` })),
  };
  const entries: ArchiveEntry[] = manifest.files.map(file => ({
    name: file.path, data: project.files.get(file.path.slice("author/".length))!, sha256: file.sha256, bytes: file.bytes,
  }));
  const used = new Set<string>();
  for (const resource of manifest.resources) {
    if (used.has(resource.path)) continue;
    const file = await realpath(resolve(game, resource.sourcePath));
    if (!insideEditorRoot(game, file)) throw new Error("项目资源越出作品目录");
    mediaExtension(resource.sourcePath, String(project.assets.find(asset => asset.key === resource.assetId)!.record.type));
    entries.push({ name: resource.path, file, sha256: resource.sha256, bytes: resource.bytes }); used.add(resource.path);
  }
  entries.unshift({ name: "project-manifest.json", data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) });
  return writeArchive(filename, entries, options.progress);
}

export async function readProjectArchive(filename: string): Promise<{
  archive: ProjectArchive; project: AuthorProject; manifest: PortableManifest;
}> {
  const archive = await ProjectArchive.open(filename);
  const manifest = readManifest(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await archive.read("project-manifest.json"))));
  const expected = new Set(["project-manifest.json", ...manifest.files.map(file => file.path), ...manifest.resources.map(file => file.path)]);
  if (archive.entries.size !== expected.size || [...archive.entries.keys()].some(path => !expected.has(path))) throw new Error("项目包文件集合与清单不一致");
  const files = new Map<string, Uint8Array>();
  let total = 0;
  for (const file of manifest.files) {
    total += file.bytes; if (total > 16 * 1024 * 1024) throw new Error("项目作者文件超过 16 MiB");
    const bytes = await archive.read(file.path);
    if (bytes.byteLength !== file.bytes || authorHash(bytes) !== file.sha256) throw new Error("项目作者文件与清单不一致");
    files.set(file.path.slice("author/".length), bytes);
  }
  const project = assembleAuthorProject(files);
  if (project.workId !== manifest.workId || project.sourceSha256 !== manifest.sourceSha256) throw new Error("项目身份或作者源摘要与清单不一致");
  compileAuthorProject(project);
  if (project.assets.length !== manifest.resources.length) throw new Error("项目资源登记不完整");
  for (const asset of project.assets) {
    const resource = manifest.resources.find(file => file.assetId === asset.key);
    const entry = resource ? archive.entries.get(resource.path) : undefined;
    if (!resource || !entry || asset.record.src !== resource.sourcePath || entry.size !== resource.bytes) throw new Error("项目资源身份、来源或大小不符");
    mediaExtension(resource.sourcePath, String(asset.record.type));
  }
  return { archive, project, manifest };
}

export async function migrateProjectArchive(filename: string, staging: string, gameRoot?: string,
  progress: (done: number, total: number) => void = () => {}): Promise<AuthorWorkspaceModel> {
  const { archive, project, manifest } = await readProjectArchive(filename);
  const extracted = await localDirectory(staging, "media"), blobs = new Map<string, { file: string; sha256: string; bytes: number }>();
  // Check every resource before installing any into the current project's immutable asset store.
  for (const [index, resource] of manifest.resources.entries()) {
    if (!blobs.has(resource.path)) {
      const file = resolve(extracted, resource.path.slice("media/".length)), result = await archive.extract(resource.path, file);
      if (result.sha256 !== resource.sha256 || result.bytes !== resource.bytes) throw new Error("项目素材字节与 SHA-256 清单不一致");
      blobs.set(resource.path, { file, ...result });
    }
    progress(index + 1, manifest.resources.length);
  }
  const model = authorWorkspace(project);
  for (const asset of model.assets) {
    const resource = manifest.resources.find(file => file.assetId === asset.key)!;
    const path = await installMedia(blobs.get(resource.path)!, extname(resource.sourcePath).toLowerCase(), gameRoot);
    if (!Object.hasOwn(asset.record, "importedFrom")) asset.record.importedFrom = resource.sourcePath;
    asset.record.src = path;
  }
  return model;
}
