import { readStoryContent } from "../../packages/story-model/src/content.ts";
import { ClearedContextReader } from "../../packages/chat/src/context.ts";

// Synthetic, isolated test data. Never read or write the player's database or author project.
export const scope = Object.freeze({ kind: "development", id: "normal-entry" });
export const selection = Object.freeze({ factId: "test-clear-1", endingId: "test-ending" });
export const character = Object.freeze({ id: "test-character", revision: "test-1", name: "测试角色" });
export const destination = Object.freeze({ serviceId: "test-service", label: "离线测试服务", character });
export const content = readStoryContent({
  format: "haifeng.story/1", workId: "chat-test-work", title: "隔离测试", revision: "a".repeat(64),
  entryNodeId: "test-node", variables: [], resources: [],
  nodes: [{
    id: "test-node", label: "", chapter: "test", source: { file: "tests/chat/fixture.json", field: "node" },
    enter: [], flow: { kind: "ending", endingId: selection.endingId },
    presentation: {
      speaker: "", text: "测试结局",
      scene: { background: null, sprites: [], mood: "", music: { kind: "stop", fadeMs: 0 }, ambience: [] },
      performance: {
        transition: "", screenEffect: "", actorActions: {}, voiceId: null, sounds: [],
        waitMs: 0, typeMultiplier: 1, holdMs: 0, sourceHints: {},
      },
    },
  }],
  source: { file: "tests/chat/fixture.json", sha256: "b".repeat(64), metadata: {}, settings: {} },
});

export function records() {
  return {
    format: "haifeng.committed-clears/1", workId: content.workId, scope: { ...scope },
    unlockedEndingIds: [selection.endingId], clears: [{ ...selection }],
  };
}

export function reader(source = { read: async () => records() }) {
  return new ClearedContextReader(content, scope, source);
}

export function event(request, sequence, type, fields = {}) {
  return { format: "haifeng.chat-event/1", requestId: request.requestId, sequence, type, ...fields };
}

export function provider(stream) {
  const requests = [];
  return {
    requests, destination,
    async stream(request, signal, receive) {
      requests.push(request);
      if (stream) return stream(request, signal, receive);
      receive(event(request, 0, "delta", { text: "测试回复" }));
      receive(event(request, 1, "done"));
    },
  };
}

export function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

export const tick = () => new Promise(resolve => setTimeout(resolve, 0));
