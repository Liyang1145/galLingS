import type { AtomicVoicePreferenceStore, VoicePreferenceRecord } from "../voice-preferences.ts";
import type { AtomicSaveStore, SaveRecord, StoredSlot, StoredSavePage } from "../saves.ts";
import { SaveStorageError } from "../saves.ts";
import type { AtomicPlayerStore, PlayerRecords } from "../records.ts";
import type { AtomicAudioPreferenceStore, AudioPreferenceRecord } from "../preferences.ts";
import type { AtomicReadingPreferenceStore, ReadingPreferenceRecord } from "../reading-preferences.ts";
import type { AtomicButtonPreferenceStore, ButtonPreferenceRecord } from "../button-preferences.ts";
import type { AtomicReadoutPreferenceStore, ReadoutPreferenceRecord } from "../readout-preferences.ts";

export type GameRecordStore = AtomicSaveStore & AtomicPlayerStore & AtomicAudioPreferenceStore
  & AtomicReadingPreferenceStore & AtomicButtonPreferenceStore & AtomicReadoutPreferenceStore & AtomicVoicePreferenceStore;
export type NativeRecordOperation =
  | { op: "read"; key: string }
  | { op: "scan"; prefix: string; after: string | null; limit: number }
  | { op: "replace"; key: string; value: SaveRecord }
  | { op: "cas"; key: string; expected: number; value: unknown };
export interface NativeRecordDriver { request(operation: NativeRecordOperation): Promise<unknown>; }

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生记录回执需要对象");
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, expected: readonly string[]): void {
  if (Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) {
    throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生记录回执字段无效");
  }
}
function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生存储代次无效");
  }
  return value;
}
function slot(value: unknown): StoredSlot {
  const data = object(value);
  if (data.found === false) { fields(data, ["found"]); return { found: false }; }
  if (data.found === true) { fields(data, ["found", "value"]); return { found: true, value: data.value }; }
  throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生记录缺失/存在标记无效");
}

/** Implements the existing stores. Only their original TypeScript callbacks validate and merge data. */
export class NativeRecordStore implements GameRecordStore {
  readonly #driver: NativeRecordDriver;
  readonly #warnings: (warnings: readonly string[]) => void;
  #revision = 0;

  constructor(driver: NativeRecordDriver, warnings: (warnings: readonly string[]) => void) {
    this.#driver = driver;
    this.#warnings = warnings;
  }

