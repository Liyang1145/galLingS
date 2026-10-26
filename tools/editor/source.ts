import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compileSourceContent } from "../content/build.ts";
import {
  AUTHOR_DIRECTORY, AUTHOR_LOCK, AUTHOR_ROOT, assembleAuthorProject, authorFileDigests,
  authorHash, authorLocation, authorPath, readAuthorProject,
} from "../content/source.ts";
import type { AuthorProject } from "../content/source.ts";
import { authorJson } from "../content/json.ts";
import type { StringToken } from "../content/json.ts";
import { readAuthorTextPatch } from "../../packages/story-model/src/author.ts";
import { reject } from "../../packages/story-model/src/read.ts";

export function authorFields(project: AuthorProject): Record<string, ("speaker" | "text")[]> {
  return Object.fromEntries(project.nodes.map(({ record }) => [
    String(record.id), (["speaker", "text"] as const).filter(field => typeof record[field] === "string"),
  ]));
}

export async function readAuthorSource(): Promise<{
  sourceSha256: string;
  editable: ReturnType<typeof authorFields>;
  loaded: Awaited<ReturnType<typeof compileSourceContent>>;
}> {
  const project = await readAuthorProject();
  return { sourceSha256: project.sourceSha256, editable: authorFields(project), loaded: await compileSourceContent(project) };
}

async function candidate(input: unknown, holdingLock = false) {
  const patch = readAuthorTextPatch(input);
  const original = await readAuthorProject(holdingLock);
  if (original.sourceSha256 !== patch.sourceSha256) {
    reject("AUTHOR_CONFLICT", "作者源已改变；先导出草稿，再重新读取并处理冲突", authorLocation("project.json"));
  }
  const ids = new Map(original.nodes.map(node => [node.record.id, node]));
  if (ids.size !== original.nodes.length) reject("AUTHOR_NODE", "作者节点 ID 重复", authorLocation("project.json"));
  const documents = new Map<string, ReturnType<typeof authorJson>>();
  const changes = new Map<string, (StringToken & { after: string })[]>();
  for (const edit of patch.edits) {
    const node = ids.get(edit.nodeId);
    if (!node || typeof node.record[edit.field] !== "string" || node.record[edit.field] !== edit.before) {
      reject("AUTHOR_CONFLICT", "原字段缺失、类型不符或已改变", node
        ? { ...node.where, field: `${node.where.field}.${edit.field}` }
        : { ...authorLocation("project.json"), nodeId: edit.nodeId });
    }
    let document = documents.get(node.file);
    if (!document) {
      document = authorJson(original.files.get(node.file)!, authorLocation(node.file).file);
      documents.set(node.file, document);
    }
    const span = document.strings.get(JSON.stringify(["nodes", node.index, edit.field]));
    if (!span) reject("AUTHOR_CONFLICT", "原字符串位置无法明确定位，拒绝写回", node.where);
    if (edit.before === edit.after) continue;
    const edits = changes.get(node.file) ?? [];
    edits.push({ ...span, after: edit.after });
    changes.set(node.file, edits);
  }
  const files = new Map(original.files);
  const changed = new Map<string, Uint8Array>();
  for (const [file, edits] of changes) {
    let text = documents.get(file)!.text;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      text = text.slice(0, edit.start) + JSON.stringify(edit.after) + text.slice(edit.end);
    }
    const bytes = Buffer.from(text, "utf8");
    files.set(file, bytes);
    changed.set(file, bytes);
  }
  const updated = assembleAuthorProject(files);
  // Same full compilation and resource checks as packaged content; no separate editor interpreter.
  const loaded = await compileSourceContent(updated);
  return { original, updated, changed, loaded };
}

export async function previewAuthorText(input: unknown): Promise<Awaited<ReturnType<typeof candidate>>> {
  return candidate(input);
}

/**
 * Cooperative multi-file transaction. Readers reject the lock throughout replacement.
 * Any interrupted transaction leaves originals, candidates and a journal for explicit recovery.
 * This is not a filesystem-wide atomic rename or protection against uncooperative editors.
 */
