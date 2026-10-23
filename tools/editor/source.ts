import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rmdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { readLegacyExport } from "../content/legacy.ts";
import { compileSourceContent, REPOSITORY_ROOT } from "../content/build.ts";
import { readAuthorTextPatch } from "../../packages/story-model/src/author.ts";
import type { AuthorTextPatch } from "../../packages/story-model/src/author.ts";
import { array, at, object, reject, string } from "../../packages/story-model/src/read.ts";
import type { SourceLocation } from "../../packages/story-model/src/model.ts";

const SOURCE: SourceLocation = { file: "海风与布丁/game.js", field: "" };
const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const MAX_SOURCE = 16 * 1024 * 1024;

export function authorFields(bytes: Uint8Array): Record<string, ("speaker" | "text")[]> {
  const game = object(readLegacyExport(decoder.decode(bytes)), SOURCE);
  return Object.fromEntries(array(game.lines, at(SOURCE, "lines")).map((value, index) => {
    const where = at(SOURCE, `lines.${index}`);
    const node = object(value, where);
    return [string(node.id, at(where, "id")),
      (["speaker", "text"] as const).filter(field => typeof node[field] === "string")];
  }));
}

function inside(root: string, filename: string): boolean {
  const part = relative(root, filename);
  return !!part && part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

async function sourcePath(): Promise<string> {
  const root = await realpath(REPOSITORY_ROOT);
  const folder = await realpath(resolve(root, "海风与布丁"));
  const file = resolve(folder, "game.js");
  if (!inside(root, folder) || await realpath(file) !== file || !(await lstat(file)).isFile()) {
    reject("AUTHOR_PATH", "作者源必须是当前仓库作品目录中的普通文件", SOURCE);
  }
  return file;
}

export async function readAuthorSource(): Promise<{
  sourceSha256: string;
  editable: ReturnType<typeof authorFields>;
  loaded: Awaited<ReturnType<typeof compileSourceContent>>;
}> {
  const bytes = await readFile(await sourcePath());
  if (bytes.byteLength > MAX_SOURCE) reject("AUTHOR_LIMIT", "作者源超过 16 MiB 的本片编辑大小范围", SOURCE);
  return { sourceSha256: sha256(bytes), editable: authorFields(bytes), loaded: await compileSourceContent(bytes) };
}

interface Range { start: number; end: number }

/** Locate existing string tokens; JSON parsing validates semantics, the scanner preserves all other bytes. */
function textRanges(text: string): Map<string, Range> {
  const prefix = /^\uFEFF?\s*window\.VN_GAME\s*=\s*/u.exec(text);
  if (!prefix) reject("LEGACY_WRAPPER", "不是已支持的作者导出", SOURCE);
  const ranges = new Map<string, Range>();
  let cursor = prefix[0].length;
  let count = 0;
  const space = (): void => { while (/\s/u.test(text[cursor] ?? "") && cursor < text.length) cursor++; };
  const quoted = (): { start: number; end: number; value: string } => {
    const start = cursor++;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === "\\") cursor++;
      else if (char === "\"") return { start, end: cursor, value: JSON.parse(text.slice(start, cursor)) as string };
    }
    return reject("AUTHOR_JSON", "作者源字符串未结束", SOURCE);
  };
  function value(path: (string | number)[], depth: number): void {
    if (depth > 128 || ++count > 1000000) reject("AUTHOR_LIMIT", "作者源嵌套或字段数量超出本片编辑范围", SOURCE);
    space();
    if (text[cursor] === "\"") {
      const span = quoted();
      if (path.length === 3 && path[0] === "lines" && typeof path[1] === "number"
        && (path[2] === "speaker" || path[2] === "text")) ranges.set(`${path[1]}:${path[2]}`, span);
    } else if (text[cursor] === "{") {
      cursor++;
      space();
      const keys = new Set<string>();
      while (text[cursor] !== "}") {
        const key = quoted().value;
        if (keys.has(key)) reject("AUTHOR_JSON", "作者源含重复对象键，拒绝有歧义的往返编辑", SOURCE);
        keys.add(key);
        space();
        if (text[cursor++] !== ":") reject("AUTHOR_JSON", "作者源对象格式无效", SOURCE);
        value([...path, key], depth + 1);
        space();
        if (text[cursor] !== ",") break;
        cursor++;
        space();
      }
      if (text[cursor++] !== "}") reject("AUTHOR_JSON", "作者源对象未结束", SOURCE);
    } else if (text[cursor] === "[") {
      cursor++;
      space();
      let index = 0;
      while (text[cursor] !== "]") {
        value([...path, index++], depth + 1);
        space();
        if (text[cursor] !== ",") break;
        cursor++;
      }
      if (text[cursor++] !== "]") reject("AUTHOR_JSON", "作者源数组未结束", SOURCE);
    } else {
      const start = cursor;
      while (cursor < text.length && !/[\s,\]}]/u.test(text[cursor]!)) cursor++;
      if (cursor === start) reject("AUTHOR_JSON", "作者源值无效", SOURCE);
    }
  }
  value([], 0);
  return ranges;
}

