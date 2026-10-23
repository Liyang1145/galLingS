import type { Clock } from "../../../packages/player/src/clock.ts";
import { createGameSession } from "../../../packages/player/src/session.ts";
import type { GameSession, RestoreVoice, SessionView } from "../../../packages/player/src/session.ts";
import { WebPresentation } from "../../../packages/player/src/web/presentation.ts";
import { createResourceAccess } from "../../../packages/player/src/web/resources.ts";
import { authorButtonPreferences } from "../../../packages/player/src/button-preferences.ts";
import { connectButtonSounds } from "../../../packages/player/src/web/button-sounds.ts";
import type { AuthorDocument } from "./document.ts";
import { whaleSkin } from "virtual:haifeng-appearance";
import { applyAuthorAppearance } from "../../../packages/player/src/web/appearance.ts";
import { ChoicePanel } from "../../../packages/player/src/web/choices.ts";
import { connectStageLayout } from "../../../packages/player/src/web/stage-layout.ts";
import { PlayerInput } from "../../../packages/player/src/web/input.ts";
import { PlayerFullscreen } from "../../../packages/player/src/web/fullscreen.ts";
import { EndingPanel } from "../../../packages/player/src/web/ending.ts";
import { StageFade } from "../../../packages/player/src/web/stage-fade.ts";
import { capturePreviewCheckpoint, inspectPreviewCheckpoint, previewContent } from "./checkpoint.ts";
import type { PreviewCheckpointInput, PreviewCheckpointRecord } from "./checkpoint.ts";

export type PreviewStart =
  | { readonly kind: "entry" }
  | { readonly kind: "selected"; readonly nodeId: string }
  | { readonly kind: "checkpoint"; readonly input: PreviewCheckpointInput; readonly voice: RestoreVoice };

export interface PreviewElements {
  stage: HTMLElement; scene: HTMLElement; choices: HTMLElement;
  note: HTMLElement; status: HTMLElement; debug: HTMLElement;
  next: HTMLButtonElement; pause: HTMLButtonElement; auto: HTMLButtonElement;
  audio: HTMLButtonElement; retry: HTMLButtonElement; stop: HTMLButtonElement;
  controls: HTMLElement; hide: HTMLButtonElement;
  surface: HTMLElement; fullscreen: HTMLButtonElement; fullscreenStatus: HTMLElement;
  changed(): void;
  stopped(): void;
}

/** Owns only preview lifecycle. Story transitions remain in the shared session. */
export class EditorPreview {
  readonly #elements: PreviewElements;
  readonly #layout: { dispose(): void };
  readonly #choices: ChoicePanel;
  readonly #input: PlayerInput;
  readonly #fullscreen: PlayerFullscreen;
  readonly #ending: EndingPanel;
  readonly #fade: StageFade;
  readonly #events = new AbortController();
  #endingVisualKey = "";
  #session: GameSession | null = null;
  #presentation: WebPresentation | null = null;
  #generation = 0;
  #activeNote = "";
  #buttonSoundsEnabled = true;
  #context: { document: AuthorDocument; selectedEntry: string | null } | null = null;

