import { AUDIO_CHANNELS, readAudioVolumes } from "../../../packages/player/src/preferences.ts";
import type {
  AudioChannel, AudioPreferenceChange, AudioPreferenceRepository, AudioVolumes,
} from "../../../packages/player/src/preferences.ts";

type Entry = "main" | "timed";
const LABELS: Record<AudioChannel, string> = { music: "配乐", ambience: "环境声", voice: "语音", effects: "音效" };

interface Options {
  root: HTMLElement;
  repository: AudioPreferenceRepository;
  defaults: AudioVolumes;
  blocked(): boolean;
  trackWrite(operation: () => Promise<void>): Promise<void>;
  volumesChanged(volumes: AudioVolumes): void;
}

/** Explicit preference writes; live adjustment never captures or mutates progress. */
export class AudioPreferencesPanel {
  readonly #options: Options;
  readonly #defaults: AudioVolumes;
  readonly #events = new AbortController();
  readonly #inputs = new Map<AudioChannel, { input: HTMLInputElement; output: HTMLOutputElement }>();
  readonly #status: HTMLParagraphElement;
  readonly #save: HTMLButtonElement;
  readonly #reset: HTMLButtonElement;
  readonly #retry: HTMLButtonElement;
  #main: AudioVolumes;
  #timed: AudioVolumes;
  #dirty: AudioPreferenceChange = {};
  #mode: Entry = "main";
  #saving = false;
  #reading = false;
  #disposed = false;
  #loadEpoch = 0;
  #message = "音量偏好尚未读取，当前使用作者默认。";
  #retryOperation: (() => Promise<void>) | null = null;

