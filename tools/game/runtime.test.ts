import assert from "node:assert/strict";
import test from "node:test";
import { loadSourceContent } from "../content/build.ts";
import { createStoryRuntime } from "../../packages/story-runtime/src/index.ts";
import type { RuntimeCommand } from "../../packages/story-runtime/src/index.ts";
import { VoicePolicy, VoicePreferenceRepository } from "../../packages/player/src/voice-preferences.ts";
import type { VoicePreferenceRecord } from "../../packages/player/src/voice-preferences.ts";
import { ReadingPreferenceRepository, authorReadingPreferences } from "../../packages/player/src/reading-preferences.ts";
import type { StoredSlot } from "../../packages/player/src/saves.ts";
import { createGameSession } from "../../packages/player/src/session.ts";
import type { PresentationAdapter } from "../../packages/player/src/session.ts";
import type { Clock } from "../../packages/player/src/clock.ts";
import type { StoryFact } from "../../packages/story-runtime/src/index.ts";

const { content } = await loadSourceContent();

test("actual story routes reach terminal; restores never repeat entry actions; stale commands are rejected", () => {
  const terminals = new Set<string>();
  let accepted = 0;
  let choices = 0;
  let restores = 0;
  for (let route = 0; route < 20; route++) {
    const { runtime } = createStoryRuntime(content, { "周目": 1, "结局数": 0 });
    let random = route + 1;
    let steps = 0;
    while (runtime.view().phase !== "ended") {
      assert.ok(++steps < 10000, `route ${route} did not terminate`);
      const view = runtime.view();
      if (steps % 113 === 0 && view.phase !== "presenting") {
        const snapshot = runtime.snapshot();
        const restored = runtime.restore(snapshot, view.player);
        assert.equal(restored.accepted, true);
        assert.deepEqual(restored.facts, []);
        assert.deepEqual(restored.variableChanges, []);
        assert.deepEqual(runtime.snapshot(), snapshot);
        restores++;
      }
      const current = runtime.view();
      let command: RuntimeCommand;
      if (current.phase === "choosing") {
        choices++;
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        if (current.timeout && route % 4 === 0) command = { type: "timeout", step: current.step };
        else {
          const index = route === 0 ? 0 : route === 1 ? current.choices.length - 1 : random % current.choices.length;
          command = { type: "choose", step: current.step, choiceId: current.choices[index]!.id };
        }
      } else command = { type: current.phase === "presenting" ? "presented" : "advance", step: current.step };
      const result = runtime.dispatch(command);
      assert.equal(result.accepted, true, JSON.stringify(result.error));
      accepted++;
      // A consumed input cannot settle another choice, timeout or enter action.
      const after = runtime.snapshot();
      assert.equal(runtime.dispatch(command).accepted, false);
      assert.deepEqual(runtime.snapshot(), after);
    }
    terminals.add(JSON.stringify(runtime.view().terminal));
  }
  assert.ok(choices > 0 && restores > 0);
  console.log(JSON.stringify({ routes: 20, accepted, choices, restores, terminals: [...terminals] }));
});

test("voice defaults follow declared chapter boundary; explicit false/reset survive independent persistence", async () => {
  const policy = new VoicePolicy(content);
  const boundary = content.source.settings.voiceOptionalFromChapterId;
  assert.equal(typeof boundary, "string");
  assert.equal(policy.key(content.entryNodeId), "early");
  assert.equal(policy.key(String(boundary)), "later");
  assert.deepEqual(policy.defaults, { early: true, later: false });
  const records = new Map<string, VoicePreferenceRecord>();
  const read = async (key: string): Promise<StoredSlot> => records.has(key)
    ? { found: true, value: structuredClone(records.get(key)) } : { found: false };
  const store = { read, async updateVoice(key: string, change: (stored: StoredSlot) => VoicePreferenceRecord) {
    const record = change(await read(key)); records.set(key, structuredClone(record)); return record;
  } };
  const repo = new VoicePreferenceRepository(content.workId, { kind: "game", id: "main" }, policy.defaults, store);
  assert.equal((await repo.read()).values.later, false);
  await repo.update({ later: true, early: false });
  assert.deepEqual((await repo.read()).values, { early: false, later: true });
  await repo.update({ later: null });
  assert.deepEqual((await repo.read()).values, { early: false, later: false });
  const isolated = new VoicePreferenceRepository(content.workId, { kind: "preview", id: "main" }, policy.defaults, store);
  assert.deepEqual((await isolated.read()).values, policy.defaults);
  const before = structuredClone([...records]);
  await assert.rejects(repo.update({ later: 1 } as unknown as { later: boolean }));
  assert.deepEqual([...records], before);
});

