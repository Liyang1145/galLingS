import type { RestoreVoice } from "../../../packages/player/src/session.ts";
import { readPreviewCheckpointInput } from "./checkpoint.ts";
import type { PreviewCheckpointInput, PreviewCheckpointRecord } from "./checkpoint.ts";
import { downloadJson } from "./download.ts";

interface Options {
  root: HTMLElement;
  canCapture(): boolean;
  capture(): Promise<PreviewCheckpointRecord>;
  resume(input: PreviewCheckpointInput, voice: RestoreVoice): void;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}
function button(text: string): HTMLButtonElement {
  const result = element("button", text);
  result.type = "button";
  return result;
}

/** One local preview checkpoint. No server request, game storage or author write API. */
export class PreviewCheckpoints {
  readonly #options: Options;
  readonly #events = new AbortController();
  readonly #capture = button("捕获当前预览检查点");
  readonly #export = button("导出最近已校验检查点");
  readonly #restore = button("从待用检查点继续预览");
  readonly #clear = button("清除 / 取消检查点读取");
  readonly #file = element("input");
  readonly #voice = element("select");
  readonly #status = element("p", "尚无待用检查点。场面就绪并完整显示文字后可捕获；也可读取本机导出的预览检查点。");
  readonly #details = element("details");
  readonly #data = element("pre");
  #candidate: { input: PreviewCheckpointInput; record: PreviewCheckpointRecord | null } | null = null;
  #retained: PreviewCheckpointRecord | null = null;
  #enabled = false;
  #pending = false;
  #epoch = 0;
  #closed = false;

  constructor(options: Options) {
    this.#options = options;
    const controls = element("div");
    controls.className = "controls";
    controls.append(this.#capture, this.#export, this.#clear);
    const file = element("label", "读取本机预览检查点 JSON");
    this.#file.type = "file";
    this.#file.accept = ".json,application/json";
    file.append(this.#file);
    const voice = element("label", "本次恢复语音");
    for (const [value, label] of [
      ["", "请选择本次方式"], ["silent", "本句静音"], ["replay", "重播本句"], ["resume", "尝试续播活动语音"],
    ] as const) {
      const option = element("option", label);
      option.value = value;
      this.#voice.append(option);
    }
    voice.append(this.#voice);
    this.#details.append(element("summary", "检查点详情与初始条件"), this.#data);
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    const note = element("p",
      "只读取编辑器预览检查点，严格匹配作品和草稿修订。使用检查点保存时的变量与玩家投影，不读取游戏槽位、正式成果或聊天；导入和恢复均不写作者文件。");
    note.className = "help";
    options.root.classList.add("preview-checkpoints");
    options.root.append(element("h3", "检查点初始条件预览"), note, controls, file, voice, this.#restore, this.#status, this.#details);
    const { signal } = this.#events;
    this.#capture.addEventListener("click", () => { void this.capture(); }, { signal });
    this.#file.addEventListener("change", () => { void this.readFile(); }, { signal });
    this.#voice.addEventListener("change", () => this.controls(), { signal });
    this.#export.addEventListener("click", () => {
      if (!this.#enabled || this.#pending || !this.#retained) return;
      const record = this.#retained;
      downloadJson(record, `预览检查点-${record.contentRevision.slice(0, 12)}.json`);
      this.#status.textContent = "已请求下载已校验的预览检查点；文件只含当前检查点，不是作者源或正式玩家存档。";
    }, { signal });
    this.#clear.addEventListener("click", () => {
      if (!this.#enabled) return;
      ++this.#epoch;
      this.#pending = false;
      this.#candidate = null;
      this.#retained = null;
      this.#voice.value = "";
      this.#status.textContent = "已清除待用检查点并取消旧读取，当前预览和草稿保持原值。";
      this.details();
      this.controls();
    }, { signal });
    this.#restore.addEventListener("click", () => {
      if (!this.#enabled || this.#pending || !this.#candidate) return;
      const voice = this.#voice.value;
      if (voice !== "silent" && voice !== "replay" && voice !== "resume") return;
      this.#voice.value = "";
      this.controls();
      this.#options.resume(this.#candidate.input, voice);
    }, { signal });
    this.#details.addEventListener("toggle", () => this.details(), { signal });
    this.controls();
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) this.invalidatePending("制作操作已变化，未采用旧检查点读取；此前待用数据保留。");
    this.#enabled = enabled && !this.#closed;
    this.controls();
  }