export async function saveAuthorText(input: unknown): Promise<{
  sourceSha256: string; backup: string | null; editable: ReturnType<typeof authorFields>;
  loaded: Awaited<ReturnType<typeof compileSourceContent>>;
}> {
  // Check the fixed root before creating any lock/backup directory.
  await authorPath("project.json");
  try { await mkdir(AUTHOR_LOCK); }
  catch { return reject("AUTHOR_LOCK", "无法取得作者锁；请先检查正在保存的操作或 .author-lock 恢复记录", authorLocation("project.json")); }
  const owner = randomUUID();
  const ownerFile = resolve(AUTHOR_LOCK, "owner");
  const journal = resolve(AUTHOR_LOCK, "transaction.json");
  let recoveryRequired = false;
  let ownerWritten = false;
  const ownsLock = async (): Promise<void> => {
    if (await realpath(AUTHOR_LOCK) !== AUTHOR_LOCK || await realpath(ownerFile) !== ownerFile
      || await readFile(ownerFile, "utf8") !== owner) {
      reject("AUTHOR_LOCK", "作者锁身份或路径改变，保留恢复材料，拒绝继续写入", authorLocation("project.json"));
    }
  };
  try {
    if (await realpath(AUTHOR_LOCK) !== AUTHOR_LOCK) reject("AUTHOR_PATH", "作者锁路径发生改变", authorLocation("project.json"));
    await writeFile(ownerFile, owner, { flag: "wx" });
    ownerWritten = true;
    const result = await candidate(input, true);
    const editable = authorFields(result.updated);
    let backup: string | null = null;
    if (result.changed.size) {
      await ownsLock();
      const backups = resolve(AUTHOR_ROOT, ".author-backups");
      await mkdir(backups, { recursive: true });
      if (await realpath(backups) !== backups || !(await lstat(backups)).isDirectory()) {
        reject("AUTHOR_PATH", "作者备份目录不能是链接或特殊文件", authorLocation("project.json"));
      }
      const backupRoot = resolve(backups, owner);
      await mkdir(backupRoot);
      backup = `${AUTHOR_DIRECTORY}/.author-backups/${owner}`;
      const replacements: { file: string; candidate: string; before: string; after: string }[] = [];
      // Prepare every original backup and every candidate before changing any live chapter.
      recoveryRequired = true;
      for (const [file, bytes] of result.changed) {
        const original = result.original.files.get(file)!;
        const backupFile = resolve(backupRoot, file);
        await mkdir(dirname(backupFile), { recursive: true });
        await writeFile(backupFile, original, { flag: "wx" });
        const name = `candidate-${replacements.length}.json`;
        await writeFile(resolve(AUTHOR_LOCK, name), bytes, { flag: "wx" });
        replacements.push({ file, candidate: name, before: authorHash(original), after: authorHash(bytes) });
      }
      const transaction = {
        format: "haifeng.author-write/1", owner, phase: "prepared", backup,
        before: result.original.sourceSha256, after: result.updated.sourceSha256, replacements,
        originalFiles: authorFileDigests(result.original.files),
      };
      await writeFile(resolve(backupRoot, "transaction.json"), `${JSON.stringify(transaction, null, 2)}\n`, { flag: "wx" });
      await writeFile(journal, `${JSON.stringify(transaction, null, 2)}\n`, { flag: "wx" });
      await ownsLock();
      if ((await readAuthorProject(true)).sourceSha256 !== result.original.sourceSha256) {
        reject("AUTHOR_CONFLICT", "替换前作者源已变化，保留备份和候选，拒绝覆盖", authorLocation("project.json"));
      }
      for (const replacement of replacements) {
        await ownsLock();
        const file = await authorPath(replacement.file);
        const temporary = resolve(AUTHOR_LOCK, replacement.candidate);
        if (await realpath(temporary) !== temporary || !(await lstat(temporary)).isFile()
          || authorHash(await readFile(temporary)) !== replacement.after
          || authorHash(await readFile(file)) !== replacement.before) {
          reject("AUTHOR_CONFLICT", "原章节或候选在写入期间改变，必须先处理恢复记录", authorLocation(replacement.file));
        }
        await rename(temporary, file);
      }
      await ownsLock();
      if ((await readAuthorProject(true)).sourceSha256 !== result.updated.sourceSha256) {
        reject("AUTHOR_CONFLICT", "替换后的作者文件集合与候选不一致，保留锁等待人工恢复", authorLocation("project.json"));
      }
      await unlink(journal);
    }
    await ownsLock();
    await unlink(ownerFile);
    ownerWritten = false;
    await rmdir(AUTHOR_LOCK); // Nonempty/changed directories are never recursively removed.
    recoveryRequired = false;
    return { sourceSha256: result.updated.sourceSha256, editable, backup, loaded: result.loaded };
  } finally {
    // Only release a failure-before-preparation lock whose ownership is still certain.
    if (!recoveryRequired && ownerWritten) {
      try { await ownsLock(); await unlink(ownerFile); await rmdir(AUTHOR_LOCK); }
      catch { /* Retain unexpected lock contents; source readers remain blocked. */ }
    }
  }
}
