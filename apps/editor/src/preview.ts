import type { StoryContent } from "../../../packages/story-model/src/model.ts";
import type { Clock } from "../../../packages/player/src/clock.ts";
import { createGameSession } from "../../../packages/player/src/session.ts";
import type { GameSession, SessionView } from "../../../packages/player/src/session.ts";
import { WebPresentation } from "../../../packages/player/src/web/presentation.ts";
import { createResourceAccess } from "../../../packages/player/src/web/resources.ts";
import { authorButtonPreferences } from "../../../packages/player/src/button-preferences.ts";
import { connectButtonSounds } from "../../../packages/player/src/web/button-sounds.ts";
import type { AuthorDocument } from "./document.ts";
import { whaleSkin } from "virtual:haifeng-appearance";
import { applyAuthorAppearance } from "../../../packages/player/src/web/appearance.ts";
import { ChoicePanel } from "../../../packages/player/src/web/choices.ts";
import { connectStageLayout } from "../../../packages/player/src/web/stage-layout.ts";

export interface PreviewElements {
  stage: HTMLElement; scene: HTMLElement; choices: HTMLElement;
  note: HTMLElement; status: HTMLElement; debug: HTMLElement;
  next: HTMLButtonElement; pause: HTMLButtonElement; auto: HTMLButtonElement;
  audio: HTMLButtonElement; retry: HTMLButtonElement; stop: HTMLButtonElement;
}

/** Owns only preview lifecycle. Story transitions remain in the shared session. */
export class EditorPreview {
  readonly #elements: PreviewElements;
  readonly #layout: { dispose(): void };
  readonly #choices: ChoicePanel;
  readonly #events = new AbortController();
  #session: GameSession | null = null;
  #presentation: WebPresentation | null = null;
  #generation = 0;
  #activeNote = "";
  #buttonSoundsEnabled = true;

  constructor(elements: PreviewElements) {
    this.#elements = elements;
    this.#choices = new ChoicePanel(elements.choices, (token, choiceId) => {
      this.#presentation?.unlockAudio();
      this.#session?.send({ type: "choose", token, choiceId });
    });
    this.#layout = connectStageLayout(elements.stage);
    const { signal } = this.#events;
    connectButtonSounds({
      buttons: [elements.next, elements.pause, elements.auto, elements.audio, elements.retry, elements.stop],
      signal,
      enabled: () => {
        if (document.hidden || !this.#buttonSoundsEnabled || !this.#session) return false;
        const view = this.#session.view();
        return !view.disposed && !view.skipping && view.story.phase !== "ended" && view.paused.length === 0;
      },
      play: cue => this.#presentation?.interaction({ type: "cue", cue }),
    });
    const sendNext = (): void => {
      const current = this.#session;
      if (current) current.send({ type: "next", token: current.view().token });
    };
    elements.next.addEventListener("click", sendNext, { signal });
    elements.scene.addEventListener("click", sendNext, { signal });
    elements.pause.addEventListener("click", () => {
      const current = this.#session;
      if (current) current.send({ type: "pause", reason: "menu", paused: !current.view().paused.includes("menu") });
    }, { signal });
    elements.auto.addEventListener("click", () => {
      const current = this.#session;
      if (current) current.send({ type: "auto", enabled: !current.view().auto });
    }, { signal });
    elements.audio.addEventListener("click", () => this.#presentation?.unlockAudio(), { signal });
    elements.retry.addEventListener("click", () => this.#session?.send({ type: "retry" }), { signal });
    elements.stop.addEventListener("click", () => this.stop(), { signal });
    document.addEventListener("visibilitychange", () => this.#session?.send({
      type: "pause", reason: "background", paused: document.hidden,
    }), { signal });
  }

  get running(): boolean { return this.#session !== null; }

  start(draft: AuthorDocument, selectedNode: string | null): void {
    this.stop();
    const { content, locations } = draft;
    this.#buttonSoundsEnabled = authorButtonPreferences(content.source.settings).enabled;
    if (selectedNode && !content.nodes.some(node => node.id === selectedNode)) throw new Error("预览节点不存在");
    const source: StoryContent = selectedNode
      ? { ...content, entryNodeId: selectedNode, revision: `editor-preview:${selectedNode}:${content.revision}` }
      : content;
    const initial = { variables: Object.fromEntries(source.variables.map(variable => [variable.name, variable.initial])),
      player: { "周目": 1, "结局数": 0 } };
    this.#activeNote = selectedNode
      ? `所选节点 ${selectedNode} 的人工初始条件预览：使用全部声明初值、周目 1、结局数 0，再正常执行该节点进入动作。不是此前真实路线进度。`
      : "正常开局草稿预览：从作品入口开始，使用声明初值、周目 1、结局数 0。成果与已读仅保留在本次预览内存中。";
    this.#elements.note.textContent = this.#activeNote;
    this.#elements.debug.textContent = JSON.stringify({ initial, contentRevision: content.revision }, null, 2);
    const clock: Clock = {
      now: () => performance.now(),
      schedule(delay, callback) { const id = window.setTimeout(callback, delay); return () => window.clearTimeout(id); },
    };
    const generation = ++this.#generation;
    const resources = createResourceAccess(source, locations);
    applyAuthorAppearance(this.#elements.stage, source, resources, whaleSkin.artwork);
    const presentation = new WebPresentation(this.#elements.scene, source, resources, true, undefined, undefined, whaleSkin.artwork);
    this.#presentation = presentation;
    try {
      this.#session = createGameSession({
        content: source, player: initial.player, generation, clock, presentation, seen: new Set<string>(),
        initialPauses: document.hidden ? ["background"] : [],
        onChange: view => {
          if (generation !== this.#generation) return;
          this.render(view, initial);
        },
      });
      presentation.unlockAudio();
    } catch (error: unknown) {
      this.stop();
      throw error;
    }
  }

  private render(view: SessionView, initial: unknown): void {
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
    this.#choices.render(view);
  }

  draftChanged(): void {
    if (this.#session) this.#elements.note.textContent = `${this.#activeNote} 此后草稿有变；当前画面仍使用启动时的修订，请重新预览以采用。`;
  }

  stop(): void {
    ++this.#generation;
    this.#session?.dispose();
    this.#presentation?.dispose();
    this.#session = null;
    this.#presentation = null;
    const e = this.#elements;
    e.scene.replaceChildren();
    this.#choices.clear();
    e.scene.classList.remove("paused");
    for (const button of [e.next, e.pause, e.auto, e.audio, e.retry, e.stop]) button.disabled = true;
    e.auto.setAttribute("aria-pressed", "false");
    e.note.textContent = "预览不读取或写入玩家存档、全局解锁和聊天记录。";
    e.status.textContent = "预览已停止。";
  }

  dispose(): void {
    this.stop();
    this.#choices.dispose();
    this.#layout.dispose();
    this.#events.abort();
  }
}
