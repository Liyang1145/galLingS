import type { PlayerProjection, Resource, StoryContent } from "../../story-model/src/model.ts";
import type { CommittedClears } from "../../story-model/src/completion.ts";
import { array, at, knownFields, numeric, object, reject, string } from "../../story-model/src/read.ts";
import type { StoryFact } from "../../story-runtime/src/index.ts";
import type { RecordScope, StoredSlot } from "./saves.ts";

export interface PlayerRecords {
  format: "haifeng.player-records/1";
  workId: string;
  scope: RecordScope;
  readNodeIds: string[];
  cgIds: string[];
  endings: { id: string; unlockedAt: number }[];
  clears: { factId: string; endingId: string }[];
}

export interface PlayerFactBatch {
  /** A stable delivery ID: retry this batch with the same ID. */
  id: string;
  occurredAt: number;
  facts: readonly StoryFact[];
}

/** Ephemeral outcome of this transaction, never persisted in achievements or saves. */
export interface PlayerCommitReceipt {
  batchId: string;
  newEndingIds: string[];
}

export interface PlayerCommit {
  records: PlayerRecords;
  receipt: PlayerCommitReceipt;
}

export interface AtomicPlayerStore {
  read(key: string): Promise<StoredSlot>;
  /** Read, validate, merge and write inside one transaction; resolve only after commit, including across tabs. */
  update(key: string, change: (stored: StoredSlot) => PlayerRecords): Promise<PlayerRecords>;
}

const SOURCE = { file: "player-records", field: "" };

function id(input: unknown, field: string): string {
  const value = string(input, at(SOURCE, field));
  if (!value.trim() || value.length > 512) reject("PLAYER_ID", "需要有效的记录标识", at(SOURCE, field));
  return value;
}

function scope(input: unknown): RecordScope {
  const data = object(input, at(SOURCE, "scope"));
  knownFields(data, ["kind", "id"], at(SOURCE, "scope"));
  const kind = data.kind;
  if (kind !== "game" && kind !== "development" && kind !== "preview") reject("PLAYER_SCOPE", "未知玩家记录范围", SOURCE);
  return { kind, id: id(data.id, "scope.id") };
}

export function galleryCatalog(content: StoryContent): { cgs: Resource[]; endings: string[] } {
  return {
    cgs: content.resources.filter(resource => resource.kind === "bg" && !resource.metadata.previewExcluded
      && (resource.metadata.cg === true || (resource.metadata.cg == null && typeof resource.metadata.name === "string"
        && /^cg[_\-\s]/iu.test(resource.metadata.name)))),
    endings: [...new Set(content.nodes.flatMap(node => node.flow.kind === "ending" ? [node.flow.endingId] : []))],
  };
}

export function playerProjection(records: PlayerRecords): PlayerProjection {
  if (!Number.isSafeInteger(records.clears.length + 1)) reject("PLAYER_COUNT", "通关次数超出支持范围", SOURCE);
  return { "周目": records.clears.length + 1, "结局数": records.endings.length };
}

/** Global achievements are never restored from a progress checkpoint. */
export class PlayerRepository {
  readonly #content: StoryContent;
  readonly #scope: RecordScope;
  readonly #store: AtomicPlayerStore;
  readonly #key: string;

  constructor(content: StoryContent, range: RecordScope, store: AtomicPlayerStore) {
    this.#content = structuredClone(content);
    this.#scope = scope(range);
    this.#store = store;
    // No content revision: stable unlock identities survive content revisions.
    this.#key = JSON.stringify(["haifeng.player-records/1", content.workId, this.#scope.kind, this.#scope.id]);
  }

  private readStored(stored: StoredSlot): PlayerRecords {
    if (!stored.found) return {
      format: "haifeng.player-records/1", workId: this.#content.workId, scope: { ...this.#scope },
      readNodeIds: [], cgIds: [], endings: [], clears: [],
    };
    const data = object(stored.value, SOURCE);
    knownFields(data, ["format", "workId", "scope", "readNodeIds", "cgIds", "endings", "clears"], SOURCE);
    const range = scope(data.scope);
    if (data.format !== "haifeng.player-records/1" || data.workId !== this.#content.workId
      || range.kind !== this.#scope.kind || range.id !== this.#scope.id) {
      reject("PLAYER_IDENTITY", "玩家记录格式、作品或范围不匹配", SOURCE);
    }
    const unique = <T>(items: T[], key: (item: T) => string, field: string): T[] => {
      if (new Set(items.map(key)).size !== items.length) reject("PLAYER_DUPLICATE", "玩家记录包含重复标识", at(SOURCE, field));
      return items;
    };
    const ids = (value: unknown, field: string): string[] =>
      unique(array(value, at(SOURCE, field)).map((item, index) => id(item, `${field}.${index}`)), item => item, field);
    const endings = array(data.endings, at(SOURCE, "endings")).map((input, index) => {
      const source = at(SOURCE, `endings.${index}`);
      const item = object(input, source);
      knownFields(item, ["id", "unlockedAt"], source);
      const unlockedAt = numeric(item.unlockedAt, at(source, "unlockedAt"));
      if (!Number.isSafeInteger(unlockedAt) || unlockedAt < 0 || unlockedAt > 8_640_000_000_000_000) {
        reject("PLAYER_TIME", "解锁时间无效", source);
      }
      return { id: id(item.id, `endings.${index}.id`), unlockedAt };
    });
    const clears = array(data.clears, at(SOURCE, "clears")).map((input, index) => {
      const source = at(SOURCE, `clears.${index}`);
      const item = object(input, source);
      knownFields(item, ["factId", "endingId"], source);
      return { factId: id(item.factId, `clears.${index}.factId`), endingId: id(item.endingId, `clears.${index}.endingId`) };
    });
    unique(endings, item => item.id, "endings");
    unique(clears, item => item.factId, "clears");
    const unlocked = new Set(endings.map(item => item.id));
    if (clears.some(item => !unlocked.has(item.endingId))) reject("PLAYER_ENDING", "通关事实缺少对应解锁记录", SOURCE);
    return {
      format: "haifeng.player-records/1", workId: this.#content.workId, scope: range,
      readNodeIds: ids(data.readNodeIds, "readNodeIds"), cgIds: ids(data.cgIds, "cgIds"), endings, clears,
    };
  }

