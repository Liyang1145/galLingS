import { editorSessionToken } from "./session.ts";
import { readAuthorWorkspacePatch } from "../../../packages/story-model/src/author-workspace.ts";
import type { AuthorWorkspacePatch } from "../../../packages/story-model/src/author-workspace.ts";
import { object, string } from "../../../packages/story-model/src/read.ts";

export interface DeliverySnapshot { revision: number; sourceSha256: string; dirty: boolean; patch: AuthorWorkspacePatch }
interface Options {
  root: HTMLElement;
  capture(): DeliverySnapshot | null;
  current(snapshot: DeliverySnapshot): boolean;
  applyProject(snapshot: DeliverySnapshot, patch: AuthorWorkspacePatch, locations: Record<string, string>): void;
  applyResource(snapshot: DeliverySnapshot, asset: unknown, locations: Record<string, string>): void;
  changed(): void;
  notice(message: string): void;
}
interface Job {
  id: string; kind: string; state: "running" | "ready" | "failed";
  message: string; done: number; total: number;
  download?: { url: string; filename: string; bytes: number; sha256: string };
  packageId?: string;
}
const SOURCE = { file: "editor-delivery-response", field: "" };
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag); value.textContent = text; return value;
}
function locations(input: unknown): Record<string, string> {
  const entries = object(input, SOURCE);
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => {
    const path = string(value, SOURCE), match = /^\/__editor\/media\/[a-f0-9]{64}\/([^/?#]+)$/u.exec(path);
    if (!match || match[1] !== encodeURIComponent(key)) throw new Error("素材位置未登记");
    return [key, path];
  }));
}
function readJob(input: unknown): Job {
  const data = object(input, SOURCE), state = string(data.state, SOURCE);
  if (!["running", "ready", "failed"].includes(state)) throw new Error("交付任务状态无效");
  const job: Job = {
    id: string(data.id, SOURCE), kind: string(data.kind, SOURCE), state: state as Job["state"], message: string(data.message, SOURCE),
    done: typeof data.done === "number" ? data.done : 0, total: typeof data.total === "number" ? data.total : 0,
  };
  if (data.packageId !== undefined) job.packageId = string(data.packageId, SOURCE);
  if (data.download !== undefined) {
    const item = object(data.download, SOURCE), url = string(item.url, SOURCE), filename = string(item.filename, SOURCE);
    const sha256 = string(item.sha256, SOURCE);
    if (!/^\/__editor\/delivery\/[a-f0-9]{64}\/[a-z0-9-]+\.zip$/u.test(url)
      || !/^[a-f0-9]{64}$/u.test(sha256) || typeof item.bytes !== "number" || !Number.isSafeInteger(item.bytes)) throw new Error("交付下载信息无效");
    job.download = { url, filename, sha256, bytes: item.bytes };
  }
  return job;
}

/** Explicit project import/export and official game packaging, kept outside preview input scopes. */
export class AuthorDeliveryPanel {
  readonly #options: Options;
  readonly #events = new AbortController();
  readonly #export = element("button", "导出完整项目包（含素材）");
  readonly #build = element("button", "生成正式游戏 ZIP");
  readonly #status = element("p", "保存后可生成正式游戏包；完整项目包可包含当前草稿。");
  readonly #result = element("div");
  readonly #projectFile = element("input");
  readonly #confirm = element("input");
  readonly #import = element("button", "导入项目包到本页草稿");
  readonly #assetFiles = element("input");
  readonly #assetKind = element("select");
  readonly #upload = element("button", "导入所选素材");
  readonly #cancel = element("button", "取消文件导入");
  #available = false;
  #busy = false;
  #disposed = false;
  #controller: AbortController | null = null;
  #timer: number | null = null;
  #cancelWait: (() => void) | null = null;

