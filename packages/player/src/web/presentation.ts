import type { JsonObject, JsonValue, Sprite, StoryContent } from "../../../story-model/src/model.ts";
import type { RuntimeView } from "../../../story-runtime/src/index.ts";
import { ActiveTimer } from "../clock.ts";
import type { Playback, PresentationAdapter, PresentationContext } from "../session.ts";
import { AudioMixer } from "./audio.ts";
import type { EntryAudio } from "./audio.ts";
import type { ResourceAccess } from "./resources.ts";
import { setting } from "./resources.ts";

const LOOKS: Record<string, string> = {
  "": "", none: "", shadow: "brightness(0)",
  mystery: "brightness(.12) contrast(1.3) drop-shadow(0 0 8px rgba(140,170,255,.75))",
  dark: "brightness(.45) saturate(.7)", gray: "grayscale(1) contrast(.9)",
  sepia: "sepia(.85) contrast(.95)", night: "brightness(.7) sepia(.4) hue-rotate(180deg) saturate(1.3)",
  red: "sepia(1) saturate(5) hue-rotate(-50deg) brightness(.75)", blur: "blur(6px)",
  ghost: "opacity(.45) drop-shadow(0 0 10px rgba(200,230,255,.8))",
  glow: "drop-shadow(0 0 12px rgba(255,255,255,.9)) brightness(1.08)",
};
const MOODS = ["", "dizzy", "flicker", "strobe", "blur", "sway", "gray", "dark", "danger", "underwater", "slowmo"];
const FX = ["", "shake", "quake", "flash", "redflash", "blink", "zoom", "whip"];
const ACTIONS = ["jump", "shake", "nod", "lean", "flinch", "settle"];
const ENTRIES = ["", "fade", "left", "right", "up", "pop", "none"];
const EXITS = ["", "fade", "left", "right", "down", "none"];

function record(value: JsonValue | undefined): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function grade(metadata: JsonObject): string {
  const fit = record(metadata.sceneFit);
  const brightness = Math.max(0.6, Math.min(1.2, setting(fit, "brightness", 1)));
  const saturation = Math.max(0.65, Math.min(1.2, setting(fit, "saturation", 1)));
  const warmth = Math.max(-1, Math.min(1, setting(fit, "warmth", 0)));
  return `brightness(${brightness}) saturate(${saturation}) ${warmth > 0 ? `sepia(${warmth * 0.16})` : `hue-rotate(${warmth * 6}deg)`}`;
}

function loadImage(url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cleanup = (): void => {
      image.onload = image.onerror = null;
      signal.removeEventListener("abort", aborted);
    };
    const aborted = (): void => { cleanup(); reject(new DOMException("已取消场景加载", "AbortError")); };
    image.onload = () => { cleanup(); resolve(); };
    image.onerror = () => { cleanup(); reject(new Error("图片无法读取或解码")); };
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) return aborted();
    image.src = url;
  });
}

interface Actor {
  element: HTMLDivElement;
  image: HTMLImageElement;
  sprite: Sprite;
}

/** Web presentation is reusable by game and editor preview; no story writes. */
export class WebPresentation implements PresentationAdapter {
  readonly #root: HTMLElement;
  readonly #world: HTMLDivElement;
  readonly #background: HTMLImageElement;
  readonly #actorsLayer: HTMLDivElement;
  readonly #veil: HTMLDivElement;
  readonly #dialogue: HTMLDivElement;
  readonly #name: HTMLElement;
  readonly #text: HTMLElement;
  readonly #resources: ResourceAccess;
  readonly #content: StoryContent;
  readonly #audio: AudioMixer;
  readonly #actors = new Map<string, Actor>();
  #backgroundId: string | null = null;
  #disposed = false;
  #active: Playback | null = null;