async function candidate(input: unknown): Promise<{
  patch: AuthorTextPatch; bytes: Buffer; updated: Buffer;
  loaded: Awaited<ReturnType<typeof compileSourceContent>>; file: string;
}> {
  const patch = readAuthorTextPatch(input);
  const file = await sourcePath();
  const bytes = await readFile(file);
  if (bytes.byteLength > MAX_SOURCE) reject("AUTHOR_LIMIT", "作者源超过 16 MiB 的本片编辑大小范围", SOURCE);
  if (sha256(bytes) !== patch.sourceSha256) reject("AUTHOR_CONFLICT", "作者源已改变；先导出草稿，再重新读取并处理冲突", SOURCE);
  const text = decoder.decode(bytes);
  const game = object(readLegacyExport(text), SOURCE);
  const nodes = array(game.lines, at(SOURCE, "lines")).map((value, index) => {
    const where = at(SOURCE, `lines.${index}`);
    const node = object(value, where);
    return { id: string(node.id, at(where, "id")), node, index };
  });
  const ids = new Map(nodes.map(node => [node.id, node]));
  if (ids.size !== nodes.length) reject("AUTHOR_NODE", "作者节点 ID 重复", SOURCE);
  const ranges = textRanges(text);
  const edits = patch.edits.map(edit => {
    const node = ids.get(edit.nodeId);
    const span = node ? ranges.get(`${node.index}:${edit.field}`) : undefined;
    if (!node || !span || node.node[edit.field] !== edit.before) {
      reject("AUTHOR_CONFLICT", "原字段缺失、类型不符或已改变", {
        ...SOURCE, nodeId: edit.nodeId, field: `lines.${node?.index ?? "?"}.${edit.field}`,
      });
    }
    return { ...span, value: JSON.stringify(edit.after) };
  }).sort((a, b) => b.start - a.start);
  let updatedText = text;
  for (const edit of edits) updatedText = updatedText.slice(0, edit.start) + edit.value + updatedText.slice(edit.end);
  const updated = Buffer.from(updatedText, "utf8");
  if (updated.byteLength > MAX_SOURCE) reject("AUTHOR_LIMIT", "修改后的作者源超过 16 MiB，本片拒绝写入", SOURCE);
  // Full conversion and actual resource hashing, identical to content/game input.
  const loaded = await compileSourceContent(updated);
  return { patch, file, bytes, updated, loaded };
}

export async function previewAuthorText(input: unknown): Promise<Awaited<ReturnType<typeof candidate>>> {
  return candidate(input);
}

/** Explicit editor Save only. No filesystem mutation occurs when this module is imported. */
export async function saveAuthorText(input: unknown): Promise<{
  sourceSha256: string; backup: string; editable: ReturnType<typeof authorFields>;
  loaded: Awaited<ReturnType<typeof compileSourceContent>>;
}> {
  const file = await sourcePath();
  const folder = dirname(file);
  const lock = resolve(folder, ".rebuild-editor-lock");
  try { await mkdir(lock); }
  catch { return reject("AUTHOR_LOCK", "无法取得编辑锁；可能有保存进行中或残留锁，请先检查作品目录再重试", SOURCE); }
  try {
    if (await realpath(lock) !== lock || dirname(lock) !== folder) reject("AUTHOR_PATH", "编辑锁目录边界改变", SOURCE);
    const result = await candidate(input);
    if (result.file !== file) reject("AUTHOR_PATH", "作者源位置改变", SOURCE);
    const editable = authorFields(result.updated);
    const sourceSha256 = sha256(result.updated);
    const backup = `.rebuild-editor-backup-${result.patch.sourceSha256}-${randomUUID()}.js`;
    // Finish the recoverable original before replacing source. If replacement
    // fails the original remains live and this backup is retained.
    await writeFile(resolve(folder, backup), result.bytes, { flag: "wx" });
    const temporary = resolve(folder, `.rebuild-editor-${randomUUID()}.tmp`);
    // Keep this invocation's candidate on failure; never recursively clean author files.
    await writeFile(temporary, result.updated, { flag: "wx" });
    if (await sourcePath() !== file || sha256(await readFile(file)) !== result.patch.sourceSha256
      || await realpath(temporary) !== temporary) {
      reject("AUTHOR_CONFLICT", "写入前作者源已变化；保留原文件、备份和候选，拒绝覆盖", SOURCE);
    }
    await rename(temporary, file);
    return { sourceSha256, editable, backup: `海风与布丁/${backup}`, loaded: result.loaded };
  } finally {
    // Never recursively clean a lock changed by another process.
    try { await rmdir(lock); }
    catch { /* Nonempty/changed lock is retained; future Save refuses to proceed. */ }
  }
}
