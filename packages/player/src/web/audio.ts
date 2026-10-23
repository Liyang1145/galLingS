import type { JsonObject, Presentation } from "../../../story-model/src/model.ts";
import type { Clock } from "../clock.ts";
import { ActiveTimer } from "../clock.ts";
import type { MediaProblem, PresentationContext } from "../session.ts";
import type { ResourceAccess } from "./resources.ts";
import type { PlaybackCheckpoint, TrackCheckpoint, VoiceCheckpoint } from "../checkpoint.ts";
import { setting, volume } from "./resources.ts";

interface Track {
  id: string;
  element: HTMLAudioElement;
  fade: ActiveTimer | null;
  alive: boolean;
  failed: boolean;
  playRejected: boolean;
  seekMs: number | null;
  ended: (() => void) | null;
}

export interface EntryAudio {
  cancel(): void;
  skip(): void;
  capture(): PlaybackCheckpoint;
}

/** Persistent tracks belong to the mixer; voice/effects belong to an entry. */
export class AudioMixer {
  readonly #resources: ResourceAccess;
  readonly #settings: JsonObject;
  readonly #tracks = new Set<Track>();
  readonly #ambience = new Map<string, Track>();
  #music: Track | null = null;
  #paused = false;
  #disposed = false;
  #clock: Clock | null = null;
  #report: (problem: MediaProblem) => void = () => {};

  constructor(resources: ResourceAccess, settings: JsonObject) {
    this.#resources = resources;
    this.#settings = settings;
  }

