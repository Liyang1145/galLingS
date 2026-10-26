import { isCommandEntry } from "../cli-entry.ts";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, rmdir, lstat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { build as buildFrontend, normalizePath, version as viteVersion } from "vite";
import type { Plugin } from "vite";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { readStoryContent } from "../../packages/story-model/src/content.ts";
import { canonical } from "../../packages/story-model/src/integrity.ts";
import { assertPackageContent, readGamePackage } from "../../packages/story-model/src/package.ts";
import type { GamePackage, PackageFile, PackagedResource } from "../../packages/story-model/src/package.ts";
import { loadSourceContent, REPOSITORY_ROOT } from "../content/build.ts";
import type { ResourceFile } from "../content/build.ts";
import { HOST_BRIDGE_PROTOCOL, NATIVE_RECORD_CLIENT, NATIVE_RECORD_PROTOCOL, WINDOWS_AUDIO_CLIENT, WINDOWS_AUDIO_PROTOCOL } from "../../packages/story-model/src/host.ts";
import { readWhaleSkin } from "../content/appearance.ts";
import { readCollectionSkin } from "../content/collection-appearance.ts";
import { readUiOrigins } from "../content/ui-source.ts";
import { collectionAppearance, whaleAppearance } from "../dev/appearance.ts";

const exec = promisify(execFile);
const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const virtualId = "virtual:haifeng-content";
const resolvedId = `\0${virtualId}`;

function inside(root: string, filename: string): boolean {
  const child = relative(root, filename);
  return !!child && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

/** Bundle only the runtime package reader, never the Node author converter. */
function packagedContent(root: string): Plugin {
  return {
    name: "haifeng-packaged-content",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const result = html.replace(/<!-- GAME_DEV_START -->[\s\S]*?<!-- GAME_DEV_END -->/gu, "");
        if (result === html || result.includes("GAME_DEV_START") || result.includes("GAME_DEV_END")
          || /id="(?:tools-panel|tools-open|timed|aftergame|debug|inspect-timed|load-timed)"|data-panel-open="tools"/u.test(result)) {
          throw new Error("正式页面的开发区标记缺失、不完整或仍有开发入口");
        }
        return result;
      },
    },
    resolveId(id) { if (id === virtualId) return resolvedId; },
    load(id) {
      if (id !== resolvedId) return;
      const reader = normalizePath(resolve(root, "packages/player/src/web/package.ts"));
      return `import { loadPackagedContent } from ${JSON.stringify(reader)};
        export const development = false;
        export function loadContent(signal) {
          return loadPackagedContent(new URL(".", window.location.href), signal);
        }`;
    },
  };
}

async function writeJson(root: string, path: string, value: unknown): Promise<PackageFile> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const filename = resolve(root, path);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, bytes, { flag: "wx" });
  return { path, sha256: sha256(bytes), bytes: bytes.byteLength };
}

async function frontendFiles(root: string, folder = root): Promise<PackageFile[]> {
  const files: PackageFile[] = [];
  const entries = await readdir(folder, { withFileTypes: true });
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const entry of entries) {
    const filename = resolve(folder, entry.name);
    if (entry.isDirectory()) files.push(...await frontendFiles(root, filename));
    else if (entry.isFile()) {
      const data = await readFile(filename);
      const path = relative(root, filename).split(sep).join("/");
      if (/\.(?:html|js|css)$/u.test(path) && data.toString("utf8").includes("/@fs/")) {
        throw new Error(`前端产物残留开发资源位置：${path}`);
      }
      files.push({ path, sha256: sha256(data), bytes: data.byteLength });
    } else throw new Error("前端产物不能包含符号链接或特殊文件");
  }
  return files;
}

async function copyMedia(root: string, files: readonly ResourceFile[], temporary: string): Promise<PackagedResource[]> {
  const gameRoot = await realpath(resolve(root, "海风与布丁"));
  const written = new Set<string>();
  const resources: PackagedResource[] = [];
  await mkdir(resolve(temporary, "media"));
  for (const file of files) {
    const filename = await realpath(resolve(gameRoot, file.path));
    if (!inside(gameRoot, filename)) throw new Error(`资源越出作者目录：${file.assetId}`);
    const extension = extname(file.path).toLowerCase();
    if (!/^\.[a-z0-9]{1,16}$/u.test(extension)) throw new Error(`资源扩展名不能直接装包：${file.assetId}`);
    const path = `media/${file.sha256}${extension}`;
    // Re-read and verify the copied bytes; a changed source must not be
    // published with the digest sampled earlier by the content converter.
    const data = await readFile(filename);
    if (data.byteLength !== file.bytes || sha256(data) !== file.sha256) {
      throw new Error(`资源在构建期间发生变化：${file.assetId}`);
    }
    if (!written.has(path)) {
      await writeFile(resolve(temporary, path), data, { flag: "wx" });
      written.add(path);
    }
    resources.push({ assetId: file.assetId, sourcePath: file.path, path, sha256: file.sha256, bytes: file.bytes });
  }
  return resources;
}

async function absent(filename: string): Promise<void> {
  try { await lstat(filename); }
  catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("相同游戏产物目录已存在，拒绝覆盖");
}

