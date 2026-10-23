import type { StoryContent } from "../../../story-model/src/model.ts";
import { ContentError } from "../../../story-model/src/model.ts";
import { readStoryContent } from "../../../story-model/src/content.ts";
import { contentRevisionText } from "../../../story-model/src/integrity.ts";
import { assertPackageContent, readGamePackage } from "../../../story-model/src/package.ts";
import type { PackageFile } from "../../../story-model/src/package.ts";

export interface LoadedGameContent {
  content: StoryContent;
  locations: Readonly<Record<string, string>>;
}

/** Resolve one literal package filename under an explicitly supplied local serving base. */
function installedUrl(base: URL, path: string): URL {
  const encoded = path.split("/").map(segment => encodeURIComponent(segment)).join("/");
  const result = new URL(encoded, base);
  if (result.origin !== base.origin || !result.pathname.startsWith(base.pathname)
    || result.search || result.hash || result.username || result.password) {
    throw new Error(`包内位置越出安装目录：${path}`);
  }
  return result;
}

async function digest(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  const value = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
}

function parseJson(text: string, file: string): unknown {
  try { return JSON.parse(text) as unknown; }
  catch { throw new ContentError("PACKAGE_JSON", "文件不是有效 JSON", { file, field: "" }); }
}

async function readLocal(base: URL, path: string, signal: AbortSignal | undefined): Promise<ArrayBuffer> {
  const url = installedUrl(base, path);
  const response = await fetch(url, { signal: signal ?? null, redirect: "error", credentials: "omit", cache: "no-store" });
  if (!response.ok || (response.url && response.url !== url.href)) throw new Error(`无法从安装位置读取：${path}`);
  return response.arrayBuffer();
}

async function checkedFile(base: URL, file: PackageFile, signal: AbortSignal | undefined): Promise<ArrayBuffer> {
  const bytes = await readLocal(base, file.path, signal);
  if (bytes.byteLength !== file.bytes || await digest(bytes) !== file.sha256) {
    throw new ContentError("PACKAGE_INTEGRITY", "文件大小或 SHA-256 与清单不一致", { file: file.path, field: "" });
  }
  return bytes;
}

/** No author-source import, remote fallback, or second interpreter. Media remain lazy. */
export async function loadPackagedContent(base: URL, signal?: AbortSignal): Promise<LoadedGameContent> {
  if (!base.pathname.endsWith("/") || base.search || base.hash || base.username || base.password) {
    throw new Error("游戏包基址必须是明确的目录 URL");
  }
  if (!globalThis.crypto?.subtle) throw new Error("当前宿主未提供包校验所需的 Web Crypto");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const manifestBytes = await readLocal(base, "game-package.json", signal);
  const manifest = readGamePackage(parseJson(decoder.decode(manifestBytes), "game-package.json"));
  const storyBytes = await checkedFile(base, manifest.story, signal);
  const content = readStoryContent(parseJson(decoder.decode(storyBytes), manifest.story.path), manifest.story.path);
  assertPackageContent(manifest, content);
  const revision = await digest(new TextEncoder().encode(contentRevisionText(content, manifest.resources.map(resource => ({
    assetId: resource.assetId, path: resource.sourcePath, sha256: resource.sha256, bytes: resource.bytes,
  })))));
  if (revision !== content.revision) throw new Error("内容修订与剧情及资源摘要不一致");
  signal?.throwIfAborted();
  // Hash inventory supports build/install checks. Do not preload/decode every
  // image or sound just to enter the title screen.
  return {
    content,
    locations: Object.fromEntries(manifest.resources.map(resource => [
      resource.assetId, installedUrl(base, resource.path).href,
    ])),
  };
}
