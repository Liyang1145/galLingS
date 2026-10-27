import assert from "node:assert/strict";
import test from "node:test";
import { authorChoiceField, readAuthorTextPatch } from "../../packages/story-model/src/author.ts";
import type { AuthorTextEdit } from "../../packages/story-model/src/author.ts";
import { AuthorDraftHistory } from "../../packages/story-model/src/author-history.ts";
import { prepareDraftImport, resolveDraftImport } from "../../packages/story-model/src/author-draft.ts";
import { projectAuthorDraft } from "../../packages/story-model/src/author-projection.ts";
import { compileAuthorLogic } from "../../packages/story-model/src/author-logic.ts";
import { createReferenceIndex } from "../../packages/story-model/src/references.ts";
import { createStoryRuntime } from "../../packages/story-runtime/src/index.ts";
import { authorFields, prepareAuthorPatch } from "../../tools/editor/patch.ts";
import { base, compile, fixture } from "./fixture.ts";

const original = fixture();
const patch = (edits: AuthorTextEdit[]) => ({
  format: "haifeng.author-text-patch/4" as const, sourceSha256: original.sourceSha256, edits,
});
const edit = (nodeId: string, field: AuthorTextEdit["field"], before: string, after: string): AuthorTextEdit =>
  ({ nodeId, field, before, after });
const history = () => {
  const value = new AuthorDraftHistory({ maxEntries: 100, maxUnits: 2_000_000 });
  value.reset(base(original));
  return value;
};

test("older drafts import as the current format but cannot claim later capabilities", () => {
  for (const version of [1, 2, 3]) {
    assert.equal(readAuthorTextPatch({ ...patch([edit("start", "text", "节点 start", "新对白")]),
      format: `haifeng.author-text-patch/${version}` }).format, "haifeng.author-text-patch/4");
    assert.throws(() => readAuthorTextPatch({ ...patch([edit("start", "jump", "", "end")]),
      format: `haifeng.author-text-patch/${version}` }));
  }
  assert.throws(() => readAuthorTextPatch({ ...patch([edit("menu", authorChoiceField("choice-a", "set"), "", "好感 += 1")]),
    format: "haifeng.author-text-patch/2" }));
  for (const field of ["__proto__", "choices.0.target", "../project.json"]) {
    assert.throws(() => readAuthorTextPatch({ ...patch([]), edits: [{ nodeId: "menu", field, before: "", after: "" }] }));
  }
  assert.throws(() => readAuthorTextPatch(patch([edit("start", "text", "", "A"), edit("start", "text", "", "B")])));
});

test("history groups the same field and separates node actions from choice actions", () => {
  const value = history();
  value.update("menu", authorChoiceField("choice-a", "set"), "好感 += 1", "typing");
  value.update("menu", authorChoiceField("choice-a", "set"), "好感 += 12", "typing");
  value.closeGroup();
  value.update("menu", "set", "好感 += 5", "node");
  assert.equal(value.size, 2);
  assert.equal(value.status.undoSteps, 2);
  value.undo();
  assert.deepEqual(value.patch().edits, [edit("menu", authorChoiceField("choice-a", "set"), "", "好感 += 12")]);
  value.redo();
  value.removeNode("menu");
  assert.equal(value.size, 0);
  value.undo();
  assert.equal(value.size, 2);
});

test("import conflicts require explicit choices and preserve unavailable work", () => {
  const value = history();
  value.update("menu", authorChoiceField("choice-a", "cond"), "好感 >= 5");
  const incoming = patch([
    edit("menu", authorChoiceField("choice-a", "cond"), "", "好感 >= 10"),
    edit("menu", authorChoiceField("missing"), "", "不可丢失"),
  ]);
  const plan = prepareDraftImport(base(original), value.patch(), incoming);
  assert.deepEqual(plan.rows.map(row => row.status), ["conflict", "unavailable"]);
  assert.throws(() => resolveDraftImport(plan, new Map([[1, "keep"]])));
  assert.throws(() => resolveDraftImport(plan, new Map([[0, "incoming"], [1, "incoming"]])));
  const result = resolveDraftImport(plan, new Map([[0, "incoming"], [1, "keep"]]));
  assert.deepEqual(result.patch.edits, [incoming.edits[0]]);
  assert.deepEqual(result.remaining.edits, [incoming.edits[1]]);
});

test("source patching edits the stable choice only, preserving BOM, CRLF and all other bytes", () => {
  const after = '新"台词\n鲸鱼';
  const prepared = prepareAuthorPatch(original, patch([edit("menu", authorChoiceField("choice-b"), "相同文字", after)]));
  const file = "chapters/trial.json";
  const beforeText = Buffer.from(original.files.get(file)!).toString("utf8");
  const expected = beforeText.replace(/("id": "choice-b",\r\n\s+"text": )"相同文字"/u,
    (_match, prefix: string) => prefix + JSON.stringify(after));
  assert.notEqual(expected, beforeText);
  assert.equal(Buffer.from(prepared.changed.get(file)!).toString("utf8"), expected);
  assert.deepEqual([...prepared.changed.keys()], [file]);
  for (const [path, bytes] of original.files) {
    if (path !== file) assert.deepEqual(prepared.updated.files.get(path), bytes);
  }
  assert.equal(Buffer.from(original.files.get(file)!).toString("utf8"), beforeText);
});

