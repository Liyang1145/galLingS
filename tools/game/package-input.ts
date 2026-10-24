import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError } from "../../packages/story-model/src/model.ts";
import type { StoryContent } from "../../packages/story-model/src/model.ts";
import { readStoryContent } from "../../packages/story-model/src/content.ts";
import { canonical, contentRevisionText } from "../../packages/story-model/src/integrity.ts";
import { assertPackageContent, readGamePackage } from "../../packages/story-model/src/package.ts";
import type { GamePackage, PackageFile } from "../../packages/story-model/src/package.ts";

export const repository = fileURLToPath(new URL("../../", import.meta.url));
export const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
export interface GamePackageInput {
  readonly root: string;
  readonly game: string;
  readonly packageId: string;
  readonly manifest: GamePackage;
  readonly manifestBytes: Buffer;
  readonly content: StoryContent;
}
export function insidePackage(root: string, path: string): boolean {
  const child = relative(root, path);
  return !!child && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}
function json(bytes: Uint8Array, file: string): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new ContentError("PACKAGE_JSON", "游戏包文件不是有效 UTF-8 JSON", { file, field: "" }); }
}
async function readFileInside(root: string, path: string): Promise<Buffer> {
  let filename: string;
  try { filename = await realpath(resolve(root, path)); }
  catch { throw new ContentError("PACKAGE_FILE_READ", "无法读取登记文件的位置", { file: path, field: "" }); }
  if (!insidePackage(root, filename)) throw new ContentError("PACKAGE_PATH", "登记文件越出原游戏包", { file: path, field: "" });
  try {
    if (!(await stat(filename)).isFile()) throw new ContentError("PACKAGE_FILE_TYPE", "登记文件不是普通文件", { file: path, field: "" });
    return await readFile(filename);
  } catch (error: unknown) {
    if (error instanceof ContentError) throw error;
    throw new ContentError("PACKAGE_FILE_READ", "登记文件读取失败", { file: path, field: "" });
  }
}
export async function checkedPackageFile(root: string, file: PackageFile): Promise<Buffer> {
  const bytes = await readFileInside(root, file.path);
  if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256) {
    throw new ContentError("PACKAGE_INTEGRITY", "登记文件大小或 SHA-256 与清单不一致", { file: file.path, field: "" });
  }
  return bytes;
}
/** Physical files only; shared media bytes are counted/copied once without changing resource identities. */
export function gamePackageFiles(manifest: GamePackage): readonly PackageFile[] {
  const files = new Map<string, PackageFile>();
  for (const file of [manifest.story, manifest.provenance, ...manifest.frontend, ...manifest.resources]) {
    if (!files.has(file.path)) files.set(file.path, file);
  }
  return [...files.values()];
}

/** Shared read-only boundary for package inspection and both platform preparation commands. */
export async function openGamePackageInput(packageId: string): Promise<GamePackageInput> {
  if (!/^[a-f0-9]{64}$/u.test(packageId)) {
    throw new ContentError("PACKAGE_ID", "需要 game:build 输出的完整产物摘要", { file: "game-package.json", field: "" });
  }
  const root = await realpath(repository);
  let game: string;
  try { game = await realpath(resolve(root, "dist/game", packageId)); }
  catch { throw new ContentError("PACKAGE_INPUT", "找不到该摘要的现有游戏包；本入口不自动构建", { file: "game-package.json", field: "" }); }
  if (!insidePackage(root, game)) throw new ContentError("PACKAGE_PATH", "游戏包越出当前仓库", { file: "game-package.json", field: "" });
  const manifestBytes = await readFileInside(game, "game-package.json");
  const manifest = readGamePackage(json(manifestBytes, "game-package.json"));
  if (sha256(canonical(manifest)) !== packageId) {
    throw new ContentError("PACKAGE_ID", "游戏包目录摘要与清单不一致", { file: "game-package.json", field: "" });
  }
  const content = readStoryContent(json(await checkedPackageFile(game, manifest.story), manifest.story.path), manifest.story.path);
  assertPackageContent(manifest, content);
  const revision = sha256(contentRevisionText(content, manifest.resources.map(file => ({
    assetId: file.assetId, path: file.sourcePath, sha256: file.sha256, bytes: file.bytes,
  }))));
  if (revision !== manifest.contentRevision) {
    throw new ContentError("PACKAGE_REVISION", "剧情与素材摘要不能重现内容修订", { file: manifest.story.path, field: "revision" });
  }
  return { root, game, packageId, manifest, manifestBytes, content };
}

/** Reads every registered file; no output, cache, repair, copy or source conversion. */
export async function verifyGamePackageInput(packageId: string): Promise<{
  readonly input: GamePackageInput;
  readonly files: number;
  readonly bytes: number;
}> {
  const input = await openGamePackageInput(packageId);
  const files = gamePackageFiles(input.manifest);
  let bytes = input.manifestBytes.byteLength;
  for (const file of files) {
    // The story was already read/validated by openGamePackageInput; rereading
    // here checks its inventory position just like the prepare-copy operation.
    await checkedPackageFile(input.game, file);
    bytes += file.bytes;
    if (!Number.isSafeInteger(bytes)) {
      throw new ContentError("PACKAGE_BYTES", "登记文件总字节数超过安全整数范围", { file: "game-package.json", field: "" });
    }
  }
  const current = await readFileInside(input.game, "game-package.json");
  if (!current.equals(input.manifestBytes)) {
    throw new ContentError("PACKAGE_CHANGED", "读取期间清单已变化，未确认本次完整包", { file: "game-package.json", field: "" });
  }
  return { input, files: files.length + 1, bytes };
}