  constructor(root: HTMLElement, content: StoryContent, resources: ResourceAccess, audioAllowed = true) {
    this.#root = root;
    this.#content = content;
    this.#resources = resources;
    this.#world = document.createElement("div");
    this.#world.className = "world";
    this.#background = document.createElement("img");
    this.#background.className = "backdrop";
    this.#background.alt = "";
    this.#actorsLayer = document.createElement("div");
    this.#actorsLayer.className = "actors";
    this.#veil = document.createElement("div");
    this.#veil.className = "veil";
    this.#dialogue = document.createElement("div");
    this.#dialogue.className = "dialogue";
    this.#name = document.createElement("strong");
    this.#name.className = "speaker";
    this.#text = document.createElement("p");
    this.#text.className = "dialogue-text";
    this.#dialogue.append(this.#name, this.#text);
    this.#world.append(this.#background, this.#actorsLayer, this.#veil);
    root.replaceChildren(this.#world, this.#dialogue);
    this.#audio = new AudioMixer(resources, content.source.settings, audioAllowed);
  }

  unlockAudio(): void { this.#audio.unlock(); }
  setAudioAllowed(allowed: boolean): void { this.#audio.setAudioAllowed(allowed); }

  present(view: RuntimeView, context: PresentationContext): Playback {
    if (this.#disposed) throw new Error("表现实例已经离开");
    this.#active?.cancel();
    let paused = context.paused;
    let skipping = context.skipping;
    let cancelled = false;
    let ready = false;
    let textDone = view.phase !== "presenting";
    let finishRequested = textDone || skipping;
    let audio: EntryAudio | null = null;
    let typing: ActiveTimer | null = null;
    const timers = new Set<ActiveTimer>();
    const animations = new Set<Animation>();
    const transients = new Set<HTMLElement>();
    const alive = (): boolean => !cancelled && !this.#disposed && !context.signal.aborted;
    const defer = (milliseconds: number, callback: () => void): ActiveTimer => {
      const timer = new ActiveTimer(context.clock, milliseconds, () => {
        timers.delete(timer);
        if (alive()) callback();
      });
      timers.add(timer);
      timer.setPaused(paused);
      return timer;
    };
    const animate = (element: Element, frames: Keyframe[], duration: number, finish?: () => void): void => {
      if (skipping || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish?.(); return; }
      const animation = element.animate(frames, { duration, easing: "ease-out", fill: "none" });
      animations.add(animation);
      if (paused) animation.pause();
      void animation.finished.then(() => {
        animations.delete(animation);
        if (alive()) finish?.();
      }, () => { animations.delete(animation); });
    };
    const fullText = (): void => {
      if (!alive() || !ready) return;
      typing?.cancel();
      if (typing) timers.delete(typing);
      typing = null;
      this.#text.textContent = view.presentation.text;
      if (!textDone) {
        textDone = true;
        context.textReady();
      }
    };
    const typeText = (): void => {
      if (finishRequested || !view.presentation.text) return fullText();
      const letters = Array.from(view.presentation.text);
      let index = 0;
      const milliseconds = Math.max(1, setting(this.#content.source.settings, "speed", 30))
        * Math.min(4, view.presentation.performance.typeMultiplier);
      const letter = (): void => {
        if (finishRequested) return fullText();
        this.#text.textContent = letters.slice(0, ++index).join("");
        if (index >= letters.length) fullText();
        else typing = defer(milliseconds, letter);
      };
      typing = defer(Math.min(3000, view.presentation.performance.holdMs) + milliseconds, letter);
    };
    const problem = (error: unknown): void => {
      if (alive()) context.problem({
        code: "SCENE_RESOURCE", blocking: true,
        message: `节点 ${view.nodeId} 场面未就绪：${error instanceof Error ? error.message : "未知媒体错误"}。可重试当前场面。`,
      });
    };
    const validate = (): void => {
      const presentation = view.presentation;
      if (!MOODS.includes(presentation.scene.mood)) throw new Error(`未支持氛围：${presentation.scene.mood}`);
      if (!FX.includes(presentation.performance.screenEffect)) throw new Error(`未支持镜头特效：${presentation.performance.screenEffect}`);
      if (!["", "fade", "black", "flash", "cut", "none"].includes(presentation.performance.transition)) throw new Error("未支持转场");
      for (const action of Object.values(presentation.performance.actorActions)) {
        if (!ACTIONS.includes(action)) throw new Error(`未支持角色动作：${action}`);
      }
      for (const sprite of presentation.scene.sprites) {
        if (!Object.hasOwn(LOOKS, sprite.look) || !ENTRIES.includes(sprite.enter) || !EXITS.includes(sprite.exit)) {
          throw new Error(`未支持立绘外观或进出场：${sprite.id}`);
        }
        if (sprite.poseSwitch !== null && sprite.poseSwitch !== "soft") throw new Error(`未支持切姿态提示：${sprite.id}`);
      }
    };
    const actorKey = (id: string): string => {
      const resource = this.#resources.get(id);
      const character = resource.metadata.character;
      if (typeof character === "string" && character) return character;
      const name = resource.metadata.name;
      return typeof name === "string" ? name.split(/[_\-—]/u)[0]! : id;
    };
    const updateScene = (): void => {
      if (!alive()) return;
      const scene = view.presentation.scene;
      const changedBackground = this.#backgroundId !== scene.background;
      const first = this.#backgroundId === null;
      const metadata = scene.background ? this.#resources.get(scene.background).metadata : {};
      if (scene.background) {
        this.#background.src = this.#resources.url(scene.background);
        this.#background.hidden = false;
      } else {
        this.#background.removeAttribute("src");
        this.#background.hidden = true;
      }
      this.#backgroundId = scene.background;
      const shot = record(metadata.shot);
      const focus = shot.focus;
      const viewMetadata = record(metadata.view);
      const focusPosition = Array.isArray(focus) && typeof focus[0] === "number" && typeof focus[1] === "number"
        ? `${focus[0] * 100}% ${focus[1] * 100}%` : "50% 50%";
      this.#background.style.objectPosition = typeof viewMetadata.position === "string" ? viewMetadata.position : focusPosition;
      this.#background.style.objectFit = viewMetadata.size === "contain" ? "contain" : "cover";
      this.#background.style.transformOrigin = focusPosition;
      const zoom = Math.max(1, Math.min(1.15, setting(shot, "scale", 1)));
      this.#background.style.transform = zoom > 1 ? `scale(${zoom})` : "";
      this.#world.dataset.mood = scene.mood;
      const keep = new Set<string>();
      const actorActions = view.presentation.performance.actorActions;
      const focusActor = this.#content.source.settings.focus !== false && !!view.presentation.text
        && scene.sprites.some(sprite => actorKey(sprite.assetId) === view.presentation.speaker);
      for (const sprite of scene.sprites) {
        const key = actorKey(sprite.assetId);
        keep.add(key);
        let actor = this.#actors.get(key);
        const isNew = !actor;
        if (!actor) {
          const element = document.createElement("div");
          element.className = "actor";
          const image = document.createElement("img");
          image.alt = key;
          image.draggable = false;
          element.append(image);
          actor = { element, image, sprite };
          this.#actors.set(key, actor);
          this.#actorsLayer.append(element);
        }
        const previous = actor.sprite;
        const { element, image } = actor;
        if (!isNew && previous.assetId !== sprite.assetId && sprite.poseSwitch === "soft"
          && !changedBackground && !actorActions[key] && !skipping && context.mode === "enter") {
          const ghost = image.cloneNode(false) as HTMLImageElement;
          ghost.className = "pose-ghost";
          ghost.alt = "";
          element.append(ghost);
          transients.add(ghost);
          animate(ghost, [{ opacity: 1 }, { opacity: 0 }], 140, () => { ghost.remove(); transients.delete(ghost); });
        }
        image.src = this.#resources.url(sprite.assetId);
        image.style.transform = `scaleX(${sprite.flipped ? -1 : 1})`;
        image.style.filter = `${grade(metadata)} ${LOOKS[sprite.look]}`;
        element.dataset.instance = sprite.id;
        element.style.left = `${sprite.x}px`;
        element.style.top = `${sprite.y}px`;
        element.style.height = `${sprite.height}px`;
        element.style.opacity = focusActor && key !== view.presentation.speaker ? "0.65" : "1";
        actor.sprite = sprite;
        if (context.mode === "enter" && !skipping) {
          if (actorActions[key]) this.actorAction(image, actorActions[key]!, animate);
          else if (isNew && sprite.enter !== "none") {
            const offset = sprite.enter === "left" ? "-120px" : sprite.enter === "right" ? "120px" : "0px";
            const down = sprite.enter === "up" ? "100px" : "0px";
            animate(element, [
              { opacity: 0, translate: `${offset} ${down}`, scale: sprite.enter === "pop" ? ".85" : "1" },
              { opacity: 1, translate: "0px 0px", scale: "1" },
            ], 400);
          }
        }
      }
      for (const [key, actor] of this.#actors) {
        if (keep.has(key)) continue;
        this.#actors.delete(key);
        if (skipping || context.mode !== "enter" || actor.sprite.exit === "none") actor.element.remove();
        else {
          const element = actor.element;
          transients.add(element);
          const x = actor.sprite.exit === "left" ? "-120px" : actor.sprite.exit === "right" ? "120px" : "0px";
          const y = actor.sprite.exit === "down" ? "100px" : "0px";
          animate(element, [{ opacity: 1 }, { opacity: 0, translate: `${x} ${y}` }], 400,
            () => { element.remove(); transients.delete(element); });
        }
      }
      if (context.mode === "enter" && !skipping) {
        const transition = view.presentation.performance.transition;
        if (changedBackground && !first) {
          if (transition === "fade") animate(this.#background, [{ opacity: 0 }, { opacity: 1 }], 600);
          else if (transition === "black" || transition === "flash") {
            this.#veil.style.background = transition === "black" ? "#000" : "#fff";
            animate(this.#veil, [{ opacity: 1 }, { opacity: 0 }], 600);
          }
        }
        this.screenEffect(view.presentation.performance.screenEffect, animate);
        if (zoom > 1 && changedBackground) {
          animate(this.#background, [{ transform: "scale(1)" }, { transform: `scale(${zoom})` }],
            Math.max(100, Math.min(10000, setting(shot, "ms", 2200))));
        }
      }
      this.#name.textContent = view.presentation.speaker;
      const character = this.#content.source.metadata.chars;
      const color = Array.isArray(character) ? character.map(record).find(item => item.name === view.presentation.speaker)?.color : null;
      this.#name.style.color = typeof color === "string" ? color : "";
      this.#dialogue.hidden = !view.presentation.text && !view.choices.length;
      this.#text.textContent = "";
      audio = this.#audio.begin(view.presentation, context);
      ready = true;
      context.sceneReady();
      typeText();
    };
    const cancel = (): void => {
      if (cancelled) return;
      cancelled = true;
      context.signal.removeEventListener("abort", cancel);
      for (const timer of timers) timer.cancel();
      for (const animation of animations) animation.cancel();
      for (const element of transients) element.remove();
      timers.clear();
      animations.clear();
      transients.clear();
      audio?.cancel();
      this.#veil.style.opacity = "0";
    };
    const playback: Playback = {
      capture: () => {
        if (!alive() || !ready || !textDone || !audio) throw new Error("场面或完整文字尚未就绪，不能捕获检查点");
        return audio.capture();
      },
      finishText: () => { finishRequested = true; fullText(); },
      setPaused: value => {
        paused = value;
        this.#root.classList.toggle("paused", value);
        for (const timer of timers) timer.setPaused(value);
        for (const animation of animations) {
          if (value) animation.pause();
          else animation.play();
        }
        this.#audio.setPaused(value);
      },
      setSkipping: value => {
        skipping = value;
        if (value) {
          finishRequested = true;
          audio?.skip();
          for (const animation of [...animations]) {
            try { animation.finish(); } catch { animation.cancel(); }
          }
          fullText();
        }
      },
      cancel,
    };
    this.#active = playback;
    playback.setPaused(paused);
    context.signal.addEventListener("abort", cancel, { once: true });
    void (async () => {
      try {
        validate();
        const ids = [...new Set([
          ...(view.presentation.scene.background ? [view.presentation.scene.background] : []),
          ...view.presentation.scene.sprites.map(sprite => sprite.assetId),
        ])];
        await Promise.all(ids.map(async id => {
          try { await loadImage(this.#resources.url(id), context.signal); }
          catch (error: unknown) {
            if (context.signal.aborted) throw error;
            throw new Error(`${id}：${error instanceof Error ? error.message : "图片加载失败"}`);
          }
        }));
        updateScene();
      } catch (error: unknown) { problem(error); }
    })();
    return playback;
  }

  private actorAction(image: HTMLImageElement, action: string,
    animate: (element: Element, frames: Keyframe[], duration: number) => void): void {
    const positions: Record<string, Keyframe[]> = {
      jump: [{ translate: "0 0" }, { translate: "0 -30px" }, { translate: "0 0" }],
      shake: [{ translate: "-6px 0" }, { translate: "6px 0" }, { translate: "-4px 0" }, { translate: "0 0" }],
      nod: [{ translate: "0 0" }, { translate: "0 12px" }, { translate: "0 0" }],
      lean: [{ translate: "0 0" }, { translate: "18px 0" }, { translate: "0 0" }],
      flinch: [{ translate: "0 0" }, { translate: "-22px 0" }, { translate: "0 0" }],
      settle: [{ translate: "0 -6px" }, { translate: "0 3px" }, { translate: "0 0" }],
    };
    animate(image, positions[action]!, 420);
  }

  private screenEffect(fx: string, animate: (element: Element, frames: Keyframe[], duration: number) => void): void {
    if (fx === "shake" || fx === "quake") {
      animate(this.#world, [{ translate: "-8px 3px" }, { translate: "8px -3px" }, { translate: "-4px 0" }, { translate: "0 0" }], 450);
    }
    if (fx === "zoom") animate(this.#world, [{ scale: "1" }, { scale: "1.07" }, { scale: "1" }], 400);
    if (fx === "whip") animate(this.#world, [{ translate: "-36px 0" }, { translate: "18px 0" }, { translate: "0 0" }], 450);
    if (["flash", "quake", "whip", "redflash", "blink"].includes(fx)) {
      this.#veil.style.background = fx === "redflash" ? "#c00" : fx === "blink" ? "#000" : "#fff";
      animate(this.#veil, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], fx === "blink" ? 800 : 450);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#active?.cancel();
    this.#audio.dispose();
    this.#root.classList.add("paused");
  }
}