  constructor(elements: PreviewElements) {
    this.#elements = elements;
    this.#ending = new EndingPanel(elements.stage, {
      leaveLabel: "停止预览",
      leave: token => {
        const view = this.#session?.view();
        if (view?.story.phase === "ended" && view.token.session === token.session
          && view.token.epoch === token.epoch && view.token.step === token.step) this.stop();
      },
    });
    this.#fade = new StageFade({
      stage: elements.stage,
      layers: () => [elements.scene, elements.choices, ...elements.stage.querySelectorAll<HTMLElement>(":scope > .ending-panel")],
      enabled: () => !document.hidden && this.#session !== null && !this.#session.view().skipping,
      issue: message => { elements.status.textContent += ` · 界面过渡未能完成：${message}`; },
    });
    this.#choices = new ChoicePanel(elements.choices, (token, choiceId) => {
      this.#presentation?.unlockAudio();
      this.#session?.send({ type: "choose", token, choiceId });
    });
    this.#layout = connectStageLayout(elements.stage);
    this.#input = new PlayerInput({
      stage: elements.stage, scene: elements.scene, choices: elements.choices,
      controls: elements.controls, hide: elements.hide, keyboardScopes: [elements.stage, elements.controls],
      session: () => this.#session, enabled: () => !document.hidden,
      unlockAudio: () => this.#presentation?.unlockAudio(),
      menu: () => {
        const current = this.#session;
        if (current) current.send({ type: "pause", reason: "menu", paused: !current.view().paused.includes("menu") });
      },
    });
    this.#fullscreen = new PlayerFullscreen({
      root: elements.surface, surface: elements.surface, button: elements.fullscreen, status: elements.fullscreenStatus,
      keyboardScopes: [elements.surface], enabled: () => this.#session !== null,
      changed: () => { this.#input.reset(); this.#fade.cancel(); },
    });
    const { signal } = this.#events;
    connectButtonSounds({
      buttons: [elements.next, elements.pause, elements.auto, elements.audio, elements.retry, elements.stop, elements.hide, elements.fullscreen],
      signal,
      enabled: () => {
        if (document.hidden || !this.#buttonSoundsEnabled || !this.#session) return false;
        const view = this.#session.view();
        return !view.disposed && !view.skipping && view.story.phase !== "ended" && view.paused.length === 0;
      },
      play: cue => this.#presentation?.interaction({ type: "cue", cue }),
    });
    elements.next.addEventListener("click", () => this.#input.next(), { signal });
    elements.pause.addEventListener("click", () => this.#input.menu(), { signal });
    elements.auto.addEventListener("click", () => this.#input.toggleAuto(), { signal });
    elements.audio.addEventListener("click", () => this.#presentation?.unlockAudio(), { signal });
    elements.retry.addEventListener("click", () => this.#session?.send({ type: "retry" }), { signal });
    elements.stop.addEventListener("click", () => this.stop(), { signal });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.#fade.cancel();
      this.#session?.send({ type: "pause", reason: "background", paused: document.hidden });
    }, { signal });
  }

  get running(): boolean { return this.#session !== null; }
  get canCheckpoint(): boolean { return this.#session?.view().canCheckpoint ?? false; }

  start(draft: AuthorDocument, start: PreviewStart): PreviewCheckpointRecord | null {
    const { content, locations } = draft;
    const restored = start.kind === "checkpoint" ? inspectPreviewCheckpoint(content, start.input) : null;
    if (start.kind === "checkpoint" && !["silent", "replay", "resume"].includes(start.voice)) {
      throw new Error("请选择本次检查点预览的语音方式");
    }
    const selectedNode = start.kind === "selected" ? start.nodeId : restored?.record.selectedEntry ?? null;
    const source = restored?.content ?? previewContent(content, selectedNode);
    const buttonSoundsEnabled = authorButtonPreferences(content.source.settings).enabled;
    const resources = createResourceAccess(source, locations);
    const initial = {
      variables: restored?.view.variables ?? Object.fromEntries(source.variables.map(variable => [variable.name, variable.initial])),
      player: restored?.view.player ?? { "周目": 1, "结局数": 0 },
      checkpoint: restored ? {
        nodeId: restored.view.nodeId, phase: restored.view.phase, timing: restored.checkpoint.timing,
        controls: restored.checkpoint.controls,
        playback: restored.checkpoint.presentation.playback, voice: start.kind === "checkpoint" ? start.voice : null,
      } : null,
    };
    // All external checkpoint preparation happens before cancelling the old preview.
    this.stop();
    this.#buttonSoundsEnabled = buttonSoundsEnabled;
    this.#activeNote = restored
      ? `检查点预览：恢复 ${restored.view.nodeId} 的已生效变量、完整文字及剩余有效时间，不重执行进入动作。使用保存时玩家投影（周目 ${initial.player["周目"]}、结局数 ${initial.player["结局数"]}），不读取正式记录；本次语音：${start.kind === "checkpoint" ? start.voice : ""}。`
      : selectedNode
      ? `所选节点 ${selectedNode} 的人工初始条件预览：使用全部声明初值、周目 1、结局数 0，再正常执行该节点进入动作。不是此前真实路线进度。`
      : "正常开局草稿预览：从作品入口开始，使用声明初值、周目 1、结局数 0。成果与已读仅保留在本次预览内存中。";
    this.#elements.note.textContent = this.#activeNote;
    this.#elements.debug.textContent = JSON.stringify({ initial, contentRevision: content.revision }, null, 2);
    const clock: Clock = {
      now: () => performance.now(),
      schedule(delay, callback) { const id = window.setTimeout(callback, delay); return () => window.clearTimeout(id); },
    };
    const generation = ++this.#generation;
    applyAuthorAppearance(this.#elements.stage, source, resources, whaleSkin.artwork);
    const presentation = new WebPresentation(this.#elements.scene, source, resources, true, undefined, undefined,
      whaleSkin.artwork, { stage: this.#elements.stage, choices: this.#elements.choices });
    this.#presentation = presentation;
    this.#context = { document: draft, selectedEntry: selectedNode };
    try {
      this.#session = createGameSession({
        content: source, player: initial.player, generation, clock, presentation, seen: new Set<string>(),
        ...(restored && start.kind === "checkpoint" ? { resume: { checkpoint: restored.checkpoint, voice: start.voice } } : {}),
        initialPauses: document.hidden ? ["background"] : [],
        onChange: view => {
          if (generation !== this.#generation) return;
          this.render(view, initial);
        },
      });
      this.#input.refresh();
      this.#fullscreen.refresh();
      presentation.unlockAudio();
      this.#elements.changed();
      return restored?.record ?? null;
    } catch (error: unknown) {
      this.stop();
      throw error;
    }
  }

  async captureCheckpoint(): Promise<PreviewCheckpointRecord> {
    const owner = this.#session;
    const context = this.#context;
    const generation = this.#generation;
    if (!owner || !context) throw new Error("尚未运行预览");
    const result = await owner.captureCheckpoint(owner.view().token);
    if (owner !== this.#session || generation !== this.#generation) throw new Error("预览已变化，未采用旧检查点");
    if (!result.accepted) throw new Error(`${result.code}：${result.message}`);
    return capturePreviewCheckpoint(context.document.content, context.selectedEntry, result.checkpoint);
  }

  private render(view: SessionView, initial: unknown): void {
    this.#input.refresh();
    this.#fullscreen.refresh();
    const e = this.#elements;
    const active = !view.disposed && view.story.phase !== "ended";
    e.next.disabled = !active || view.paused.length > 0 || view.story.phase === "choosing";
    e.pause.disabled = e.auto.disabled = e.audio.disabled = !active;
    e.retry.disabled = !active || !view.problem;
    e.stop.disabled = false;
    e.pause.textContent = view.paused.includes("menu") ? "继续预览" : "暂停预览";
    e.auto.setAttribute("aria-pressed", String(view.auto));
    e.scene.classList.toggle("paused", view.paused.length > 0);
    e.status.textContent = [
      `${view.story.chapter} · ${view.story.nodeId} · ${view.story.phase}`,
      view.choiceRemainingMs === null ? "" : `剩余 ${(view.choiceRemainingMs / 1000).toFixed(1)} 秒`,
      view.paused.length ? `暂停：${view.paused.join("、")}` : "",
      view.problem ? `${view.problem.code}：${view.problem.message}` : "",
      view.story.terminal ? JSON.stringify(view.story.terminal) : "",
    ].filter(Boolean).join("；");
    e.debug.textContent = JSON.stringify({ initial, current: view.story.variables, player: view.story.player,
      token: view.token }, null, 2);
    const terminal = view.story.terminal;
    const visualKey = !view.disposed && view.story.phase === "ended" && terminal
      ? JSON.stringify([view.token.session, terminal]) : "";
    if (visualKey && visualKey !== this.#endingVisualKey) this.#fade.begin();
    this.#endingVisualKey = visualKey;
    this.#choices.render(view);
    this.#ending.render(view, { kind: "preview", message: "草稿预览已到达此结局；不写玩家解锁、通关次数或正式记录。" });
    if (view.disposed || view.skipping || view.problem?.blocking || view.paused.includes("background")) this.#fade.cancel();
    this.#elements.changed();
  }

  draftChanged(): void {
    if (this.#session) this.#elements.note.textContent = `${this.#activeNote} 此后草稿有变；当前画面仍使用启动时的修订，请重新预览以采用。`;
  }

  stop(): void {
    this.#fade.cancel();
    this.#endingVisualKey = "";
    ++this.#generation;
    this.#input.reset();
    this.#fullscreen.reset();
    this.#session?.dispose();
    this.#presentation?.dispose();
    this.#session = null;
    this.#presentation = null;
    this.#context = null;
    this.#elements.stopped();
    const e = this.#elements;
    e.scene.replaceChildren();
    this.#choices.clear();
    this.#ending.clear();
    e.scene.classList.remove("paused");
    for (const button of [e.next, e.pause, e.auto, e.audio, e.retry, e.stop]) button.disabled = true;
    e.auto.setAttribute("aria-pressed", "false");
    e.note.textContent = "预览不读取或写入玩家存档、全局解锁和聊天记录。";
    e.status.textContent = "预览已停止。";
    this.#input.refresh();
    this.#fullscreen.refresh();
    this.#elements.changed();
  }

  dispose(): void {
    this.stop();
    this.#input.dispose();
    this.#fullscreen.dispose();
    this.#choices.dispose();
    this.#ending.dispose();
    this.#fade.dispose();
    this.#layout.dispose();
    this.#events.abort();
  }
}
