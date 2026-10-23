import type { JsonObject } from "../../../packages/story-model/src/model.ts";
import type { DialogueEntry, RestoreVoice, RollbackResult } from "../../../packages/player/src/session.ts";
import type { RollbackTarget } from "../../../packages/player/src/rollback.ts";
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
  canRollback(): boolean;
  rollback(request: { targetId: number; voice: RestoreVoice; crossChoices: boolean }, signal: AbortSignal): Promise<RollbackResult>;
}

/** Detached history, independent voice and explicit rollback intents; no core or checkpoint access. */
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
  readonly #voice = document.createElement("select");
  readonly #boundary = document.createElement("select");
  readonly #rollbackStatus = document.createElement("p");
  readonly #rollbackButtons: HTMLButtonElement[] = [];
  readonly #voiceButtons: HTMLButtonElement[] = [];
  #rollingBack = false;

  constructor(options: DialoguePanelOptions) {
    this.#options = options;
    this.#audio = new AudioMixer(options.resources, options.settings, options.audioAllowed, options.volumes);
  }

  open(entries: readonly DialogueEntry[], targets: readonly RollbackTarget[]): void {
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
    const rollbackControls = document.createElement("fieldset");
    rollbackControls.className = "dialogue-rollback-controls";
    const legend = document.createElement("legend");
    legend.textContent = "从记录回退";
    this.#voice.replaceChildren(new Option("请选择本次语音方式", ""),
      new Option("不播放目标句", "silent"), new Option("从头播放目标句", "replay"), new Option("按检查点位置续播", "resume"));
    this.#boundary.replaceChildren(new Option("请选择本次回退范围", ""),
      new Option("仅当前选择之后的片段", "within"), new Option("允许跨选择回退", "across"));
    const voiceLabel = document.createElement("label");
    voiceLabel.append("恢复语音", this.#voice);
    const boundaryLabel = document.createElement("label");
    boundaryLabel.append("回退范围", this.#boundary);
    this.#rollbackStatus.setAttribute("role", "status");
    this.#rollbackStatus.setAttribute("aria-live", "polite");
    this.#rollbackStatus.textContent = "请先选本次范围和语音方式，再点击条目回退；已解锁成果保留。当前句显示完整、画面就绪后才可操作，结局后暂不支持。";
    rollbackControls.append(legend, voiceLabel, boundaryLabel, this.#rollbackStatus);
    this.#voice.addEventListener("change", () => this.refreshRollback(), { signal });
    this.#boundary.addEventListener("change", () => this.refreshRollback(), { signal });
    const rollbackTargets = new Map<number, RollbackTarget>(targets.map(target => [target.id, target]));
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
        this.#voiceButtons.push(button);
      }
      const target = rollbackTargets.get(entry.visitId);
      if (target) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = entry.kind === "choice" ? "回到此选择之前" : "回到此处";
        button.setAttribute("aria-label", `${button.textContent}：${entry.text.slice(0, 40)}${target.crossesChoice ? "（跨选择）" : ""}`);
        button.addEventListener("click", () => { void this.rollback(target.id); }, { signal });
        item.append(button);
        this.#rollbackButtons.push(button);
        if (target.crossesChoice) {
          const boundary = document.createElement("small");
          boundary.textContent = "此处需要跨选择回退";
          item.append(boundary);
        }
      }
      list.append(item);
    }
    root.append(controls, rollbackControls);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.textContent = "这里会留下本次游玩中已经出现的对白和选择。";
      root.append(empty);
    } else root.append(list);
    this.refreshRollback();
  }

  private play(button: HTMLButtonElement, voiceId: string): void {
    if (!this.#open || this.#disposed || this.#rollingBack) return;
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

  private refreshRollback(): void {
    const blocked = !this.#open || this.#disposed || this.#rollingBack || !this.#options.canRollback();
    this.#voice.disabled = this.#boundary.disabled = this.#rollingBack;
    const policy = ["silent", "replay", "resume"].includes(this.#voice.value)
      && ["within", "across"].includes(this.#boundary.value);
    for (const button of this.#rollbackButtons) button.disabled = blocked || !policy;
    for (const button of this.#voiceButtons) button.disabled = this.#rollingBack;
  }

  private async rollback(targetId: number): Promise<void> {
    const events = this.#events;
    const voice = this.#voice.value;
    const boundary = this.#boundary.value;
    if (!events || events.signal.aborted || !this.#open || this.#disposed || this.#rollingBack || !this.#options.canRollback()
      || (voice !== "silent" && voice !== "replay" && voice !== "resume")
      || (boundary !== "within" && boundary !== "across")) return;
    this.stop("历史语音已停止，正在准备回退。");
    this.#rollingBack = true;
    this.refreshRollback();
    this.#rollbackStatus.textContent = "正在准备所选检查点与当前全局成果；关闭回看可取消尚未采用的回退。";
    const current = (): boolean => this.#open && !this.#disposed && this.#events === events && !events.signal.aborted;
    try {
      const result = await this.#options.rollback({ targetId, voice, crossChoices: boundary === "across" }, events.signal);
      if (!current()) return;
      this.#rollbackStatus.textContent = result.accepted
        ? `已恢复到 ${result.nodeId}；后续路线记录已截断，全局成果保留。`
        : `${result.code}：${result.message}。本次回退未采用，可以调整设置或关闭回看。`;
    } catch (error: unknown) {
      if (current()) this.#rollbackStatus.textContent = `回退请求未完成：${error instanceof Error ? error.message : "请求失败"}。请查看当前剧情状态。`;
    } finally {
      if (current()) { this.#rollingBack = false; this.refreshRollback(); }
    }
  }

  refresh(audioAllowed: boolean): void {
    if (this.#disposed) return;
    // Cancel before granting a new permission, so a stale track cannot auto-resume.
    if (this.#selected && !this.#options.available()) {
      this.stop("历史语音已停止；窗口或声音许可恢复后，请再次点击本条语音。");
    }
    this.#audio.setAudioAllowed(audioAllowed);
    this.refreshRollback();
  }

  close(): void {
    this.#open = false;
    this.stop();
    this.#events?.abort();
    this.#events = null;
    this.#status = null;
    this.#stop = null;
    this.#rollingBack = false;
    this.#rollbackButtons.length = this.#voiceButtons.length = 0;
    this.#options.root.replaceChildren();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.close();
    this.#disposed = true;
    this.#audio.dispose();
  }
}
