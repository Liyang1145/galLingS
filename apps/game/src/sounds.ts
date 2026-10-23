import type { StoryContent } from "../../../packages/story-model/src/model.ts";
import { LIBRARY_CATEGORIES, readAudioLibrary } from "../../../packages/player/src/audio-library.ts";
import type { LibraryCategory, LibraryEntry } from "../../../packages/player/src/audio-library.ts";
import type { AudioVolumes } from "../../../packages/player/src/preferences.ts";
import { AudioMixer } from "../../../packages/player/src/web/audio.ts";
import type { ResourceAccess } from "../../../packages/player/src/web/resources.ts";

interface Options {
  root: HTMLElement;
  content: StoryContent;
  resources: ResourceAccess;
  volumes: AudioVolumes;
  audioAllowed: boolean;
  available(): boolean;
  paused(): boolean;
  requestAudio(): void;
}
const LABELS: Readonly<Record<LibraryCategory, string>> = { music: "配乐", ambience: "环境", effect: "音效" };
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = text;
  result.className = className;
  return result;
}
function action(text: string): HTMLButtonElement {
  const result = element("button", text);
  result.type = "button";
  return result;
}

/** Read-only local collection. It owns no story, checkpoint, achievements or preference repository. */
export class SoundLibraryPanel {
  readonly #options: Options;
  readonly #entries: readonly LibraryEntry[];
  readonly #audio: AudioMixer;
  readonly #buttons = new Map<HTMLButtonElement, LibraryEntry>();
  #events: AbortController | null = null;
  #status: HTMLParagraphElement | null = null;
  #stop: HTMLButtonElement | null = null;
  #enable: HTMLButtonElement | null = null;
  #selected: { button: HTMLButtonElement; entry: LibraryEntry } | null = null;
  #cancel: (() => void) | null = null;
  #epoch = 0;
  #open = false;
  #disposed = false;
  #paused = true;
  #audioAllowed: boolean;

  constructor(options: Options) {
    this.#options = options;
    this.#entries = readAudioLibrary(options.content);
    this.#audio = new AudioMixer(options.resources, options.content.source.settings, options.audioAllowed, options.volumes);
    this.#audio.setPaused(true);
    this.#audioAllowed = options.audioAllowed;
  }

