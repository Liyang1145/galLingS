import type { JsonObject } from "../../story-model/src/model.ts";
import { at, knownFields, object, reject, string } from "../../story-model/src/read.ts";
import type { RecordScope, StoredSlot } from "./saves.ts";

export interface ReadoutPreferences { enabled: boolean }
export interface ReadoutPreferenceChange { enabled?: boolean | null }
export interface ReadoutPreferenceRecord {
  format: "haifeng.readout-preferences/1";
  workId: string;
  scope: RecordScope;
  overrides: { enabled?: boolean };
}
export interface ReadoutPreferenceState {
  record: ReadoutPreferenceRecord;
  values: ReadoutPreferences;
}
export interface AtomicReadoutPreferenceStore {
  read(key: string): Promise<StoredSlot>;
  updateReadout(key: string, change: (stored: StoredSlot) => ReadoutPreferenceRecord): Promise<ReadoutPreferenceRecord>;
}

const SOURCE = { file: "readout-preferences", field: "" };
function enabled(input: unknown): boolean {
  if (typeof input !== "boolean") reject("READOUT_PREFERENCE_TYPE", "剧透数值显示开关必须是布尔值", at(SOURCE, "enabled"));
  return input;
}
export function readReadoutPreferences(input: unknown): ReadoutPreferences {
  const data = object(input, SOURCE);
  knownFields(data, ["enabled"], SOURCE);
  return { enabled: enabled(data.enabled) };
}
export function authorReadoutPreferences(settings: JsonObject): ReadoutPreferences {
  return { enabled: settings.showStats === undefined ? false : enabled(settings.showStats) };
}
function readScope(input: unknown): RecordScope {
  const where = at(SOURCE, "scope");
  const data = object(input, where);
  knownFields(data, ["kind", "id"], where);
  const kind = data.kind;
  const id = string(data.id, at(where, "id"));
  if ((kind !== "development" && kind !== "preview" && kind !== "game") || !id.trim() || id.length > 128) {
    reject("READOUT_PREFERENCE_SCOPE", "数值显示偏好范围无效", where);
  }
  return { kind, id };
}

/** Separate opt-in preferences; no changes to story, achievements or existing strict records. */
export class ReadoutPreferenceRepository {
  readonly #workId: string;
  readonly #scope: RecordScope;
  readonly #defaults: ReadoutPreferences;
  readonly #store: AtomicReadoutPreferenceStore;
  readonly #key: string;

  constructor(workId: string, scope: RecordScope, defaults: ReadoutPreferences, store: AtomicReadoutPreferenceStore) {
    if (!workId.trim()) reject("READOUT_PREFERENCE_WORK", "缺少数值显示偏好所属作品", SOURCE);
    this.#workId = workId;
    this.#scope = readScope(scope);
    this.#defaults = readReadoutPreferences(defaults);
    this.#store = store;
    this.#key = JSON.stringify(["haifeng.readout-preferences/1", workId, this.#scope.kind, this.#scope.id]);
  }

  private inspect(stored: StoredSlot): ReadoutPreferenceState {
    if (!stored.found) return {
      record: { format: "haifeng.readout-preferences/1", workId: this.#workId, scope: { ...this.#scope }, overrides: {} },
      values: { ...this.#defaults },
    };
    const data = object(stored.value, SOURCE);
    knownFields(data, ["format", "workId", "scope", "overrides"], SOURCE);
    const scope = readScope(data.scope);
    if (data.format !== "haifeng.readout-preferences/1" || data.workId !== this.#workId
      || scope.kind !== this.#scope.kind || scope.id !== this.#scope.id) {
      reject("READOUT_PREFERENCE_IDENTITY", "数值显示偏好格式、作品或范围不匹配", SOURCE);
    }
    const input = object(data.overrides, at(SOURCE, "overrides"));
    knownFields(input, ["enabled"], at(SOURCE, "overrides"));
    const overrides: ReadoutPreferenceRecord["overrides"] = {};
    if (Object.hasOwn(input, "enabled")) overrides.enabled = enabled(input.enabled);
    return {
      record: { format: "haifeng.readout-preferences/1", workId: this.#workId, scope, overrides },
      values: { ...this.#defaults, ...overrides },
    };
  }

  async read(): Promise<ReadoutPreferenceState> { return this.inspect(await this.#store.read(this.#key)); }

  async update(input: ReadoutPreferenceChange): Promise<ReadoutPreferenceState> {
    const data = object(input, SOURCE);
    knownFields(data, ["enabled"], SOURCE);
    const change = Object.hasOwn(data, "enabled") ? data.enabled === null ? null : enabled(data.enabled) : undefined;
    const record = await this.#store.updateReadout(this.#key, stored => {
      const current = this.inspect(stored).record;
      if (change === null) delete current.overrides.enabled;
      else if (change !== undefined) current.overrides.enabled = change;
      return current;
    });
    return this.inspect({ found: true, value: record });
  }
}
