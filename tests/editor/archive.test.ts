import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { deflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { ProjectArchive, writeArchive } from "../../tools/editor/archive.ts";
import { migrateProjectArchive, readProjectArchive, writeProjectArchive } from "../../tools/editor/portable.ts";
import { authorWorkspace, prepareWorkspacePatch } from "../../tools/editor/workspace.ts";
import { compileAuthorProject } from "../../tools/content/compile.ts";
import { fixture } from "./fixture.ts";
import { crc32, fixtureImage, fixtureAudio } from "./media.mjs";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const temporary = () => mkdtemp(resolve(tmpdir(), "haifeng-editor-archive-"));

test("ZIP stored/UTF-8 round trip and resource digest guard", async () => {
  const directory = await temporary(), file = resolve(directory, "valid.zip"), bytes = Buffer.from("内容\n");
  const result = await writeArchive(file, [{ name: "作者.json", data: bytes, sha256: hash(bytes), bytes: bytes.byteLength }]);
  assert.equal(result.sha256, hash(await readFile(file)));
  const archive = await ProjectArchive.open(file);
  assert.deepEqual(await archive.read("作者.json"), bytes);
  const extracted = resolve(directory, "copy.json"), digest = await archive.extract("作者.json", extracted);
  assert.equal(digest.sha256, hash(bytes));
  await assert.rejects(writeArchive(resolve(directory, "wrong.zip"), [{ name: "x", data: bytes, sha256: "0".repeat(64) }]));
});

test("ZIP reader accepts standard deflate and rejects traversal, symlinks, CRC damage and duplicate names", async () => {
  const directory = await temporary(), file = resolve(directory, "valid.zip");
  const data = Buffer.from("safe data");
  await writeArchive(file, [{ name: "safe.json", data }]);
  const valid = await readFile(file);
  const traversal = Buffer.from(valid);
  for (let at = traversal.indexOf("safe.json"); at >= 0; at = traversal.indexOf("safe.json", at + 1)) traversal.write("../x.json", at);
  await writeFile(resolve(directory, "traversal.zip"), traversal);
  await assert.rejects(ProjectArchive.open(resolve(directory, "traversal.zip")), /路径/u);
  const link = Buffer.from(valid), central = link.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  link.writeUInt32LE((0xa1ff << 16) >>> 0, central + 38);
  await writeFile(resolve(directory, "link.zip"), link);
  await assert.rejects(ProjectArchive.open(resolve(directory, "link.zip")), /链接/u);
  const damaged = Buffer.from(valid); damaged[30 + Buffer.byteLength("safe.json")]! ^= 1;
  await writeFile(resolve(directory, "damaged.zip"), damaged);
  const bad = await ProjectArchive.open(resolve(directory, "damaged.zip"));
  await assert.rejects(bad.read("safe.json"), /CRC32/u);
  await assert.rejects(writeArchive(resolve(directory, "duplicate.zip"), [{ name: "A", data }, { name: "a", data }]), /重复/u);
  const path = Buffer.from("deflated.json"), compressed = deflateRawSync(data);
  const local = Buffer.alloc(30), record = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(path.length, 26);
  record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
  record.writeUInt16LE(0x800, 8); record.writeUInt16LE(8, 10); record.writeUInt32LE(crc32(data), 16);
  record.writeUInt32LE(compressed.length, 20); record.writeUInt32LE(data.length, 24); record.writeUInt16LE(path.length, 28);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(record.length + path.length, 12); end.writeUInt32LE(local.length + path.length + compressed.length, 16);
  const deflated = resolve(directory, "deflated.zip");
  await writeFile(deflated, Buffer.concat([local, path, compressed, record, path, end]));
  assert.deepEqual(await (await ProjectArchive.open(deflated)).read("deflated.json"), data);
});

test("complete project export/migration retains author files and identities, deduplicates bytes, and never includes unrelated files", async () => {
  const directory = await temporary(), original = resolve(directory, "original"), migrated = resolve(directory, "migrated");
  await mkdir(resolve(original, "assets"), { recursive: true }); await mkdir(migrated);
  await writeFile(resolve(original, "private-not-a-resource.txt"), "not for export");
  const project = fixture(true), content = compileAuthorProject(project);
  const resources = [];
  for (const resource of content.resources) {
    const bytes = ["bg", "ch"].includes(resource.kind) ? fixtureImage() : fixtureAudio();
    await writeFile(resolve(original, resource.path), bytes);
    resources.push({ assetId: resource.id, path: resource.path, sha256: hash(bytes), bytes: bytes.byteLength });
  }
  const output = resolve(directory, "project.zip");
  await writeProjectArchive(project, resources, output, { gameRoot: original });
  const opened = await readProjectArchive(output);
  assert.equal(opened.project.sourceSha256, project.sourceSha256);
  assert.equal(opened.archive.entries.has("private-not-a-resource.txt"), false);
  assert.equal([...opened.archive.entries.keys()].filter(path => path.startsWith("media/")).length, 2);
  const staging = resolve(directory, "staging"); await mkdir(staging);
  const model = await migrateProjectArchive(output, staging, migrated);
  assert.deepEqual(model.chapters.map(chapter => chapter.nodes.map(node => node.id)), authorWorkspace(project).chapters.map(chapter => chapter.nodes.map(node => node.id)));
  assert.deepEqual(model.assets.map(asset => asset.key), project.assets.map(asset => asset.key));
  assert.equal((await readdir(resolve(migrated, "assets/imported"))).length, 2);
  for (const asset of model.assets) {
    const expected = resources.find(resource => resource.assetId === asset.key)!;
    assert.equal(hash(await readFile(resolve(migrated, String(asset.record.src)))), expected.sha256);
    assert.equal(asset.record.importedFrom, expected.path);
    assert.deepEqual(await readFile(resolve(original, expected.path)), await readFile(resolve(migrated, String(asset.record.src))));
  }
});

test("replacing another work is explicit and preserves imported migration metadata", () => {
  const original = fixture(), model = authorWorkspace(original);
  model.workId = "imported-work"; model.migration = { originalSource: "portable-fixture" };
  const patch = { format: "haifeng.author-workspace-patch/1", sourceSha256: original.sourceSha256, workspace: model };
  assert.throws(() => prepareWorkspacePatch(original, patch), /明确/u);
  const result = prepareWorkspacePatch(original, { ...patch, replaceProject: true });
  assert.equal(result.updated.workId, "imported-work");
  assert.equal(authorWorkspace(result.updated).migration.originalSource, "portable-fixture");
});
