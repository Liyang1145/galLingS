import assert from "node:assert/strict";
import { test } from "node:test";
import { ClearedContextReader } from "../../packages/chat/src/context.ts";
import { ChatSession } from "../../packages/chat/src/session.ts";
import { CHAT_LIMITS, ChatError, chatRequest, readChatEvent } from "../../packages/chat/src/protocol.ts";
import { character, content, deferred, destination, event, provider, reader, records, scope, selection, tick } from "./fixtures.mjs";

test("准备不联网；确认采用冻结的原载荷，每轮重新读取已提交事实", async () => {
  let reads = 0;
  const original = records();
  const gateway = reader({ read: async () => { ++reads; return original; } });
  const model = provider();
  const session = new ChatSession(gateway, selection, model);
  const request = await session.prepare("你好");
  assert.equal(reads, 1);
  assert.equal(model.requests.length, 0);
  assert.equal(request.context.coverage, "ending-only");
  assert.equal(request.context.reference.kind, "current-content");
  assert.deepEqual(request.messages, [{ role: "user", text: "你好" }]);
  assert.equal(Object.isFrozen(request.context.completion), true);
  assert.equal(Object.isFrozen(request.messages[0]), true);
  assert.throws(() => { request.messages[0].text = "换掉输入"; }, TypeError);
  assert.throws(() => { request.character.id = "其他角色"; }, TypeError);
  assert.equal(JSON.stringify(request).includes("token"), false);
  await session.confirm(request.requestId);
  assert.equal(reads, 2);
  assert.equal(model.requests[0], request);
  assert.equal(session.view().phase, "idle");
  assert.equal(session.view().turns[0].status, "complete");
  assert.deepEqual(original, records());
  session.dispose();
});

test("已完成历史进入下一轮；失败片段可见但不会上传；重试须新 ID 和确认", async () => {
  let round = 0;
  const model = provider((request, _signal, receive) => {
    receive(event(request, 0, "delta", { text: `回复${++round}` }));
    receive(event(request, 1, round === 2 ? "error" : "done", round === 2 ? { code: "quota" } : {}));
  });
  const session = new ChatSession(reader(), selection, model);
  const first = await session.prepare("第一轮");
  await session.confirm(first.requestId);
  const failed = await session.prepare("失败输入");
  await session.confirm(failed.requestId);
  assert.equal(session.view().error, "quota");
  assert.equal(session.view().turns[1].reply, "回复2");
  const retry = await session.prepare("失败输入");
  assert.notEqual(retry.requestId, failed.requestId);
  assert.equal(retry.conversationId, first.conversationId);
  assert.deepEqual(retry.messages.map(message => message.text), ["第一轮", "回复1", "失败输入"]);
  assert.equal(model.requests.length, 2);
  await session.confirm(retry.requestId);
  assert.equal(session.view().turns[2].status, "complete");
  session.dispose();
});

test("双击确认及发送期间的新输入都不会创建第二笔模型请求", async () => {
  const held = deferred();
  const model = provider(async () => held.promise);
  const session = new ChatSession(reader(), selection, model);
  const request = await session.prepare("一次");
  const sending = session.confirm(request.requestId);
  await assert.rejects(session.confirm(request.requestId), { code: "context" });
  await assert.rejects(session.prepare("第二次"), { code: "busy" });
  await tick();
  assert.equal(model.requests.length, 1);
  session.cancel();
  await sending;
  held.resolve();
  session.dispose();
});

test("准备后通关事实消失，确认不会调用模型", async () => {
  const original = records();
  const model = provider();
  const session = new ChatSession(reader({ read: async () => original }), selection, model);
  const request = await session.prepare("不能用旧列表授权");
  original.clears = [];
  await session.confirm(request.requestId);
  assert.equal(session.view().error, "context");
  assert.equal(model.requests.length, 0);
  session.dispose();
});

test("取消未完成的事实读取立即释放本地操作，迟到读取不会采用", async () => {
  const held = deferred();
  let reads = 0;
  const model = provider();
  const session = new ChatSession(reader({ read: () => ++reads === 1 ? Promise.resolve(records()) : held.promise }), selection, model);
  const request = await session.prepare("等待事实再读");
  const sending = session.confirm(request.requestId);
  session.cancel();
  await sending;
  assert.equal(session.view().phase, "cancelled");
  held.resolve(records());
  await tick();
  assert.equal(model.requests.length, 0);
  session.dispose();
});

test("适配器不合作也能停止；迟到流不能污染新轮次或被销毁会话", async () => {
  const held = deferred();
  let oldReceive;
  const model = provider((request, _signal, receive) => {
    if (!oldReceive) {
      oldReceive = receive;
      receive(event(request, 0, "delta", { text: "未完成片段" }));
      return held.promise;
    }
    receive(event(request, 0, "delta", { text: "新回复" }));
    receive(event(request, 1, "done"));
  });
  const session = new ChatSession(reader(), selection, model);
  const first = await session.prepare("旧输入");
  const sending = session.confirm(first.requestId);
  await tick();
  session.cancel();
  await sending;
  const second = await session.prepare("新输入");
  assert.equal(second.messages.length, 1);
  oldReceive(event(first, 1, "delta", { text: "迟到内容" }));
  await session.confirm(second.requestId);
  assert.equal(session.view().turns[1].reply, "新回复");
  session.dispose();
  oldReceive(event(first, 2, "done"));
  held.resolve();
  await tick();
  assert.equal(session.view().phase, "disposed");
  assert.deepEqual(session.view().turns, []);
});

