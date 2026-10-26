import type { JsonObject, Presentation } from "../../../story-model/src/model.ts";
import type { Clock } from "../clock.ts";
import { ActiveTimer } from "../clock.ts";
import type { MediaProblem, PresentationContext } from "../session.ts";
import type { ResourceAccess } from "./resources.ts";
import type { PlaybackCheckpoint, TrackCheckpoint, VoiceCheckpoint } from "../checkpoint.ts";
import { setting, volume } from "./resources.ts";
import { authorAudioVolumes, readAudioVolumes } from "../preferences.ts";
import type { AudioChannel, AudioVolumes } from "../preferences.ts";
import type { InteractionFeedback, UiSounds } from "../ui-sounds.ts";
import { readLibraryEntry } from "../audio-library.ts";

interface Track {
  id: string;
  kind: "persistent" | "voice" | "effect" | "feedback" | "tick";
  channel: AudioChannel;
  /** Author/scene/fade envelope before the player's channel level. */
  gain: number;
  element: HTMLAudioElement;
  fade: ActiveTimer | null;
  alive: boolean;
  failed: boolean;
  playRejected: boolean;
  seekMs: number | null;
  ended: (() => void) | null;
  expectedPauses: number;
  externallyPaused: boolean;
}

export interface EntryAudio {
  cancel(): void;
  skip(): void;
  capture(): PlaybackCheckpoint;
}

export interface AudioPreviewObserver {
  started(): void;
  ended(): void;
  problem(problem: MediaProblem): void;
}
export type VoicePreviewObserver = AudioPreviewObserver;

/** Persistent tracks belong to the mixer; voice/effects belong to an entry. */
export class AudioMixer {
  readonly #resources: ResourceAccess;
  #volumes: AudioVolumes;
  readonly #tracks = new Set<Track>();
  readonly #ambience = new Map<string, Track>();
  readonly #uiSounds: UiSounds;
  #music: Track | null = null;
  #choiceTick: Track | null = null;
  #choiceTickWanted = false;
  #choiceTickFailed = false;
  #paused = false;
  #audioAllowed: boolean;
  #disposed = false;
  #clock: Clock | null = null;
  #report: (problem: MediaProblem) => void = () => {};

  constructor(resources: ResourceAccess, settings: JsonObject, audioAllowed = true, volumes?: AudioVolumes, uiSounds: UiSounds = {}) {
    this.#resources = resources;
    this.#volumes = volumes === undefined ? authorAudioVolumes(settings) : readAudioVolumes(volumes);
    this.#audioAllowed = audioAllowed;
    this.#uiSounds = { ...uiSounds };
  }

