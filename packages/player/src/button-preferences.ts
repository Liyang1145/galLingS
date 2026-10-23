import type { JsonObject } from "../../story-model/src/model.ts";
import { at, knownFields, object, reject, string } from "../../story-model/src/read.ts";
import type { RecordScope, StoredSlot } from "./saves.ts";

export interface ButtonPreferences { enabled: boolean }
export interface ButtonPreferenceChange { enabled?: boolean | null }
export interface ButtonPreferenceRecord {
  format: "haifeng.button-preferences/1";
  workId: string;
  scope: RecordScope;
  overrides: { enabled?: boolean };
}
export interface ButtonPreferenceState {
  record: ButtonPreferenceRecord;
  values: ButtonPreferences;
}
export interface AtomicButtonPreferenceStore {
  read(key: string): Promise<StoredSlot>;
  updateButtons(key: string, change: (stored: StoredSlot) => ButtonPreferenceRecord): Promise<ButtonPreferenceRecord>;
}

const SOURCE = { file: "button-preferences", field: "" };

function enabled(input: unknown): boolean {
  if (typeof input !== "boolean") reject("BUTTON_PREFERENCE_TYPE", "按钮声音开关必须是布尔值", at(SOURCE, "enabled"));
  return input;
}

export function readButtonPreferences(input: unknown): ButtonPreferences {
  const data = object(input, SOURCE);
  knownFields(data, ["enabled"], SOURCE);
  return { enabled: enabled(data.enabled) };
}

export function authorButtonPreferences(settings: JsonObject): ButtonPreferences {
  return { enabled: settings.btnSe === undefined ? true : enabled(settings.btnSe) };
}

function readScope(input: unknown): RecordScope {
  const where = at(SOURCE, "scope");
  const data = object(input, where);
  knownFields(data, ["kind", "id"], where);
  const kind = data.kind;
  const id = string(data.id, at(where, "id"));
  if ((kind !== "development" && kind !== "preview" && kind !== "game") || !id.trim() || id.length > 128) {
    reject("BUTTON_PREFERENCE_SCOPE", "按钮声音偏好范围无效", where);
  }
  return { kind, id };
}

/** Button UI preferences have their own namespace; existing strict formats stay unchanged. */
export class ButtonPreferenceRepository {
  readonly #workId: string;
  readonly #scope: RecordScope;
  readonly #defaults: ButtonPreferences;
  readonly #store: AtomicButtonPreferenceStore;
  readonly #key: string;

  constructor(workId: string, scope: RecordScope, defaults: ButtonPreferences, store: AtomicButtonPreferenceStore) {
    if (!workId.trim()) reject("BUTTON_PREFERENCE_WORK", "缺少按钮声音偏好所属作品", SOURCE);
    this.#workId = workId;
    this.#scope = readScope(scope);
    this.#defaults = readButtonPreferences(defaults);
    this.#store = store;
    this.#key = JSON.stringify(["haifeng.button-preferences/1", workId, this.#scope.kind, this.#scope.id]);
  }

  private inspect(stored: StoredSlot): ButtonPreferenceState {
    if (!stored.found) {
      return {
        record: { format: "haifeng.button-preferences/1", workId: this.#workId, scope: { ...this.#scope }, overrides: {} },
        values: { ...this.#defaults },
      };
    }
    const data = object(stored.value, SOURCE);
    knownFields(data, ["format", "workId", "scope", "overrides"], SOURCE);
    const scope = readScope(data.scope);
    if (data.format !== "haifeng.button-preferences/1" || data.workId !== this.#workId
      || scope.kind !== this.#scope.kind || scope.id !== this.#scope.id) {
      reject("BUTTON_PREFERENCE_IDENTITY", "按钮声音偏好格式、作品或范围不匹配", SOURCE);
    }
    const input = object(data.overrides, at(SOURCE, "overrides"));
    knownFields(input, ["enabled"], at(SOURCE, "overrides"));
    const overrides: ButtonPreferenceRecord["overrides"] = {};
    if (Object.hasOwn(input, "enabled")) overrides.enabled = enabled(input.enabled);
    return {
      record: { format: "haifeng.button-preferences/1", workId: this.#workId, scope, overrides },
      values: { ...this.#defaults, ...overrides },
    };
  }

  async read(): Promise<ButtonPreferenceState> { return this.inspect(await this.#store.read(this.#key)); }

  async update(input: ButtonPreferenceChange): Promise<ButtonPreferenceState> {
    const data = object(input, SOURCE);
    knownFields(data, ["enabled"], SOURCE);
    const change = Object.hasOwn(data, "enabled") ? data.enabled === null ? null : enabled(data.enabled) : undefined;
    const record = await this.#store.updateButtons(this.#key, stored => {
      const current = this.inspect(stored).record;
      if (change === null) delete current.overrides.enabled;
      else if (change !== undefined) current.overrides.enabled = change;
      return current;
    });
    return this.inspect({ found: true, value: record });
  }
}