  private async request(operation: NativeRecordOperation): Promise<Record<string, unknown>> {
    const received = await this.#driver.request(operation);
    try {
      const envelope = object(received);
      fields(envelope, ["result", "warnings"]);
      if (!Array.isArray(envelope.warnings) || envelope.warnings.length > 16
        || !envelope.warnings.every((item: unknown) => typeof item === "string" && item.length <= 1024)) {
        throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生记录警告格式无效");
      }
      const result = object(envelope.result);
      const generation = revision(result.revision);
      if (generation < this.#revision) throw new SaveStorageError("NATIVE_STORAGE_REVISION", "原生存储代次倒退，未采用旧记录");
      if (operation.op === "replace" || operation.op === "cas") {
        fields(result, ["kind", "revision"]);
        if (operation.op === "replace"
          ? result.kind !== "committed" || generation < 1
          : (result.kind !== "committed" && result.kind !== "conflict") || generation <= operation.expected) {
          throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生写入回执没有形成有效提交或冲突");
        }
      }
      this.#revision = generation;
      // Display observers cannot reject a native commit already acknowledged by the driver.
      try { this.#warnings(envelope.warnings as string[]); } catch { /* Only presentation failed. */ }
      return result;
    } catch (error: unknown) {
      if (operation.op === "replace" || operation.op === "cas") {
        throw new SaveStorageError("NATIVE_STORAGE_UNCONFIRMED",
          `原生写入回执无法确认，请查看原记录或显式重试：${error instanceof Error ? error.message : "回执无效"}`);
      }
      throw error;
    }
  }

  private async inspect(key: string): Promise<{ revision: number; slot: StoredSlot }> {
    const data = await this.request({ op: "read", key });
    fields(data, ["kind", "revision", "slot"]);
    if (data.kind !== "read") throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生读取回执种类不符");
    return { revision: revision(data.revision), slot: slot(data.slot) };
  }
  async read(key: string): Promise<StoredSlot> { return (await this.inspect(key)).slot; }

  async replace(key: string, value: SaveRecord): Promise<void> {
    const data = await this.request({ op: "replace", key, value: structuredClone(value) });
    fields(data, ["kind", "revision"]);
    if (data.kind !== "committed" || revision(data.revision) < 1) throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生进度替换尚未确认");
  }

  async scan(prefix: string, after: string | null, limit: number): Promise<StoredSavePage> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || (after !== null && !after.startsWith(prefix))) {
      throw new SaveStorageError("NATIVE_STORAGE_PAGE", "原生目录范围或容量无效");
    }
    const data = await this.request({ op: "scan", prefix, after, limit });
    fields(data, ["kind", "revision", "entries", "next"]);
    revision(data.revision);
    if (data.kind !== "scan" || !Array.isArray(data.entries) || data.entries.length > limit) {
      throw new SaveStorageError("NATIVE_STORAGE_PAGE", "原生目录回执无效");
    }
    let previous = after;
    const entries = data.entries.map((item: unknown) => {
      const row = object(item);
      fields(row, ["key", "value"]);
      if (typeof row.key !== "string" || !row.key.startsWith(prefix) || (previous !== null && row.key <= previous)) {
        throw new SaveStorageError("NATIVE_STORAGE_PAGE", "原生目录返回范围外或乱序地址");
      }
      previous = row.key;
      return { key: row.key, value: row.value };
    });
    if (data.next !== null && (typeof data.next !== "string" || data.next !== entries.at(-1)?.key)) {
      throw new SaveStorageError("NATIVE_STORAGE_PAGE", "原生目录续页地址无效");
    }
    return { entries, next: data.next as string | null };
  }

  private async updateRecord<T>(key: string, change: (stored: StoredSlot) => T): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await this.inspect(key);
      const candidate = structuredClone(change(current.slot));
      const data = await this.request({ op: "cas", key, expected: current.revision, value: candidate });
      fields(data, ["kind", "revision"]);
      const next = revision(data.revision);
      if (data.kind === "committed" && next > current.revision) return candidate;
      if (data.kind !== "conflict" || next <= current.revision) {
        throw new SaveStorageError("NATIVE_STORAGE_REPLY", "原生条件更新未形成有效提交或冲突");
      }
    }
    throw new SaveStorageError("NATIVE_STORAGE_CONFLICT", "记录连续发生竞争，原操作尚未提交，请显式重试");
  }
  update(key: string, change: (stored: StoredSlot) => PlayerRecords): Promise<PlayerRecords> { return this.updateRecord(key, change); }
  updateAudio(key: string, change: (stored: StoredSlot) => AudioPreferenceRecord): Promise<AudioPreferenceRecord> { return this.updateRecord(key, change); }
  updateReading(key: string, change: (stored: StoredSlot) => ReadingPreferenceRecord): Promise<ReadingPreferenceRecord> { return this.updateRecord(key, change); }
  updateButtons(key: string, change: (stored: StoredSlot) => ButtonPreferenceRecord): Promise<ButtonPreferenceRecord> { return this.updateRecord(key, change); }
  updateVoice(key: string, change: (stored: StoredSlot) => VoicePreferenceRecord): Promise<VoicePreferenceRecord> { return this.updateRecord(key, change); }
  updateReadout(key: string, change: (stored: StoredSlot) => ReadoutPreferenceRecord): Promise<ReadoutPreferenceRecord> { return this.updateRecord(key, change); }
}