  private applyVolume(track: Track): void {
    track.element.volume = volume(track.gain * this.#volumes[track.channel]);
  }

  setVolumes(input: AudioVolumes): void {
    const values = readAudioVolumes(input);
    if (this.#disposed) return;
    this.#volumes = values;
    for (const track of this.#tracks) this.applyVolume(track);
    this.syncChoiceTick();
  }

  private track(id: string, channel: AudioChannel, gain: number, ended: (() => void) | null = null, seekMs: number | null = null,
    feedback?: "feedback" | "tick"): Track {
    const loop = feedback === "tick" || channel === "music" || channel === "ambience";
    const element = new Audio(this.#resources.url(id));
    element.loop = loop;
    element.preload = "auto";
    const track: Track = { id, channel, gain: volume(gain), kind: feedback ?? (loop ? "persistent" : ended ? "voice" : "effect"),
      element, fade: null, alive: true, failed: false, playRejected: false, seekMs, ended,
      expectedPauses: 0, externallyPaused: false };
    this.applyVolume(track);
    this.#tracks.add(track);
    element.addEventListener("pause", () => {
      if (track.expectedPauses > 0) { track.expectedPauses--; return; }
      if (!track.alive || track.failed || this.#disposed || this.#paused || !this.#audioAllowed || element.ended || element.error) return;
      // Android WebView owns playback focus. Only an unsolicited media pause reports
      // interruption; menu, lifecycle, cancellation and permission pauses are accounted for.
      track.externallyPaused = true;
      window.dispatchEvent(new Event("haifeng:audio-interrupted"));
    });
    element.addEventListener("playing", () => {
      if (!track.externallyPaused || !track.alive || this.#disposed || element.paused) return;
      track.externallyPaused = false;
      window.dispatchEvent(new Event("haifeng:audio-resumed"));
    });
    element.addEventListener("ended", () => {
      if (!track.alive) return;
      const callback = track.ended;
      this.stop(track);
      callback?.();
    }, { once: true });
    element.addEventListener("error", () => {
      if (!track.alive || this.#disposed) return;
      track.failed = true;
      if (track.kind === "tick") this.#choiceTickFailed = true;
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
    if (!this.#audioAllowed) {
      if (track.kind === "effect" || track.kind === "feedback") this.stop(track);
      else if (track.kind === "voice") {
        track.playRejected = true;
        const ended = track.ended;
        track.ended = null;
        ended?.();
      }
      return;
    }
    void track.element.play().then(() => {
      track.playRejected = false;
      // play() may resolve after entry cancellation or a background pause.
      if (!track.alive || this.#paused || !this.#audioAllowed || this.#disposed) this.pauseTrack(track);
    }).catch((error: unknown) => {
      if (!track.alive || this.#disposed) return;
      // A failed event cue is never retained for unlock or foreground catch-up.
      if (track.kind === "feedback") this.stop(track);
      if (this.#paused || !this.#audioAllowed) return;
      track.playRejected = true;
      if (track.kind === "tick") this.#choiceTickFailed = true;
      this.#report({
        code: "AUDIO_PLAY",
        message: `${track.kind === "feedback" ? "本次交互声音未播放，已跳过" : "声音暂未播放"}：${track.id}。`
          + `${track.kind === "feedback" ? "" : "可点击“启用声音”重试。"}${error instanceof Error ? ` ${error.name}` : ""}`,
        blocking: false,
      });
      // A rejected voice must not leave automatic reading waiting forever.
      const ended = track.ended;
      track.ended = null;
      ended?.();
      if (track.kind === "feedback" || track.kind === "tick") this.stop(track);
    });
  }

  unlock(): void {
    for (const track of this.#tracks) if (track.element.paused) this.play(track);
    this.#choiceTickFailed = false;
    this.syncChoiceTick();
  }

  /** Use on a separate mixer owned by a read-only viewer, never on story entry audio. */
  previewVoice(id: string, observer: VoicePreviewObserver): () => void {
    if (this.#resources.get(id).kind !== "vo") throw new Error(`历史语音需要登记的配音资源：${id}`);
    return this.preview(id, "voice", 1, observer);
  }

  /** Author-tagged collection, on its own mixer. Category/gain are re-read, never trusted from UI data. */
  previewLibrary(id: string, observer: AudioPreviewObserver): () => void {
    const entry = readLibraryEntry(this.#resources.get(id), { file: "audio-library", field: `assets.${id}` });
    if (!entry) throw new Error(`资源没有作者声音收藏分类：${id}`);
    return this.preview(id, entry.channel, entry.gain, observer);
  }

  private preview(id: string, channel: AudioChannel, gain: number, observer: AudioPreviewObserver): () => void {
    if (this.#disposed) throw new Error("试听声音实例已离开");
    if (this.#tracks.size || this.#music || this.#ambience.size || this.#entryDelays) {
      throw new Error("试听需要已清空的独立声音实例；请先停止上一段");
    }
    if (this.#paused || !this.#audioAllowed) throw new Error("当前声音未获准或正在暂停；恢复后请再次点击试听");
    if (this.#volumes[channel] === 0) throw new Error("当前试听轨道音量为 0；调高后请再次点击试听");
    let track: Track | null = null;
    let closed = false;
    const report = (problem: MediaProblem): void => { if (!closed) observer.problem(problem); };
    const releaseReporter = (): void => {
      if (this.#report === report) this.#report = () => {};
    };
    const finish = (): void => {
      if (closed) return;
      closed = true;
      if (track) this.stop(track);
      releaseReporter();
      observer.ended();
    };
    // The owner cancels an old preview before starting another, so stale failures cannot
    // acquire the new reporter. No scene, timer, checkpoint or story callback is involved.
    this.#report = report;
    try { track = this.track(id, channel, gain, finish); }
    catch (error: unknown) { closed = true; releaseReporter(); throw error; }
    const current = track;
    current.element.addEventListener("playing", () => {
      if (!closed && current.alive && !this.#disposed) observer.started();
    });
    return () => {
      if (closed) return;
      closed = true;
      this.stop(current);
      releaseReporter();
    };
  }

  private stop(track: Track): void {
    if (!track.alive) return;
    track.alive = false;
    track.fade?.cancel();
    track.fade = null;
    this.pauseTrack(track);
    track.element.removeAttribute("src");
    track.element.load();
    this.#tracks.delete(track);
    if (this.#choiceTick === track) this.#choiceTick = null;
  }

  private pauseTrack(track: Track): void {
    if (!track.element.paused) track.expectedPauses++;
    track.element.pause();
  }

  /** One-shot UI feedback is an actual event, never a queued or restored sound. */
  interaction(feedback: InteractionFeedback): void {
    if (this.#disposed) return;
    if (feedback.type === "choices") {
      this.#choiceTickWanted = feedback.active && feedback.timed;
      if (!feedback.active) this.#choiceTickFailed = false;
      if (feedback.active && feedback.announce) this.feedbackCue(this.#uiSounds.choiceShow);
      this.syncChoiceTick();
    } else {
      const gain = feedback.cue === "btnClick" ? 0.35 : feedback.cue === "btnHover" ? 0.22
        : feedback.cue === "favorDown" ? 0.75 : 1;
      this.feedbackCue(this.#uiSounds[feedback.cue], gain);
    }
  }

  private feedbackCue(id: string | undefined, gain = 1): void {
    if (!id || this.#paused || !this.#audioAllowed || this.#volumes.effects === 0) return;
    try { this.effect(id, gain, true); }
    catch (error: unknown) { this.feedbackProblem(id, error); }
  }

  private syncChoiceTick(): void {
    if (!this.#choiceTickWanted || this.#volumes.effects === 0 || this.#disposed) {
      if (this.#choiceTick) this.stop(this.#choiceTick);
      return;
    }
    if (this.#choiceTick?.alive || this.#paused || !this.#audioAllowed || this.#choiceTickFailed) return;
    const id = this.#uiSounds.timeoutTick;
    if (id) {
      try { this.#choiceTick = this.track(id, "effects", 1, null, null, "tick"); }
      catch (error: unknown) {
        this.#choiceTickFailed = true;
        this.feedbackProblem(id, error);
      }
    }
  }

  private feedbackProblem(id: string, error: unknown): void {
    this.#report({
      code: "UI_AUDIO", blocking: false,
      message: `交互提示音未播放：${id}。${error instanceof Error ? error.message : "声音不可用"}；剧情可继续。`,
    });
  }

  /** Scene and UI one-shots share the same cap and duplicate suppression. */
  private effect(id: string, gain: number, feedback = false): Track | null {
    const effects = [...this.#tracks].filter(track => track.kind === "effect" || track.kind === "feedback");
    if (effects.some(track => track.id === id && track.element.currentTime < 0.4)) return null;
    if (effects.length >= 4) this.stop(effects[0]!);
    return this.track(id, "effects", volume(gain), null, null, feedback ? "feedback" : undefined);
  }

  private fade(track: Track, target: number, duration: number, retire = false): void {
    track.fade?.cancel();
    if (!this.#clock || duration <= 0) {
      track.gain = volume(target);
      this.applyVolume(track);
      if (retire) this.stop(track);
      return;
    }
    const from = track.gain;
    const timer = new ActiveTimer(this.#clock, duration, () => {
      if (!track.alive) return;
      track.gain = volume(target);
      this.applyVolume(track);
      track.fade = null;
      if (retire) this.stop(track);
    }, () => {
      if (track.alive) {
        track.gain = volume(from + (target - from) * (1 - timer.remaining() / duration));
        this.applyVolume(track);
      }
    });
    track.fade = timer;
    timer.setPaused(this.#paused || !this.#audioAllowed);
  }

  private scene(presentation: Presentation, restored: PlaybackCheckpoint | null): void {
    const scene = presentation.scene;
    const music = scene.music.kind === "play" ? scene.music.assetId : null;
    const mood = scene.mood;
    const musicDuck = mood === "underwater" ? 0.35 : mood === "slowmo" ? 0.5 : 1;
    const ambienceDuck = mood === "underwater" ? 0.45 : mood === "slowmo" ? 0.15 : 1;
    if (this.#music?.id !== music || (this.#music && !this.#music.alive)) {
      if (this.#music) this.fade(this.#music, 0, scene.music.fadeMs, true);
      this.#music = music ? this.track(music, "music", 0, null, restored?.music?.positionMs ?? null) : null;
      if (this.#music) {
        const gain = setting(this.#resources.get(music!).metadata, "playbackGain", 1);
        this.fade(this.#music, volume(gain) * musicDuck, 800);
      }
    } else if (this.#music) {
      const gain = setting(this.#resources.get(this.#music.id).metadata, "playbackGain", 1);
      this.fade(this.#music, volume(gain) * musicDuck, 300);
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
        track = this.track(id, "ambience", 0, null, restored?.ambience.find(item => item.assetId === id)?.positionMs ?? null);
        this.#ambience.set(id, track);
      }
      const gain = volume(specification.gain)
        * (music ? 0.75 : 1) * ambienceDuck;
      this.fade(track, gain, 350);
    }
  }

  begin(presentation: Presentation, context: PresentationContext): EntryAudio {
    this.#clock = context.clock;
    this.#report = problem => { if (!context.signal.aborted) context.problem(problem); };
    this.setPaused(context.paused);
    if (context.mode !== "enter") {
      for (const track of [...this.#tracks]) if (track.kind === "feedback") this.stop(track);
    }
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
      voice = this.track(presentation.performance.voiceId, "voice", 1, voiceEnded,
        resumeVoice ? restoredVoice?.positionMs ?? null : null);
    } else voiceEnded();
    const effect = (id: string, gain: number): void => {
      if (closed || skipped || context.signal.aborted || this.#volumes.effects === 0) return;
      for (const old of effects) if (!old.alive) effects.delete(old);
      const track = this.effect(id, gain);
      if (track) effects.add(track);
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
        for (const track of [...this.#tracks]) if (track.kind === "feedback") this.stop(track);
        voiceEnded();
      },
    };
  }

  #entryDelays: Set<ActiveTimer> | null = null;

  setPaused(paused: boolean): void {
    this.#paused = paused;
    for (const track of this.#tracks) {
      track.fade?.setPaused(paused || !this.#audioAllowed);
      if (paused) this.pauseTrack(track);
      else if (track.element.paused) this.play(track);
    }
    for (const timer of this.#entryDelays ?? []) timer.setPaused(paused);
    this.syncChoiceTick();
  }

  setAudioAllowed(allowed: boolean): void {
    if (this.#disposed || this.#audioAllowed === allowed) return;
    this.#audioAllowed = allowed;
    for (const track of this.#tracks) {
      track.fade?.setPaused(this.#paused || !allowed);
      if (!allowed && track.kind === "feedback") this.stop(track);
      else if (!allowed) this.pauseTrack(track);
      else if (!this.#paused && track.element.paused) this.play(track);
    }
    this.syncChoiceTick();
  }

  /** End story audio; retain only the capability to play a new terminal event. */
  end(paused: boolean, report: (problem: MediaProblem) => void): void {
    if (this.#disposed) return;
    this.#choiceTickWanted = false;
    for (const track of [...this.#tracks]) this.stop(track);
    for (const timer of this.#entryDelays ?? []) timer.cancel();
    this.#entryDelays = null;
    this.#ambience.clear();
    this.#music = null;
    this.#paused = paused;
    this.#report = report;
  }

  dispose(): void {
    this.#disposed = true;
    this.#choiceTickWanted = false;
    for (const track of [...this.#tracks]) this.stop(track);
    for (const timer of this.#entryDelays ?? []) timer.cancel();
    this.#ambience.clear();
    this.#music = null;
  }
}
