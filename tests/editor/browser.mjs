import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { prepareAuthorPatch } from "../../tools/editor/patch.ts";
import { prepareWorkspacePatch } from "../../tools/editor/workspace.ts";
import { documentFor, fixture } from "./fixture.ts";

const require = createRequire(process.env.HAIFENG_PLAYWRIGHT_PACKAGE ?? import.meta.url);
const { chromium } = require("playwright");
const root = resolve(import.meta.dirname, "../..");
const artifacts = resolve(root, "dist/verification/editor");
const server = await createServer({
  configFile: resolve(root, "tools/editor/vite.config.ts"),
  logLevel: "warn",
  server: { host: "127.0.0.1", port: 0, strictPort: false, open: false },
});
let browser;
let project = fixture();
let writes = 0;
const checks = [];
const errors = [];
const external = [];
const check = value => { checks.push(value); console.log(`PASS ${value}`); };
const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
};
function fixtureImage() {
  const chunk = (type, payload) => {
    const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(payload.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, payload])));
    return Buffer.concat([length, name, payload, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from([0,70,120,200,255]))), chunk("IEND", Buffer.alloc(0))]);
}
async function until(predicate, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await wait(40); }
  throw new Error("等待编辑器状态超时");
}

try {
  await mkdir(artifacts, { recursive: true });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    headless: true, executablePath: process.env.HAIFENG_BROWSER_EXECUTABLE ?? chromium.executablePath(),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: "block" });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      if (["data:", "blob:"].includes(url.protocol)) return route.continue();
      external.push(url.origin);
      return route.abort();
    }
    if (url.pathname.startsWith("/__editor/media/")) {
      const id = decodeURIComponent(url.pathname.split("/").at(-1));
      if (["fixture-bg", "fixture-ch"].includes(id)) return route.fulfill({
        contentType: "image/png", body: fixtureImage(),
      });
      const wav = Buffer.alloc(46);
      wav.write("RIFF"); wav.writeUInt32LE(38, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
      wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(2, 40);
      return route.fulfill({ contentType: "audio/wav", body: wav });
    }
    if (!["/__editor/source", "/__editor/preview", "/__editor/save"].includes(url.pathname)) return route.continue();
    // Exercise the real UI against isolated author data; never send a save to the actual project.
    try {
      let candidate = project;
      if (url.pathname !== "/__editor/source") {
        const input = route.request().postDataJSON();
        candidate = (input.format === "haifeng.author-workspace-patch/1"
          ? prepareWorkspacePatch(project, input) : prepareAuthorPatch(project, input)).updated;
        documentFor(candidate); // The real shared compiler rejects invalid candidates before adoption.
      }
      if (url.pathname === "/__editor/save") { project = candidate; writes++; }
      const document = documentFor(candidate);
      if (url.pathname === "/__editor/save") document.backup = "content/story/.author-backups/isolated-fixture";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(document) });
    } catch (error) {
      return route.fulfill({
        status: 422, contentType: "application/json",
        body: JSON.stringify({
          error: error instanceof Error ? error.message : "测试候选无效",
          ...(error instanceof ContentError ? { diagnostic: error.diagnostic } : {}),
        }),
      });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await until(async () => (await page.locator("#message").innerText()).includes("已读取当前作者源"));
  check("editor loads exact author fields and the node/choice forms");
  const field = name => page.locator("[data-author-field]").filter({ visible: true }).and(page.locator(`[data-author-field="${name}"]`));
  const value = async name => field(name).inputValue();
  const action = id => page.locator(`#${id}`);
  const debug = async () => JSON.parse(await action("debug").textContent());

  const card = id => page.locator(`#node-cards [data-node-id="${id}"]`);
  assert.equal(await card("start").getAttribute("aria-current"), "true");
  assert.equal(await action("preview-empty").isVisible(), false);
  assert.equal(await action("author-canvas").isVisible(), true);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    stage: document.getElementById("stage").getBoundingClientRect().toJSON(),
    cards: document.getElementById("node-cards").getBoundingClientRect().toJSON(),
    height: window.innerHeight,
  }));
  assert.equal(layout.overflow, false);
  assert.ok(layout.stage.top > 0 && layout.stage.bottom < layout.cards.top);
  assert.ok(layout.cards.bottom < layout.height);
  await action("tab-dialogue").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await action("tab-structure").getAttribute("aria-selected"), "true");
  await page.keyboard.press("End");
  assert.equal(await action("panel-checkpoints").isVisible(), true);
  await page.keyboard.press("Home");
  assert.equal(await action("panel-dialogue").isVisible(), true);
  await card("menu").click();
  const menuText = await action("text").inputValue();
  await action("text").fill("工作台切换保留的草稿");
  await card("start").click();
  await card("menu").click();
  assert.equal(await action("text").inputValue(), "工作台切换保留的草稿");
  assert.ok((await card("menu").innerText()).includes("工作台切换保留的草稿"));
  await action("undo-draft").click();
  assert.equal(await action("text").inputValue(), menuText);
  await card("menu").focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await card("start").getAttribute("aria-current"), "true");
  assert.equal(writes, 0);
  check("studio layout, keyboard tabs and timeline navigation preserve drafts without saving");

  await field("set").fill("好感 += 5");
  await action("undo-draft").click();
  assert.equal(await value("set"), "");
  await action("redo-draft").click();
  assert.equal(await value("set"), "好感 += 5");
  check("node-field edits support undo and redo without losing the current node");

  await field("jump").fill("end");
  await field("jumpIf").fill("好感 >= 5");
  await action("preview-selected").click();
  await until(async () => (await action("message").innerText()).includes("已采用本次草稿修订"));
  await until(async () => (await debug()).current?.["好感"] === 5);
  await until(async () => (await action("preview-status").innerText()).includes("ready"));
  assert.equal(await action("preview-empty").isVisible(), false);
  await action("tab-changes").click();
  await action("tab-flow").click();
  assert.equal((await debug()).current["好感"], 5);
  await action("tab-dialogue").click();
  await action("tab-story").click();
  await action("fullscreen").click();
  await until(async () => await page.evaluate(() => document.fullscreenElement?.id === "preview-surface"));
  assert.equal(await action("preview-surface").locator("#speaker").count(), 0);
  await action("fullscreen").click();
  await until(async () => await page.evaluate(() => document.fullscreenElement === null));
  await action("next").click();
  await until(async () => (await action("preview-status").innerText()).includes("end ·"));
  assert.equal((await debug()).current["好感"], 5);
  await action("stop").click();
  check("preview executes the node action once and follows the authored conditional jump");

  await field("ending").fill("冲突结局");
  await action("preview-selected").click();
  await until(async () => (await action("author-diagnostic").innerText()).includes("FLOW_CONFLICT"));
  assert.equal(await action("panel-source").isVisible(), true);
  await action("tab-dialogue").click();
  assert.equal(await value("ending"), "冲突结局");
  assert.equal(writes, 0);
  await action("undo-draft").click();
  assert.equal(await value("ending"), "");
  await action("save").click();
  await until(async () => (await action("message").innerText()).includes("作者源已保存"));
  await action("reload").click();
  await until(async () => (await action("message").innerText()).includes("已读取当前作者源"));
  assert.equal(await value("set"), "好感 += 5");
  assert.equal(await value("jump"), "end");
  assert.equal(writes, 1);
  check("conflicting flow is rejected with a diagnostic; valid node fields save and reread in the fixture");

  await action("nodes").selectOption("menu");
  await field("choice:choice-b").fill("可选项");
  await field("choice-cond:choice-a").fill("好感 >= 10");
  await field("choice-set:choice-b").fill("好感 += 7");
  await field("choice-target:choice-b").fill("start");
  await field("cdef").selectOption("choice-b");
  await action("search").fill("可选项");
  assert.ok((await action("count").innerText()).includes("匹配 1 个"));
  await action("search").fill("");
  await action("tab-flow").click();
  await page.getByRole("button", { name: "按当前草稿刷新流程", exact: true }).click();
  assert.ok((await action("author-flow").innerText()).includes("可选项"));
  await action("tab-references").click();
  await page.getByRole("button", { name: "按当前草稿刷新引用", exact: true }).click();
  assert.ok((await action("author-references").innerText()).includes("可选项"));
  await action("tab-story").click();
  check("draft choice labels participate in search, flow and reference inspection");

  const downloadPromise = page.waitForEvent("download");
  await action("export").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  assert.equal(exported.format, "haifeng.author-text-patch/4");
  assert.ok(exported.edits.some(edit => edit.field === "choice-target:choice-b" && edit.after === "start"));
  await action("preview-selected").click();
  await until(async () => (await action("preview-status").innerText()).includes("choosing"));
  assert.equal(await page.locator("#choices button").count(), 1);
  await page.locator("#choices button").filter({ hasText: "可选项" }).click();
  await until(async () => (await action("preview-status").innerText()).includes("start ·"));
  assert.equal((await debug()).current["好感"], 12);
  await action("stop").click();
  check("preview applies choice visibility, accepted-choice actions, and the edited target");

  await action("save").click();
  await until(async () => (await action("message").innerText()).includes("作者源已保存"));
  await action("reload").click();
  await until(async () => (await action("message").innerText()).includes("已读取当前作者源"));
  assert.equal(await value("choice-target:choice-b"), "start");
  assert.equal(await value("cdef"), "choice-b");
  await action("tab-source").click();
  await action("import-file").setInputFiles({
    name: "剧情草稿.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)),
  });
  await until(async () => (await action("import-panel").innerText()).includes("采用"));
  await page.locator("#import-panel").getByRole("button", { name: /采用.*草稿/u }).click();
  await until(async () => (await action("message").innerText()).includes("导入结果已采用"));
  assert.ok((await action("count").innerText()).includes("草稿修改 0 个字段"));
  assert.equal(writes, 2);
  check("choice/default fields save and reread; exported drafts compare and import without duplicate changes");

  await action("tab-dialogue").click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await action("tab-source").click();
  assert.equal(await action("import-file").isVisible(), true);
  await action("tab-dialogue").click();
  assert.equal(await value("choice-target:choice-b"), "start");
  await page.screenshot({ path: resolve(artifacts, "editor-narrow.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  const compact = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth, viewport: window.innerWidth,
    dockBottom: document.querySelector(".studio-dock").getBoundingClientRect().bottom,
    height: window.innerHeight,
  }));
  assert.equal(compact.width, compact.viewport);
  assert.ok(compact.dockBottom <= compact.height);
  check("narrow and compact desktop layouts keep author controls reachable without horizontal overflow");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await action("tab-structure").click();
  await page.getByRole("textbox", { name: "新章节名称", exact: true }).fill("新增的章节");
  await page.getByRole("button", { name: "新增章节", exact: true }).click();
  await page.getByRole("button", { name: "在后面新增", exact: true }).click();
  const firstNew = await action("nodes").inputValue();
  await page.getByRole("button", { name: "在后面新增", exact: true }).click();
  const secondNew = await action("nodes").inputValue();
  assert.notEqual(firstNew, secondNew);
  await page.getByRole("button", { name: "将所选节点设为开局", exact: true }).click();
  await page.getByRole("checkbox", { name: /确认删除所选节点/u }).check();
  await page.getByRole("button", { name: "删除所选节点", exact: true }).click();
  assert.ok((await action("message").innerText()).includes("删除范围含作品入口"));
  assert.equal(await action("nodes").inputValue(), secondNew);
  await page.getByRole("textbox", { name: "删除后的替代节点", exact: true }).fill(firstNew);
  await page.getByRole("button", { name: "删除所选节点", exact: true }).click();
  assert.equal(await action("nodes").inputValue(), firstNew);
  await page.getByRole("button", { name: "新增选项", exact: true }).click();
  await page.getByRole("button", { name: "新增选项", exact: true }).click();
  const managedChoices = page.getByRole("listbox", { name: "管理已有选项", exact: true });
  const choiceIds = await managedChoices.locator("option").evaluateAll(options => options.map(option => option.value));
  assert.equal(choiceIds.length, 2);
  await managedChoices.selectOption(choiceIds[1]);
  await page.getByRole("button", { name: "选项前移", exact: true }).click();
  assert.equal(await managedChoices.locator("option").first().getAttribute("value"), choiceIds[1]);
  await page.getByRole("button", { name: "删除选项", exact: true }).click();
  assert.equal(await managedChoices.locator("option").count(), 1);
  await action("undo-draft").click();
  assert.equal(await managedChoices.locator("option").count(), 2);
  const workspaceDownload = page.waitForEvent("download");
  await action("export").click();
  const workspaceFile = await workspaceDownload;
  const workspaceStream = await workspaceFile.createReadStream();
  const workspaceChunks = [];
  for await (const chunk of workspaceStream) workspaceChunks.push(chunk);
  const workspaceBytes = Buffer.concat(workspaceChunks);
  const workspace = JSON.parse(workspaceBytes.toString("utf8"));
  assert.equal(workspace.format, "haifeng.author-workspace-patch/1");
  assert.equal(workspace.workspace.chapters.length, 2);
  await page.getByRole("textbox", { name: "章节名称", exact: true }).fill("临时名称");
  await page.getByRole("button", { name: "重命名章节", exact: true }).click();
  await action("tab-source").click();
  await action("import-file").setInputFiles({ name: "工程草稿.json", mimeType: "application/json", buffer: workspaceBytes });
  await until(async () => (await action("import-panel").innerText()).includes("采用完整工程草稿"));
  await page.getByRole("button", { name: "采用完整工程草稿，替换本页修改", exact: true }).click();
  await action("tab-structure").click();
  assert.equal(await page.getByRole("textbox", { name: "章节名称", exact: true }).inputValue(), "新增的章节");
  await action("save").click();
  await until(async () => (await action("message").innerText()).includes("作者源已保存"));
  await action("reload").click();
  await until(async () => (await action("message").innerText()).includes("已读取当前作者源"));
  assert.equal(writes, 3);
  assert.ok((await action("count").innerText()).includes("共 4 个节点"));
  assert.equal(await action("nodes").inputValue(), firstNew);
  check("chapter/node/choice structure, deletion retargeting, history and complete draft adoption save in the isolated project");
  project = fixture(true);
  await action("reload").click();
  await until(async () => (await action("message").innerText()).includes("已读取当前作者源"));
  await until(async () => await page.locator("#author-canvas .actor").count() === 1);
  await page.getByRole("combobox", { name: "素材类别", exact: true }).selectOption("ch");
  await page.getByRole("button", { name: "使用素材 fixture-ch", exact: true }).click();
  await page.getByRole("button", { name: "使用素材 fixture-ch", exact: true }).click();
  await until(async () => await page.locator("#author-canvas .actor").count() === 3);
  const placements = page.getByRole("listbox", { name: "选择舞台立绘实例", exact: true });
  const placementIds = await placements.locator("option").evaluateAll(options => options.map(option => option.value));
  assert.equal(new Set(placementIds).size, 3);
  for (const id of placementIds.filter(id => id !== "fixture-sprite")) {
    await placements.selectOption(id);
    await page.getByRole("button", { name: "移除这张立绘", exact: true }).click();
  }
  await placements.selectOption("fixture-sprite");
  const number = async (name, value) => {
    const input = page.getByRole("spinbutton", { name, exact: true });
    await input.fill(String(value)); await input.press("Tab");
  };
  await number("立绘 X", 400);
  await number("立绘 Y", 700);
  await number("立绘高度", 500);
  await page.getByRole("checkbox", { name: "水平翻转立绘", exact: true }).check();
  await until(async () => await page.locator('#author-canvas .actor[data-instance="fixture-sprite"]').count() === 1);
  const authorActor = page.locator('#author-canvas .actor[data-instance="fixture-sprite"]');
  const scale = (await action("author-canvas").boundingBox()).width / 1280;
  const box = await authorActor.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  assert.equal(Number(await page.getByRole("spinbutton", { name: "立绘 X", exact: true }).inputValue()), Math.round(400 + 40 / scale));
  assert.equal(Number(await page.getByRole("spinbutton", { name: "立绘 Y", exact: true }).inputValue()), Math.round(700 + 20 / scale));
  await until(async () => await authorActor.locator(".author-resize").isVisible());
  const handle = await authorActor.locator(".author-resize").boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 24, { steps: 3 });
  await page.mouse.up();
  assert.ok(Number(await page.getByRole("spinbutton", { name: "立绘高度", exact: true }).inputValue()) > 500);
  await page.getByRole("combobox", { name: "配乐", exact: true }).selectOption("fixture-bgm");
  await page.getByRole("combobox", { name: "语音", exact: true }).selectOption("fixture-vo");
  await page.getByRole("button", { name: "添加一次音效", exact: true }).click();
  await page.getByRole("button", { name: "添加环境声", exact: true }).click();
  await number("环境声增益 1", 0.4);
  assert.equal(await page.locator("#author-assets audio").evaluate(audio => audio.paused), true);
  await action("save").click();
  await until(async () => (await action("message").innerText()).includes("作者源已保存"));
  const savedStage = project.nodes.find(node => node.record.id === "start").record;
  assert.equal(savedStage.bgm, "fixture-bgm");
  assert.equal(savedStage.voice, "fixture-vo");
  assert.equal(savedStage.sprites.length, 1);
  assert.equal(savedStage.sprites[0].uid, "fixture-sprite");
  assert.equal(savedStage.sprites[0].flip, true);
  assert.equal(savedStage.seEvents[0].id, "fixture-se");
  assert.equal(savedStage.ambience[0].gain, 0.4);
  check("registered assets, distinct sprite instances, canvas dragging/resizing, flipping and sound selection reach the saved author model");
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await page.screenshot({ path: resolve(artifacts, "editor.png"), fullPage: true });
  await writeFile(resolve(artifacts, "summary.json"), JSON.stringify({
    checks, pageErrors: errors, externalRequests: external, writes,
    scope: "Real editor UI and shared compiler with isolated in-memory author data; actual author files untouched.",
  }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, writes, artifacts }));
} finally {
  await browser?.close();
  await server.close();
}