async function removeStaging(base: string, temporary: string): Promise<void> {
  // Check physical absolute paths before recursive deletion. Only this
  // invocation's immediate .building-* child can ever be cleaned up.
  const actualBase = await realpath(base);
  const actualTemporary = await realpath(temporary);
  if (actualBase !== base || actualTemporary !== temporary || dirname(actualTemporary) !== actualBase
    || !basename(actualTemporary).startsWith(".building-") || !inside(actualBase, actualTemporary)) {
    throw new Error("临时产物目录边界已改变，拒绝自动清理");
  }
  await rm(actualTemporary, { recursive: true, force: true });
}

/** Explicit command only. No build, media copy or Git subprocess runs on import. */
async function build(): Promise<void> {
  const root = await realpath(REPOSITORY_ROOT);
  if (!inside(root, await realpath(resolve(root, "海风与布丁")))) {
    throw new Error("作者目录越出当前仓库，拒绝从外部目录收集资源");
  }
  const loaded = await loadSourceContent();
  const content = readStoryContent(loaded.content);
  const [skin, collection, uiOrigins] = await Promise.all([readWhaleSkin(), readCollectionSkin(), readUiOrigins()]);
  const [commit, state, lockBytes] = await Promise.all([
    exec("git", ["rev-parse", "HEAD"], { cwd: root }),
    exec("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: root }),
    readFile(resolve(root, "package-lock.json")),
  ]);
  const stamp: GamePackage["build"] = {
    commit: commit.stdout.trim(), dirty: !!state.stdout.trim(), lockSha256: sha256(lockBytes), vite: viteVersion,
  };
  const dist = resolve(root, "dist");
  await mkdir(dist, { recursive: true });
  const actualDist = await realpath(dist);
  if (!inside(root, actualDist)) throw new Error("生成物目录越出当前仓库");
  const output = resolve(actualDist, "game");
  await mkdir(output, { recursive: true });
  const base = await realpath(output);
  if (!inside(root, base)) throw new Error("游戏输出目录越出当前仓库");
  // Concurrent invocations for this content revision must not race publication.
  // An existing/stale lock is reported; it is never silently deleted.
  const lock = resolve(base, `.lock-${content.revision}`);
  await mkdir(lock);
  let temporary: string | null = null;
  let published = false;
  try {
    temporary = await mkdtemp(resolve(base, ".building-"));
    await buildFrontend({
      configFile: false, envFile: false, publicDir: false,
      root: resolve(root, "apps/game"), base: "./",
      plugins: [packagedContent(root), whaleAppearance(skin), collectionAppearance(collection)],
      build: {
        outDir: temporary, emptyOutDir: false, copyPublicDir: false, sourcemap: false,
        assetsInlineLimit: 0,
      },
    });
    // Capability file is covered by the frontend manifest; old packages cannot opt into file records.
    await writeJson(temporary, "assets/native-record-client.json", {
      format: NATIVE_RECORD_CLIENT, protocol: NATIVE_RECORD_PROTOCOL,
    });
    await writeJson(temporary, "assets/windows-audio-client.json", {
      format: WINDOWS_AUDIO_CLIENT, protocol: WINDOWS_AUDIO_PROTOCOL,
    });
    const frontend = await frontendFiles(temporary);
    const story = await writeJson(temporary, "content/story.json", content);
    const provenance = await writeJson(temporary, "content/sources.json", {
      format: "haifeng.package-sources/1",
      author: content.source,
      choiceIdentities: { file: "docs/rebuild/baseline/choices.json", sha256: loaded.identitySha256 },
      uiSkin: skin.source,
      uiCollection: collection.source,
      uiOrigins,
      resources: content.resources.map(resource => ({
        assetId: resource.id, sourcePath: resource.path, metadata: resource.metadata,
      })),
      notice: "保留来源元数据；不表示已完成素材授权核验。资源缺失或复制时变化会阻止本次产物发布。",
    });
    const resources = await copyMedia(root, loaded.files, temporary);
    const manifest = readGamePackage({
      format: "haifeng.game-package/2", hostBridge: HOST_BRIDGE_PROTOCOL,
      target: "shared-web", purpose: "game",
      workId: content.workId, contentRevision: content.revision, entry: "index.html",
      build: stamp, story, provenance, frontend, resources,
    });
    assertPackageContent(manifest, content);
    const packageId = sha256(canonical(manifest));
    const destination = resolve(base, packageId);
    await absent(destination);
    await writeJson(temporary, "game-package.json", manifest);
    // Both locations are physical absolute children of the checked output base.
    if (!inside(base, temporary) || !inside(base, destination) || dirname(destination) !== base
      || await realpath(temporary) !== temporary) throw new Error("游戏产物移动边界无效");
    await absent(destination);
    await rename(temporary, destination);
    published = true;
    console.log(`游戏集成产物已生成：${relative(root, destination)}`);
    console.log("正式运行配置：独立 game 记录，不带开发入口；尚不是 EXE/APK，未执行路线、媒体或平台验收。");
  } finally {
    try {
      if (temporary && !published) await removeStaging(base, temporary);
    } finally {
      // The lock was created exclusively above; only remove its empty directory.
      await rmdir(lock);
    }
  }
}

if (isCommandEntry(import.meta.url)) {
  build().catch((error: unknown) => {
    if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
    else console.error(error instanceof Error ? error.message : "游戏构建失败");
    process.exitCode = 1;
  });
}
