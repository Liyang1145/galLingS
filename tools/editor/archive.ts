import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";

const LIMIT = 2 * 1024 * 1024 * 1024;
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1; return crc >>> 0;
});
function crcUpdate(crc: number, bytes: Uint8Array): number {
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ crc >>> 8;
  return crc >>> 0;
}
function name(value: string): void {
  if (!value || value.length > 1024 || value.startsWith("/") || /[\\:\u0000-\u001f]/u.test(value)
    || value.split("/").some(part => !part || part === "." || part === "..")) throw new Error("ZIP 条目路径无效");
}
export interface ArchiveEntry {
  name: string;
  data?: Uint8Array;
  file?: string;
  sha256?: string;
  bytes?: number;
}
export interface ArchiveFile { name: string; size: number; compressed: number; crc: number; method: number; flags: number; offset: number }
async function bytesAt(handle: FileHandle, size: number, offset: number): Promise<Buffer> {
  const bytes = Buffer.alloc(size);
  let done = 0;
  while (done < size) {
    const result = await handle.read(bytes, done, size - done, offset + done);
    if (!result.bytesRead) throw new Error("ZIP 文件不完整");
    done += result.bytesRead;
  }
  return bytes;
}

/** Standard ZIP32 with streaming stored entries, UTF-8 names, CRC32 and SHA-256 verification. */
export async function writeArchive(filename: string, entries: readonly ArchiveEntry[], progress: (done: number, total: number) => void = () => {}):
Promise<{ bytes: number; sha256: string }> {
  if (entries.length > 10000) throw new Error("ZIP 文件数超过 10000");
  const handle = await open(filename, "wx");
  const archiveHash = createHash("sha256");
  let position = 0;
  const put = async (bytes: Uint8Array): Promise<void> => {
    if (position + bytes.byteLength > LIMIT) throw new Error("ZIP 超过 2 GiB 上限");
    let done = 0;
    while (done < bytes.byteLength) {
      const result = await handle.write(bytes, done, bytes.byteLength - done, position + done);
      if (!result.bytesWritten) throw new Error("ZIP 输出写入中断");
      done += result.bytesWritten;
    }
    archiveHash.update(bytes); position += bytes.byteLength;
  };
  const central: Buffer[] = [];
  const used = new Set<string>();
  try {
    for (const [index, entry] of entries.entries()) {
      name(entry.name);
      if (used.has(entry.name.toLowerCase())) throw new Error("ZIP 路径重复");
      used.add(entry.name.toLowerCase());
      const path = Buffer.from(entry.name), start = position;
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x808, 6);
      header.writeUInt16LE(0x21, 12); header.writeUInt16LE(path.byteLength, 26);
      await put(header); await put(path);
      let crc = 0xffffffff, size = 0;
      const hash = createHash("sha256");
      const source = entry.data ? Readable.from([entry.data]) : entry.file ? createReadStream(entry.file) : null;
      if (!source) throw new Error("ZIP 条目没有数据来源");
      for await (const chunk of source) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        crc = crcUpdate(crc, bytes); hash.update(bytes); size += bytes.byteLength; await put(bytes);
      }
      const digest = hash.digest("hex");
      if ((entry.sha256 && digest !== entry.sha256) || (entry.bytes !== undefined && size !== entry.bytes)) {
        throw new Error(`打包时文件字节发生变化：${entry.name}`);
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc, 4); descriptor.writeUInt32LE(size, 8); descriptor.writeUInt32LE(size, 12);
      await put(descriptor);
      const record = Buffer.alloc(46);
      record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x808, 8);
      record.writeUInt16LE(0x21, 14); record.writeUInt32LE(crc, 16); record.writeUInt32LE(size, 20); record.writeUInt32LE(size, 24);
      record.writeUInt16LE(path.byteLength, 28); record.writeUInt32LE(start, 42);
      central.push(record, path); progress(index + 1, entries.length);
    }
    const directory = position;
    for (const bytes of central) await put(bytes);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(position - directory, 12); end.writeUInt32LE(directory, 16); await put(end);
    await handle.sync();
    return { bytes: position, sha256: archiveHash.digest("hex") };
  } finally { await handle.close(); }
}