  constructor(options: Options) {
    this.#options = options;
    this.#defaults = readAudioVolumes(options.defaults);
    this.#main = { ...this.#defaults };
    this.#timed = { ...this.#defaults };
    const heading = document.createElement("h2");
    heading.textContent = "声音设置";
    const note = document.createElement("p");
    note.textContent = "调整立即用于本次播放；保存音量可在下次游玩时沿用。音量与剧情进度分开，读档和回退不会恢复旧音量。";
    const controls = document.createElement("div");
    controls.className = "audio-preferences-grid";
    const { signal } = this.#events;
    for (const channel of AUDIO_CHANNELS) {
      const label = document.createElement("label");
      const text = document.createElement("span");
      text.textContent = LABELS[channel];
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "1";
      input.step = "0.05";
      input.setAttribute("aria-label", `${LABELS[channel]}音量`);
      const output = document.createElement("output");
      this.#inputs.set(channel, { input, output });
      input.addEventListener("input", () => {
        if (this.#saving || this.#reading || this.#disposed || options.blocked()) return;
        const values = readAudioVolumes({ ...this.values(this.#mode), [channel]: input.valueAsNumber });
        if (this.#mode === "main") {
          this.#main = values;
          this.#dirty[channel] = values[channel];
          this.#message = "音量已用于本次播放，尚未保存。";
        } else this.#timed = values;
        options.volumesChanged(values);
        this.render();
      }, { signal });
      label.append(text, input, output);
      controls.append(label);
    }
    this.#save = document.createElement("button");
    this.#save.type = "button";
    this.#save.textContent = "保存音量偏好";
    this.#save.addEventListener("click", () => this.save(), { signal });
    this.#reset = document.createElement("button");
    this.#reset.type = "button";
    this.#reset.textContent = "使用作者默认音量";
    this.#reset.addEventListener("click", () => {
      if (this.#saving || this.#reading || this.#disposed || options.blocked()) return;
      if (this.#mode === "main") {
        this.#main = { ...this.#defaults };
        this.#dirty = { music: null, ambience: null, voice: null, effects: null };
        this.#message = "本次播放已使用作者默认音量；点击保存后，下次也会跟随作者默认。";
      } else this.#timed = { ...this.#defaults };
      options.volumesChanged(this.values(this.#mode));
      this.render();
    }, { signal });
    this.#retry = document.createElement("button");
    this.#retry.type = "button";
    this.#retry.textContent = "重试上次音量保存";
    this.#retry.addEventListener("click", () => {
      if (this.#retryOperation) void this.run(this.#retryOperation);
    }, { signal });
    const actions = document.createElement("div");
    actions.className = "controls";
    actions.append(this.#save, this.#reset, this.#retry);
    this.#status = document.createElement("p");
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    options.root.replaceChildren(heading, note, controls, actions, this.#status);
    this.render();
  }

  values(entry: Entry): AudioVolumes { return { ...(entry === "main" ? this.#main : this.#timed) }; }

  setMode(entry: Entry): void {
    this.#mode = entry;
    this.#options.volumesChanged(this.values(entry));
    this.render();
  }

  refresh(): void { this.render(); }

  async load(): Promise<void> {
    const epoch = ++this.#loadEpoch;
    this.#reading = true;
    this.#message = "正在读取已保存的音量偏好……";
    this.render();
    let timer = 0;
    let aborted: () => void = () => {};
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = window.setTimeout(() => reject(new Error("音量偏好读取超过 5 秒，本次先使用作者默认；原记录未重置")), 5000);
      aborted = () => reject(new Error("页面已离开，取消采用音量偏好"));
      this.#events.signal.addEventListener("abort", aborted, { once: true });
    });
    try {
      const state = await Promise.race([this.#options.repository.read(), deadline]);
      if (this.#disposed || epoch !== this.#loadEpoch) return;
      this.#main = { ...state.volumes };
      this.#message = "已读取声音偏好；调整后需点击保存，才会用于下次游玩。";
      this.#options.volumesChanged(this.values(this.#mode));
    } catch (error: unknown) {
      if (!this.#disposed && epoch === this.#loadEpoch) {
        this.#message = `音量偏好未采用：${error instanceof Error ? error.message : "存储不可用"}。本次可继续调音，已有记录未被替换。`;
      }
    } finally {
      window.clearTimeout(timer);
      this.#events.signal.removeEventListener("abort", aborted);
      if (!this.#disposed && epoch === this.#loadEpoch) { this.#reading = false; this.render(); }
    }
  }

  private save(): void {
    if (this.#mode !== "main" || this.#saving || this.#reading || this.#disposed
      || this.#options.blocked() || !Object.keys(this.#dirty).length) return;
    const changes = { ...this.#dirty };
    const operation = async (): Promise<void> => {
      this.#saving = true;
      this.#message = "正在保存本次选定的音量……";
      this.render();
      try {
        const saved = await this.#options.repository.update(changes);
        if (!this.#disposed) {
          for (const channel of AUDIO_CHANNELS) {
            if (Object.hasOwn(changes, channel) && this.#dirty[channel] === changes[channel]) {
              delete this.#dirty[channel];
            }
          }
          const values = { ...saved.volumes };
          for (const channel of AUDIO_CHANNELS) {
            const remaining = this.#dirty[channel];
            if (remaining !== undefined) values[channel] = remaining === null ? this.#defaults[channel] : remaining;
          }
          this.#main = values;
          this.#retryOperation = null;
          this.#message = Object.keys(this.#dirty).length
            ? "上次选定的音量已保存；后续调整仍用于本次播放，尚未保存。"
            : "音量偏好已保存；剧情进度与全局成果未改变。";
          this.#options.volumesChanged(this.values(this.#mode));
        }
      } catch (error: unknown) {
        if (!this.#disposed) {
          this.#retryOperation = operation;
          this.#message = `音量尚未保存：${error instanceof Error ? error.message : "存储失败"}。可重试原调整；当前音量仅用于本次播放。`;
        }
        throw error;
      } finally { this.#saving = false; this.render(); }
    };
    void this.run(operation);
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    if (this.#saving || this.#reading || this.#disposed || this.#options.blocked()) return;
    this.#saving = true;
    this.render();
    try { await this.#options.trackWrite(operation); }
    catch { /* The captured operation reports its own failure; the write tracker retains it. */ }
    finally { this.#saving = false; this.render(); }
  }

  private render(): void {
    if (this.#disposed) return;
    const disabled = this.#saving || this.#reading || this.#options.blocked();
    const volumes = this.values(this.#mode);
    for (const [channel, item] of this.#inputs) {
      item.input.value = String(volumes[channel]);
      item.input.disabled = disabled;
      item.output.value = `${Math.round(volumes[channel] * 100)}%`;
    }
    this.#save.disabled = disabled || this.#mode !== "main" || !Object.keys(this.#dirty).length;
    this.#reset.disabled = disabled;
    this.#retry.hidden = !this.#retryOperation || this.#mode !== "main";
    this.#retry.disabled = disabled;
    this.#status.textContent = this.#mode === "timed"
      ? "限时样例的音量只留在本页内存，不读取或改写正常游玩的音量偏好。" : this.#message;
  }

  dispose(): void {
    this.#disposed = true;
    ++this.#loadEpoch;
    this.#events.abort();
  }
}