  invalidatePending(reason: string): void {
    if (!this.#pending) return;
    ++this.#epoch;
    this.#pending = false;
    this.#status.textContent = reason;
    this.controls();
  }

  confirmed(input: PreviewCheckpointInput, record: PreviewCheckpointRecord): void {
    if (this.#closed || this.#candidate?.input !== input) return;
    this.#retained = structuredClone(record);
    this.#candidate = { input: readPreviewCheckpointInput(this.#retained), record: this.#retained };
    this.#status.textContent = `已校验并恢复预览检查点：${record.checkpoint.story.nodeId}；修订 ${record.contentRevision}。当前预览不写正式成果。`;
    this.details();
    this.controls();
  }

  private controls(): void {
    const locked = this.#closed || !this.#enabled || this.#pending;
    this.#capture.disabled = locked || !this.#options.canCapture();
    this.#file.disabled = locked;
    this.#export.disabled = locked || !this.#retained;
    this.#voice.disabled = locked || !this.#candidate;
    this.#restore.disabled = locked || !this.#candidate || !["silent", "replay", "resume"].includes(this.#voice.value);
    this.#clear.disabled = this.#closed || !this.#enabled || (!this.#candidate && !this.#pending);
  }

  private details(): void {
    this.#data.textContent = this.#details.open && this.#candidate
      ? JSON.stringify(this.#candidate.record ?? {
        workId: this.#candidate.input.workId, contentRevision: this.#candidate.input.contentRevision,
        selectedEntry: this.#candidate.input.selectedEntry, validation: "仅已读取文件头，恢复前仍须完整校验",
      }, null, 2) : "";
  }

  private async capture(): Promise<void> {
    if (!this.#enabled || this.#pending || !this.#options.canCapture()) return;
    const epoch = ++this.#epoch;
    this.#pending = true;
    this.#status.textContent = "正在同一预览会话队列中捕获检查点……";
    this.controls();
    try {
      const record = await this.#options.capture();
      if (this.#closed || epoch !== this.#epoch) return;
      this.#retained = structuredClone(record);
      this.#candidate = { input: readPreviewCheckpointInput(this.#retained), record: this.#retained };
      this.#voice.value = "";
      this.#status.textContent = `已捕获 ${record.checkpoint.story.nodeId}；草稿修订 ${record.contentRevision}。继续预览不会改变此检查点，可导出后在同一修订恢复。`;
      this.details();
    } catch (error: unknown) {
      if (this.#closed || epoch !== this.#epoch) return;
      this.#status.textContent = `检查点未捕获：${error instanceof Error ? error.message : "未知错误"}。此前待用数据保留。`;
    } finally {
      if (!this.#closed && epoch === this.#epoch) { this.#pending = false; this.controls(); }
    }
  }

  private async readFile(): Promise<void> {
    const file = this.#file.files?.[0];
    this.#file.value = "";
    if (!file || !this.#enabled || this.#pending || this.#closed) return;
    const epoch = ++this.#epoch;
    this.#pending = true;
    this.#status.textContent = "正在本页读取预览检查点；文件不会上传，当前预览和草稿未改变……";
    this.controls();
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error("预览检查点文件超过 4 MiB");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      if (this.#closed || epoch !== this.#epoch) return;
      const input = readPreviewCheckpointInput(JSON.parse(text) as unknown);
      this.#candidate = { input, record: null };
      this.#voice.value = "";
      this.#status.textContent = `已读取预览检查点文件头：作品 ${input.workId}，修订 ${input.contentRevision}。选择语音方式后显式继续，完整校验成功才替换旧预览；此前已校验检查点仍可导出。`;
      this.details();
    } catch (error: unknown) {
      if (this.#closed || epoch !== this.#epoch) return;
      this.#status.textContent = `文件未采用：${error instanceof Error ? error.message : "读取失败"}。此前待用数据、草稿和预览保留。`;
    } finally {
      if (!this.#closed && epoch === this.#epoch) { this.#pending = false; this.controls(); }
    }
  }

  dispose(): void {
    this.#closed = true;
    ++this.#epoch;
    this.#pending = false;
    this.#candidate = null;
    this.#retained = null;
    this.#events.abort();
    this.#options.root.replaceChildren();
  }
}
