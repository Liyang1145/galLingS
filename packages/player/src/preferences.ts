import type { JsonObject } from "../../story-model/src/model.ts";
import { at, knownFields, numeric, object, reject, string } from "../../story-model/src/read.ts";
import type { RecordScope, StoredSlot } from "./saves.ts";

export const AUDIO_CHANNELS = ["music", "ambience", "voice", "effects"] as const;
export type AudioChannel = (typeof AUDIO_CHANNELS)[number];
export type AudioVolumes = Record<AudioChannel, number>;
export type AudioOverrides = Partial<AudioVolumes>;
/** Null explicitly follows the author default; absent channels remain unchanged. */
export type AudioPreferenceChange = Partial<Record<AudioChannel, number | null>>;

export interface AudioPreferenceRecord {
  format: "haifeng.audio-preferences/1";
  workId: string;
  scope: RecordScope;
  overrides: AudioOverrides;
}

export interface AudioPreferenceState {
  record: AudioPreferenceRecord;
  volumes: AudioVolumes;
}

export interface AtomicAudioPreferenceStore {
  read(key: string): Promise<StoredSlot>;
  updateAudio(key: string, change: (stored: StoredSlot) => AudioPreferenceRecord): Promise<AudioPreferenceRecord>;
}

const SOURCE = { file: "audio-preferences", field: "" };

function level(input: unknown, field: string): number {
  const where = at(SOURCE, field);
  const value = numeric(input, where);
  if (value < 0 || value > 1) reject("PREFERENCE_LEVEL", "音量必须在 0～1 之间", where);
  return value;
}

export function readAudioVolumes(input: unknown): AudioVolumes {
  const data = object(input, SOURCE);
  knownFields(data, AUDIO_CHANNELS, SOURCE);
  return {
    music: level(data.music, "music"), ambience: level(data.ambience, "ambience"),
    voice: level(data.voice, "voice"), effects: level(data.effects, "effects"),
  };
}

/** Existing author defaults and playback fallbacks, never player data or author mutation. */
export function authorAudioVolumes(settings: JsonObject): AudioVolumes {
  const value = (key: string, fallback: number): number =>
    settings[key] === undefined ? fallback : level(settings[key], `author.${key}`);
  return {
    music: value("vbgm", 0.6), ambience: value("vamb", 0.3),
    voice: value("vvo", 1), effects: value("vse", 0.8),
  };
}

function readScope(input: unknown): RecordScope {
  const where = at(SOURCE, "scope");
  const data = object(input, where);
  knownFields(data, ["kind", "id"], where);
  const kind = data.kind;
  const id = string(data.id, at(where, "id"));
  if ((kind !== "development" && kind !== "preview" && kind !== "game") || !id.trim() || id.length > 128) {
    reject("PREFERENCE_SCOPE", "偏好记录范围无效", where);
  }
  return { kind, id };
}

/** Preferences never enter checkpoints or the global achievements record. */
export class AudioPreferenceRepository {
  readonly #workId: string;
  readonly #scope: RecordScope;
  readonly #defaults: AudioVolumes;
  readonly #store: AtomicAudioPreferenceStore;
  readonly #key: string;

  constructor(workId: string, scope: RecordScope, defaults: AudioVolumes, store: AtomicAudioPreferenceStore) {
    if (!workId.trim()) reject("PREFERENCE_WORK", "缺少偏好所属作品", SOURCE);
    this.#workId = workId;
    this.#scope = readScope(scope);
    this.#defaults = readAudioVolumes(defaults);
    this.#store = store;
    this.#key = JSON.stringify(["haifeng.audio-preferences/1", workId, this.#scope.kind, this.#scope.id]);
  }

  private inspect(stored: StoredSlot): AudioPreferenceState {
    if (!stored.found) {
      return {
        record: { format: "haifeng.audio-preferences/1", workId: this.#workId, scope: { ...this.#scope }, overrides: {} },
        volumes: { ...this.#defaults },
      };
    }
    const data = object(stored.value, SOURCE);
    knownFields(data, ["format", "workId", "scope", "overrides"], SOURCE);
    const scope = readScope(data.scope);
    if (data.format !== "haifeng.audio-preferences/1" || data.workId !== this.#workId
      || scope.kind !== this.#scope.kind || scope.id !== this.#scope.id) {
      reject("PREFERENCE_IDENTITY", "声音偏好格式、作品或范围不匹配", SOURCE);
    }
    const input = object(data.overrides, at(SOURCE, "overrides"));
    knownFields(input, AUDIO_CHANNELS, at(SOURCE, "overrides"));
    const overrides: AudioOverrides = {};
    for (const channel of AUDIO_CHANNELS) {
      if (Object.hasOwn(input, channel)) overrides[channel] = level(input[channel], `overrides.${channel}`);
    }
    return {
      record: { format: "haifeng.audio-preferences/1", workId: this.#workId, scope, overrides },
      volumes: { ...this.#defaults, ...overrides },
    };
  }

  async read(): Promise<AudioPreferenceState> { return this.inspect(await this.#store.read(this.#key)); }

  async update(input: AudioPreferenceChange): Promise<AudioPreferenceState> {
    const data = object(input, SOURCE);
    knownFields(data, AUDIO_CHANNELS, SOURCE);
    const changes: AudioPreferenceChange = {};
    for (const channel of AUDIO_CHANNELS) {
      if (Object.hasOwn(data, channel)) changes[channel] = data[channel] === null ? null : level(data[channel], channel);
    }
    const record = await this.#store.updateAudio(this.#key, stored => {
      const current = this.inspect(stored).record;
      for (const channel of AUDIO_CHANNELS) {
        const change = changes[channel];
        if (change === null) delete current.overrides[channel];
        else if (change !== undefined) current.overrides[channel] = change;
      }
      return current;
    });
    return this.inspect({ found: true, value: record });
  }
}
