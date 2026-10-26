import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { GamePackage } from "../../packages/story-model/src/package.ts";
import { checkedPackageFile, gamePackageFiles, insidePackage, openGamePackageInput } from "./package-input.ts";
export { repository, sha256 } from "./package-input.ts";

export interface PreparedInput {
  output: string;
  frontend: string;
  manifest: GamePackage;
  manifestBytes: Buffer;
}

async function directory(root: string, path: string): Promise<string> {
  const folder = resolve(root, path);
  await mkdir(folder, { recursive: true });
  const actual = await realpath(folder);
  if (actual !== root && !insidePackage(root, actual)) throw new Error("平台准备目录越出输入边界");
  return actual;
}

/** Shared platform boundary. Explicit callers choose when to copy; no tool runs on import. */
export async function prepareInput(packageId: string, platform: "windows" | "android"): Promise<PreparedInput> {
  const { root, game, manifest, manifestBytes } = await openGamePackageInput(packageId);
  const dist = await directory(root, "dist");
  const base = await directory(dist, platform);
  const output = resolve(base, packageId);
  await mkdir(output);
  try {
    if (await realpath(output) !== output) throw new Error("平台产物目录边界已改变");
    const frontend = await directory(output, platform === "windows" ? "frontend" : "assets/game");
    for (const file of gamePackageFiles(manifest)) {
      const bytes = await checkedPackageFile(game, file);
      const target = resolve(frontend, file.path);
      const folder = await directory(frontend, relative(frontend, dirname(target)) || ".");
      if (!insidePackage(frontend, target) || !insidePackage(output, folder)) throw new Error("复制位置越出平台前端目录");
      await writeFile(target, bytes, { flag: "wx" });
    }
    await writeFile(resolve(frontend, "game-package.json"), manifestBytes, { flag: "wx" });
    return { output, frontend, manifest, manifestBytes };
  } catch (error: unknown) {
    console.error(`平台准备未完成，保留本次目录供定位，不自动删除或覆盖：${output}`);
    throw error;
  }
}
