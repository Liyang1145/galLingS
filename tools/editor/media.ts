import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { REPOSITORY_ROOT } from "../content/build.ts";
import type { ResourceFile } from "../content/build.ts";

const TYPES: Readonly<Record<string, string>> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif", ".bmp": "image/bmp",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav",
  ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".aac": "audio/aac", ".flac": "audio/flac",
  ".webm": "audio/webm", ".weba": "audio/webm", ".oga": "audio/ogg",
};
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
function inside(root: string, filename: string): boolean {
  const child = relative(root, filename);
  return !!child && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}
function problem(response: ServerResponse, status: number, text: string): void {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
  });
  response.end(text);
}
function interval(range: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
  if (!match || size === 0 || (!match[1] && !match[2])) return null;
  const first = Number(match[1]);
  const last = Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return null;
  if (!match[1]) return last > 0 ? { start: Math.max(0, size - last), end: size - 1 } : null;
  if (first >= size || (match[2] && last < first)) return null;
  return { start: first, end: match[2] ? Math.min(last, size - 1) : size - 1 };
}

/** Per-server allowlist of already converted resource identities; never accepts a file path. */
export class EditorMedia {
  readonly #files = new Map<string, Readonly<ResourceFile>>();

  register(files: readonly ResourceFile[]): Record<string, string> {
    return Object.fromEntries(files.map(file => {
      const url = `/__editor/media/${file.sha256}/${encodeURIComponent(file.assetId)}`;
      this.#files.set(url, Object.freeze({ ...file }));
      return [file.assetId, url];
    }));
  }

  async respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const file = this.#files.get(request.url ?? "");
    if (!file) { problem(response, 404, "没有此已登记的预览资源。"); return; }
    if (request.method !== "GET" && request.method !== "HEAD") {
      problem(response, 405, "预览资源只允许读取。"); return;
    }
    const type = TYPES[extname(file.path).toLowerCase()];
    if (!type) { problem(response, 415, "登记资源不是本片支持的图片或声音文件；未提供原件。"); return; }
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    request.once("aborted", abort);
    response.once("close", abort);
    try {
      const root = await realpath(REPOSITORY_ROOT);
      const game = await realpath(resolve(root, "海风与布丁"));
      const filename = await realpath(resolve(game, file.path));
      if (!inside(root, game) || !inside(game, filename) || !(await stat(filename)).isFile()) {
        problem(response, 403, "预览资源不在当前作品目录内。"); return;
      }
      // Only this requested resource is read. A later external asset edit must
      // not silently supply different bytes to an older preview identity.
      const bytes = await readFile(filename, { signal: controller.signal });
      if (controller.signal.aborted || response.destroyed) return;
      if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256) {
        problem(response, 409, "预览资源字节已变化，请重新读取作者源或准备新的预览。"); return;
      }
      const range = request.headers.range;
      const slice = range === undefined ? null : interval(range, bytes.byteLength);
      if (range !== undefined && slice === null) {
        response.writeHead(416, { "Content-Range": `bytes */${bytes.byteLength}`, "Cache-Control": "no-store" });
        response.end();
        return;
      }
      const data = slice ? bytes.subarray(slice.start, slice.end + 1) : bytes;
      response.writeHead(slice ? 206 : 200, {
        "Content-Type": type,
        "Content-Length": data.byteLength, "Accept-Ranges": "bytes", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
        ...(slice ? { "Content-Range": `bytes ${slice.start}-${slice.end}/${bytes.byteLength}` } : {}),
      });
      response.end(request.method === "HEAD" ? undefined : data);
    } catch {
      if (controller.signal.aborted || response.destroyed) return;
      if (!response.headersSent) problem(response, 404, "预览资源读取失败，原内容与草稿保持；请检查素材后显式重试。");
      else response.destroy();
    } finally {
      request.off("aborted", abort);
      response.off("close", abort);
    }
  }
}
