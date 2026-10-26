import type { StoryContent } from "../../story-model/src/model.ts";
import { readClearedContext, readCommittedClears, readCompletionScope } from "../../story-model/src/completion.ts";
import type { ClearedContext, CommittedClears, CompletionReference, CompletionScope } from "../../story-model/src/completion.ts";
import { reject } from "../../story-model/src/read.ts";

/** Only this read capability crosses into aftergame code. */
export interface CompletionSource {
  read(): Promise<unknown>;
}

export interface ContextCandidate {
  readonly completion: CompletionReference;
  /** Position in the committed ledger, not a timestamp or route preference. */
  readonly ordinal: number;
  readonly inCurrentContent: boolean;
}

const SOURCE = { file: "cleared-context", field: "" };

/** No network, writable runtime, save slot or global record mutation capability. */
export class ClearedContextReader {
  readonly #workId: string;
  readonly #scope: CompletionScope;
  readonly #reference: ClearedContext["reference"];
  readonly #endings: Set<string>;
  readonly #source: CompletionSource;

  constructor(content: StoryContent, scope: CompletionScope, source: CompletionSource) {
    this.#scope = readCompletionScope(scope);
    if (this.#scope.kind === "preview") reject("CONTEXT_PREVIEW", "预览成果不能作为通关后玩法的准备依据", SOURCE);
    this.#workId = content.workId;
    this.#reference = Object.freeze({
      kind: "current-content", contentRevision: content.revision, sourceSha256: content.source.sha256,
    });
    this.#endings = new Set(content.nodes.flatMap(node => node.flow.kind === "ending" ? [node.flow.endingId] : []));
    this.#source = source;
  }

  private async committed(): Promise<CommittedClears> {
    const records = readCommittedClears(await this.#source.read());
    if (records.workId !== this.#workId || records.scope.kind !== this.#scope.kind || records.scope.id !== this.#scope.id) {
      reject("CONTEXT_IDENTITY", "通关事实与当前作品或记录范围不一致", SOURCE);
    }
    return records;
  }

  async list(): Promise<readonly ContextCandidate[]> {
    const records = await this.committed();
    return Object.freeze(records.clears.map((completion, index) => Object.freeze({
      completion, ordinal: index + 1, inCurrentContent: this.#endings.has(completion.endingId),
    })));
  }

  /** Explicit selection, re-read at preparation time; a stale UI list is not authority. */
  async read(selected: CompletionReference): Promise<ClearedContext> {
    const records = await this.committed();
    const completion = records.clears.find(item => item.factId === selected.factId);
    if (!completion) reject("CONTEXT_NOT_COMMITTED", "所选通关事实尚未提交或不在当前记录中", SOURCE);
    if (completion.endingId !== selected.endingId) reject("CONTEXT_CHANGED", "所选通关事实的结局已改变，请重新读取记录", SOURCE);
    if (!this.#endings.has(completion.endingId)) {
      reject("CONTEXT_ENDING", "所选结局不在当前内容中；保留原成果，暂不准备其聊天上下文", SOURCE);
    }
    return readClearedContext({
      format: "haifeng.cleared-context/1", workId: this.#workId, scope: this.#scope,
      completion, coverage: "ending-only", reference: this.#reference,
    });
  }
}
