import { hash, oneOf } from "./content.ts";
import { array, at, knownFields, object, reject, string } from "./read.ts";
import type { SourceLocation } from "./model.ts";

export interface CompletionScope {
  readonly kind: "development" | "game" | "preview";
  readonly id: string;
}

export interface CompletionReference {
  readonly factId: string;
  readonly endingId: string;
}

/** A detached view of committed global facts, never a progress checkpoint. */
export interface CommittedClears {
  readonly format: "haifeng.committed-clears/1";
  readonly workId: string;
  readonly scope: CompletionScope;
  readonly unlockedEndingIds: readonly string[];
  readonly clears: readonly CompletionReference[];
}

/** The present records contain ending facts, not historical route snapshots. */
export interface ClearedContext {
  readonly format: "haifeng.cleared-context/1";
  readonly workId: string;
  readonly scope: CompletionScope;
  readonly completion: CompletionReference;
  readonly coverage: "ending-only";
  readonly reference: {
    readonly kind: "current-content";
    readonly contentRevision: string;
    readonly sourceSha256: string;
  };
}

const SOURCE: SourceLocation = { file: "completion-context", field: "" };

function id(input: unknown, source: SourceLocation): string {
  const value = string(input, source);
  if (!value.trim() || value.length > 512) reject("COMPLETION_ID", "需要 1～512 字符的稳定标识", source);
  return value;
}

export function readCompletionScope(input: unknown, source = at(SOURCE, "scope")): CompletionScope {
  const data = object(input, source);
  knownFields(data, ["kind", "id"], source);
  return Object.freeze({
    kind: oneOf(data.kind, ["development", "game", "preview"] as const, at(source, "kind")),
    id: id(data.id, at(source, "id")),
  });
}

function completion(input: unknown, source: SourceLocation): CompletionReference {
  const data = object(input, source);
  knownFields(data, ["factId", "endingId"], source);
  return Object.freeze({ factId: id(data.factId, at(source, "factId")), endingId: id(data.endingId, at(source, "endingId")) });
}

export function readCommittedClears(input: unknown): CommittedClears {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "workId", "scope", "unlockedEndingIds", "clears"], SOURCE);
  if (data.format !== "haifeng.committed-clears/1") reject("COMPLETION_FORMAT", "不是已提交全局通关记录", SOURCE);
  const endings = array(data.unlockedEndingIds, at(SOURCE, "unlockedEndingIds"))
    .map((value, index) => id(value, at(SOURCE, `unlockedEndingIds.${index}`)));
  const clears = array(data.clears, at(SOURCE, "clears"))
    .map((value, index) => completion(value, at(SOURCE, `clears.${index}`)));
  if (new Set(endings).size !== endings.length || new Set(clears.map(item => item.factId)).size !== clears.length) {
    reject("COMPLETION_DUPLICATE", "通关事实或结局解锁标识重复", SOURCE);
  }
  const unlocked = new Set(endings);
  if (clears.some(item => !unlocked.has(item.endingId))) reject("COMPLETION_ENDING", "通关事实缺少已解锁结局", SOURCE);
  return Object.freeze({
    format: "haifeng.committed-clears/1", workId: id(data.workId, at(SOURCE, "workId")),
    scope: readCompletionScope(data.scope), unlockedEndingIds: Object.freeze(endings), clears: Object.freeze(clears),
  });
}

/** Shape validation alone is not proof of unlock; readers must re-read committed records. */
export function readClearedContext(input: unknown): ClearedContext {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "workId", "scope", "completion", "coverage", "reference"], SOURCE);
  if (data.format !== "haifeng.cleared-context/1" || data.coverage !== "ending-only") {
    reject("CONTEXT_FORMAT", "不支持的通关上下文格式或事实范围", SOURCE);
  }
  const where = at(SOURCE, "reference");
  const reference = object(data.reference, where);
  knownFields(reference, ["kind", "contentRevision", "sourceSha256"], where);
  if (reference.kind !== "current-content") reject("CONTEXT_REFERENCE", "不能把当前内容引用冒充历史路线修订", where);
  return Object.freeze({
    format: "haifeng.cleared-context/1", workId: id(data.workId, at(SOURCE, "workId")),
    scope: readCompletionScope(data.scope), completion: completion(data.completion, at(SOURCE, "completion")),
    coverage: "ending-only",
    reference: Object.freeze({
      kind: "current-content", contentRevision: hash(reference.contentRevision, at(where, "contentRevision")),
      sourceSha256: hash(reference.sourceSha256, at(where, "sourceSha256")),
    }),
  });
}
