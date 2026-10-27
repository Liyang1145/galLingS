import { randomBytes, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { compileSourceContent } from "../content/build.ts";
import { authorHash, readAuthorProject, REPOSITORY_ROOT } from "../content/source.ts";
import { buildGamePackage } from "../game/build.ts";
import { gamePackageFiles, verifyGamePackageInput } from "../game/package-input.ts";
import { knownFields, object, string } from "../../packages/story-model/src/read.ts";
import { hash } from "../../packages/story-model/src/content.ts";
import type { AuthorWorkspacePatch } from "../../packages/story-model/src/author-workspace.ts";
import { authorWorkspace, prepareWorkspacePatch } from "./workspace.ts";
import { deliveryDirectory, digestFile, installMedia, localDirectory, mediaExtension, receiveUpload, uploadName } from "./assets.ts";
import { migrateProjectArchive, writeProjectArchive } from "./portable.ts";
import { writeArchive } from "./archive.ts";
import type { EditorMedia } from "./media.ts";

interface Download { url: string; filename: string; bytes: number; sha256: string }
interface Job {
  id: string; kind: "project" | "game"; state: "running" | "ready" | "failed";
  message: string; done: number; total: number; download?: Download; packageId?: string;
}
interface StoredDownload extends Download { file: string }

/** Explicit local production operations. Jobs start only from authenticated editor requests. */
export class EditorDelivery {
  readonly #media: EditorMedia;
  readonly #before: (() => Promise<void>) | undefined;
  readonly #jobs = new Map<string, Job>();
  readonly #downloads = new Map<string, StoredDownload>();
  #busy = false;
  constructor(media: EditorMedia, before?: () => Promise<void>) { this.#media = media; this.#before = before; }
  get busy(): boolean { return this.#busy; }
  status(input: unknown): Job | null {
    const data = object(input, { file: "editor-delivery", field: "" });
    knownFields(data, ["id"], { file: "editor-delivery", field: "" });
    if (data.id === null) return [...this.#jobs.values()].at(-1) ?? null;
    const id = string(data.id, { file: "editor-delivery", field: "id" });
    const job = this.#jobs.get(id);
    if (!job) throw new Error("交付任务不存在或服务已重启");
    return job;
  }
  private start(kind: Job["kind"], task: (job: Job, directory: string) => Promise<void>): Job {
    if (this.#busy) throw new Error("另一项项目交付尚未完成");
    this.#busy = true;
    const job: Job = { id: randomUUID(), kind, state: "running", message: "正在准备项目交付", done: 0, total: 0 };
    this.#jobs.set(job.id, job);
    if (this.#jobs.size > 20) this.#jobs.delete(this.#jobs.keys().next().value!);
    void (async () => {
      try {
        const directory = await localDirectory(await deliveryDirectory(), job.id);
        await this.#before?.();
        await task(job, directory);
        await this.#before?.();
        job.state = "ready";
      } catch (error: unknown) {
        job.state = "failed"; job.message = error instanceof Error ? error.message : "项目交付未完成";
        if (job.download) { this.#downloads.delete(job.download.url); delete job.download; }
      } finally { this.#busy = false; }
    })();
    return job;
  }
  private download(job: Job, file: string, filename: string, digest: { bytes: number; sha256: string }): void {
    const url = `/__editor/delivery/${randomBytes(32).toString("hex")}/${filename}`;
    const download = { url, filename, ...digest };
    this.#downloads.set(url, { ...download, file }); job.download = download;
  }
  exportProject(input: unknown): Job {
    return this.start("project", async (job, directory) => {
      job.message = "正在编译项目并检查全部登记素材";
      const original = await readAuthorProject(), candidate = prepareWorkspacePatch(original, input);
      const loaded = await compileSourceContent(candidate.updated);
      const file = resolve(directory, "project.zip");
      const digest = await writeProjectArchive(candidate.updated, loaded.files, file, {
        progress(done, total) { job.done = done; job.total = total; job.message = `正在打包作者文件与素材 ${done}/${total}`; },
      });
      this.download(job, file, `project-${candidate.updated.sourceSha256.slice(0, 12)}.zip`, digest);
      job.message = "完整项目包已生成，包含作者文件、素材及 SHA-256 清单；未保存页面草稿或上传外部服务";
    });
  }
  buildGame(input: unknown): Job {
    const where = { file: "editor-game-build", field: "" }, data = object(input, where);
    knownFields(data, ["sourceSha256"], where);
    const sourceSha256 = hash(data.sourceSha256, where);
    return this.start("game", async (job, directory) => {
      job.message = "正在通过正式构建流程装配游戏";
      const built = await buildGamePackage({ reuse: true, expectedSourceSha256: sourceSha256 });
      const verified = await verifyGamePackageInput(built.packageId);
      if ((await readAuthorProject()).sourceSha256 !== sourceSha256) throw new Error("构建期间作者源改变，保留产物但未提供本次下载，请重新读取");
      job.packageId = built.packageId; job.message = "正在打包已核对清单的正式游戏文件";
      const manifest = { name: "game-package.json", file: resolve(built.directory, "game-package.json"),
        sha256: authorHash(verified.input.manifestBytes), bytes: verified.input.manifestBytes.byteLength };
      const entries = [manifest, ...gamePackageFiles(verified.input.manifest).map(file => ({
        name: file.path, file: resolve(built.directory, file.path), sha256: file.sha256, bytes: file.bytes,
      }))];
      const file = resolve(directory, "game.zip");
      const digest = await writeArchive(file, entries, (done, total) => { job.done = done; job.total = total; });
      this.download(job, file, `game-${built.packageId}.zip`, digest);
      job.message = `正式共享游戏包已生成：dist/game/${built.packageId}。ZIP 包含全部登记媒体；不是 EXE/APK。`;
    });
  }
  async importResource(request: IncomingMessage): Promise<unknown> {
    if (this.#busy) throw new Error("另一项交付尚未完成");
    this.#busy = true;
    try {
      const name = uploadName(request), kind = request.headers["x-haifeng-asset-kind"];
      if (typeof kind !== "string") throw new Error("缺少素材类别");
      const extension = mediaExtension(name, kind), upload = await receiveUpload(request, 512 * 1024 * 1024);
      const path = await installMedia(upload, extension), id = `asset-${randomUUID()}`;
      const asset = { key: id, record: { id, type: kind, src: path, name, importedFrom: name,
        contentSha256: upload.sha256, contentBytes: upload.bytes } };
      return { asset, locations: this.#media.register([{ assetId: id, path, sha256: upload.sha256, bytes: upload.bytes }]) };
    } finally { this.#busy = false; }
  }
  async importProject(request: IncomingMessage): Promise<unknown> {
    if (this.#busy) throw new Error("另一项交付尚未完成");
    this.#busy = true;
    try {
      const source = request.headers["x-haifeng-source"];
      if (typeof source !== "string" || !/^[a-f0-9]{64}$/u.test(source)) throw new Error("缺少当前作者源身份");
      const upload = await receiveUpload(request, 2 * 1024 * 1024 * 1024);
      const staging = await localDirectory(await deliveryDirectory(), randomUUID());
      const workspace = await migrateProjectArchive(upload.file, staging);
      const original = await readAuthorProject();
      if (original.sourceSha256 !== source) throw new Error("导入期间作者源改变，请重新读取；已检查的素材保留在本机");
      const patch: AuthorWorkspacePatch = { format: "haifeng.author-workspace-patch/1", sourceSha256: source, workspace,
        replaceProject: workspace.workId !== original.workId };
      const candidate = prepareWorkspacePatch(original, patch), loaded = await compileSourceContent(candidate.updated);
      return { patch, locations: this.#media.register(loaded.files), title: workspace.title, workId: workspace.workId };
    } finally { this.#busy = false; }
  }
  async respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const download = this.#downloads.get(request.url ?? "");
    if (!download || !["GET", "HEAD"].includes(request.method ?? "")) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); response.end("本次项目下载不存在或服务已重启"); return;
    }
    try {
      const root = await realpath(REPOSITORY_ROOT), file = await realpath(download.file);
      if (!file.startsWith(resolve(root, "dist", "editor-delivery") + (process.platform === "win32" ? "\\" : "/"))
        || file !== download.file || !(await lstat(file)).isFile()) throw new Error("下载产物位置改变");
      const digest = await digestFile(file);
      if (digest.sha256 !== download.sha256 || digest.bytes !== download.bytes) throw new Error("下载产物字节已变化");
      response.writeHead(200, {
        "Content-Type": "application/zip", "Content-Length": download.bytes,
        "Content-Disposition": `attachment; filename="${download.filename}"`, "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
      });
      if (request.method === "HEAD") response.end();
      else await pipeline(createReadStream(file), response);
    } catch (error: unknown) {
      if (response.headersSent) response.destroy();
      else { response.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" }); response.end(error instanceof Error ? error.message : "产物读取失败"); }
    }
  }
}