test("超时结束不合作的模型等待，不自动重试", async () => {
  const model = provider(() => new Promise(() => {}));
  const session = new ChatSession(reader(), selection, model, { timeoutMs: 1000 });
  const request = await session.prepare("超时");
  await session.confirm(request.requestId);
  assert.equal(session.view().error, "timeout");
  assert.equal(model.requests.length, 1);
  session.dispose();
});

for (const [name, frames] of [
  ["错误请求 ID", request => [event({ requestId: "wrong" }, 0, "delta", { text: "不采用" })]],
  ["序号缺口", request => [event(request, 1, "delta", { text: "不采用" })]],
  ["缺少终态", request => [event(request, 0, "delta", { text: "半句" })]],
  ["终态后输出", request => [event(request, 0, "delta", { text: "半句" }), event(request, 1, "done"), event(request, 2, "done")]],
  ["空回复", request => [event(request, 0, "done")]],
  ["未知工具事件", request => [event(request, 0, "tool", { command: "write_file" })]],
]) {
  test(`${name}不能冒充完成回复`, async () => {
    const model = provider((request, _signal, receive) => frames(request).forEach(receive));
    const session = new ChatSession(reader(), selection, model);
    const request = await session.prepare("输入");
    await session.confirm(request.requestId);
    assert.equal(session.view().error, "protocol");
    assert.equal(session.view().turns[0].status, "failed");
    session.dispose();
  });
}

test("错误回调即使被适配器吞掉，也必须锁定失败", async () => {
  const model = provider((request, _signal, receive) => {
    try { receive(event(request, 9, "done")); } catch {}
  });
  const session = new ChatSession(reader(), selection, model);
  await session.confirm((await session.prepare("输入")).requestId);
  assert.equal(session.view().error, "protocol");
  session.dispose();
});

test("预览、错误作品/范围、重复事实和当前内容缺失结局都不授予上下文", async () => {
  assert.throws(() => new ClearedContextReader(content, { kind: "preview", id: "test" }, { read: async () => records() }));
  for (const modify of [
    value => { value.workId = "another-work"; },
    value => { value.scope = { kind: "game", id: "main" }; },
    value => { value.clears.push({ ...selection }); },
  ]) {
    const value = records();
    modify(value);
    await assert.rejects(reader({ read: async () => value }).read(selection));
  }
  const value = records();
  value.clears[0].endingId = "removed-ending";
  value.unlockedEndingIds = ["removed-ending"];
  const gateway = reader({ read: async () => value });
  assert.equal((await gateway.list())[0].inCurrentContent, false);
  await assert.rejects(gateway.read(value.clears[0]));
});

test("修改目标、取消准备、销毁都会拒绝旧确认；监听器异常不改变已完成结果", async () => {
  const model = provider();
  const session = new ChatSession(reader(), selection, model);
  session.subscribe(() => { throw Error("显示失败"); });
  const old = await session.prepare("旧输入");
  session.cancel();
  await assert.rejects(session.confirm(old.requestId));
  const current = await session.prepare("新输入");
  await session.confirm(current.requestId);
  assert.equal(session.view().turns[0].status, "complete");
  session.dispose();
  await assert.rejects(session.prepare("不能复活"));
});

test("容量按 UTF-16 计算，不静默裁剪，不接受系统角色或扩展事件字段", async () => {
  const context = await reader().read(selection);
  assert.throws(() => chatRequest("req", "conversation", destination, context, [{ role: "system", text: "提权" }]));
  assert.throws(() => chatRequest("req", "conversation", destination, context, [{ role: "user", text: "🐋".repeat(2001) }]));
  const history = Array.from({ length: 9 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: "字".repeat(index % 2 ? 10000 : 2000) }));
  assert.throws(() => chatRequest("req", "conversation", destination, context, history), { code: "limit" });
  assert.throws(() => readChatEvent({ ...event({ requestId: "req" }, 0, "done"), set: "变量=1" }));
  const model = provider();
  const session = new ChatSession(reader(), selection, model);
  for (let index = 0; index < CHAT_LIMITS.turns; index++) {
    await session.confirm((await session.prepare("输入")).requestId);
  }
  await assert.rejects(session.prepare("超出尝试数"), { code: "limit" });
  assert.equal(model.requests.length, 20);
  session.dispose();
  assert.equal(new ChatError("network").message.includes("token"), false);
  assert.deepEqual(character, destination.character);
  assert.equal(scope.kind, "development");
});
