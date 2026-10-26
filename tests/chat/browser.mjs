import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "vite";

// Use an installed/bundled Playwright without adding a supplier or changing the project lock file.
const require = createRequire(process.env.HAIFENG_PLAYWRIGHT_PACKAGE ?? import.meta.url);
const { chromium } = require("playwright");
const root = resolve(import.meta.dirname, "../..");
const token = randomBytes(24).toString("base64url");
const python = process.env.HAIFENG_TEST_PYTHON ?? resolve(root, ".venv/Scripts/python.exe");
const artifacts = resolve(root, "dist/verification/agent");
await mkdir(artifacts, { recursive: true });
const panelServer = await createServer({
  configFile: false, envFile: false, root, logLevel: "warn",
  optimizeDeps: { entries: ["tests/chat/panel.html"] },
  server: { host: "127.0.0.1", port: 0, strictPort: false, open: false },
});
let gameServer;
let child;
let browser;
let serviceOrigin;
const summary = [];
const check = name => { summary.push(name); console.log(`PASS ${name}`); };
const headers = { "X-Haifeng-Chat-Token": token };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await wait(30); }
  throw Error("Timed out waiting for isolated test condition");
}

try {
  await panelServer.listen();
  const panelOrigin = `http://127.0.0.1:${panelServer.httpServer.address().port}`;
  child = spawn(python, ["tests/chat/fixture_service.py", "--origin", panelOrigin], {
    cwd: root, env: { ...process.env, HAIFENG_CHAT_TOKEN: token }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let childError = "";
  child.stderr.on("data", value => { childError += value.toString(); });
  const lines = createInterface({ input: child.stdout });
  const first = await Promise.race([
    new Promise((resolve, reject) => {
      lines.once("line", resolve);
      child.once("error", reject);
      child.once("exit", code => reject(Error(`Fixture exited ${code}: ${childError}`)));
    }),
    wait(10000).then(() => { throw Error("Fixture did not start"); }),
  ]);
  serviceOrigin = `http://127.0.0.1:${JSON.parse(first).port}`;
  await until(async () => {
    try { return (await fetch(`${serviceOrigin}/__test/state`, { headers })).ok; } catch { return false; }
  });
  const state = async () => (await fetch(`${serviceOrigin}/__test/state`, { headers })).json();
  browser = await chromium.launch({
    headless: true, executablePath: process.env.HAIFENG_BROWSER_EXECUTABLE ?? chromium.executablePath(),
  });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const allowed = new Set([panelOrigin, serviceOrigin]);
  const external = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (allowed.has(url.origin) || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    external.push(url.origin);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${panelOrigin}/tests/chat/panel.html`);
  await page.locator("#open").click();
  await page.getByLabel("选择一次已保存的通关", { exact: true }).selectOption("test-clear-1");
  const connect = page.getByRole("button", { name: "连接并读取角色目录", exact: true });
  const origin = page.getByLabel("独立聊天服务地址（不是模型 API）", { exact: true });
  const password = page.getByLabel("独立服务令牌（不是模型密钥，仅留内存）", { exact: true });
  const characters = page.getByLabel("显式选择聊天角色", { exact: true });
  const input = page.getByLabel("输入消息", { exact: true });
  const prepare = page.getByRole("button", { name: "准备发送并查看上传内容", exact: true });
  const confirm = page.getByRole("button", { name: "我确认上传并发起本轮请求", exact: true });
  const stop = page.getByRole("button", { name: "停止接收 / 取消准备", exact: true });
  await origin.fill(serviceOrigin);
  await password.fill("incorrect_test_token_with_valid_shape");
  await connect.click();
  await page.getByRole("status").filter({ hasText: "凭据无效" }).waitFor();
  assert.equal((await state()).calls, 0);
  check("浏览器能读取跨源鉴权错误，错误凭据不触发模型");
  await password.fill(token);
  await connect.click();
  await characters.selectOption("test-character");
  assert.equal(await password.inputValue(), "");
  await input.fill("你好");
  await prepare.click();
  await confirm.waitFor();
  assert.equal((await state()).calls, 0);
  const disclosure = await page.locator(".chat-disclosure").innerText();
  assert.ok(disclosure.includes(serviceOrigin) && disclosure.includes("确认后才上传"));
  assert.equal(disclosure.includes(token), false);
  const readsBefore = await page.evaluate(() => window.chatTest.reads());
  await confirm.click();
  await page.locator(".chat-turn").filter({ hasText: "回复完成" }).waitFor();
  assert.ok((await page.evaluate(() => window.chatTest.reads())) > readsBefore);
  assert.equal((await state()).calls, 1);
  assert.ok((await page.locator(".chat-transcript").innerText()).includes("离线测试回复🐋"));
  check("实际 TS 面板→HTTP/CORS→Python→脚本模型→文字流完整收发；发送前需确认且再读事实");
  await page.screenshot({ path: resolve(artifacts, "chat-desktop.png"), fullPage: true });

  await input.fill("markup");
  await prepare.click();
  await confirm.click();
  await page.locator(".chat-turn").filter({ hasText: "window.injected" }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 2
    && document.querySelector(".chat-turn:last-child").textContent.includes("回复完成"));
  assert.equal(await page.locator(".chat-transcript img").count(), 0);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  check("模型输出仅为文字，不执行 HTML/脚本或工具");

  await input.fill("hold");
  await prepare.click();
  await confirm.click();
  await page.locator(".chat-turn:last-child").filter({ hasText: "等待片段" }).waitFor();
  await stop.click();
  await page.locator(".chat-turn:last-child").filter({ hasText: "已停止" }).waitFor();
  await until(async () => (await state()).active === 0);
  const stopped = await state();
  assert.ok(stopped.cancelled >= 1);
  await wait(150);
  assert.equal((await state()).calls, stopped.calls);
  check("停止关闭实际模型流并释放服务会话，不自动重发");

  await input.fill("quota");
  await prepare.click();
  await confirm.click();
  await page.locator(".chat-turn:last-child").filter({ hasText: "额度不足" }).waitFor();
  assert.equal((await page.locator("#panel").innerText()).includes("PRIVATE"), false);
  await wait(100);
  assert.equal((await state()).calls, stopped.calls + 1);
  check("额度错误只影响本轮聊天，不泄露供应错误体，不降级或重试");

  const beforeOffline = (await state()).calls;
  await context.setOffline(true);
  await input.fill("离线输入");
  await prepare.click();
  await confirm.click();
  await page.locator(".chat-turn:last-child").filter({ hasText: "连接失败或中断" }).waitFor();
  await context.setOffline(false);
  assert.equal((await state()).calls, beforeOffline);
  check("浏览器断网只产生本轮网络错误，没有后台重发或模型调用");

  await input.fill("hold");
  await prepare.click();
  await confirm.click();
  await page.locator(".chat-turn:last-child").filter({ hasText: "等待片段" }).waitFor();
  await page.getByLabel("选择一次已保存的通关", { exact: true }).selectOption("test-clear-2");
  await until(async () => (await state()).active === 0);
  await origin.waitFor();
  assert.equal(await origin.inputValue(), "");
  assert.equal(await page.locator(".chat-turn").count(), 0);
  check("切换通关事实取消真实在途请求，不沿用聊天、凭据或上一条事实的确认");
  await origin.fill(serviceOrigin);
  await password.fill(token);
  await connect.click();
  await characters.selectOption("test-character");
  await input.fill("未发送的确认");
  await prepare.click();
  await confirm.waitFor();
  const beforeChange = (await state()).calls;
  await origin.fill(`${serviceOrigin}/`);
  assert.equal(await confirm.count(), 0);
  assert.equal((await state()).calls, beforeChange);
  check("连接配置变更使待确认载荷失效，不能发送给后来修改的目标");
  await password.fill(token);
  await connect.click();
  await characters.selectOption("test-character");
  await input.fill("hold");
  await prepare.click();
  await confirm.click();
  await page.locator(".chat-turn:last-child").filter({ hasText: "等待片段" }).waitFor();
  await page.locator("#close").click();
  await until(async () => (await state()).active === 0);
  assert.equal(await page.locator("#panel").innerText(), "");
  await page.locator("#open").click();
  await page.getByLabel("选择一次已保存的通关", { exact: true }).selectOption("test-clear-1");
  assert.equal(await page.locator(".chat-turn").count(), 0);
  assert.equal(await password.inputValue(), "");
  check("关闭/重开取消原请求、清空本页历史和令牌，不接续旧流");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(artifacts, "chat-narrow.png"), fullPage: true });
  await page.locator("#close").click();
  await page.evaluate(() => window.chatTest.empty());
  await page.locator("#open").click();
  await page.getByRole("status").filter({ hasText: "尚无已保存的通关事实" }).waitFor();
  assert.equal(await connect.count(), 0);
  check("没有已提交通关时不提供聊天连接，不伪造解锁");
  assert.equal((await state()).tools, false);
  assert.deepEqual(errors, []);
  await context.close();

  // Fresh browser storage; actual mainline startup must not depend on the fixture service.
  gameServer = await createServer({
    configFile: resolve(root, "tools/dev/vite.config.ts"), envFile: false, logLevel: "warn",
    server: { host: "127.0.0.1", port: 0, strictPort: false, open: false },
  });
  await gameServer.listen();
  const gameOrigin = `http://127.0.0.1:${gameServer.httpServer.address().port}`;
  const gameContext = await browser.newContext({ serviceWorkers: "block" });
  const mainNetwork = [];
  await gameContext.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === gameOrigin || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    mainNetwork.push(url.origin);
    return route.abort();
  });
  const game = await gameContext.newPage();
  const gameErrors = [];
  game.on("pageerror", error => gameErrors.push(error.message));
  await game.goto(gameOrigin);
  await game.locator("#start").click({ timeout: 20000 });
  await until(async () => game.locator("#play-controls").isVisible());
  await until(async () => !(await game.locator("#next").isDisabled()));
  const nodeId = async () => JSON.parse(await game.locator("#debug").textContent()).nodeId;
  const initialNode = await nodeId();
  for (let attempt = 0; attempt < 3 && await nodeId() === initialNode; attempt++) {
    // First click may finish the typewriter; an accepted continuation must actually change node.
    await game.locator("#next").click();
    await wait(200);
  }
  assert.notEqual(await nodeId(), initialNode);
  assert.equal(await game.locator("#title").isVisible(), false);
  assert.deepEqual(gameErrors, []);
  assert.deepEqual(mainNetwork, []);
  await wait(500); // Capture after the existing 360 ms static title fade, not midway through it.
  await game.screenshot({ path: resolve(artifacts, "mainline-offline.png") });
  check("实际分章源主线在隔离存储、无聊天连接且阻断外网时开局并继续，无页面脚本异常");
  await gameContext.close();
  assert.deepEqual(external, []);
  console.log(JSON.stringify({ passed: summary.length, checks: summary, artifacts }, null, 2));
} finally {
  await browser?.close();
  await gameServer?.close();
  await panelServer.close();
  if (child && child.exitCode === null) {
    if (serviceOrigin) {
      await fetch(`${serviceOrigin}/__test/shutdown`, { method: "POST", headers }).catch(() => {});
    }
    await until(async () => child.exitCode !== null, 5000).catch(async () => {
      child.kill();
      await until(async () => child.exitCode !== null, 2000);
    });
  }
}
await writeFile(resolve(artifacts, "browser-results.json"), JSON.stringify({
  passed: summary.length, checks: summary, temporaryServicesStopped: child?.exitCode !== null,
  externalModelCalls: 0,
}, null, 2) + "\n");
