import assert from "node:assert/strict";
import test from "node:test";
import { authorWorkspace, prepareWorkspacePatch } from "../../tools/editor/workspace.ts";
import { prepareAuthorPatch } from "../../tools/editor/patch.ts";
import { compileAuthorProject } from "../../tools/content/compile.ts";
import { compileAuthorWorkspace, newAuthorNode, readAuthorWorkspacePatch } from "../../packages/story-model/src/author-workspace.ts";
import { EditorProjectDraft } from "../../apps/editor/src/project-draft.ts";
import { documentFor, fixture } from "./fixture.ts";

const envelope = (workspace = authorWorkspace(fixture())) => ({
  format: "haifeng.author-workspace-patch/1" as const, sourceSha256: fixture().sourceSha256, workspace,
});

test("workspace no-op retains all raw files; string changes match exact token patch bytes", () => {
  const source = fixture();
  const model = authorWorkspace(source);
  assert.equal(prepareWorkspacePatch(source, envelope(model)).changed.size, 0);
  model.chapters[0]!.nodes[0]!.text = "包含\n换行和“引号”";
  const actual = prepareWorkspacePatch(source, envelope(model));
  const expected = prepareAuthorPatch(source, {
    format: "haifeng.author-text-patch/4", sourceSha256: source.sourceSha256,
    edits: [{ nodeId: "start", field: "text", before: "节点 start", after: model.chapters[0]!.nodes[0]!.text }],
  });
  assert.deepEqual([...actual.changed.keys()], [...expected.changed.keys()]);
  for (const [file, bytes] of actual.changed) assert.deepEqual(bytes, expected.changed.get(file));
});

test("chapter and node structure round trips through the same compiler", () => {
  const source = fixture();
  const model = authorWorkspace(source);
  const original = model.chapters[0]!;
  const moved = original.nodes.splice(1, 1)[0]!;
  model.chapters.push({ id: "new-chapter", title: "新章", nodes: [moved, newAuthorNode("new-node")] });
  model.chapters.push({ id: "empty-chapter", title: "空章", nodes: [] });
  model.entryNodeId = "new-node";
  const prepared = prepareWorkspacePatch(source, envelope(model));
  assert.ok(prepared.changed.has("chapters/new-chapter.json"));
  assert.ok(prepared.changed.has("chapters/empty-chapter.json"));
  const content = compileAuthorProject(prepared.updated);
  const local = compileAuthorWorkspace(model, source.sourceSha256);
  assert.deepEqual(content.nodes.map(node => node.id), local.nodes.map(node => node.id));
  assert.equal(content.entryNodeId, "new-node");
  assert.equal(content.nodes.find(node => node.id === "menu")!.chapter, "新章");
  assert.equal(content.nodes.find(node => node.id === "menu")!.source.file, "content/story/chapters/new-chapter.json");
  model.chapters = model.chapters.filter(chapter => chapter.id !== "empty-chapter");
  const removed = prepareWorkspacePatch(prepared.updated, { ...envelope(model), sourceSha256: prepared.updated.sourceSha256 });
  assert.equal(removed.changed.get("chapters/empty-chapter.json"), null);
  assert.equal(removed.updated.files.has("chapters/empty-chapter.json"), false);
});

test("sorting choices retains their stable IDs and authored default", () => {
  const model = authorWorkspace(fixture());
  const menu = model.chapters[0]!.nodes[1]!;
  const choices = menu.choices as { id: string; text: string }[];
  choices.reverse();
  const content = compileAuthorWorkspace(model, fixture().sourceSha256);
  const flow = content.nodes.find(node => node.id === "menu")!.flow;
  assert.equal(flow.kind, "choice");
  if (flow.kind === "choice") {
    assert.deepEqual(flow.choices.map(choice => choice.id), ["choice-b", "choice-a"]);
    assert.equal(flow.timeout!.choiceId, "choice-a");
  }
});

test("workspace reader rejects paths, duplicate identities and dangling entry; compiler rejects deleted explicit targets", () => {
  const base = authorWorkspace(fixture());
  assert.throws(() => readAuthorWorkspacePatch({ ...envelope(base), file: "../anything" }));
  const duplicate = structuredClone(base);
  duplicate.chapters.push({ id: "trial", title: "重复", nodes: [] });
  assert.throws(() => readAuthorWorkspacePatch(envelope(duplicate)));
  const missing = structuredClone(base);
  missing.entryNodeId = "missing";
  assert.throws(() => readAuthorWorkspacePatch(envelope(missing)));
  const target = structuredClone(base);
  target.chapters[0]!.nodes.pop();
  assert.throws(() => compileAuthorWorkspace(target, fixture().sourceSha256), /目标/u);
});

test("one draft history retains field edits across structural undo, redo, export and adoption", () => {
  const draft = new EditorProjectDraft({ maxEntries: 100, maxUnits: 2_000_000 });
  draft.reset(documentFor(fixture()));
  draft.update("start", "text", "保留的对白", "start/text");
  draft.change("新增章节与节点", model => {
    model.chapters.push({ id: "added", title: "新增章", nodes: [newAuthorNode("added-node")] });
  });
  draft.update("added-node", "text", "新节点的对白", "added/text");
  assert.equal(draft.extended, true);
  const exported = structuredClone(draft.patch());
  draft.undo();
  assert.equal(draft.model.chapters.at(-1)!.nodes[0]!.text, "");
  draft.undo();
  assert.equal(draft.model.chapters.length, 1);
  assert.equal(draft.model.chapters[0]!.nodes[0]!.text, "保留的对白");
  draft.redo();
  draft.replaceWorkspace(exported);
  assert.equal(draft.model.chapters.at(-1)!.nodes[0]!.text, "新节点的对白");
  assert.equal(draft.inspect().nodes.at(-1)!.presentation.text, "新节点的对白");
  const prepared = prepareWorkspacePatch(fixture(), draft.patch());
  draft.reset(documentFor(prepared.updated));
  assert.equal(draft.size, 0);
  assert.equal(draft.status.undoSteps, 0);
});

test("incomplete expressions remain editable in the outline but cannot pass inspection", () => {
  const draft = new EditorProjectDraft({ maxEntries: 100, maxUnits: 2_000_000 });
  draft.reset(documentFor(fixture()));
  draft.update("start", "set", "好感 +=");
  assert.equal(draft.document().editable.start!.find(field => field.field === "set")!.value, "好感 +=");
  assert.throws(() => draft.inspect());
  assert.equal(draft.undo()!.nodeId, "start");
  assert.doesNotThrow(() => draft.inspect());
});