  async read(): Promise<PlayerRecords> {
    return this.readStored(await this.#store.read(this.#key));
  }

  /** A minimal, freshly read view; pending writer batches and progress never enter it. */
  async readCompletions(): Promise<CommittedClears> {
    const records = await this.read();
    return {
      format: "haifeng.committed-clears/1", workId: records.workId, scope: { ...records.scope },
      unlockedEndingIds: records.endings.map(ending => ending.id),
      clears: records.clears.map(clear => ({ ...clear })),
    };
  }

  async record(batch: PlayerFactBatch): Promise<PlayerRecords> {
    return (await this.recordWithReceipt(batch)).records;
  }

  async recordWithReceipt(batch: PlayerFactBatch): Promise<PlayerCommit> {
    const batchId = id(batch.id, "batch.id");
    if (batchId.length > 480) reject("PLAYER_ID", "事实交付标识过长", SOURCE);
    if (!Number.isSafeInteger(batch.occurredAt) || batch.occurredAt < 0 || batch.occurredAt > 8_640_000_000_000_000) {
      reject("PLAYER_TIME", "事实显示时间无效", SOURCE);
    }
    const facts = structuredClone(batch.facts);
    const nodes = new Map(this.#content.nodes.map(node => [node.id, node]));
    const cgs = new Set(galleryCatalog(this.#content).cgs.map(resource => resource.id));
    // Validate facts before opening a transaction; no caller-owned live objects.
    for (const fact of facts) {
      const node = nodes.get(fact.nodeId);
      if (!node) reject("PLAYER_FACT", "事实节点不存在", { ...SOURCE, nodeId: fact.nodeId });
      if (fact.type === "ending" && (node.flow.kind !== "ending" || node.flow.endingId !== fact.endingId)) {
        reject("PLAYER_FACT", "结局事实与节点不一致", node.source);
      }
      if (fact.type !== "entered" && fact.type !== "ending" && fact.type !== "chosen") reject("PLAYER_FACT", "未知剧情事实", node.source);
    }
    let newEndingIds: string[] = [];
    const records = await this.#store.update(this.#key, stored => {
      newEndingIds = [];
      const record = this.readStored(stored);
      const reads = new Set(record.readNodeIds);
      const unlockedCgs = new Set(record.cgIds);
      const endings = new Map(record.endings.map(item => [item.id, item]));
      const clears = new Map(record.clears.map(item => [item.factId, item]));
      facts.forEach((fact, index) => {
        if (fact.type === "entered") {
          reads.add(fact.nodeId);
          const background = nodes.get(fact.nodeId)!.presentation.scene.background;
          if (background && cgs.has(background)) unlockedCgs.add(background);
        } else if (fact.type === "ending") {
          const factId = `${batchId}:${index}`;
          const existing = clears.get(factId);
          if (existing && existing.endingId !== fact.endingId) reject("PLAYER_FACT", "同一交付标识对应了不同结局", SOURCE);
          if (!endings.has(fact.endingId)) {
            endings.set(fact.endingId, { id: fact.endingId, unlockedAt: batch.occurredAt });
            newEndingIds.push(fact.endingId);
          }
          clears.set(factId, { factId, endingId: fact.endingId });
        }
      });
      return {
        ...record, readNodeIds: [...reads], cgIds: [...unlockedCgs], endings: [...endings.values()], clears: [...clears.values()],
      };
    });
    // The store resolves only after commit. Aborted transactions produce no receipt.
    return { records, receipt: { batchId, newEndingIds: [...newEndingIds] } };
  }
}

/** Failed deliveries stay queued with their original IDs for explicit retry. */
export class PlayerRecordWriter {
  readonly #repository: PlayerRepository;
  readonly #committed: (records: PlayerRecords, receipt: PlayerCommitReceipt) => void;
  readonly #failed: (error: unknown) => void;
  readonly #pending: PlayerFactBatch[] = [];
  #running: Promise<void> | null = null;
  #failure: unknown = null;

  constructor(repository: PlayerRepository, committed: (records: PlayerRecords, receipt: PlayerCommitReceipt) => void,
    failed: (error: unknown) => void) {
    this.#repository = repository;
    this.#committed = committed;
    this.#failed = failed;
  }

  enqueue(batch: PlayerFactBatch): void {
    this.#pending.push(structuredClone(batch));
    if (!this.#failure) void this.flush().catch(() => {});
  }

  pending(): number { return this.#pending.length; }

  flush(): Promise<void> {
    if (this.#running) return this.#running;
    this.#failure = null;
    this.#running = this.drain().catch((error: unknown) => {
      this.#failure = error;
      this.#failed(error);
      throw error;
    }).finally(() => {
      this.#running = null;
      if (this.#pending.length && !this.#failure) void this.flush().catch(() => {});
    });
    return this.#running;
  }

  private async drain(): Promise<void> {
    while (this.#pending.length) {
      const { records, receipt } = await this.#repository.recordWithReceipt(this.#pending[0]!);
      this.#pending.shift();
      this.#committed(records, receipt);
    }
  }
}
