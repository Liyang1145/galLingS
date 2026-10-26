import { isCommandEntry } from "../cli-entry.ts";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError } from "../../packages/story-model/src/model.ts";
import type { StoryContent } from "../../packages/story-model/src/model.ts";
import { contentRevisionText } from "../../packages/story-model/src/integrity.ts";
import type { ResourceDigest } from "../../packages/story-model/src/integrity.ts";
import { compileAuthorProject } from "./compile.ts";
import { REPOSITORY_ROOT, authorFileDigests, readAuthorProject } from "./source.ts";
import type { AuthorProject } from "./source.ts";

export { REPOSITORY_ROOT } from "./source.ts";
const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

export type ResourceFile = ResourceDigest;

/** Reads actual local files only when explicitly invoked by a content consumer. */
export async function loadSourceContent(): Promise<Awaited<ReturnType<typeof compileSourceContent>>> {
  return compileSourceContent(await readAuthorProject());
}

/** Same converter and resource checks for explicit author editing; never executes source JS. */
export async function compileSourceContent(project: AuthorProject): Promise<{
  content: StoryContent; files: ResourceFile[];
  authorFiles: ReturnType<typeof authorFileDigests>;
}> {
  const gameRoot = await realpath(resolve(REPOSITORY_ROOT, "海风与布丁"));
  const content = compileAuthorProject(project);
  const files: ResourceFile[] = [];
  const cache = new Map<string, { sha256: string; bytes: number }>();
  for (const resource of content.resources) {
    const filename = await realpath(resolve(gameRoot, resource.path)).catch(() => {
      throw new ContentError("RESOURCE_MISSING", `找不到资源「${resource.id}」`, {
        ...project.assets.find(asset => asset.key === resource.id)!.where, field: `${resource.id}.src`,
      });
    });
    const child = relative(gameRoot, filename);
    if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) {
      throw new ContentError("RESOURCE_PATH", "资源符号链接越出作品目录", {
        ...project.assets.find(asset => asset.key === resource.id)!.where, field: `${resource.id}.src`,
      });
    }
    let info = cache.get(filename);
    if (!info) {
      const data = await readFile(filename);
      info = { sha256: sha256(data), bytes: data.byteLength };
      cache.set(filename, info);
    }
    files.push({ assetId: resource.id, path: resource.path, ...info });
  }
  // Raw JSON whitespace/key order does not change the semantic content revision.
  content.revision = sha256(contentRevisionText(content, files));
  return { content, files, authorFiles: authorFileDigests(project.files) };
}

async function build(): Promise<void> {
  const { content, files } = await loadSourceContent();
  const base = resolve(REPOSITORY_ROOT, "dist/content");
  const destination = resolve(base, content.revision);
  await mkdir(base, { recursive: true });
  // Immutable revision directories: no removal or overwrite of an existing build.
  const temporary = await mkdtemp(resolve(base, ".building-"));
  try {
    await writeFile(resolve(temporary, "story.json"), `${JSON.stringify(content, null, 2)}\n`, "utf8");
    await writeFile(resolve(temporary, "resources.json"), `${JSON.stringify({
      workId: content.workId, contentRevision: content.revision,
      resourceBase: "海风与布丁/", files,
      scope: "content-only; media remain at author source; not a distributable game",
    }, null, 2)}\n`, "utf8");
    await rename(temporary, destination);
  } catch (error) {
    // Temporary output lives strictly under dist/content and is never author input.
    const cleanupPath = relative(base, resolve(temporary));
    if (cleanupPath.startsWith(".building-") && !cleanupPath.includes(sep) && !isAbsolute(cleanupPath)) {
      await rm(temporary, { recursive: true, force: true });
    }
    throw error;
  }
  console.log(`内容已生成：${relative(REPOSITORY_ROOT, destination)}`);
  console.log("这是内容产物，不是游戏包；未执行路线、媒体解码或平台验收。");
}

if (isCommandEntry(import.meta.url)) {
  build().catch((error: unknown) => {
    if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
    else console.error(error instanceof Error ? error.message : "内容构建失败");
    process.exitCode = 1;
  });
}
