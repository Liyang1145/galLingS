import type { StoryContent } from "../../story-model/src/model.ts";
import { at, knownFields, numeric, object, reject, string } from "../../story-model/src/read.ts";
import { inspectStorySnapshot } from "../../story-runtime/src/index.ts";
import type { RuntimeView, StorySnapshot } from "../../story-runtime/src/index.ts";

export interface TrackCheckpoint {
  assetId: string;
  /** Null means no usable media position was available, never an assumed zero. */
  positionMs: number | null;
}

export interface VoiceCheckpoint extends TrackCheckpoint {
  state: "active" | "finished" | "skipped" | "unavailable";
}

export interface PlaybackCheckpoint {
  music: TrackCheckpoint | null;
  ambience: TrackCheckpoint[];
  voice: VoiceCheckpoint | null;
}

/** Stable target scene; no animation objects, transient sounds or callbacks. */
export interface GameCheckpoint {
  format: "haifeng.game-checkpoint/1";
  story: StorySnapshot;
  presentation: { kind: "target-scene"; playback: PlaybackCheckpoint };
  timing: {
    choiceRemainingMs: number | null;
    advance: { remainingMs: number; waitVoice: boolean } | null;
    waitingForVoice: boolean;
    voiceDone: boolean;
  };
  controls: { auto: boolean; skipping: boolean };
}

export interface InspectedCheckpoint {
  checkpoint: GameCheckpoint;
  view: RuntimeView;
}

const SOURCE = { file: "game-checkpoint", field: "" };

/** Uses the one story core for snapshot semantics; never adopts or re-enters. */
export function inspectGameCheckpoint(content: StoryContent, input: unknown): InspectedCheckpoint {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "story", "presentation", "timing", "controls"], SOURCE);
  if (data.format !== "haifeng.game-checkpoint/1") reject("CHECKPOINT_FORMAT", "不支持的游戏检查点格式", SOURCE);
  const { snapshot, view } = inspectStorySnapshot(content, data.story);
  if (view.phase !== "ready" && view.phase !== "choosing") {
    reject("CHECKPOINT_PHASE", "本切片只支持文字完成后的非结局检查点", at(SOURCE, "story.phase"));
  }
  const position = (value: unknown, field: string): number => {
    const source = at(SOURCE, field);
    const result = numeric(value, source);
    if (result < 0) reject("CHECKPOINT_TIME", "时间不能为负数", source);
    return result;
  };
  const flag = (record: Record<string, unknown>, name: string, parent: string): boolean => {
    const value = record[name];
    if (typeof value !== "boolean") reject("CHECKPOINT_STATE", "需要明确的布尔状态", at(SOURCE, `${parent}.${name}`));
    return value;
  };
  const track = (value: unknown, expected: string, field: string, voice = false): TrackCheckpoint => {
    const source = at(SOURCE, field);
    const record = object(value, source);
    knownFields(record, voice ? ["assetId", "positionMs", "state"] : ["assetId", "positionMs"], source);
    const assetId = string(record.assetId, at(source, "assetId"));
    if (assetId !== expected) reject("CHECKPOINT_MEDIA", "音轨与当前节点目标场景不一致", source);
    return { assetId, positionMs: record.positionMs === null ? null : position(record.positionMs, `${field}.positionMs`) };
  };
  const presentation = object(data.presentation, at(SOURCE, "presentation"));
  knownFields(presentation, ["kind", "playback"], at(SOURCE, "presentation"));
  if (presentation.kind !== "target-scene") reject("CHECKPOINT_PRESENTATION", "不支持的场景检查点", at(SOURCE, "presentation"));
  const playbackSource = at(SOURCE, "presentation.playback");
  const playback = object(presentation.playback, playbackSource);
  knownFields(playback, ["music", "ambience", "voice"], playbackSource);
  const scene = view.presentation.scene;
  let music: TrackCheckpoint | null = null;
  if (scene.music.kind === "play") music = track(playback.music, scene.music.assetId, "presentation.playback.music");
  else if (playback.music !== null) reject("CHECKPOINT_MEDIA", "停奏场景不能保存播放中的音乐", playbackSource);
  if (!Array.isArray(playback.ambience) || playback.ambience.length !== scene.ambience.length) {
    reject("CHECKPOINT_MEDIA", "环境声与当前节点目标场景不一致", playbackSource);
  }
  const ambience = playback.ambience.map((value: unknown, index: number) =>
    track(value, scene.ambience[index]!.assetId, `presentation.playback.ambience.${index}`));
  let voice: VoiceCheckpoint | null = null;
  const voiceId = view.presentation.performance.voiceId;
  if (voiceId) {
    const field = "presentation.playback.voice";
    const captured = track(playback.voice, voiceId, field, true);
    const record = object(playback.voice, at(SOURCE, field));
    const state = string(record.state, at(SOURCE, `${field}.state`));
    if (state !== "active" && state !== "finished" && state !== "skipped" && state !== "unavailable") {
      reject("CHECKPOINT_MEDIA", "未知语音播放状态", at(SOURCE, field));
    }
    voice = { ...captured, state };
  } else if (playback.voice !== null) reject("CHECKPOINT_MEDIA", "当前节点没有对白语音", playbackSource);

  const timingSource = at(SOURCE, "timing");
  const timing = object(data.timing, timingSource);
  knownFields(timing, ["choiceRemainingMs", "advance", "waitingForVoice", "voiceDone"], timingSource);
  let choiceRemainingMs: number | null = null;
  if (view.timeout) {
    choiceRemainingMs = position(timing.choiceRemainingMs, "timing.choiceRemainingMs");
    if (choiceRemainingMs > view.timeout.durationMs) reject("CHECKPOINT_TIME", "选择剩余时间超过作者时长", timingSource);
  } else if (timing.choiceRemainingMs !== null) reject("CHECKPOINT_TIME", "当前阶段没有限时选择", timingSource);
  let advance: GameCheckpoint["timing"]["advance"] = null;
  if (timing.advance !== null) {
    const record = object(timing.advance, at(timingSource, "advance"));
    knownFields(record, ["remainingMs", "waitVoice"], at(timingSource, "advance"));
    advance = {
      remainingMs: position(record.remainingMs, "timing.advance.remainingMs"),
      waitVoice: flag(record, "waitVoice", "timing.advance"),
    };
  }
  const controlsSource = at(SOURCE, "controls");
  const controls = object(data.controls, controlsSource);
  knownFields(controls, ["auto", "skipping"], controlsSource);
  // Unlike author settings, external checkpoints have no default booleans.
  const auto = flag(controls, "auto", "controls");
  const skipping = flag(controls, "skipping", "controls");
  const waitingForVoice = flag(timing, "waitingForVoice", "timing");
  const voiceDone = flag(timing, "voiceDone", "timing");
  if (view.phase === "choosing" && (advance !== null || waitingForVoice || skipping)) {
    reject("CHECKPOINT_STATE", "选择阶段不能保存自动推进或快进等待", timingSource);
  }
  if (waitingForVoice && (!auto || skipping || voiceDone || advance !== null)) {
    reject("CHECKPOINT_STATE", "等待语音与当前推进状态不一致", timingSource);
  }
  if (!voice && !voiceDone) reject("CHECKPOINT_STATE", "无语音节点不能等待语音结束", timingSource);
  return {
    checkpoint: {
      format: "haifeng.game-checkpoint/1", story: snapshot,
      presentation: { kind: "target-scene", playback: { music, ambience, voice } },
      timing: { choiceRemainingMs, advance, waitingForVoice, voiceDone }, controls: { auto, skipping },
    },
    view,
  };
}