/** Read ZIP's directory first; entries are never extracted to a path supplied by the archive. */
export class ProjectArchive {
  readonly filename: string;
  readonly entries: ReadonlyMap<string, ArchiveFile>;
  private constructor(filename: string, entries: Map<string, ArchiveFile>) { this.filename = filename; this.entries = entries; }
  static async open(filename: string): Promise<ProjectArchive> {
    const size = (await stat(filename)).size;
    if (size < 22 || size > LIMIT) throw new Error("ZIP 文件大小无效或超过 2 GiB");
    const handle = await open(filename, "r");
    try {
      const tail = await bytesAt(handle, Math.min(size, 65557), Math.max(0, size - 65557));
      let end = -1;
      for (let at = tail.length - 22; at >= 0; at--) {
        if (tail.readUInt32LE(at) === 0x06054b50 && at + 22 + tail.readUInt16LE(at + 20) === tail.length) { end = at; break; }
      }
      if (end < 0 || tail.readUInt16LE(end + 4) || tail.readUInt16LE(end + 6)) throw new Error("ZIP 缺少有效目录或使用了分卷");
      const count = tail.readUInt16LE(end + 10), directorySize = tail.readUInt32LE(end + 12), offset = tail.readUInt32LE(end + 16);
      if (count !== tail.readUInt16LE(end + 8) || count > 10000 || count === 0xffff
        || directorySize > 16 * 1024 * 1024 || offset + directorySize !== size - tail.length + end) throw new Error("ZIP 目录范围无效");
      const directory = await bytesAt(handle, directorySize, offset), entries = new Map<string, ArchiveFile>(), paths = new Set<string>();
      let cursor = 0, total = 0;
      for (let index = 0; index < count; index++) {
        if (cursor + 46 > directory.length || directory.readUInt32LE(cursor) !== 0x02014b50) throw new Error("ZIP 目录损坏");
        const flags = directory.readUInt16LE(cursor + 8), method = directory.readUInt16LE(cursor + 10);
        const length = directory.readUInt16LE(cursor + 28), extra = directory.readUInt16LE(cursor + 30), comment = directory.readUInt16LE(cursor + 32);
        const next = cursor + 46 + length + extra + comment;
        if (next > directory.length || flags & ~0x80e || ![0, 8].includes(method) || directory.readUInt16LE(cursor + 34)) throw new Error("ZIP 条目格式不支持");
        const path = new TextDecoder("utf-8", { fatal: true }).decode(directory.subarray(cursor + 46, cursor + 46 + length));
        name(path);
        const mode = directory.readUInt32LE(cursor + 38) >>> 16 & 0xf000;
        if ((mode && mode !== 0x8000) || paths.has(path.toLowerCase())) throw new Error("ZIP 包含链接、特殊文件或重复路径");
        paths.add(path.toLowerCase());
        const entry: ArchiveFile = {
          name: path, size: directory.readUInt32LE(cursor + 24), compressed: directory.readUInt32LE(cursor + 20),
          crc: directory.readUInt32LE(cursor + 16), method, flags, offset: directory.readUInt32LE(cursor + 42),
        };
        total += entry.size;
        if (total > LIMIT || entry.size > 512 * 1024 * 1024 || entry.offset + 30 > offset
          || (method === 0 && entry.size !== entry.compressed)) throw new Error("ZIP 解包容量或条目位置无效");
        const local = await bytesAt(handle, 30, entry.offset);
        if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== flags || local.readUInt16LE(8) !== method) throw new Error("ZIP 本地头与目录不一致");
        const localName = await bytesAt(handle, local.readUInt16LE(26), entry.offset + 30);
        if (!localName.equals(Buffer.from(path))) throw new Error("ZIP 文件名不一致");
        entry.offset += 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
        if (entry.offset + entry.compressed > offset) throw new Error("ZIP 条目越界");
        if (!(flags & 8) && (local.readUInt32LE(14) !== entry.crc || local.readUInt32LE(18) !== entry.compressed || local.readUInt32LE(22) !== entry.size)) {
          throw new Error("ZIP 本地校验信息不一致");
        }
        entries.set(path, entry); cursor = next;
      }
      if (cursor !== directory.length) throw new Error("ZIP 目录包含未登记数据");
      return new ProjectArchive(filename, entries);
    } finally { await handle.close(); }
  }
  private async stream(entry: ArchiveFile, destination: Writable): Promise<{ sha256: string; bytes: number }> {
    let crc = 0xffffffff, size = 0;
    const hash = createHash("sha256");
    const verify = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.byteLength;
        if (size > entry.size) { callback(new Error("ZIP 解包超过声明大小")); return; }
        crc = crcUpdate(crc, chunk); hash.update(chunk); callback(null, chunk);
      },
    });
    const source = entry.compressed ? createReadStream(this.filename, { start: entry.offset, end: entry.offset + entry.compressed - 1 }) : Readable.from([]);
    if (entry.method === 8) await pipeline(source, createInflateRaw(), verify, destination);
    else await pipeline(source, verify, destination);
    if (size !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw new Error("ZIP 条目 CRC32 或大小不一致");
    return { sha256: hash.digest("hex"), bytes: size };
  }
  async read(path: string, maximum = 16 * 1024 * 1024): Promise<Buffer> {
    const entry = this.entries.get(path);
    if (!entry || entry.size > maximum) throw new Error(`ZIP 文件缺失或超过读取上限：${path}`);
    const chunks: Buffer[] = [];
    const sink = new Writable({ write(chunk: Buffer, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    await this.stream(entry, sink);
    return Buffer.concat(chunks);
  }
  async extract(path: string, destination: string): Promise<{ sha256: string; bytes: number }> {
    const entry = this.entries.get(path);
    if (!entry) throw new Error(`ZIP 缺少文件：${path}`);
    return this.stream(entry, createWriteStream(destination, { flags: "wx" }));
  }
}
