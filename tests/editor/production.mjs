import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createServer } from "vite";
import { fixture } from "./fixture.ts";
import { fixtureImage, fixtureAudio } from "./media.mjs";
import { assembleAuthorProject } from "../../tools/content/source.ts";
import { readProjectArchive, writeProjectArchive } from "../../tools/editor/portable.ts";
import { ProjectArchive } from "../../tools/editor/archive.ts";

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, "../.."), artifacts = resolve(root, "dist/verification/editor/production");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const readJson = async file => JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/u, ""));
const require = createRequire(process.env.HAIFENG_PLAYWRIGHT_PACKAGE ?? import.meta.url);
const { chromium } = require("playwright");
const checks = [], errors = [], external = [], replies = [], downloadReplies = [];
const check = value => { checks.push(value); console.log(`PASS ${value}`); };
await mkdir(artifacts, { recursive: true });
const sandbox = await mkdtemp(resolve(artifacts, "sandbox-"));
const sourceFolders = ["tools/editor", "tools/content", "tools/game", "tools/dev", "packages/story-model",
  "packages/story-runtime", "packages/player", "packages/chat", "apps/editor", "apps/game", "content/game-ui"];
for (const folder of sourceFolders) {
  await cp(resolve(root, folder), resolve(sandbox, folder), { recursive: true, filter: async path => {
    const info = await lstat(path);
    return info.isDirectory() || info.isFile() && /\.(?:ts|js|css|html|json)$/u.test(path);
  } });
}
for (const file of ["package.json", "package-lock.json", "tsconfig.json", "tsconfig.web.json", ".gitignore", "tools/cli-entry.ts"]) {
  await mkdir(dirname(resolve(sandbox, file)), { recursive: true }); await cp(resolve(root, file), resolve(sandbox, file));
}
await symlink(resolve(root, "node_modules"), resolve(sandbox, "node_modules"), process.platform === "win32" ? "junction" : "dir");
const original = fixture(true), story = resolve(sandbox, "content/story"), game = resolve(sandbox, "海风与布丁");
for (const [file, bytes] of original.files) {
  await mkdir(dirname(resolve(story, file)), { recursive: true }); await writeFile(resolve(story, file), bytes);
}
for (const asset of original.assets) {
  const file = resolve(game, asset.record.src);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, ["bg", "ch"].includes(asset.record.type) ? fixtureImage() : fixtureAudio());
}
const collection = JSON.parse(await readFile(resolve(root, "content/game-ui/collection.json"), "utf8"));
const decoration = resolve(root, collection.musicBackdrop), child = relative(root, decoration);
assert.ok(child && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child));
await mkdir(dirname(resolve(sandbox, child)), { recursive: true }); await cp(decoration, resolve(sandbox, child));
await writeFile(resolve(game, "private-not-for-export.txt"), "PRIVATE SENTINEL — must never be packaged");
await exec("git", ["-c", "init.defaultBranch=main", "init", sandbox]);
await exec("git", ["add", "--", "."], { cwd: sandbox });
await exec("git", ["-c", "user.name=Editor Fixture", "-c", "user.email=editor-fixture@example.invalid",
  "-c", "commit.gpgsign=false", "-c", `core.hooksPath=${resolve(sandbox, "no-hooks")}`, "commit", "-m", "fixture"], { cwd: sandbox });

