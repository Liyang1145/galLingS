import type { JsonObject } from "../../story-model/src/model.ts";
import { at, knownFields, numeric, object, reject, string } from "../../story-model/src/read.ts";
import type { RecordScope, StoredSlot } from "./saves.ts";

export const READING_KEYS = ["textSpeedMs", "autoWaitMultiplier", "textScale", "dialogueOpacity"] as const;
export type ReadingKey = (typeof READING_KEYS)[number];
export type ReadingPreferences = Record<ReadingKey, number>;
export type ReadingPreferenceChange = Partial<Record<ReadingKey, number | null>>;
type ReadingOverrides = Partial<ReadingPreferences>;

export const READING_LIMITS = {
  textSpeedMs: { min: 5, max: 80, step: 5 },
  autoWaitMultiplier: { min: 0.4, max: 2.5, step: 0.1 },
  textScale: { min: 1, max: 1.25, step: 0.05 },
  dialogueOpacity: { min: 0.35, max: 0.95, step: 0.05 },
} as const;

export interface ReadingPreferenceRecord {
  format: "haifeng.reading-preferences/1";
  workId: string;
  scope: RecordScope;
  overrides: ReadingOverrides;
}

export interface ReadingPreferenceState {
  record: ReadingPreferenceRecord;
  values: ReadingPreferences;
}

export interface AtomicReadingPreferenceStore {
  read(key: string): Promise<StoredSlot>;
  updateReading(key: string, change: (stored: StoredSlot) => ReadingPreferenceRecord): Promise<ReadingPreferenceRecord>;
}

const SOURCE = { file: "reading-preferences", field: "" };

export function readReadingValue(key: ReadingKey, input: unknown): number {
  const where = at(SOURCE, key);
  const value = numeric(input, where);
  const { min, max } = READING_LIMITS[key];
  if (value < min || value > max) reject("READING_PREFERENCE_RANGE", `${key} 必须在 ${min}～${max} 之间`, where);
  return value;
}

export function readReadingPreferences(input: unknown): ReadingPreferences {
  const data = object(input, SOURCE);
  knownFields(data, READING_KEYS, SOURCE);
  return {
    textSpeedMs: readReadingValue("textSpeedMs", data.textSpeedMs),
    autoWaitMultiplier: readReadingValue("autoWaitMultiplier", data.autoWaitMultiplier),
    textScale: readReadingValue("textScale", data.textScale),
    dialogueOpacity: readReadingValue("dialogueOpacity", data.dialogueOpacity),
  };
}

/** Keep authored timing and display defaults separate from player overrides. */
export function authorReadingPreferences(settings: JsonObject): ReadingPreferences {
  const value = (key: string, fallback: number): unknown => settings[key] === undefined ? fallback : settings[key];
  return readReadingPreferences({
    textSpeedMs: value("speed", 30),
    autoWaitMultiplier: value("autoMul", 1),
    textScale: value("readerScale", 1),
    dialogueOpacity: value("ghost", 0.35),
  });
}

function readScope(input: unknown): RecordScope {
  const where = at(SOURCE, "scope");
  const data = object(input, where);
  knownFields(data, ["kind", "id"], where);
  const kind = data.kind;
  const id = string(data.id, at(where, "id"));
  if ((kind !== "development" && kind !== "preview" && kind !== "game") || !id.trim() || id.length > 128) {
    reject("READING_PREFERENCE_SCOPE", "阅读偏好范围无效", where);
  }
  return { kind, id };
}

/** Reading preferences never replace progress, achievements or audio preferences. */
export class ReadingPreferenceRepository {
  readonly #workId: string;
  readonly #scope: RecordScope;
  readonly #defaults: ReadingPreferences;
  readonly #store: AtomicReadingPreferenceStore;
  readonly #key: string;

  constructor(workId: string, scope: RecordScope, defaults: ReadingPreferences, store: AtomicReadingPreferenceStore) {
    if (!workId.trim()) reject("READING_PREFERENCE_WORK", "缺少阅读偏好所属作品", SOURCE);
    this.#workId = workId;
    this.#scope = readScope(scope);
    this.#defaults = readReadingPreferences(defaults);
    this.#store = store;
    this.#key = JSON.stringify(["haifeng.reading-preferences/1", workId, this.#scope.kind, this.#scope.id]);
  }

  private inspect(stored: StoredSlot): ReadingPreferenceState {
    if (!stored.found) {
      return {
        record: { format: "haifeng.reading-preferences/1", workId: this.#workId, scope: { ...this.#scope }, overrides: {} },
        values: { ...this.#defaults },
      };
    }
    const data = object(stored.value, SOURCE);
    knownFields(data, ["format", "workId", "scope", "overrides"], SOURCE);
    const scope = readScope(data.scope);
    if (data.format !== "haifeng.reading-preferences/1" || data.workId !== this.#workId
      || scope.kind !== this.#scope.kind || scope.id !== this.#scope.id) {
      reject("READING_PREFERENCE_IDENTITY", "阅读偏好格式、作品或范围不匹配", SOURCE);
    }
    const input = object(data.overrides, at(SOURCE, "overrides"));
    knownFields(input, READING_KEYS, at(SOURCE, "overrides"));
    const overrides: ReadingOverrides = {};
    for (const key of READING_KEYS) {
      if (Object.hasOwn(input, key)) overrides[key] = readReadingValue(key, input[key]);
    }
    return {
      record: { format: "haifeng.reading-preferences/1", workId: this.#workId, scope, overrides },
      values: { ...this.#defaults, ...overrides },
    };
  }

  async read(): Promise<ReadingPreferenceState> { return this.inspect(await this.#store.read(this.#key)); }

  async update(input: ReadingPreferenceChange): Promise<ReadingPreferenceState> {
    const data = object(input, SOURCE);
    knownFields(data, READING_KEYS, SOURCE);
    const changes: ReadingPreferenceChange = {};
    for (const key of READING_KEYS) {
      if (Object.hasOwn(data, key)) changes[key] = data[key] === null ? null : readReadingValue(key, data[key]);
    }
    const record = await this.#store.updateReading(this.#key, stored => {
      const current = this.inspect(stored).record;
      for (const key of READING_KEYS) {
        const change = changes[key];
        if (change === null) delete current.overrides[key];
        else if (change !== undefined) current.overrides[key] = change;
      }
      return current;
    });
    return this.inspect({ found: true, value: record });
  }
}
