import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rmdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as buildFrontend, version as viteVersion } from "vite";
import { canonical } from "../../packages/story-model/src/integrity.ts";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { REPOSITORY_ROOT } from "../content/build.ts";
import { readWhaleSkin } from "../content/appearance.ts";
import { whaleAppearance } from "../dev/appearance.ts";
import { assertEditorSessionMarker } from "./api.ts";
import { editorFileBytes, editorFiles, editorPackageId, editorRuntimeInputs, editorSha256, insideEditorRoot, readEditorPackage } from "./package.ts";

const exec = promisify(execFile);
async function absent(filename: string): Promise<void> {
  try { await lstat(filename); }
  catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("相同编辑产物已存在，拒绝覆盖");
}

/** Explicit local integration build only; never reads/writes author dialogue or starts a service. */
async function build(): Promise<void> {
  const root = await realpath(REPOSITORY_ROOT);
  const runtimeInputs = await editorRuntimeInputs(root);
  const [skin, commit, state, lockBytes] = await Promise.all([
    readWhaleSkin(),
    exec("git", ["rev-parse", "HEAD"], { cwd: root }),
    exec("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: root }),
    readFile(resolve(root, "package-lock.json")),
  ]);
  const dist = resolve(root, "dist");
  await mkdir(dist, { recursive: true });
  const actualDist = await realpath(dist);
  if (!insideEditorRoot(root, actualDist)) throw new Error("编辑输出目录越出当前仓库");
  const output = resolve(actualDist, "editor");
  await mkdir(output, { recursive: true });
  const base = await realpath(output);
  if (!insideEditorRoot(root, base)) throw new Error("编辑输出目录越出当前仓库");
  const lock = resolve(base, ".build-lock");
  await mkdir(lock);
  let temporary: string | null = null;
  let published = false;
  try {
    temporary = await mkdtemp(resolve(base, ".building-"));
    const frontend = resolve(temporary, "frontend");
    await buildFrontend({
      configFile: false, envFile: false, publicDir: false,
      root: resolve(root, "apps/editor"), base: "./",
      plugins: [whaleAppearance(skin)],
      build: {
        outDir: frontend, emptyOutDir: false, copyPublicDir: false,
        sourcemap: false, assetsInlineLimit: 0,
      },
    });
    const files = await editorFiles(frontend);
    for (const file of files) {
      if (/\.(?:html|js|css)$/u.test(file.path)
        && (await editorFileBytes(frontend, file.path)).toString("utf8").includes("/@fs/")) {
        throw new Error(`编辑前端残留开发资源地址：${file.path}`);
      }
    }
    assertEditorSessionMarker(new TextDecoder("utf-8", { fatal: true }).decode(await editorFileBytes(frontend, "index.html")));
    if (canonical(await editorRuntimeInputs(root)) !== canonical(runtimeInputs)) {
      throw new Error("本机编辑运行输入在构建期间变化，未采用本次产物");
    }
    const manifest = readEditorPackage({
      format: "haifeng.editor-package/1", purpose: "local-integration-trial", entry: "index.html",
      build: {
        commit: commit.stdout.trim(), dirty: !!state.stdout.trim(),
        lockSha256: editorSha256(lockBytes), vite: viteVersion,
      },
      uiSkin: skin.source, frontend: files, runtimeInputs,
    });
    const id = editorPackageId(manifest);
    const destination = resolve(base, id);
    await absent(destination);
    await writeFile(resolve(temporary, "editor-package.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    if (await realpath(base) !== base || await realpath(temporary) !== temporary || dirname(temporary) !== base
      || !insideEditorRoot(base, destination) || dirname(destination) !== base) {
      throw new Error("编辑产物移动边界已改变");
    }
    await absent(destination);
    await rename(temporary, destination);
    published = true;
    console.log(`编辑集成产物已生成：${relative(root, destination)}`);
    console.log(`显式本机试用：npm run editor:serve -- ${id}`);
    console.log("产物仍依赖当前仓库的固定作者服务与来源；未启动、未写作者源、未验收或决定正式分发。");
  } finally {
    if (temporary && !published) console.error(`编辑构建未完成，保留本次临时目录：${relative(root, temporary)}`);
    if (await realpath(lock) !== lock || dirname(lock) !== base) throw new Error("编辑构建锁边界已改变，保留锁供人工确认");
    await rmdir(lock);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error: unknown) => {
    if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
    else if (error instanceof Error) console.error(error.message);
    console.error("编辑集成构建未完成；请检查固定来源、依赖、产物及锁目录。没有启动服务或修改作者源。");
    process.exitCode = 1;
  });
}