const server = await createServer({
  configFile: resolve(sandbox, "tools/editor/vite.config.ts"), logLevel: "warn",
  plugins: [{
    name: "isolated-production-origin-proxy", enforce: "pre",
    configureServer(instance) {
      // Normalize only this random loopback origin to the production API origin.
      // Keep browser file bodies and native downloads on their real HTTP streams.
      instance.middlewares.use((request, _response, next) => {
        const address = instance.httpServer.address();
        const host = typeof address === "object" && address ? `127.0.0.1:${address.port}` : "";
        if (request.url?.startsWith("/__editor/") && request.headers.host === host
          && (request.headers.origin === undefined || request.headers.origin === `http://${host}`)) {
          request.headers.host = "127.0.0.1:5174";
          if (request.headers.origin !== undefined) request.headers.origin = "http://127.0.0.1:5174";
        }
        next();
      });
    },
  }],
  server: { host: "127.0.0.1", port: 0, strictPort: false, open: false },
});
let browser, page;
function transport(origin, path, method = "POST", body = Buffer.from("{}"), headers = {}) {
  return new Promise((resolveRequest, reject) => {
    const outgoing = { ...headers, host: "127.0.0.1:5174", origin: "http://127.0.0.1:5174",
      "sec-fetch-site": "same-origin" };
    delete outgoing["content-length"]; delete outgoing["transfer-encoding"]; delete outgoing["accept-encoding"];
    if (method === "POST") outgoing["content-length"] = String(body?.length ?? 0);
    const request = httpRequest(new URL(path, origin), { method, headers: outgoing }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolveRequest({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end(body);
  });
}
const pause = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
async function until(predicate, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await pause(60); }
  throw new Error("隔离生产流程等待超时");
}
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.HAIFENG_BROWSER_EXECUTABLE ?? chromium.executablePath() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) {
      if (["data:", "blob:"].includes(url.protocol)) return route.continue();
      external.push(url.origin); return route.abort();
    }
    return route.continue();
  });
  page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  page.on("response", async response => {
    const url = new URL(response.url());
    if (url.origin !== origin || !url.pathname.startsWith("/__editor/")
      || url.pathname.startsWith("/__editor/media/") || url.pathname.startsWith("/__editor/delivery/")) return;
    try { replies.push({ route: url.pathname, status: response.status(), data: await response.json() }); } catch {}
  });
  await page.goto(origin);
  await until(async () => (await page.locator("#message").innerText()).includes("已读取当前作者源"));
  check("real author API loads only the isolated fixture workspace");
  const action = id => page.locator(`#${id}`);
  const waitDownload = async link => until(async () => {
    const failed = replies.filter(reply => reply.route === "/__editor/delivery-status"
      && reply.data?.state === "failed").at(-1);
    if (failed) throw new Error(`交付失败：${failed.data.message}`);
    return link.isVisible();
  }, 120000);
  const save = async () => {
    const before = replies.filter(reply => reply.route === "/__editor/save").length;
    await action("save").click();
    await until(() => replies.filter(reply => reply.route === "/__editor/save").length > before);
    await until(async () => (await action("message").innerText()).includes("作者源已保存"));
    assert.equal(replies.filter(reply => reply.route === "/__editor/save").at(-1).status, 200);
  };
  await action("tab-structure").click();
  await page.getByRole("textbox", { name: "新章节名称", exact: true }).fill("真实文件新章");
  await page.getByRole("button", { name: "新增章节", exact: true }).click();
  await page.getByRole("button", { name: "在后面新增", exact: true }).click();
  const created = await action("nodes").inputValue();
  await page.getByRole("button", { name: "将所选节点设为开局", exact: true }).click();
  await save();
  const manifest = JSON.parse(await readFile(resolve(story, "project.json"), "utf8"));
  assert.equal(manifest.entryNodeId, created);
  const newChapter = manifest.chapters.find(chapter => chapter.id !== "trial");
  assert.equal(JSON.parse(await readFile(resolve(story, newChapter.file), "utf8")).nodes[0].id, created);
  const added = replies.filter(reply => reply.route === "/__editor/save").at(-1).data;
  const firstBackup = resolve(sandbox, added.backup);
  const journal = JSON.parse(await readFile(resolve(firstBackup, "transaction.json"), "utf8"));
  assert.ok(journal.replacements.some(file => file.file === newChapter.file && file.before === null));
  await page.getByRole("textbox", { name: "删除后的替代节点", exact: true }).fill("start");
  await page.getByRole("checkbox", { name: /确认删除所选节点/u }).check();
  await page.getByRole("button", { name: "删除所管理章节", exact: true }).click();
  await save();
  await assert.rejects(readFile(resolve(story, newChapter.file)), { code: "ENOENT" });
  const removed = replies.filter(reply => reply.route === "/__editor/save").at(-1).data;
  assert.equal(JSON.parse(await readFile(resolve(sandbox, removed.backup, newChapter.file), "utf8")).nodes[0].id, created);
  assert.equal(JSON.parse(await readFile(resolve(story, "project.json"), "utf8")).entryNodeId, "start");
  check("real multi-file transactions add/delete chapter files, retarget entry and retain originals and journals");

  await action("tab-delivery").click();
  await page.getByRole("combobox", { name: "导入素材类别", exact: true }).selectOption("bg");
  await page.locator('input[aria-label="选择要导入的素材"]').setInputFiles({ name: "上传样例.png", mimeType: "image/png", buffer: fixtureImage() });
  await page.getByRole("button", { name: "导入所选素材", exact: true }).click();
  await until(() => replies.some(reply => reply.route === "/__editor/import-resource" && reply.status === 200));
  await until(async () => (await action("author-delivery").innerText()).includes("已将 1 个素材"));
  const uploaded = replies.filter(reply => reply.route === "/__editor/import-resource").at(-1).data.asset;
  assert.equal(uploaded.record.src, `assets/imported/${hash(fixtureImage())}.png`);
  assert.deepEqual(await readFile(resolve(game, uploaded.record.src)), fixtureImage());
  assert.equal(Object.hasOwn(JSON.parse(await readFile(resolve(story, "resources/backgrounds.json"), "utf8")), uploaded.key), false);
  await page.getByRole("combobox", { name: "素材类别", exact: true }).selectOption("bg");
  await page.getByRole("button", { name: `使用素材 ${uploaded.key}`, exact: true }).click();
  await save();
  assert.equal((await readJson(resolve(story, "chapters/trial.json"))).nodes[0].bg, uploaded.key);
  check("binary HTTP resource import installs immutable bytes and registers them only when the author explicitly saves");

  await action("tab-dialogue").click(); await action("text").fill("项目包中的未保存对白");
  await action("tab-delivery").click();
  assert.equal(await page.getByRole("button", { name: "生成正式游戏 ZIP", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "导出完整项目包（含素材）", exact: true }).click();
  const projectLink = page.locator("#author-delivery a").filter({ hasText: /下载 project-/u });
  await waitDownload(projectLink);
  const projectDownloadPromise = page.waitForEvent("download"); await projectLink.click();
  const projectDownload = await projectDownloadPromise, projectZip = resolve(sandbox, "exported-project.zip");
  await projectDownload.saveAs(projectZip).catch(async error => {
    throw new Error(`项目下载失败：${await projectDownload.failure()}；HTTP ${JSON.stringify(downloadReplies.at(-1))}；${error.message}`);
  });
  const exported = await readProjectArchive(projectZip);
  assert.equal(exported.project.nodes[0].record.text, "项目包中的未保存对白");
  assert.notEqual((await readJson(resolve(story, "chapters/trial.json"))).nodes[0].text, "项目包中的未保存对白");
  assert.equal([...exported.archive.entries.keys()].some(path => path.includes("private-not-for-export")), false);
  const foreignFiles = new Map(exported.project.files), foreignManifest = JSON.parse(Buffer.from(foreignFiles.get("project.json")).toString("utf8"));
  foreignManifest.workId = "imported-work-fixture"; foreignManifest.title = "导入的完整作品";
  foreignFiles.set("project.json", Buffer.from(JSON.stringify(foreignManifest)));
  const foreign = assembleAuthorProject(foreignFiles), foreignZip = resolve(sandbox, "foreign-project.zip");
  await writeProjectArchive(foreign, exported.manifest.resources.map(resource => ({
    assetId: resource.assetId, path: resource.sourcePath, sha256: resource.sha256, bytes: resource.bytes,
  })), foreignZip, { gameRoot: game });
  await page.locator('input[aria-label="选择完整项目 ZIP"]').setInputFiles(foreignZip);
  await page.getByRole("checkbox", { name: /我已保留需要的当前修改/u }).check();
  await page.getByRole("button", { name: "导入项目包到本页草稿", exact: true }).click();
  await until(async () => (await action("author-delivery").innerText()).includes("项目 导入的完整作品 已导入"), 60000);
  assert.equal(JSON.parse(await readFile(resolve(story, "project.json"), "utf8")).workId, original.workId);
  await save();
  assert.equal(JSON.parse(await readFile(resolve(story, "project.json"), "utf8")).workId, foreign.workId);
  assert.equal((await readJson(resolve(story, "chapters/trial.json"))).nodes[0].text, "项目包中的未保存对白");
  const restoredAssets = JSON.parse(await readFile(resolve(story, "resources/backgrounds.json"), "utf8"));
  assert.ok(Object.values(restoredAssets).every(asset => asset.src.startsWith("assets/imported/")));
  assert.deepEqual(await readFile(resolve(game, "assets/fixture-bg.png")), fixtureImage());
  check("complete project ZIP carries current draft and materials; importing another work migrates resources and requires explicit author save");

  await page.getByRole("button", { name: "生成正式游戏 ZIP", exact: true }).click();
  const gameLink = page.locator("#author-delivery a").filter({ hasText: /下载 game-/u });
  await waitDownload(gameLink);
  const firstJob = replies.filter(reply => reply.route === "/__editor/delivery-status" && reply.data?.state === "ready").at(-1).data;
  const packageModule = await import(pathToFileURL(resolve(sandbox, "tools/game/package-input.ts")).href);
  const verified = await packageModule.verifyGamePackageInput(firstJob.packageId);
  assert.equal(verified.input.content.workId, foreign.workId);
  assert.ok(verified.files > 5);
  const gameDownloadPromise = page.waitForEvent("download"); await gameLink.click();
  const gameDownload = await gameDownloadPromise, gameZip = resolve(sandbox, "exported-game.zip");
  await gameDownload.saveAs(gameZip);
  const gameArchive = await ProjectArchive.open(gameZip);
  assert.equal(JSON.parse((await gameArchive.read("game-package.json")).toString("utf8")).workId, foreign.workId);
  assert.equal(gameArchive.entries.size, packageModule.gamePackageFiles(verified.input.manifest).length + 1);
  await page.getByRole("button", { name: "生成正式游戏 ZIP", exact: true }).click();
  await waitDownload(gameLink);
  const repeated = replies.filter(reply => reply.route === "/__editor/delivery-status" && reply.data?.state === "ready").at(-1).data;
  assert.equal(repeated.packageId, firstJob.packageId);
  check("editor calls the official game builder, verifies every packaged file, downloads the complete ZIP and safely reuses an identical package");
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await page.screenshot({ path: resolve(artifacts, "production.png"), fullPage: true });
  await writeFile(resolve(artifacts, "summary.json"), JSON.stringify({
    checks, errors, external, packageId: firstJob.packageId, files: verified.files, bytes: verified.bytes, sandbox,
    scope: "Real browser + real HTTP API and filesystem, isolated source/media/Git snapshot; production author files untouched.",
  }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, artifacts }));
} catch (error) {
  console.error(JSON.stringify({ errors, message: await page?.locator("#message").textContent().catch(() => ""),
    delivery: await page?.locator("#author-delivery").innerText().catch(() => ""),
    lastReply: { route: replies.at(-1)?.route, status: replies.at(-1)?.status, error: replies.at(-1)?.data?.error }, sandbox }));
  await page?.screenshot({ path: resolve(artifacts, "production-failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser?.close(); await server.close(); }