  private track(id: string, loop: boolean, gain: number, ended: (() => void) | null = null, seekMs: number | null = null): Track {
    const element = new Audio(this.#resources.url(id));
    element.loop = loop;
    element.preload = "auto";
    element.volume = volume(gain);
    const track: Track = { id, element, fade: null, alive: true, failed: false, playRejected: false, seekMs, ended };
    this.#tracks.add(track);
    element.addEventListener("ended", () => {
      if (!track.alive) return;
      const callback = track.ended;
      this.stop(track);
      callback?.();
    }, { once: true });
    element.addEventListener("error", () => {
      if (!track.alive || this.#disposed) return;
      track.failed = true;
      this.#report({ code: "AUDIO_RESOURCE", message: `声音无法读取或解码：${id}`, blocking: false });
      const callback = track.ended;
      this.stop(track);
      callback?.();
    }, { once: true });
    if (seekMs !== null) {
      element.addEventListener("loadedmetadata", () => {
        if (!track.alive || this.#disposed || track.seekMs === null) return;
        const seconds = track.seekMs / 1000;
        track.seekMs = null;
        try {
          const duration = element.duration;
          if (!loop && Number.isFinite(duration) && duration > 0 && seconds >= duration) {
            const callback = track.ended;
            this.stop(track);
            callback?.();
            return;
          }
          element.currentTime = Number.isFinite(duration) && duration > 0
            ? loop ? seconds % duration : Math.min(seconds, duration) : seconds;
        } catch {
          this.#report({ code: "AUDIO_SEEK", message: `声音位置无法恢复：${id}，当前音轨从可用位置播放。`, blocking: false });
        }
        this.play(track);
      }, { once: true });
    }
    this.play(track);
    return track;
  }

  private play(track: Track): void {
    if (!track.alive || track.failed || track.seekMs !== null || this.#paused || this.#disposed) return;
    void track.element.play().then(() => {
      track.playRejected = false;
      // play() may resolve after entry cancellation or a background pause.
      if (!track.alive || this.#paused || this.#disposed) track.element.pause();
    }).catch((error: unknown) => {
      if (!track.alive || this.#paused || this.#disposed) return;
      track.playRejected = true;
      this.#report({
        code: "AUDIO_PLAY",
        message: `声音暂未播放：${track.id}。可点击“启用声音”重试。${error instanceof Error ? ` ${error.name}` : ""}`,
        blocking: false,
      });
      // A rejected voice must not leave automatic reading waiting forever.
      const ended = track.ended;
      track.ended = null;
      ended?.();
    });
  }

  unlock(): void {
    for (const track of this.#tracks) if (track.element.paused) this.play(track);
  }

  private stop(track: Track): void {
    if (!track.alive) return;
    track.alive = false;
    track.fade?.cancel();
    track.fade = null;
    track.element.pause();
    track.element.removeAttribute("src");
    track.element.load();
    this.#tracks.delete(track);
  }

  private fade(track: Track, target: number, duration: number, retire = false): void {
    track.fade?.cancel();
    if (!this.#clock || duration <= 0) {
      track.element.volume = volume(target);
      if (retire) this.stop(track);
      return;
    }
    const from = track.element.volume;
    const timer = new ActiveTimer(this.#clock, duration, () => {
      if (!track.alive) return;
      track.element.volume = volume(target);
      track.fade = null;
      if (retire) this.stop(track);
    }, () => {
      if (track.alive) track.element.volume = volume(from + (target - from) * (1 - timer.remaining() / duration));
    });
    track.fade = timer;
    timer.setPaused(this.#paused);
  }

  private scene(presentation: Presentation, restored: PlaybackCheckpoint | null): void {
    const scene = presentation.scene;
    const music = scene.music.kind === "play" ? scene.music.assetId : null;
    const mood = scene.mood;
    const musicDuck = mood === "underwater" ? 0.35 : mood === "slowmo" ? 0.5 : 1;
    const ambienceDuck = mood === "underwater" ? 0.45 : mood === "slowmo" ? 0.15 : 1;
    if (this.#music?.id !== music || (this.#music && !this.#music.alive)) {
      if (this.#music) this.fade(this.#music, 0, scene.music.fadeMs, true);
      this.#music = music ? this.track(music, true, 0, null, restored?.music?.positionMs ?? null) : null;
      if (this.#music) {
        const gain = setting(this.#resources.get(music!).metadata, "playbackGain", 1);
        this.fade(this.#music, volume(setting(this.#settings, "vbgm", 0.6)) * volume(gain) * musicDuck, 800);
      }
    } else if (this.#music) {
      const gain = setting(this.#resources.get(this.#music.id).metadata, "playbackGain", 1);
      this.fade(this.#music, volume(setting(this.#settings, "vbgm", 0.6)) * volume(gain) * musicDuck, 300);
    }
    const next = new Map(scene.ambience.map(track => [track.assetId, track]));
    for (const [id, track] of this.#ambience) {
      if (!next.has(id)) {
        this.#ambience.delete(id);
        this.fade(track, 0, 900, true);
      }
    }
    for (const [id, specification] of next) {
      let track = this.#ambience.get(id);
      if (!track || !track.alive) {
        track = this.track(id, true, 0, null, restored?.ambience.find(item => item.assetId === id)?.positionMs ?? null);
        this.#ambience.set(id, track);
      }
      const gain = volume(setting(this.#settings, "vamb", 0.3)) * volume(specification.gain)
        * (music ? 0.75 : 1) * ambienceDuck;
      this.fade(track, gain, 350);
    }
  }

  begin(presentation: Presentation, context: PresentationContext): EntryAudio {
    this.#clock = context.clock;
    this.#report = problem => { if (!context.signal.aborted) context.problem(problem); };
    this.setPaused(context.paused);
    if (context.restore) {
      for (const track of [...this.#tracks]) this.stop(track);
      this.#music = null;
      this.#ambience.clear();
    }
    this.scene(presentation, context.restore?.playback ?? null);
    const effects = new Set<Track>();
    const delays = new Set<ActiveTimer>();
    let voice: Track | null = null;
    let closed = false;
    let skipped = context.skipping;
    let voiceReported = false;
    const voiceEnded = (): void => {
      if (voiceReported || closed || context.signal.aborted) return;
      voiceReported = true;
      context.voiceEnded();
    };
    const restoredVoice = context.restore?.playback.voice;
    const resumeVoice = context.restore?.voice === "resume";
    const playVoice = !context.restore || context.restore.voice === "replay"
      || (resumeVoice && restoredVoice?.state === "active" && restoredVoice.positionMs !== null);
    if (resumeVoice && restoredVoice?.state === "active" && restoredVoice.positionMs === null) {
      context.problem({ code: "VOICE_POSITION", message: "这份进度没有可用的语音续播位置，本次读档保持语音停止。", blocking: false });
    }
    if (presentation.performance.voiceId && !skipped && playVoice) {
      voice = this.track(presentation.performance.voiceId, false, volume(setting(this.#settings, "vvo", 1)), voiceEnded,
        resumeVoice ? restoredVoice?.positionMs ?? null : null);
    } else voiceEnded();
    const effect = (id: string, gain: number): void => {
      if (closed || skipped || context.signal.aborted) return;
      for (const old of effects) if (!old.alive) effects.delete(old);
      if ([...effects].some(old => old.id === id && old.element.currentTime < 0.4)) return;
      if (effects.size >= 4) {
        const oldest = effects.values().next().value;
        if (oldest) { effects.delete(oldest); this.stop(oldest); }
      }
      const track = this.track(id, false, volume(setting(this.#settings, "vse", 0.8)) * volume(gain));
      effects.add(track);
    };
    // Retry reconstructs this scene but never repeats entry sound effects.
    if (context.mode === "enter" && !skipped) {
      for (const sound of presentation.performance.sounds) {
        if (!sound.delayMs) effect(sound.assetId, sound.gain);
        else {
          const timer = new ActiveTimer(context.clock, Math.min(sound.delayMs, 10000), () => {
            delays.delete(timer);
            effect(sound.assetId, sound.gain);
          });
          delays.add(timer);
          timer.setPaused(this.#paused);
        }
      }
    }
    const stopEntry = (): void => {
      for (const timer of delays) timer.cancel();
      delays.clear();
      for (const track of effects) this.stop(track);
      effects.clear();
      if (voice) this.stop(voice);
    };
    const onAbort = (): void => { closed = true; stopEntry(); };
    context.signal.addEventListener("abort", onAbort, { once: true });
    // Delay timers are entry-owned, but they must also respond to global pause.
    this.#entryDelays = delays;
    return {
      capture: () => {
        if (closed || context.signal.aborted || this.#disposed) throw new Error("旧声音呈现不能生成检查点");
        const position = (assetId: string, track: Track | null | undefined): TrackCheckpoint => {
          const seconds = track?.element.currentTime;
          return {
            assetId,
            positionMs: track?.id === assetId && track.alive && !track.failed && !track.playRejected
              && typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 ? track.seekMs ?? seconds * 1000 : null,
          };
        };
        const scene = presentation.scene;
        const voiceId = presentation.performance.voiceId;
        let capturedVoice: VoiceCheckpoint | null = null;
        if (voiceId) {
          const state: VoiceCheckpoint["state"] = skipped || !playVoice ? "skipped"
            : voice?.failed || voice?.playRejected ? "unavailable"
            : voice?.alive ? "active" : "finished";
          capturedVoice = { ...position(voiceId, voice), state };
        }
        return {
          music: scene.music.kind === "play" ? position(scene.music.assetId, this.#music) : null,
          ambience: scene.ambience.map(track => position(track.assetId, this.#ambience.get(track.assetId))),
          voice: capturedVoice,
        };
      },
      cancel: () => {
        if (closed) return;
        closed = true;
        context.signal.removeEventListener("abort", onAbort);
        stopEntry();
        if (this.#entryDelays === delays) this.#entryDelays = null;
      },
      skip: () => {
        skipped = true;
        stopEntry();
        voiceEnded();
      },
    };
  }

  #entryDelays: Set<ActiveTimer> | null = null;

  setPaused(paused: boolean): void {
    this.#paused = paused;
    for (const track of this.#tracks) {
      track.fade?.setPaused(paused);
      if (paused) track.element.pause();
      else if (track.element.paused) this.play(track);
    }
    for (const timer of this.#entryDelays ?? []) timer.setPaused(paused);
  }

  dispose(): void {
    this.#disposed = true;
    for (const track of [...this.#tracks]) this.stop(track);
    for (const timer of this.#entryDelays ?? []) timer.cancel();
    this.#ambience.clear();
    this.#music = null;
  }
}
