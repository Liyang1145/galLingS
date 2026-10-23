import type { JsonObject } from "../../../packages/story-model/src/model.ts";
import type { DialogueEntry } from "../../../packages/player/src/session.ts";
import type { AudioVolumes } from "../../../packages/player/src/preferences.ts";
import { AudioMixer } from "../../../packages/player/src/web/audio.ts";
import type { ResourceAccess } from "../../../packages/player/src/web/resources.ts";

interface DialoguePanelOptions {
  root: HTMLElement;
  resources: ResourceAccess;
  settings: JsonObject;
  volumes: AudioVolumes;
  audioAllowed: boolean;
  /** Only the owning history view may audition, with all other pauses still respected. */
  available(): boolean;
  requestAudio(): void;
}

/** Detached history data and a separate voice mixer; no writable story capability. */
export class DialoguePanel {
  readonly #options: DialoguePanelOptions;
  readonly #audio: AudioMixer;
  #events: AbortController | null = null;
  #status: HTMLParagraphElement | null = null;
  #stop: HTMLButtonElement | null = null;
  #selected: HTMLButtonElement | null = null;
  #cancel: (() => void) | null = null;
  #epoch = 0;
  #open = false;
  #disposed = false;

  constructor(options: DialoguePanelOptions) {
    this.#options = options;
    this.#audio = new AudioMixer(options.resources, options.settings, options.audioAllowed, options.volumes);
  }

  open(entries: readonly DialogueEntry[]): void {
    if (this.#disposed) throw new Error("对白回看面板已离开");
    this.close();
    this.#open = true;
    this.#events = new AbortController();
    const { signal } = this.#events;
    const root = this.#options.root;
    this.#status = document.createElement("p");
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    this.#status.textContent = "有配音的对白可单独试听，使用当前语音音量；试听不会推进剧情。";
    this.#stop = document.createElement("button");
    this.#stop.type = "button";
    this.#stop.textContent = "停止历史语音";
    this.#stop.disabled = true;
    this.#stop.addEventListener("click", () => this.stop("历史语音已停止。"), { signal });
    const controls = document.createElement("div");
    controls.className = "dialogue-audio-controls";
    controls.append(this.#status, this.#stop);
    const list = document.createElement("ol");
    list.className = "dialogue-history";
    for (const entry of entries) {
      const item = document.createElement("li");
      const label = document.createElement("b");
      label.textContent = entry.kind === "choice"
        ? entry.timedOut ? "超时选择" : "选择" : entry.speaker || "旁白";
      const text = document.createElement("p");
      text.textContent = entry.text;
      item.append(label, text);
      if (entry.kind === "line" && entry.voiceId) {
        const voiceId = entry.voiceId;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "重播语音";
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", `重播${entry.speaker || "旁白"}的语音：${entry.text.slice(0, 40)}`);
        button.addEventListener("click", () => this.play(button, voiceId), { signal });
        item.append(button);
      }
      list.append(item);
    }
    root.append(controls);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.textContent = "这里会留下本次游玩中已经出现的对白和选择。";
      root.append(empty);
    } else root.append(list);
  }

  private play(button: HTMLButtonElement, voiceId: string): void {
    if (!this.#open || this.#disposed) return;
    this.stop();
    try {
      this.#options.requestAudio();
      if (!this.#options.available()) {
        this.stop("当前暂不能试听；请确认窗口在前台、没有其他暂停且已获得声音许可，再次点击本条语音。");
        return;
      }
      const epoch = ++this.#epoch;
      const current = (): boolean => this.#open && !this.#disposed && epoch === this.#epoch;
      this.#selected = button;
      button.setAttribute("aria-pressed", "true");
      if (this.#stop) this.#stop.disabled = false;
      if (this.#status) this.#status.textContent = "正在读取本地历史语音……";
      const cancel = this.#audio.previewVoice(voiceId, {
        started: () => {
          if (!current()) return;
          if (!this.#options.available()) { this.stop("试听已取消；恢复后请再次点击语音。"); return; }
          if (this.#status) this.#status.textContent = "正在试听历史语音，剧情仍在原处暂停。";
        },
        ended: () => { if (current()) this.stop("历史语音播放完毕。"); },
        problem: problem => {
          if (current()) this.stop(`本条历史语音未完成：${problem.message} 可再次点击本条重播；剧情进度未改变。`);
        },
      });
      if (current()) this.#cancel = cancel;
      else cancel();
    } catch (error: unknown) {
      this.stop(`本条历史语音未播放：${error instanceof Error ? error.message : "声音不可用"}。剧情进度未改变。`);
    }
  }

  private stop(message?: string): void {
    ++this.#epoch;
    this.#cancel?.();
    this.#cancel = null;
    this.#selected?.setAttribute("aria-pressed", "false");
    this.#selected = null;
    if (this.#stop) this.#stop.disabled = true;
    if (message && this.#status) this.#status.textContent = message;
  }

  setVolumes(volumes: AudioVolumes): void { this.#audio.setVolumes(volumes); }

  refresh(audioAllowed: boolean): void {
    if (this.#disposed) return;
    // Cancel before granting a new permission, so a stale track cannot auto-resume.
    if (this.#selected && !this.#options.available()) {
      this.stop("历史语音已停止；窗口或声音许可恢复后，请再次点击本条语音。");
    }
    this.#audio.setAudioAllowed(audioAllowed);
  }

  close(): void {
    this.#open = false;
    this.stop();
    this.#events?.abort();
    this.#events = null;
    this.#status = null;
    this.#stop = null;
    this.#options.root.replaceChildren();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.close();
    this.#disposed = true;
    this.#audio.dispose();
  }
}
