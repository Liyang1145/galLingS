import type { StoryContent } from "../../story-model/src/model.ts";
import { at, knownFields, object, reject, string } from "../../story-model/src/read.ts";
import type { RecordScope, StoredSlot } from "./saves.ts";

export const VOICE_KEYS = ["early", "later"] as const;
export type VoiceKey = (typeof VOICE_KEYS)[number];
export type VoicePreferences = Record<VoiceKey, boolean>;
export type VoicePreferenceChange = Partial<Record<VoiceKey, boolean | null>>;
export interface VoicePreferenceRecord {
  format: "haifeng.voice-preferences/1";
  workId: string;
  scope: RecordScope;
  overrides: Partial<VoicePreferences>;
}
export interface AtomicVoicePreferenceStore {
  read(key: string): Promise<StoredSlot>;
  updateVoice(key: string, change: (stored: StoredSlot) => VoicePreferenceRecord): Promise<VoicePreferenceRecord>;
}
const SOURCE = { file: "voice-preferences", field: "" };
function flag(input: unknown): boolean {
  if (typeof input !== "boolean") reject("VOICE_PREFERENCE_TYPE", "语音开关必须是布尔值", SOURCE);
  return input;
}
export function readVoicePreferences(input: unknown): VoicePreferences {
  const value = object(input, SOURCE);
  knownFields(value, VOICE_KEYS, SOURCE);
  return { early: flag(value.early), later: flag(value.later) };
}

/** Author order identifies the declared chapter boundary; this never evaluates story flow. */
export class VoicePolicy {
  readonly defaults: VoicePreferences;
  readonly #keys = new Map<string, VoiceKey>();
  constructor(content: StoryContent) {
    const settings = content.source.settings;
    const boundary = settings.voiceOptionalFromChapterId;
    if (boundary !== undefined && (typeof boundary !== "string" || !content.nodes.some(node => node.id === boundary))) {
      reject("VOICE_BOUNDARY", "语音默认边界必须指向已有节点", SOURCE);
    }
    this.defaults = { early: true, later: settings.voiceLaterChapters === undefined ? false : flag(settings.voiceLaterChapters) };
    let key: VoiceKey = "early";
    for (const node of content.nodes) {
      if (node.id === boundary) key = "later";
      this.#keys.set(node.id, key);
    }
  }
  key(nodeId: string): VoiceKey {
    const key = this.#keys.get(nodeId);
    if (!key) reject("VOICE_NODE", "语音设置节点不属于当前作品", { ...SOURCE, nodeId });
    return key;
  }
}

/** Independent preferences, shared by browser/native atomic stores; never checkpoint data. */
export class VoicePreferenceRepository {
  readonly #workId: string;
  readonly #scope: RecordScope;
  readonly #defaults: VoicePreferences;
  readonly #store: AtomicVoicePreferenceStore;
  readonly #key: string;
  constructor(workId: string, scope: RecordScope, defaults: VoicePreferences, store: AtomicVoicePreferenceStore) {
    if (!workId.trim()) reject("VOICE_PREFERENCE_WORK", "缺少语音偏好所属作品", SOURCE);
    this.#workId = workId;
    this.#scope = this.readScope(scope);
    this.#defaults = readVoicePreferences(defaults);
    this.#store = store;
    this.#key = JSON.stringify(["haifeng.voice-preferences/1", workId, scope.kind, scope.id]);
  }
  private readScope(input: unknown): RecordScope {
    const where = at(SOURCE, "scope");
    const data = object(input, where);
    knownFields(data, ["kind", "id"], where);
    const kind = data.kind;
    const id = string(data.id, at(where, "id"));
    if ((kind !== "development" && kind !== "preview" && kind !== "game") || !id.trim() || id.length > 128) {
      reject("VOICE_PREFERENCE_SCOPE", "语音偏好范围无效", where);
    }
    return { kind, id };
  }
  private inspect(stored: StoredSlot): { record: VoicePreferenceRecord; values: VoicePreferences } {
    if (!stored.found) return {
      record: { format: "haifeng.voice-preferences/1", workId: this.#workId, scope: { ...this.#scope }, overrides: {} },
      values: { ...this.#defaults },
    };
    const data = object(stored.value, SOURCE);
    knownFields(data, ["format", "workId", "scope", "overrides"], SOURCE);
    const scope = this.readScope(data.scope);
    if (data.format !== "haifeng.voice-preferences/1" || data.workId !== this.#workId
      || scope.kind !== this.#scope.kind || scope.id !== this.#scope.id) {
      reject("VOICE_PREFERENCE_IDENTITY", "语音偏好格式、作品或范围不匹配", SOURCE);
    }
    const input = object(data.overrides, at(SOURCE, "overrides"));
    knownFields(input, VOICE_KEYS, at(SOURCE, "overrides"));
    const overrides: Partial<VoicePreferences> = {};
    for (const key of VOICE_KEYS) if (Object.hasOwn(input, key)) overrides[key] = flag(input[key]);
    return { record: { format: "haifeng.voice-preferences/1", workId: this.#workId, scope, overrides },
      values: { ...this.#defaults, ...overrides } };
  }
  async read(): Promise<{ record: VoicePreferenceRecord; values: VoicePreferences }> {
    return this.inspect(await this.#store.read(this.#key));
  }
  async update(input: VoicePreferenceChange): Promise<{ record: VoicePreferenceRecord; values: VoicePreferences }> {
    const data = object(input, SOURCE);
    knownFields(data, VOICE_KEYS, SOURCE);
    const changes: VoicePreferenceChange = {};
    for (const key of VOICE_KEYS) if (Object.hasOwn(data, key)) changes[key] = data[key] === null ? null : flag(data[key]);
    const record = await this.#store.updateVoice(this.#key, stored => {
      const current = this.inspect(stored).record;
      for (const key of VOICE_KEYS) {
        const change = changes[key];
        if (change === null) delete current.overrides[key];
        else if (change !== undefined) current.overrides[key] = change;
      }
      return current;
    });
    return this.inspect({ found: true, value: record });
  }
}