  constructor(options: Options) {
    this.#options = options; options.root.classList.add("delivery-panel");
    this.#status.setAttribute("role", "status"); this.#status.setAttribute("aria-live", "polite");
    this.#projectFile.type = "file"; this.#projectFile.accept = ".zip,application/zip";
    this.#projectFile.setAttribute("aria-label", "选择完整项目 ZIP");
    this.#confirm.type = "checkbox";
    const confirm = element("label", "我已保留需要的当前修改，同意导入项目替换本页草稿；保存时才替换作者源");
    confirm.prepend(this.#confirm);
    this.#assetFiles.type = "file"; this.#assetFiles.multiple = true; this.#assetFiles.accept = "image/*,audio/*";
    this.#assetFiles.setAttribute("aria-label", "选择要导入的素材");
    this.#assetKind.setAttribute("aria-label", "导入素材类别");
    for (const [id, title] of [["bg", "背景"], ["ch", "立绘"], ["bgm", "配乐"], ["se", "音效"], ["vo", "语音"]]) {
      this.#assetKind.add(new Option(title, id));
    }
    const project = element("section");
    project.append(element("h3", "完整项目"), this.#export, this.#projectFile, confirm, this.#import,
      element("p", "项目包携带作者文件、登记素材及校验清单。导入会复制素材，先形成可撤销草稿；原素材保留。"));
    const assets = element("section");
    assets.append(element("h3", "导入素材"), this.#assetKind, this.#assetFiles, this.#upload,
      element("p", "按所选类别导入本机文件；内容相同的文件共用副本，不覆盖已有素材。"));
    const game = element("section");
    game.append(element("h3", "游戏交付"), this.#build, element("p", "请先保存草稿。此按钮调用正式构建，核对清单后提供完整游戏 ZIP；不是 EXE/APK。"));
    this.#cancel.hidden = true;
    for (const button of [this.#export, this.#build, this.#import, this.#upload, this.#cancel]) button.type = "button";
    options.root.append(project, assets, game, this.#status, this.#result, this.#cancel);
    const { signal } = this.#events;
    this.#export.addEventListener("click", () => { void this.job("export-project"); }, { signal });
    this.#build.addEventListener("click", () => { void this.job("build-game"); }, { signal });
    this.#import.addEventListener("click", () => { void this.importProject(); }, { signal });
    this.#upload.addEventListener("click", () => { void this.importAssets(); }, { signal });
    this.#cancel.addEventListener("click", () => this.#controller?.abort(), { signal });
    this.setEnabled(false);
  }
  get busy(): boolean { return this.#busy; }
  setEnabled(enabled: boolean): void {
    this.#available = enabled;
    const snapshot = this.#options.capture(), blocked = !enabled || this.#busy;
    this.#export.disabled = this.#import.disabled = this.#projectFile.disabled = this.#confirm.disabled = blocked;
    this.#upload.disabled = this.#assetFiles.disabled = this.#assetKind.disabled = blocked;
    this.#build.disabled = blocked || !snapshot || snapshot.dirty;
    this.#build.title = snapshot?.dirty ? "先保存当前草稿，再打包" : "";
  }
  private begin(): AbortController {
    this.#busy = true; this.#result.replaceChildren();
    const controller = new AbortController(); this.#controller = controller;
    this.#options.changed(); return controller;
  }
  private end(): void {
    this.#busy = false; this.#controller = null; this.#cancel.hidden = true;
    if (!this.#disposed) this.#options.changed();
  }
  private failed(error: unknown): void {
    if (this.#disposed) return;
    this.#status.textContent = `操作未完成：${error instanceof Error ? error.message : "处理失败"}。本页原有草稿保留。`;
    this.#options.notice(this.#status.textContent);
  }
  private async json(route: string, input: unknown, signal: AbortSignal): Promise<unknown> {
    const response = await fetch(`/__editor/${route}`, {
      method: "POST", mode: "same-origin", credentials: "same-origin", cache: "no-store", signal,
      headers: { "Content-Type": "application/json", "X-Haifeng-Editor": editorSessionToken() }, body: JSON.stringify(input),
    });
    const result: unknown = await response.json();
    if (!response.ok) throw new Error(string(object(result, SOURCE).error, SOURCE));
    return result;
  }
  private wait(signal: AbortSignal): Promise<void> {
    return new Promise((resolveWait, reject) => {
      const cancel = (): void => {
        if (this.#timer !== null) window.clearTimeout(this.#timer);
        this.#timer = null; this.#cancelWait = null; signal.removeEventListener("abort", cancel); reject(new Error("交付状态读取已取消"));
      };
      this.#cancelWait = cancel;
      this.#timer = window.setTimeout(() => {
        this.#timer = null; this.#cancelWait = null; signal.removeEventListener("abort", cancel); resolveWait();
      }, 600);
      signal.addEventListener("abort", cancel, { once: true });
    });
  }
  private async job(route: "export-project" | "build-game"): Promise<void> {
    const snapshot = this.#options.capture();
    if (!snapshot || !this.#available || this.#busy || (route === "build-game" && snapshot.dirty)) return;
    const controller = this.begin();
    try {
      let job = readJob(await this.json(route, route === "export-project" ? snapshot.patch : { sourceSha256: snapshot.sourceSha256 }, controller.signal));
      while (!this.#disposed) {
        this.#status.textContent = job.message + (job.total ? `（${job.done}/${job.total}）` : "");
        if (job.state !== "running") break;
        await this.wait(controller.signal);
        job = readJob(await this.json("delivery-status", { id: job.id }, controller.signal));
      }
      if (this.#disposed) return;
      if (job.state === "failed") throw new Error(job.message);
      if (!job.download) throw new Error("交付结果未提供可用的下载");
      const download = element("a", `下载 ${job.download.filename}`);
      download.href = job.download.url; download.download = job.download.filename;
      const info = element("p", `${(job.download.bytes / 1024 / 1024).toFixed(1)} MiB · SHA-256 ${job.download.sha256}`);
      this.#result.append(download, info);
      if (job.packageId) this.#result.append(element("p", `游戏包目录：dist/game/${job.packageId}`));
    } catch (error: unknown) { this.failed(error); }
    finally { this.end(); }
  }
  private upload(route: string, file: File, headers: Record<string, string>, signal: AbortSignal): Promise<unknown> {
    return new Promise((resolveUpload, reject) => {
      if (signal.aborted) { reject(new Error("已取消文件导入")); return; }
      const request = new XMLHttpRequest();
      request.open("POST", `/__editor/${route}`); request.responseType = "json";
      request.setRequestHeader("X-Haifeng-Editor", editorSessionToken());
      request.setRequestHeader("Content-Type", route === "import-project" ? "application/zip" : "application/octet-stream");
      request.setRequestHeader("X-Haifeng-Filename", encodeURIComponent(file.name));
      for (const [key, value] of Object.entries(headers)) request.setRequestHeader(key, value);
      const abort = (): void => request.abort();
      signal.addEventListener("abort", abort, { once: true });
      const cleanup = (): void => signal.removeEventListener("abort", abort);
      request.upload.onprogress = event => {
        if (!this.#disposed) this.#status.textContent = `正在导入 ${file.name}：${event.lengthComputable ? Math.round(event.loaded / event.total * 100) + "%" : event.loaded + " 字节"}`;
      };
      request.upload.onload = () => { if (!this.#disposed) this.#status.textContent = `已读取 ${file.name}，正在检查并迁移素材……`; };
      request.onload = () => {
        cleanup();
        if (request.status >= 200 && request.status < 300) resolveUpload(request.response as unknown);
        else {
          try { reject(new Error(string(object(request.response as unknown, SOURCE).error, SOURCE))); }
          catch { reject(new Error(`文件导入未完成（${request.status}）`)); }
        }
      };
      request.onerror = () => { cleanup(); reject(new Error("本机导入连接中断")); };
      request.onabort = () => { cleanup(); reject(new Error("已取消文件导入")); };
      request.send(file);
    });
  }
  private async importProject(): Promise<void> {
    const snapshot = this.#options.capture(), file = this.#projectFile.files?.[0];
    if (!this.#available || this.#busy || !snapshot || !file) return;
    if (!this.#confirm.checked) { this.#options.notice("请先确认保留当前修改并同意替换本页草稿"); return; }
    const controller = this.begin(); this.#cancel.hidden = false;
    try {
      const result = object(await this.upload("import-project", file, { "X-Haifeng-Source": snapshot.sourceSha256 }, controller.signal), SOURCE);
      if (!this.#options.current(snapshot)) throw new Error("当前草稿改变，未采用旧导入结果");
      const patch = readAuthorWorkspacePatch(result.patch);
      this.#options.applyProject(snapshot, patch, locations(result.locations));
      this.#status.textContent = `项目 ${patch.workspace.title} 已导入本页草稿，可撤销、预览或保存。原素材保留，作者源尚未替换。`;
      this.#projectFile.value = ""; this.#confirm.checked = false;
    } catch (error: unknown) { this.failed(error); }
    finally { this.end(); }
  }
  private async importAssets(): Promise<void> {
    const files = Array.from(this.#assetFiles.files ?? []);
    if (!this.#available || this.#busy || !files.length) return;
    const kind = this.#assetKind.value, controller = this.begin(); this.#cancel.hidden = false;
    try {
      for (const file of files) {
        const snapshot = this.#options.capture();
        if (!snapshot) throw new Error("作者工程已关闭");
        const result = object(await this.upload("import-resource", file, { "X-Haifeng-Asset-Kind": kind }, controller.signal), SOURCE);
        if (!this.#options.current(snapshot)) throw new Error("当前草稿改变，未采用旧素材导入结果");
        this.#options.applyResource(snapshot, result.asset, locations(result.locations));
      }
      this.#status.textContent = `已将 ${files.length} 个素材登记到本页工程草稿，保存后采用；可在素材库应用到节点。`;
      this.#assetFiles.value = "";
    } catch (error: unknown) { this.failed(error); }
    finally { this.end(); }
  }
  dispose(): void {
    this.#disposed = true; this.#controller?.abort(); this.#cancelWait?.(); this.#events.abort(); this.#options.root.replaceChildren();
  }
}
