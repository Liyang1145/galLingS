import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compileSourceContent } from "../content/build.ts";
import {
  AUTHOR_DIRECTORY, AUTHOR_LOCK, AUTHOR_ROOT, authorFileDigests,
  authorHash, authorLocation, authorPath, readAuthorProject,
} from "../content/source.ts";
import { readAuthorTextPatch } from "../../packages/story-model/src/author.ts";
import { reject } from "../../packages/story-model/src/read.ts";
import { authorFields, prepareAuthorPatch } from "./patch.ts";
import { authorWorkspace, prepareWorkspacePatch } from "./workspace.ts";
export { authorFields } from "./patch.ts";

export async function readAuthorSource(): Promise<{
  sourceSha256: string;
  editable: ReturnType<typeof authorFields>;
  workspace: ReturnType<typeof authorWorkspace>;
  loaded: Awaited<ReturnType<typeof compileSourceContent>>;
}> {
  const project = await readAuthorProject();
  return { sourceSha256: project.sourceSha256, editable: authorFields(project), workspace: authorWorkspace(project), loaded: await compileSourceContent(project) };
}

async function candidate(input: unknown, holdingLock = false) {
  const original = await readAuthorProject(holdingLock);
  const workspace = typeof input === "object" && input !== null && "format" in input
    && input.format === "haifeng.author-workspace-patch/1";
  const { updated, changed } = workspace ? prepareWorkspacePatch(original, input) : prepareAuthorPatch(original, readAuthorTextPatch(input));
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
  workspace: ReturnType<typeof authorWorkspace>;
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
    const workspace = authorWorkspace(result.updated);
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
      const replacements: { file: string; candidate: string | null; before: string | null; after: string | null }[] = [];
      // Prepare every original backup and every candidate before changing any live chapter.
      recoveryRequired = true;
      for (const [file, bytes] of result.changed) {
        const original = result.original.files.get(file);
        const backupFile = resolve(backupRoot, file);
        if (original) {
          await mkdir(dirname(backupFile), { recursive: true });
          await writeFile(backupFile, original, { flag: "wx" });
        } else {
          const path = await authorPath(file, true);
          if (await lstat(path).then(() => true, (error: unknown) => {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
            throw error;
          })) reject("AUTHOR_CONFLICT", "新章节路径已被其他文件占用", authorLocation(file));
        }
        const name = bytes === null ? null : `candidate-${replacements.length}.json`;
        if (name && bytes) await writeFile(resolve(AUTHOR_LOCK, name), bytes, { flag: "wx" });
        replacements.push({
          file, candidate: name, before: original ? authorHash(original) : null, after: bytes ? authorHash(bytes) : null,
        });
      }
      const transaction = {
        format: "haifeng.author-write/2", owner, phase: "prepared", backup,
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
        const file = await authorPath(replacement.file, replacement.before === null);
        const current = await readFile(file).catch((error: unknown) => {
          if (replacement.before === null && error instanceof Error && "code" in error && error.code === "ENOENT") return null;
          throw error;
        });
        if ((current ? authorHash(current) : null) !== replacement.before) {
          reject("AUTHOR_CONFLICT", "原章节或候选在写入期间改变，必须先处理恢复记录", authorLocation(replacement.file));
        }
        if (replacement.candidate !== null) {
          const temporary = resolve(AUTHOR_LOCK, replacement.candidate);
          if (await realpath(temporary) !== temporary || !(await lstat(temporary)).isFile()
            || authorHash(await readFile(temporary)) !== replacement.after) {
            reject("AUTHOR_CONFLICT", "章节候选改变，保留恢复记录", authorLocation(replacement.file));
          }
          await rename(temporary, file);
        } else await unlink(file);
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
    return { sourceSha256: result.updated.sourceSha256, editable, workspace, backup, loaded: result.loaded };
  } finally {
    // Only release a failure-before-preparation lock whose ownership is still certain.
    if (!recoveryRequired && ownerWritten) {
      try { await ownsLock(); await unlink(ownerFile); await rmdir(AUTHOR_LOCK); }
      catch { /* Retain unexpected lock contents; source readers remain blocked. */ }
    }
  }
}