test("zero dialogue opacity persists separately from progress; reset follows author default", async () => {
  let stored: StoredSlot = { found: false };
  const repo = new ReadingPreferenceRepository(content.workId, { kind: "game", id: "main" },
    authorReadingPreferences(content.source.settings), {
      read: async () => structuredClone(stored),
      updateReading: async (_key, change) => {
        const record = change(structuredClone(stored)); stored = { found: true, value: record }; return record;
      },
    });
  assert.equal((await repo.update({ dialogueOpacity: 0 })).values.dialogueOpacity, 0);
  assert.equal((await repo.read()).values.dialogueOpacity, 0);
  assert.equal((await repo.update({ dialogueOpacity: null })).values.dialogueOpacity, 0.45);
});

test("real session freezes effective choice time in background, restores remainder, and settles timeout only once", async () => {
  class ManualClock implements Clock {
    time = 0;
    next = 0;
    tasks = new Map<number, { at: number; run(): void }>();
    now(): number { return this.time; }
    schedule(delay: number, run: () => void): () => void {
      const id = ++this.next;
      this.tasks.set(id, { at: this.time + delay, run });
      return () => { this.tasks.delete(id); };
    }
    advance(ms: number): void {
      const target = this.time + ms;
      let calls = 0;
      while (true) {
        const next = [...this.tasks].filter(([, value]) => value.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        assert.ok(++calls < 10000, "unbounded timer callbacks");
        this.time = next[1].at; this.tasks.delete(next[0]); next[1].run();
      }
      this.time = target;
    }
  }
  const adapter = (): PresentationAdapter => ({
    present(view, context) {
      context.sceneReady(); context.textReady(); context.voiceEnded();
      return {
        finishText() {}, setPaused() {}, setSkipping() {}, cancel() {},
        capture: () => ({
          music: view.presentation.scene.music.kind === "play"
            ? { assetId: view.presentation.scene.music.assetId, positionMs: null } : null,
          ambience: view.presentation.scene.ambience.map(track => ({ assetId: track.assetId, positionMs: null })),
          voice: view.presentation.performance.voiceId
            ? { assetId: view.presentation.performance.voiceId, positionMs: null, state: "finished" } : null,
        }),
      };
    }, dispose() {},
  });
  const node = content.nodes.find(node => node.flow.kind === "choice" && node.flow.timeout);
  assert.ok(node);
  const source = { ...content, entryNodeId: node.id };
  const clock = new ManualClock();
  const session = createGameSession({ content: source, player: { "周目": 1, "结局数": 0 }, generation: 1,
    clock, presentation: adapter(), seen: new Set(), onChange() {} });
  assert.equal(session.view().story.phase, "choosing");
  const duration = session.view().choiceRemainingMs;
  assert.ok(duration && duration > 1000);
  clock.advance(1000);
  const remaining = session.view().choiceRemainingMs;
  assert.equal(remaining, duration - 1000);
  session.send({ type: "pause", reason: "background", paused: true });
  clock.advance(60000);
  assert.equal(session.view().choiceRemainingMs, remaining);
  const captured = await session.captureCheckpoint(session.view().token);
  assert.equal(captured.accepted, true);
  if (!captured.accepted) return;
  session.dispose();
  assert.equal(clock.tasks.size, 0);

  const facts: StoryFact[] = [];
  const resumed = createGameSession({ content: source, player: { "周目": 1, "结局数": 0 }, generation: 2,
    clock, presentation: adapter(), seen: new Set(), onChange() {}, onFacts: batch => facts.push(...batch),
    resume: { checkpoint: captured.checkpoint, voice: "silent" }, initialPauses: ["host"] });
  assert.equal(facts.length, 0);
  const token = resumed.view().token;
  const choice = resumed.view().story.choices[0]!;
  clock.advance(60000);
  assert.equal(resumed.view().choiceRemainingMs, remaining);
  resumed.send({ type: "pause", reason: "host", paused: false });
  clock.advance(remaining!);
  resumed.send({ type: "choose", token, choiceId: choice.id });
  assert.equal(facts.filter(fact => fact.type === "chosen").length, 1);
  resumed.dispose();
  assert.equal(clock.tasks.size, 0);
});
