import { ContentError } from "../../story-model/src/model.ts";
import type { StoryContent } from "../../story-model/src/model.ts";
import { at, knownFields, numeric, object, reject, string } from "../../story-model/src/read.ts";
import { inspectGameCheckpoint } from "./checkpoint.ts";
import type { GameCheckpoint, InspectedCheckpoint } from "./checkpoint.ts";

export interface RecordScope {
  kind: "development" | "preview" | "game";
  id: string;
}

export interface SaveRecord {
  format: "haifeng.save/1";
  scope: RecordScope;
  slotId: string;
  /** Display metadata only; never used as an elapsed gameplay clock. */
  savedAt: number;
  checkpoint: GameCheckpoint;
}

export interface InspectedSave extends InspectedCheckpoint {
  record: SaveRecord;
}

/** Resolve replacement only on commit. A confirmed failure preserves the previous value.
 * A native acknowledgement loss is NATIVE_STORAGE_UNCONFIRMED: neither success nor proof of no write.
 */
export type StoredSlot = { found: false } | { found: true; value: unknown };

export interface StoredSavePage {
  entries: { key: string; value: unknown }[];
  next: string | null;
}
export type SaveSlotSummary =
  | {
      kind: "readable"; slotId: string; savedAt: number; nodeId: string; chapter: string;
      speaker: string; text: string; phase: "ready" | "choosing"; choiceRemainingMs: number | null;
    }
  | { kind: "unreadable"; slotId: string | null; address: string; code: string; message: string };
export interface SaveSlotPage {
  readonly items: readonly Readonly<SaveSlotSummary>[];
  /** Opaque continuation address; scoped and checked again by the repository. */
  readonly next: string | null;
}
/** Read-only replacement prompt data. Not a write reservation or an adoptable checkpoint. */
export type SaveTargetState =
  | { readonly kind: "empty"; readonly slotId: string }
  | { readonly kind: "occupied"; readonly slotId: string; readonly summary: Readonly<SaveSlotSummary> };

export interface AtomicSaveStore {
  read(key: string): Promise<StoredSlot>;
  replace(key: string, value: SaveRecord): Promise<void>;
  /** Read only this prefix, in key order. Return at most limit entries after the cursor. */
  scan(prefix: string, after: string | null, limit: number): Promise<StoredSavePage>;
}

export class SaveStorageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SaveStorageError";
    this.code = code;
  }
}

const SOURCE = { file: "save-record", field: "" };

function identifier(input: unknown, field: string): string {
  const value = string(input, at(SOURCE, field));
  if (!value.trim() || value.length > 128) reject("SAVE_ADDRESS", "记录标识需要 1～128 个字符", at(SOURCE, field));
  return value;
}

export function readSaveSlotId(input: unknown): string { return identifier(input, "slotId"); }

function readScope(input: unknown): RecordScope {
  const source = at(SOURCE, "scope");
  const record = object(input, source);
  knownFields(record, ["kind", "id"], source);
  const kind = string(record.kind, at(source, "kind"));
  if (kind !== "development" && kind !== "preview" && kind !== "game") {
    reject("SAVE_SCOPE", "未知记录命名空间", source);
  }
  return { kind, id: identifier(record.id, "scope.id") };
}

function timestamp(input: unknown): number {
  const value = numeric(input, at(SOURCE, "savedAt"));
  if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) {
    reject("SAVE_TIME", "保存时间不是有效的显示时间戳", at(SOURCE, "savedAt"));
  }
  return value;
}

/** Checkpoint persistence only. Loading here validates data, never adopts it. */
export class SaveRepository {
  readonly #content: StoryContent;
  readonly #scope: RecordScope;
  readonly #store: AtomicSaveStore;

  constructor(content: StoryContent, scope: RecordScope, store: AtomicSaveStore) {
    this.#content = structuredClone(content);
    this.#scope = readScope(scope);
    this.#store = store;
  }

