import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, realpath } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { basename, extname, resolve } from "node:path";
import { REPOSITORY_ROOT } from "../content/source.ts";

const IMAGE = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".bmp"];
const AUDIO = [".mp3", ".ogg", ".opus", ".wav", ".m4a", ".mp4", ".aac", ".flac", ".webm", ".weba", ".oga"];
export async function localDirectory(parent: string, child: string): Promise<string> {
  const physical = await realpath(parent), target = resolve(physical, child);
  if (physical !== parent || !child || /[\\/:]/u.test(child) || child === "." || child === "..") throw new Error("本机输出目录位置无效");
  await mkdir(target).catch((error: unknown) => {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
  });
  if (await realpath(target) !== target || !(await lstat(target)).isDirectory()) throw new Error("本机输出目录不能是链接或特殊文件");
  return target;
}
export async function deliveryDirectory(): Promise<string> {
  const root = await realpath(REPOSITORY_ROOT);
  return localDirectory(await localDirectory(root, "dist"), "editor-delivery");
}
export async function digestFile(file: string): Promise<{ sha256: string; bytes: number }> {
  if (await realpath(file) !== file || !(await lstat(file)).isFile()) throw new Error("文件位置不是原普通文件");
  const hash = createHash("sha256"); let bytes = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.byteLength; }
  return { sha256: hash.digest("hex"), bytes };
}
export async function receiveUpload(request: IncomingMessage, limit: number): Promise<{ file: string; sha256: string; bytes: number }> {
  const directory = await deliveryDirectory(), file = resolve(directory, `upload-${randomUUID()}.tmp`);
  const length = request.headers["content-length"];
  if (length !== undefined && (!/^\d+$/u.test(length) || Number(length) > limit)) throw new Error("导入文件超过大小上限");
  const handle = await open(file, "wx"), hash = createHash("sha256"); let bytes = 0;
  try {
    for await (const chunk of request) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      bytes += data.byteLength; if (bytes > limit) throw new Error("导入文件超过大小上限");
      let done = 0;
      while (done < data.byteLength) {
        const result = await handle.write(data, done, data.byteLength - done);
        if (!result.bytesWritten) throw new Error("导入文件写入中断");
        done += result.bytesWritten;
      }
      hash.update(data);
    }
    if (!bytes) throw new Error("导入文件为空");
    await handle.sync();
    return { file, bytes, sha256: hash.digest("hex") };
  } finally { await handle.close(); }
}
export function mediaExtension(filename: string, kind: string): string {
  const extension = extname(filename).toLowerCase();
  if (!["bg", "ch", "bgm", "se", "vo"].includes(kind)
    || !(["bg", "ch"].includes(kind) ? IMAGE : AUDIO).includes(extension)) throw new Error("素材类别与文件扩展名不匹配");
  return extension;
}
async function checkSvg(file: string, bytes: number): Promise<void> {
  if (bytes > 256 * 1024) throw new Error("SVG 超过静态素材大小上限");
  const svg = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(file));
  const markup = svg.replace(/<!--[\s\S]*?-->/gu, "");
  if (!/^\s*<svg[\s>]/u.test(markup) || !markup.trimEnd().endsWith("</svg>")
    || /<(?:script|foreignObject|image|style|animate|set)\b|<!|<\?|(?:\s|:)on[a-z]+\s*=/iu.test(markup)
    || [...markup.matchAll(/(?:\b(?:href|src)\s*=\s*["'])([^"']*)["']/giu)].some(match => !match[1]?.startsWith("#"))
    || [...markup.matchAll(/url\(([^)]*)\)/giu)].some(match => !match[1]?.startsWith("#"))) throw new Error("SVG 必须是无脚本、无外链的静态图形");
}
/** Immutable, hash-addressed copies. Original assets and previously imported bytes are never overwritten. */
export async function installMedia(input: { file: string; sha256: string; bytes: number }, extension: string,
  gameRoot?: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/u.test(input.sha256) || ![...IMAGE, ...AUDIO].includes(extension)) throw new Error("导入素材身份无效");
  if (extension === ".svg") await checkSvg(input.file, input.bytes);
  const expected = gameRoot ?? resolve(await realpath(REPOSITORY_ROOT), "海风与布丁");
  const root = await realpath(expected);
  if (root !== expected) throw new Error("作品素材目录不能是链接");
  const imported = await localDirectory(await localDirectory(root, "assets"), "imported");
  const path = `assets/imported/${input.sha256}${extension}`, output = resolve(imported, `${input.sha256}${extension}`);
  await copyFile(input.file, output, constants.COPYFILE_EXCL).catch((error: unknown) => {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
  });
  const checked = await digestFile(output);
  if (checked.sha256 !== input.sha256 || checked.bytes !== input.bytes) throw new Error("已存在的导入素材与本次字节不同，未覆盖");
  return path;
}
export function uploadName(request: IncomingMessage): string {
  const raw = request.headers["x-haifeng-filename"];
  if (typeof raw !== "string") throw new Error("缺少导入文件名称");
  const name = basename(decodeURIComponent(raw).replace(/\\/gu, "/"));
  if (!name || name.length > 256 || /[\u0000-\u001f]/u.test(name)) throw new Error("导入文件名称无效");
  return name;
}
