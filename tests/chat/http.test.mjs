import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { HttpChatConnection } from "../../packages/chat/src/http.ts";
import { ChatSession } from "../../packages/chat/src/session.ts";
import { character, event, reader, selection, tick } from "./fixtures.mjs";

async function fixture(t, chat, info) {
  const received = [];
  const token = randomBytes(24).toString("base64url");
  const server = createServer(async (request, response) => {
    const body = [];
    for await (const chunk of request) body.push(chunk);
    const text = Buffer.concat(body).toString("utf8");
    received.push({ path: request.url, headers: request.headers, body: text });
    if (request.url === "/api/aftergame/info") {
      if (info) return info(request, response);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        format: "haifeng.chat-service/1", serviceId: "http-test", name: "离线测试",
        scopeKinds: ["development"], characters: [{ ...character, endingIds: [selection.endingId] }],
      }));
      return;
    }
    const value = JSON.parse(text);
    response.writeHead(200, { "Content-Type": "application/x-ndjson" });
    chat(value, response);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const connection = new HttpChatConnection(`http://127.0.0.1:${server.address().port}`, token);
  t.after(async () => {
    connection.dispose();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { connection, received, token };
}

test("真实 HTTP：目录不上传事实，逐轮确认后仅发送原载荷；服务令牌不在正文或 URL", async t => {
  const { connection, received, token } = await fixture(t, (request, response) => {
    const raw = [
      event(request, 0, "delta", { text: "你好🐋" }), event(request, 1, "done"),
    ].map(item => JSON.stringify(item) + "\n").join("");
    const bytes = Buffer.from(raw);
    // Exercise UTF-8 and frame boundaries, not merely whole JSON chunks.
    for (let index = 0; index < bytes.length; index += 2) response.write(bytes.subarray(index, index + 2));
    response.end();
  });
  assert.equal(received.length, 0);
  await connection.discover(new AbortController().signal);
  assert.equal(received.length, 1);
  assert.equal(received[0].body, "");
  const session = new ChatSession(reader(), selection, connection.provider(character.id));
  t.after(() => session.dispose());
  const request = await session.prepare("测试输入");
  assert.equal(received.length, 1);
  await session.confirm(request.requestId);
  assert.equal(session.view().turns[0].reply, "你好🐋");
  assert.equal(session.view().turns[0].status, "complete");
  assert.deepEqual(JSON.parse(received[1].body), request);
  assert.equal(received[1].headers["x-haifeng-chat-token"], token);
  assert.equal(received[1].headers.cookie, undefined);
  assert.equal(received[1].body.includes(token), false);
  assert.equal(received[1].path.includes(token), false);
});

for (const [name, encode] of [
  ["截断行", request => JSON.stringify(event(request, 0, "done"))],
  ["终态后附加数据", request => JSON.stringify(event(request, 0, "done")) + "\n{}\n"],
  ["缺失终态", request => JSON.stringify(event(request, 0, "delta", { text: "片段" })) + "\n"],
  ["非法 UTF-8", () => Buffer.from([0xc3, 0x28])],
  ["未知事件字段", request => JSON.stringify({ ...event(request, 0, "done"), command: "write_file" }) + "\n"],
  ["超长行", () => "x".repeat(65537)],
]) {
  test(`真实 HTTP：${name}拒绝为失败，不自动重发`, async t => {
    const { connection, received } = await fixture(t, (request, response) => response.end(encode(request)));
    await connection.discover(new AbortController().signal);
    const session = new ChatSession(reader(), selection, connection.provider(character.id));
    t.after(() => session.dispose());
    await session.confirm((await session.prepare("输入")).requestId);
    assert.equal(session.view().turns[0].status, "failed");
    assert.ok(["protocol", "limit"].includes(session.view().error));
    assert.equal(received.filter(request => request.path.endsWith("/chat")).length, 1);
  });
}

test("取消和销毁会断开仍在等待的 HTTP 正文", async t => {
  const { connection } = await fixture(t, (request, response) => {
    response.write(JSON.stringify(event(request, 0, "delta", { text: "片段" })) + "\n");
  });
  await connection.discover(new AbortController().signal);
  const session = new ChatSession(reader(), selection, connection.provider(character.id));
  t.after(() => session.dispose());
  const sending = session.confirm((await session.prepare("输入")).requestId);
  while (!session.view().turns[0]?.reply) await tick();
  connection.dispose();
  await sending;
  assert.equal(session.view().turns[0].status, "cancelled");
  assert.equal(session.view().turns[0].reply, "片段");
});

test("目录正文未完成时销毁连接，目录读取也立即结束", async t => {
  const { connection } = await fixture(t, () => {}, (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write("{");
  });
  const discovering = connection.discover(new AbortController().signal);
  await tick();
  connection.dispose();
  await assert.rejects(discovering, { code: "cancelled" });
});

test("HTTP 错误只显示本地安全提示，不显示远端错误体", async t => {
  const { connection } = await fixture(t, () => {}, (_request, response) => {
    response.writeHead(401);
    response.end("PRIVATE MODEL KEY OR PROVIDER ERROR");
  });
  await assert.rejects(connection.discover(new AbortController().signal), error => {
    assert.equal(error.code, "auth");
    assert.equal(error.message.includes("PRIVATE"), false);
    return true;
  });
});

test("凭据、非本机明文、查询、任意路径和片段地址在联网前被拒绝", () => {
  const token = randomBytes(24).toString("base64url");
  for (const origin of [
    "http://example.invalid", "https://name:secret@example.invalid",
    "http://127.0.0.1:8766/api", "http://127.0.0.1:8766?token=x", "http://127.0.0.1:8766/#x",
  ]) assert.throws(() => new HttpChatConnection(origin, token));
  assert.throws(() => new HttpChatConnection("http://127.0.0.1:8766", "bad\r\nheader"));
});
