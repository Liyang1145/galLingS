import type { JsonObject, JsonValue, Sprite, StoryContent } from "../../../story-model/src/model.ts";
import type { RuntimeView } from "../../../story-runtime/src/index.ts";
import { ActiveTimer } from "../clock.ts";
import type { Playback, PresentationAdapter, PresentationContext, PresentationEndContext } from "../session.ts";
import { AudioMixer } from "./audio.ts";
import type { EntryAudio } from "./audio.ts";
import type { ResourceAccess } from "./resources.ts";
import { setting } from "./resources.ts";
import { VoicePolicy, readVoicePreferences } from "../voice-preferences.ts";
import type { VoicePreferences } from "../voice-preferences.ts";
import type { AudioVolumes } from "../preferences.ts";
import { authorReadingPreferences, readReadingPreferences } from "../reading-preferences.ts";
import type { ReadingPreferences } from "../reading-preferences.ts";
import { readUiSounds } from "../ui-sounds.ts";
import { applyAuthorAppearance } from "./appearance.ts";
import type { AuthorAppearance, WhaleArtwork } from "../appearance.ts";
import type { InteractionFeedback } from "../ui-sounds.ts";
import { captureSceneFade } from "./scene-fade.ts";
import type { SceneFadeSurface } from "./scene-fade.ts";
import { ACTOR_ACTIONS, ACTOR_ENTRIES, ACTOR_EXITS, SCREEN_MOTIONS, SCREEN_FLASH, SCREEN_BLINK } from "./motion.ts";
import { BackgroundCamera } from "./camera.ts";
import type { BackgroundShot } from "./camera.ts";

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
const ACTIONS = Object.keys(ACTOR_ACTIONS);
const ENTRIES = ["", "none", ...Object.keys(ACTOR_ENTRIES)];
const EXITS = ["", "none", ...Object.keys(ACTOR_EXITS)];

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