test("source patching rejects stale sources, wrong originals and missing fields without changing input", () => {
  const before = [...original.files].map(([file, bytes]) => [file, Buffer.from(bytes)] as const);
  assert.throws(() => prepareAuthorPatch(original, { ...patch([]), sourceSha256: "0".repeat(64) }));
  assert.throws(() => prepareAuthorPatch(original, patch([edit("start", "text", "错误原文", "新文")])));
  assert.throws(() => prepareAuthorPatch(original, patch([edit("start", authorChoiceField("choice-a"), "", "新文")])));
  for (const [file, bytes] of before) assert.deepEqual(original.files.get(file), bytes);
});

test("all edited node and choice fields project exactly as the production compiler", () => {
  const change = patch([
    edit("start", "speaker", "鲸鱼小姐", "旁白"),
    edit("start", "set", "", "好感 += 2"),
    edit("menu", "set", "", "好感 += 3"),
    edit("menu", authorChoiceField("choice-a"), "相同文字", "新的选项"),
    edit("menu", authorChoiceField("choice-a", "cond"), "", "好感 >= 1"),
    edit("menu", authorChoiceField("choice-a", "set"), "", "好感 += 7"),
    edit("menu", authorChoiceField("choice-a", "target"), "", "end"),
    edit("menu", "cdef", "choice-a", "choice-b"),
    edit("end", "ending", "完成", "新结局"),
  ]);
  const prepared = prepareAuthorPatch(original, change);
  const projected = projectAuthorDraft(compile(original), base(original), change);
  assert.deepEqual(projected.nodes, compile(prepared.updated).nodes);
  assert.deepEqual(projected.resources, compile(original).resources);
  assert.equal(projected.revision, compile(original).revision);
  assert.equal(projected.source.sha256, original.sourceSha256);
});

test("branch and ending removal use the actual sequential successor", () => {
  for (const changes of [
    [edit("start", "jump", "", "end"), edit("start", "jumpIf", "", "好感 >= 5")],
    [edit("end", "ending", "完成", "")],
  ]) {
    const change = patch(changes);
    assert.deepEqual(projectAuthorDraft(compile(original), base(original), change).nodes,
      compile(prepareAuthorPatch(original, change).updated).nodes);
  }
});

test("invalid authored logic is rejected by both projection and production compilation", () => {
  for (const changes of [
    [edit("start", "jump", "", "missing")],
    [edit("start", "jumpIf", "", "好感 > 1")],
    [edit("start", "jump", "", "end"), edit("start", "ending", "", "冲突")],
    [edit("menu", "jump", "", "end")],
    [edit("menu", "cdef", "choice-a", "missing")],
    [edit("start", "set", "", "周目 += 1")],
    [edit("menu", authorChoiceField("choice-a", "cond"), "", "好感 >>> 2")],
    [edit("menu", authorChoiceField("choice-a", "set"), "", "未声明 += 1")],
  ]) {
    const change = patch(changes);
    assert.throws(() => projectAuthorDraft(compile(original), base(original), change));
    assert.throws(() => compile(prepareAuthorPatch(original, change).updated));
  }
});

test("a default without a timer and unrepresentable timing are rejected", () => {
  const content = compile(original);
  const node = content.nodes.find(item => item.id === "menu")!;
  assert.equal(node.flow.kind, "choice");
  if (node.flow.kind !== "choice") throw new Error("fixture choice missing");
  const context = {
    source: node.source, writable: { 好感: "number" as const }, readable: { 好感: "number" as const },
    nodeIds: new Set(content.nodes.map(item => item.id)), sequential: "end",
  };
  for (const ctime of [0, -1, Infinity, Number.MAX_VALUE]) {
    assert.throws(() => compileAuthorLogic({
      set: "", jump: "", jumpIf: "", ending: "", ctime, cdef: "choice-a",
    }, node.flow.choices, context));
  }
});

test("the reference index reads the edited conditions, actions and targets", () => {
  const change = patch([
    edit("start", "set", "", "好感 += 1"),
    edit("menu", authorChoiceField("choice-a", "cond"), "", "好感 >= 2"),
    edit("menu", authorChoiceField("choice-a", "target"), "", "start"),
  ]);
  const projected = projectAuthorDraft(compile(original), base(original), change);
  const index = createReferenceIndex(projected);
  assert.ok(index.incoming({ kind: "variable", id: "好感" }).some(reference => reference.nodeId === "start" && reference.role === "write"));
  assert.ok(index.incoming({ kind: "variable", id: "好感" }).some(reference => reference.choiceId === "choice-a" && reference.role === "read"));
  assert.ok(index.incoming({ kind: "node", id: "start" }).some(reference => reference.choiceId === "choice-a" && reference.role === "choice-target"));
});

test("compiled node actions execute once and restoring never re-enters the edited node", () => {
  const updated = prepareAuthorPatch(original, patch([edit("start", "set", "", "好感 += 5")])).updated;
  const { runtime } = createStoryRuntime(compile(updated), { 周目: 1, 结局数: 0 });
  assert.equal(runtime.view().variables["好感"], 5);
  const saved = runtime.snapshot();
  const restored = runtime.restore(saved, runtime.view().player);
  assert.equal(restored.accepted, true);
  assert.deepEqual(restored.facts, []);
  assert.deepEqual(restored.variableChanges, []);
  assert.deepEqual(runtime.snapshot(), saved);
  assert.equal(runtime.view().variables["好感"], 5);
});

test("capabilities expose exact original expressions and never expose array indices as targets", () => {
  const fields = authorFields(original);
  assert.equal(fields.menu!.find(item => item.field === authorChoiceField("choice-b", "set"))?.value, "好感 += 1");
  assert.equal(fields.menu!.find(item => item.field === authorChoiceField("choice-a", "target"))?.value, "");
  assert.ok(fields.start!.some(item => item.field === "jumpIf" && item.value === ""));
  assert.ok(!fields.menu!.some(item => item.field.includes("choices.0")));
});