  private key(slotId: string): string {
    // Revision deliberately stays in the payload: an incompatible slot remains
    // visible and produces a diagnostic instead of looking like an empty slot.
    return JSON.stringify(["haifeng.save/1", this.#content.workId, this.#scope.kind, this.#scope.id, slotId]);
  }

  private prefix(): string {
    return `${JSON.stringify(["haifeng.save/1", this.#content.workId, this.#scope.kind, this.#scope.id]).slice(0, -1)},`;
  }

  private slotFromKey(key: string): string {
    const parsed: unknown = JSON.parse(key);
    if (!Array.isArray(parsed) || parsed.length !== 5) throw new SaveStorageError("SAVE_ADDRESS", "槽位地址格式无效");
    const slotId = readSaveSlotId(parsed[4]);
    if (this.key(slotId) !== key) throw new SaveStorageError("SAVE_ADDRESS", "槽位地址不属于当前作品或范围");
    return slotId;
  }

  private inspect(input: unknown, slotId: string): InspectedSave {
    const data = object(input, SOURCE);
    knownFields(data, ["format", "scope", "slotId", "savedAt", "checkpoint"], SOURCE);
    if (data.format !== "haifeng.save/1") reject("SAVE_FORMAT", "不支持的存档封装；旧存档迁移尚未接入", SOURCE);
    const scope = readScope(data.scope);
    if (scope.kind !== this.#scope.kind || scope.id !== this.#scope.id || data.slotId !== slotId) {
      reject("SAVE_ADDRESS", "记录与所选命名空间或槽位不一致", SOURCE);
    }
    const savedAt = timestamp(data.savedAt);
    const inspected = inspectGameCheckpoint(this.#content, data.checkpoint);
    return {
      ...inspected,
      record: { format: "haifeng.save/1", scope, slotId, savedAt, checkpoint: inspected.checkpoint },
    };
  }

  async save(slot: string, checkpoint: GameCheckpoint, savedAt: number): Promise<InspectedSave> {
    const slotId = identifier(slot, "slotId");
    // Validate and detach all data before the adapter opens a write transaction.
    const inspected = this.inspect({
      format: "haifeng.save/1", scope: this.#scope, slotId, savedAt, checkpoint,
    }, slotId);
    await this.#store.replace(this.key(slotId), inspected.record);
    return inspected;
  }

  async read(slot: string): Promise<InspectedSave | null> {
    const slotId = identifier(slot, "slotId");
    const stored = await this.#store.read(this.key(slotId));
    return stored.found ? this.inspect(stored.value, slotId) : null;
  }

  async target(slot: string): Promise<SaveTargetState> {
    const slotId = identifier(slot, "slotId");
    const key = this.key(slotId);
    // A storage error must propagate, never turn an unknown target into an empty slot.
    const stored = await this.#store.read(key);
    return stored.found
      ? Object.freeze({ kind: "occupied", slotId, summary: this.summary(key, stored.value) })
      : Object.freeze({ kind: "empty", slotId });
  }

  private summary(address: string, value: unknown): Readonly<SaveSlotSummary> {
    let slotId: string | null = null;
    try {
      slotId = this.slotFromKey(address);
      const inspected = this.inspect(value, slotId);
      const { view, checkpoint, record } = inspected;
      if (view.phase !== "ready" && view.phase !== "choosing") throw new SaveStorageError("SAVE_PHASE", "槽位不是稳定检查点");
      return Object.freeze({
        kind: "readable", slotId, savedAt: record.savedAt, nodeId: view.nodeId, chapter: view.chapter,
        speaker: view.presentation.speaker, text: view.presentation.text, phase: view.phase,
        choiceRemainingMs: checkpoint.timing.choiceRemainingMs,
      });
    } catch (error: unknown) {
      return Object.freeze({
        kind: "unreadable", slotId, address,
        code: error instanceof ContentError ? error.diagnostic.code : error instanceof SaveStorageError ? error.code : "SAVE_RECORD",
        message: error instanceof Error ? error.message : "槽位数据无法读取",
      });
    }
  }

  async list(options: { after: string | null; limit: number }): Promise<SaveSlotPage> {
    if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100) {
      throw new SaveStorageError("SAVE_PAGE", "每页需要 1～100 个槽位");
    }
    const prefix = this.prefix();
    if (options.after !== null && !options.after.startsWith(prefix)) {
      throw new SaveStorageError("SAVE_PAGE", "槽位游标不属于当前作品或范围");
    }
    const page = await this.#store.scan(prefix, options.after, options.limit);
    if (page.entries.length > options.limit || (page.next !== null && page.next !== page.entries.at(-1)?.key)) {
      throw new SaveStorageError("SAVE_PAGE", "存储返回的槽位分页不完整");
    }
    let previous = options.after;
    const items: Readonly<SaveSlotSummary>[] = [];
    for (const entry of page.entries) {
      if (!entry.key.startsWith(prefix) || (previous !== null && entry.key <= previous)) {
        throw new SaveStorageError("SAVE_PAGE", "存储返回了范围外或乱序槽位");
      }
      previous = entry.key;
      items.push(this.summary(entry.key, entry.value));
    }
    return Object.freeze({ items: Object.freeze(items), next: page.next });
  }
}
