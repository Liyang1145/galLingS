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

/** Resolve replacement only on commit. Failure must preserve the previous value. */
export type StoredSlot = { found: false } | { found: true; value: unknown };

export interface AtomicSaveStore {
  read(key: string): Promise<StoredSlot>;
  replace(key: string, value: SaveRecord): Promise<void>;
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
}
