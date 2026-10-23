import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readStoryContent } from "../../packages/story-model/src/content.ts";
import { canonical, contentRevisionText } from "../../packages/story-model/src/integrity.ts";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { assertPackageContent, readGamePackage } from "../../packages/story-model/src/package.ts";
import type { PackageFile } from "../../packages/story-model/src/package.ts";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

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
  if (!inside(root, filename) || !(await stat(filename)).isFile()) {
    throw new Error(`游戏包文件越界或不是普通文件：${path}`);
  }
  return readFile(filename);
}

async function checked(root: string, file: PackageFile): Promise<Buffer> {
  const data = await readFileInside(root, file.path);
  if (data.byteLength !== file.bytes || sha256(data) !== file.sha256) {
    throw new Error(`游戏包文件大小或摘要不一致：${file.path}`);
  }
  return data;
}

async function directory(root: string, path: string): Promise<string> {
  const folder = resolve(root, path);
  await mkdir(folder, { recursive: true });
  const actual = await realpath(folder);
  if (actual !== root && !inside(root, actual)) throw new Error("Windows 准备目录越出当前仓库");
  return actual;
}

/** Prepare an isolated snapshot/config only; never invokes Cargo, Tauri, installers or the game. */
async function prepare(): Promise<void> {
  if (process.platform !== "win32") throw new Error("本入口当前仅用于 Windows 集成试用");
  const [packageId, ...extra] = process.argv.slice(2);
  if (!packageId || !/^[a-f0-9]{64}$/u.test(packageId) || extra.length) {
    throw new Error("用法：npm run windows:prepare -- <game:build 输出的产物摘要>");
  }
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
  const windows = await directory(dist, "windows");
  const output = resolve(windows, packageId);
  // Exclusive directory; a failed preparation is retained and never silently overwritten/deleted.
  await mkdir(output);
  if (await realpath(output) !== output) throw new Error("Windows 产物目录边界已改变");
  const frontend = resolve(output, "frontend");
  await mkdir(frontend);
  if (await realpath(frontend) !== frontend) throw new Error("Windows 前端目录边界已改变");
  try {
    const paths = new Set<string>();
    for (const file of [manifest.story, manifest.provenance, ...manifest.frontend, ...manifest.resources]) {
      if (paths.has(file.path)) continue;
      paths.add(file.path);
      const bytes = await checked(game, file);
      const target = resolve(frontend, file.path);
      const folder = await directory(frontend, relative(frontend, dirname(target)) || ".");
      if (!inside(frontend, target) || !inside(output, folder)) throw new Error("复制位置越出 Windows 前端目录");
      await writeFile(target, bytes, { flag: "wx" });
    }
    await writeFile(resolve(frontend, "game-package.json"), manifestBytes, { flag: "wx" });
    // Config is written last: only a fully copied snapshot receives an entry for native building.
    const config = {
      $schema: "https://schema.tauri.app/config/2",
      productName: "海风与布丁重构试用",
      identifier: "com.gallings.haifeng.rebuild",
      build: {
        frontendDist: frontend,
        devUrl: null, beforeDevCommand: null, beforeBuildCommand: null, beforeBundleCommand: null,
        features: ["rebuild-host", "custom-protocol"],
      },
      app: {
        windows: [], withGlobalTauri: false,
        security: {
          capabilities: [],
          csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
        },
      },
      // Clear the legacy game resource mapping. This trial embeds the prepared frontend snapshot.
      bundle: { active: false, resources: [] },
    };
    const configPath = resolve(output, "tauri.rebuild.conf.json");
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
    const receipt = {
      format: "haifeng.windows-preparation/1",
      purpose: "integration-trial",
      packageId, workId: manifest.workId, contentRevision: manifest.contentRevision,
      manifestSha256: sha256(manifestBytes),
      configSha256: sha256(`${JSON.stringify(config, null, 2)}\n`),
      storage: "separate-webview-profile/development-records",
    };
    await writeFile(resolve(output, "preparation.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
    console.log(`Windows 集成输入已准备：${output}`);
    console.log("尚未编译、启动或生成安装包。保留此目录原样；手改后须重新准备，不能据此声称验收。");
    console.log("后续测试阶段可在 desktop/src-tauri 目录显式执行：");
    console.log(`cargo tauri build --no-bundle --config "${configPath}" -- --target-dir "${resolve(output, "native-target")}"`);
  } catch (error: unknown) {
    console.error(`Windows 准备未完成，保留本次目录供定位，不自动删除或覆盖：${output}`);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepare().catch((error: unknown) => {
    if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
    else console.error(error instanceof Error ? error.message : "Windows 集成准备失败");
    process.exitCode = 1;
  });
}
