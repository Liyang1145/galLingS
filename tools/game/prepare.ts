import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readStoryContent } from "../../packages/story-model/src/content.ts";
import { canonical, contentRevisionText } from "../../packages/story-model/src/integrity.ts";
import { assertPackageContent, readGamePackage } from "../../packages/story-model/src/package.ts";
import type { GamePackage, PackageFile } from "../../packages/story-model/src/package.ts";

export const repository = fileURLToPath(new URL("../../", import.meta.url));
export const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

export interface PreparedInput {
  output: string;
  frontend: string;
  manifest: GamePackage;
  manifestBytes: Buffer;
}

function inside(root: string, path: string): boolean {
  const child = relative(root, path);
  return !!child && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function json(bytes: Uint8Array, file: string): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new Error(`游戏包文件不是有效 UTF-8 JSON：${file}`); }
}

async function readFileInside(root: string, path: string): Promise<Buffer> {
  const filename = await realpath(resolve(root, path));
  if (!inside(root, filename) || !(await stat(filename)).isFile()) throw new Error(`游戏包文件越界或不是普通文件：${path}`);
  return readFile(filename);
}

async function checked(root: string, file: PackageFile): Promise<Buffer> {
  const data = await readFileInside(root, file.path);
  if (data.byteLength !== file.bytes || sha256(data) !== file.sha256) throw new Error(`游戏包文件大小或摘要不一致：${file.path}`);
  return data;
}

async function directory(root: string, path: string): Promise<string> {
  const folder = resolve(root, path);
  await mkdir(folder, { recursive: true });
  const actual = await realpath(folder);
  if (actual !== root && !inside(root, actual)) throw new Error("平台准备目录越出输入边界");
  return actual;
}

/** Shared platform boundary. Explicit callers choose when to copy; no tool runs on import. */
export async function prepareInput(packageId: string, platform: "windows" | "android"): Promise<PreparedInput> {
  if (!/^[a-f0-9]{64}$/u.test(packageId)) throw new Error("需要 game:build 输出的完整产物摘要");
  const root = await realpath(repository);
  const game = await realpath(resolve(root, "dist/game", packageId));
  if (!inside(root, game)) throw new Error("游戏包越出当前仓库");
  const manifestBytes = await readFileInside(game, "game-package.json");
  const manifest = readGamePackage(json(manifestBytes, "game-package.json"));
  if (sha256(canonical(manifest)) !== packageId) throw new Error("游戏包目录摘要与清单不一致");
  const story = readStoryContent(json(await checked(game, manifest.story), manifest.story.path), manifest.story.path);
  assertPackageContent(manifest, story);
  const revision = sha256(contentRevisionText(story, manifest.resources.map(file => ({
    assetId: file.assetId, path: file.sourcePath, sha256: file.sha256, bytes: file.bytes,
  }))));
  if (revision !== manifest.contentRevision) throw new Error("剧情与素材摘要不能重现内容修订");
  const dist = await directory(root, "dist");
  const base = await directory(dist, platform);
  const output = resolve(base, packageId);
  await mkdir(output);
  try {
    if (await realpath(output) !== output) throw new Error("平台产物目录边界已改变");
    const frontend = await directory(output, platform === "windows" ? "frontend" : "assets/game");
    const paths = new Set<string>();
    for (const file of [manifest.story, manifest.provenance, ...manifest.frontend, ...manifest.resources]) {
      if (paths.has(file.path)) continue;
      paths.add(file.path);
      const bytes = await checked(game, file);
      const target = resolve(frontend, file.path);
      const folder = await directory(frontend, relative(frontend, dirname(target)) || ".");
      if (!inside(frontend, target) || !inside(output, folder)) throw new Error("复制位置越出平台前端目录");
      await writeFile(target, bytes, { flag: "wx" });
    }
    await writeFile(resolve(frontend, "game-package.json"), manifestBytes, { flag: "wx" });
    return { output, frontend, manifest, manifestBytes };
  } catch (error: unknown) {
    console.error(`平台准备未完成，保留本次目录供定位，不自动删除或覆盖：${output}`);
    throw error;
  }
}