function backgroundShot(metadata: JsonObject, resourceId: string): BackgroundShot | null {
  const shot = record(metadata.shot);
  const focus = shot.focus;
  if (focus === undefined || focus === null) return null;
  if (!Array.isArray(focus) || focus.length !== 2
    || typeof focus[0] !== "number" || !Number.isFinite(focus[0])
    || typeof focus[1] !== "number" || !Number.isFinite(focus[1])) {
    throw new Error(`背景 ${resourceId} 的 shot.focus 必须是两个有限数值`);
  }
  return {
    origin: `${focus[0] * 100}% ${focus[1] * 100}%`,
    scale: Math.max(1, Math.min(1.04, setting(shot, "scale", 1))),
    duration: Math.max(600, Math.min(3000, setting(shot, "ms", 2200))),
  };
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
  readonly #sceneLayers: HTMLDivElement;
  readonly #mood: HTMLDivElement;
  readonly #background: HTMLImageElement;
  readonly #camera: BackgroundCamera;
  readonly #actorsLayer: HTMLDivElement;
  readonly #transitionVeil: HTMLDivElement;
  readonly #veil: HTMLDivElement;
  readonly #dialogue: HTMLDivElement;
  readonly #name: HTMLElement;
  readonly #text: HTMLElement;
  readonly #resources: ResourceAccess;
  readonly #content: StoryContent;
  readonly #audio: AudioMixer;
  readonly #appearance: AuthorAppearance;
  readonly #fadeSurface: SceneFadeSurface | undefined;
  #reading: ReadingPreferences;
  readonly #voicePolicy: VoicePolicy;
  #voicePreferences: VoicePreferences;
  #voiceNode: string | null = null;
  readonly #actors = new Map<string, Actor>();
  #backgroundId: string | null = null;
  #hasScene = false;
  #visualKey: string | null = null;
  #disposed = false;
  #ended = false;
  #active: Playback | null = null;

  constructor(root: HTMLElement, content: StoryContent, resources: ResourceAccess, audioAllowed = true, volumes?: AudioVolumes,
    reading?: ReadingPreferences, artwork?: WhaleArtwork, fadeSurface?: SceneFadeSurface) {
    this.#root = root;
    this.#content = content;
    this.#voicePolicy = new VoicePolicy(content);
    this.#voicePreferences = { ...this.#voicePolicy.defaults };
    this.#resources = resources;
    this.#fadeSurface = fadeSurface;
    this.#appearance = applyAuthorAppearance(root, content, resources, artwork);
    this.#world = document.createElement("div");
    this.#world.className = "world";
    this.#sceneLayers = document.createElement("div");
    this.#sceneLayers.className = "scene-layers";
    this.#background = document.createElement("img");
    this.#background.className = "backdrop";
    this.#background.alt = "";
    this.#background.draggable = false;
    this.#camera = new BackgroundCamera(this.#background);
    this.#actorsLayer = document.createElement("div");
    this.#actorsLayer.className = "actors";
    this.#mood = document.createElement("div");
    this.#mood.className = "mood-layer";
    const moodDetail = document.createElement("div");
    moodDetail.className = "mood-detail";
    this.#mood.append(moodDetail);
    this.#transitionVeil = document.createElement("div");
    this.#transitionVeil.className = "veil transition-veil";
    this.#veil = document.createElement("div");
    this.#veil.className = "veil";
    this.#dialogue = document.createElement("div");
    this.#dialogue.className = "dialogue";
    this.#name = document.createElement("strong");
    this.#name.className = "speaker";
    this.#text = document.createElement("p");
    this.#text.className = "dialogue-text";
    this.#dialogue.append(this.#name, this.#text);
    this.#sceneLayers.append(this.#background, this.#actorsLayer);
    this.#world.append(this.#sceneLayers, this.#mood, this.#transitionVeil, this.#veil);
    root.replaceChildren(this.#world, this.#dialogue);
    this.#audio = new AudioMixer(resources, content.source.settings, audioAllowed, volumes, readUiSounds(content));
    this.#reading = reading === undefined ? authorReadingPreferences(content.source.settings) : readReadingPreferences(reading);
    this.setReadingPreferences(this.#reading);
  }

  unlockAudio(): void { this.#audio.unlock(); }
  setAudioAllowed(allowed: boolean): void { this.#audio.setAudioAllowed(allowed); }
  setAudioVolumes(volumes: AudioVolumes): void { this.#audio.setVolumes(volumes); }
  setVoicePreferences(input: VoicePreferences): void {
    this.#voicePreferences = readVoicePreferences(input);
    if (this.#voiceNode) this.#audio.setVoiceEnabled(this.#voicePreferences[this.#voicePolicy.key(this.#voiceNode)]);
  }
  interaction(feedback: InteractionFeedback): void {
    if (this.#disposed) return;
    const ending = feedback.type === "cue" && feedback.cue === "endingNew";
    if (this.#ended !== ending) return;
    this.#audio.interaction(feedback);
  }
  end(context: PresentationEndContext): void {
    if (this.#disposed || this.#ended) return;
    this.#ended = true;
    this.#active?.cancel();
    this.#active = null;
    this.#camera.settle();
    this.#audio.end(context.paused, context.problem);
    this.#root.classList.toggle("paused", context.paused);
  }
  setPaused(paused: boolean): void {
    if (this.#disposed) return;
    this.#audio.setPaused(paused);
    this.#camera.setPaused(paused);
    this.#root.classList.toggle("paused", paused);
  }
  setReadingPreferences(input: ReadingPreferences): void {
    const values = readReadingPreferences(input);
    if (this.#disposed) return;
    this.#reading = values;
    this.#dialogue.style.setProperty("--reader-scale", String(values.textScale));
    this.#dialogue.style.setProperty("--reader-opacity", String(values.dialogueOpacity));
  }

  present(view: RuntimeView, context: PresentationContext): Playback {
    if (this.#disposed) throw new Error("表现实例已经离开");
    if (this.#ended) throw new Error("已结束的表现不能重新呈现剧情");
    const textSpeedMs = this.#reading.textSpeedMs;
    this.#active?.cancel();
    this.#voiceNode = view.nodeId;
    this.#audio.setVoiceEnabled(this.#voicePreferences[this.#voicePolicy.key(view.nodeId)]);
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
    const scene = view.presentation.scene;
    const visualKey = JSON.stringify([
      scene.background,
      scene.sprites.map(sprite => [sprite.assetId, Math.round(sprite.x), Math.round(sprite.y),
        Math.round(sprite.height), sprite.flipped]),
      scene.mood, !view.presentation.text && !view.choices.length,
    ]);
    let sceneFade: HTMLElement | null = null;
    const clearSceneFade = (): void => {
      if (!sceneFade) return;
      sceneFade.remove();
      transients.delete(sceneFade);
      sceneFade = null;
    };
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
    const animate = (element: Element, frames: Keyframe[], timing: number | KeyframeAnimationOptions, finish?: () => void,
      easing = "ease-out"): void => {
      if (skipping || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish?.(); return; }
      const options: KeyframeAnimationOptions = typeof timing === "number" ? { duration: timing, easing, fill: "none" }
        : { easing, fill: "none", ...timing };
      const animation = element.animate(frames, options);
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
      const milliseconds = textSpeedMs
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
      clearSceneFade();
      if (alive()) this.#camera.setPaused(true);
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
      const first = !this.#hasScene;
      const metadata = scene.background ? this.#resources.get(scene.background).metadata : {};
      const shot = scene.background ? backgroundShot(metadata, scene.background) : null;
      if (scene.background) {
        this.#background.src = this.#resources.url(scene.background);
        this.#background.hidden = false;
      } else {
        this.#background.removeAttribute("src");
        this.#background.hidden = true;
      }
      this.#backgroundId = scene.background;
      const viewMetadata = record(metadata.view);
      this.#background.style.objectPosition = typeof viewMetadata.position === "string" ? viewMetadata.position : "50% 50%";
      this.#background.style.objectFit = viewMetadata.size === "contain" ? "contain" : "cover";
      this.#camera.update(scene.background, shot, {
        mode: context.mode === "enter" ? "enter" : "stable",
        enabled: !skipping && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        paused,
      });
      const previousMood = this.#world.dataset.mood ?? "";
      const previousMoodFilter = getComputedStyle(this.#sceneLayers).filter;
      const previousMoodOpacity = getComputedStyle(this.#mood).opacity;
      if (previousMood !== scene.mood) delete this.#world.dataset.stillSlowmo;
      if (scene.mood === "slowmo" && context.mode !== "enter") this.#world.dataset.stillSlowmo = "true";
      this.#world.dataset.mood = scene.mood;
      if (context.mode === "enter" && previousMood !== scene.mood) {
        const filter = getComputedStyle(this.#sceneLayers).filter;
        const opacity = getComputedStyle(this.#mood).opacity;
        if (scene.mood !== "dizzy" && previousMoodFilter !== filter) {
          animate(this.#sceneLayers, [{ filter: previousMoodFilter }, { filter }], { duration: 600, easing: "ease" });
        }
        if (!["flicker", "strobe", "danger"].includes(scene.mood) && previousMoodOpacity !== opacity) {
          animate(this.#mood, [{ opacity: previousMoodOpacity }, { opacity }], { duration: 600, easing: "ease" });
        }
      }
      const keep = new Set<string>();
      const actorActions = view.presentation.performance.actorActions;
      const actorMotion = context.mode === "enter" && !skipping
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const focusActor = this.#content.source.settings.focus !== false && !!view.presentation.text
        && scene.sprites.some(sprite => actorKey(sprite.assetId) === view.presentation.speaker);
      for (const [z, sprite] of scene.sprites.entries()) {
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
        const previousFilter = image.style.filter;
        if (!isNew && previous.assetId !== sprite.assetId && sprite.poseSwitch === "soft"
          && !changedBackground && !actorActions[key] && actorMotion) {
          const ghost = element.cloneNode(true) as HTMLDivElement;
          ghost.classList.add("actor-ghost");
          ghost.setAttribute("aria-hidden", "true");
          ghost.inert = true;
          this.#actorsLayer.insertBefore(ghost, element);
          transients.add(ghost);
          animate(ghost, [{ opacity: 1 }, { opacity: 0 }], 140, () => { ghost.remove(); transients.delete(ghost); });
        }
        image.src = this.#resources.url(sprite.assetId);
        image.style.transform = `scaleX(${sprite.flipped ? -1 : 1})`;
        const dim = focusActor && key !== view.presentation.speaker ? "brightness(.62) saturate(.85)" : "";
        const filter = [grade(metadata), LOOKS[sprite.look], dim].filter(Boolean).join(" ");
        image.style.filter = filter;
        element.dataset.instance = sprite.id;
        element.style.zIndex = String(z);
        element.style.left = `${sprite.x}px`;
        element.style.top = `${sprite.y}px`;
        element.style.height = `${sprite.height}px`;
        element.style.opacity = "";
        actor.sprite = sprite;
        if (actorMotion) {
          if (!isNew && (previous.x !== sprite.x || previous.y !== sprite.y || previous.height !== sprite.height)) {
            animate(element, [
              { left: `${previous.x}px`, top: `${previous.y}px`, height: `${previous.height}px` },
              { left: `${sprite.x}px`, top: `${sprite.y}px`, height: `${sprite.height}px` },
            ], { duration: 500, easing: "ease" });
          }
          if (!isNew && previousFilter !== filter) {
            animate(image, [{ filter: previousFilter || "none" }, { filter }], { duration: 900, easing: "ease" });
          }
          if (actorActions[key]) {
            const motion = ACTOR_ACTIONS[actorActions[key]!]!;
            animate(element, motion.frames, motion.timing);
          }
          else if (isNew && sprite.enter !== "none") {
            const motion = ACTOR_ENTRIES[sprite.enter || "fade"]!;
            animate(element, motion.frames, motion.timing);
          }
        }
      }
      for (const [key, actor] of this.#actors) {
        if (keep.has(key)) continue;
        this.#actors.delete(key);
        if (!actorMotion || actor.sprite.exit === "none") actor.element.remove();
        else {
          const element = actor.element;
          transients.add(element);
          const motion = ACTOR_EXITS[actor.sprite.exit || "fade"]!;
          animate(element, motion.frames, motion.timing,
            () => { element.remove(); transients.delete(element); });
        }
      }
      if (context.mode === "enter" && !skipping) {
        const transition = view.presentation.performance.transition;
        if (changedBackground && !first && !sceneFade) {
          if (transition === "fade") animate(this.#background, [{ opacity: 0 }, { opacity: 1 }], 600);
          else if (transition === "black" || transition === "flash") {
            this.#transitionVeil.style.background = transition === "black" ? "#000" : "#fff";
            animate(this.#transitionVeil, [{ opacity: 1 }, { opacity: 0 }], 800);
          }
        }
        this.screenEffect(view.presentation.performance.screenEffect, animate);
      }
      this.#name.textContent = view.presentation.speaker;
      const character = this.#content.source.metadata.chars;
      const color = Array.isArray(character) ? character.map(record).find(item => item.name === view.presentation.speaker)?.color : null;
      this.#name.style.color = typeof color === "string" ? color : "";
      this.#dialogue.hidden = !view.presentation.text && !view.choices.length;
      this.#text.textContent = "";
      audio = this.#audio.begin(view.presentation, context);
      this.#hasScene = true;
      this.#visualKey = visualKey;
      if (sceneFade) animate(sceneFade, [{ opacity: 1 }, { opacity: 0 }], 360, clearSceneFade, "ease-in-out");
      ready = true;
      context.sceneReady();
      typeText();
    };
    const cancel = (): void => {
      if (cancelled) return;
      cancelled = true;
      context.signal.removeEventListener("abort", cancel);
      // Hold a scene camera across the gap; the next accepted scene reuses, settles or replaces it.
      this.#camera.setPaused(true);
      clearSceneFade();
      for (const timer of timers) timer.cancel();
      for (const animation of animations) animation.cancel();
      for (const element of transients) element.remove();
      timers.clear();
      animations.clear();
      transients.clear();
      audio?.cancel();
      this.#transitionVeil.style.opacity = "0";
      this.#veil.style.opacity = "0";
    };
    const playback: Playback = {
      capture: () => {
        if (!alive() || !ready || !textDone || !audio) throw new Error("场面或完整文字尚未就绪，不能捕获检查点");
        return audio.capture();
      },
      finishText: () => { finishRequested = true; fullText(); },
      setPaused: value => {
        if (!alive()) return;
        paused = value;
        this.#root.classList.toggle("paused", value);
        for (const timer of timers) timer.setPaused(value);
        for (const animation of animations) {
          if (value) animation.pause();
          else animation.play();
        }
        this.#audio.setPaused(value);
        this.#camera.setPaused(value);
      },
      setSkipping: value => {
        if (!alive()) return;
        skipping = value;
        if (value) {
          finishRequested = true;
          audio?.skip();
          clearSceneFade();
          this.#camera.clear();
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
    const surface = this.#fadeSurface;
    if (alive() && surface && context.mode === "enter" && !skipping && this.#hasScene
      && view.presentation.performance.transition !== "cut"
      && (visualKey !== this.#visualKey || !surface.choices.hidden)
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        sceneFade = captureSceneFade(this.#root, surface);
        transients.add(sceneFade);
      } catch (error: unknown) {
        context.problem({
          code: "SCENE_TRANSITION", blocking: false,
          message: `节点 ${view.nodeId} 的旧画面过渡未能准备：${error instanceof Error ? error.message : "未知显示错误"}`,
        });
      }
    }
    void (async () => {
      try {
        validate();
        const ids = [...new Set([
          ...(view.presentation.scene.background ? [view.presentation.scene.background] : []),
          ...view.presentation.scene.sprites.map(sprite => sprite.assetId),
          ...(this.#appearance.theme.imageId ? [this.#appearance.theme.imageId] : []),
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

  private screenEffect(fx: string,
    animate: (element: Element, frames: Keyframe[], timing: number | KeyframeAnimationOptions) => void): void {
    const motion = SCREEN_MOTIONS[fx];
    if (motion) {
      // Legacy dizzy blur is the later animation in the CSS list and owns filter during a whip.
      const frames = fx === "whip" && this.#world.dataset.mood === "dizzy"
        ? motion.frames.map(frame => { const copy = { ...frame }; delete copy.filter; return copy; }) : motion.frames;
      animate(this.#sceneLayers, frames, motion.timing);
    }
    if (["flash", "quake", "whip", "redflash", "blink"].includes(fx)) {
      this.#veil.style.background = fx === "redflash" ? "#c00" : fx === "blink" ? "#000" : "#fff";
      const flash = fx === "blink" ? SCREEN_BLINK : SCREEN_FLASH;
      animate(this.#veil, flash.frames, flash.timing);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#active?.cancel();
    this.#camera.dispose();
    this.#audio.dispose();
    this.#root.classList.add("paused");
  }
}