  get isOpen(): boolean { return this.#open; }

  open(): void {
    if (this.#disposed) throw new Error("声音收藏已离开");
    this.close();
    this.#open = true;
    this.#events = new AbortController();
    const { signal } = this.#events;
    const nav = element("nav", "", "sound-tabs");
    nav.setAttribute("aria-label", "声音分类");
    const tabs = new Map<LibraryCategory, HTMLButtonElement>();
    const panels = new Map<LibraryCategory, HTMLElement>();
    for (const category of LIBRARY_CATEGORIES) {
      const button = action(LABELS[category]);
      button.setAttribute("aria-pressed", String(category === "music"));
      tabs.set(category, button);
      nav.append(button);
      const panel = element("section");
      panel.setAttribute("aria-label", `${LABELS[category]}曲目`);
      panel.hidden = category !== "music";
      panel.append(this.grid(this.#entries.filter(entry => entry.category === category && !entry.auditionOnly), signal));
      panels.set(category, panel);
      button.addEventListener("click", () => {
        if (!this.#open) return;
        for (const [id, tab] of tabs) tab.setAttribute("aria-pressed", String(id === category));
        for (const [id, section] of panels) section.hidden = id !== category;
      }, { signal });
    }
    const controls = element("div", "", "sound-player");
    this.#status = element("p", "选择一段声音开始试听。配乐和环境循环，音效单次；音量沿用当前声音设置。");
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    this.#stop = action("停止试听");
    this.#stop.disabled = true;
    this.#stop.addEventListener("click", () => this.stop("试听已停止。"), { signal });
    this.#enable = action("启用声音 / 重试许可");
    this.#enable.addEventListener("click", () => {
      if (!this.#open || !this.#options.available()) return;
      this.#options.requestAudio();
      if (this.#selected && !this.#paused && this.#audioAllowed) this.#audio.unlock();
      else if (!this.#selected && this.#status) {
        this.#status.textContent = this.#audioAllowed && !this.#paused
          ? "声音已可尝试播放，请点击曲目。"
          : "当前窗口或声音许可尚未就绪；恢复后可再次点击曲目，不会排队补播。";
      }
    }, { signal });
    controls.append(this.#status, this.#stop, this.#enable);
    const archive = element("details", "", "sound-archive");
    archive.append(element("summary", "素材归档 · 候选试听"),
      element("p", "作者标记为候选的原件，保留供制作比较；不代表它们已经用于剧情。"),
      this.grid(this.#entries.filter(entry => entry.auditionOnly), signal));
    this.#options.root.append(nav, controls, ...panels.values(), archive);
    this.refresh(this.#audioAllowed);
  }

  private grid(entries: readonly LibraryEntry[], signal: AbortSignal): HTMLElement {
    const grid = element("div", "", "sound-grid");
    if (!entries.length) { grid.append(element("p", "这一类暂未标记曲目。")); return grid; }
    for (const entry of entries) {
      const button = action("");
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `试听${LABELS[entry.category]}：${entry.name}`);
      const duration = entry.durationSeconds === null ? "时长未标注"
        : `${entry.durationSeconds < 10 ? entry.durationSeconds.toFixed(1) : Math.round(entry.durationSeconds)} 秒（作者标注）`;
      button.append(element("b", entry.name), element("small", `${LABELS[entry.category]} · ${duration}`));
      this.#buttons.set(button, entry);
      button.addEventListener("click", () => this.play(button, entry), { signal });
      grid.append(button);
    }
    return grid;
  }

  private play(button: HTMLButtonElement, entry: LibraryEntry): void {
    if (!this.#open || this.#disposed || !this.#options.available()) return;
    this.stop();
    try {
      this.#options.requestAudio();
      if (this.#paused || !this.#audioAllowed) {
        this.stop("窗口或声音许可尚未就绪；恢复后请再次点击这首曲目，不会稍后补播。");
        return;
      }
      const epoch = ++this.#epoch;
      const current = (): boolean => this.#open && !this.#disposed && epoch === this.#epoch;
      this.#selected = { button, entry };
      button.setAttribute("aria-pressed", "true");
      if (this.#stop) this.#stop.disabled = false;
      if (this.#status) this.#status.textContent = `正在读取本地声音：${entry.name}（${entry.assetId}）……`;
      const cancel = this.#audio.previewLibrary(entry.assetId, {
        started: () => {
          if (!current()) return;
          if (this.#status) this.#status.textContent = this.#paused || !this.#audioAllowed
            ? `试听已暂停：${entry.name}；窗口及声音许可恢复后从原试听位置继续。`
            : `正在试听${LABELS[entry.category]}：${entry.name}${entry.category === "effect" ? "（单次）" : "（循环）"}。`;
        },
        ended: () => { if (current()) this.stop(`播放完毕：${entry.name}。`); },
        problem: problem => {
          if (current()) this.stop(`本条试听未完成：${entry.name}（${entry.assetId}）。${problem.message} 可再次点击原曲目重试。`);
        },
      });
      if (current()) this.#cancel = cancel;
      else cancel();
    } catch (error: unknown) {
      this.stop(`本条试听未播放：${entry.name}（${entry.assetId}）。${error instanceof Error ? error.message : "声音不可用"}。`);
    }
  }

  private stop(message?: string): void {
    ++this.#epoch;
    const cancel = this.#cancel;
    this.#cancel = null;
    this.#selected?.button.setAttribute("aria-pressed", "false");
    this.#selected = null;
    cancel?.();
    if (this.#stop) this.#stop.disabled = true;
    if (message && this.#status) this.#status.textContent = message;
  }

  setVolumes(volumes: AudioVolumes): void { this.#audio.setVolumes(volumes); }

  refresh(audioAllowed: boolean): void {
    if (this.#disposed) return;
    const paused = !this.#open || this.#options.paused() || !audioAllowed;
    const changed = paused !== this.#paused;
    this.#paused = paused;
    this.#audioAllowed = audioAllowed;
    // Pause before permission changes; unpause only after the new permission is installed.
    // This prevents transient denial from settling an effect preview as a finished voice.
    if (changed && paused) this.#audio.setPaused(true);
    this.#audio.setAudioAllowed(audioAllowed);
    if (changed && !paused) this.#audio.setPaused(false);
    if (this.#selected && changed && this.#status) {
      this.#status.textContent = paused
        ? `试听已暂停：${this.#selected.entry.name}；窗口及声音许可恢复后从原试听位置继续，可用“启用声音”重试许可。`
        : `正在接续本地试听：${this.#selected.entry.name}……`;
    }
    const blocked = !this.#open || !this.#options.available();
    for (const button of this.#buttons.keys()) button.disabled = blocked;
    if (this.#enable) this.#enable.disabled = blocked;
  }

  close(): void {
    this.#open = false;
    this.stop();
    this.#audio.setPaused(true);
    this.#paused = true;
    this.#events?.abort();
    this.#events = null;
    this.#buttons.clear();
    this.#status = this.#stop = this.#enable = null;
    this.#options.root.replaceChildren();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.close();
    this.#disposed = true;
    this.#audio.dispose();
  }
}
