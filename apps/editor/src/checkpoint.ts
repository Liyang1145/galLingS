import type { StoryContent } from "../../../packages/story-model/src/model.ts";
import { hash } from "../../../packages/story-model/src/content.ts";
import { knownFields, object, string } from "../../../packages/story-model/src/read.ts";
import { inspectGameCheckpoint, prepareGameRestore } from "../../../packages/player/src/checkpoint.ts";
import type { GameCheckpoint, InspectedCheckpoint } from "../../../packages/player/src/checkpoint.ts";

/** Explicit preview namespace. This is not a game slot or an author source. */
export interface PreviewCheckpointInput {
  readonly format: "haifeng.editor-checkpoint/1";
  readonly workId: string;
  readonly contentRevision: string;
  readonly selectedEntry: string | null;
  readonly checkpoint: unknown;
}
export interface PreviewCheckpointRecord extends PreviewCheckpointInput { readonly checkpoint: GameCheckpoint }
export interface PreparedPreviewCheckpoint extends InspectedCheckpoint {
  readonly record: PreviewCheckpointRecord;
  readonly content: StoryContent;
}

const SOURCE = { file: "editor-checkpoint", field: "" };

export function previewContent(content: StoryContent, selectedEntry: string | null): StoryContent {
  if (selectedEntry === null) return content;
  if (!content.nodes.some(node => node.id === selectedEntry)) throw new Error(`预览起点不存在：${selectedEntry}`);
  return { ...content, entryNodeId: selectedEntry, revision: `editor-preview:${selectedEntry}:${content.revision}` };
}

/** Header parsing only; the body still needs the shared checkpoint/core inspection. */
export function readPreviewCheckpointInput(input: unknown): PreviewCheckpointInput {
  const data = object(input, SOURCE);
  knownFields(data, ["format", "workId", "contentRevision", "selectedEntry", "checkpoint"], SOURCE);
  if (data.format !== "haifeng.editor-checkpoint/1") throw new Error("只接受编辑器预览检查点，不读取游戏槽位或旧存档");
  const workId = string(data.workId, { ...SOURCE, field: "workId" });
  if (!workId.trim() || workId.length > 256) throw new Error("检查点作品标识无效");
  const contentRevision = hash(data.contentRevision, { ...SOURCE, field: "contentRevision" });
  const selectedEntry = data.selectedEntry === null ? null : string(data.selectedEntry, { ...SOURCE, field: "selectedEntry" });
  if (selectedEntry !== null && (!selectedEntry || selectedEntry.length > 256)) throw new Error("检查点预览起点无效");
  const checkpoint = object(data.checkpoint, { ...SOURCE, field: "checkpoint" });
  return Object.freeze({ format: "haifeng.editor-checkpoint/1", workId, contentRevision, selectedEntry, checkpoint });
}

/** Pure preparation, before cancelling an old preview. Never rewrites a revision. */
export function inspectPreviewCheckpoint(content: StoryContent, input: unknown): PreparedPreviewCheckpoint {
  const candidate = readPreviewCheckpointInput(input);
  if (candidate.workId !== content.workId) throw new Error("预览检查点属于其他作品");
  if (candidate.contentRevision !== content.revision) {
    throw new Error("预览检查点与当前草稿修订不同；请使用匹配草稿，本入口不自动迁移进度");
  }
  const source = previewContent(content, candidate.selectedEntry);
  const inspected = inspectGameCheckpoint(source, candidate.checkpoint);
  return {
    ...prepareGameRestore(source, inspected.checkpoint, inspected.view.player), content: source,
    record: { ...candidate, checkpoint: inspected.checkpoint },
  };
}

export function capturePreviewCheckpoint(content: StoryContent, selectedEntry: string | null, input: unknown): PreviewCheckpointRecord {
  return inspectPreviewCheckpoint(content, {
    format: "haifeng.editor-checkpoint/1", workId: content.workId,
    contentRevision: content.revision, selectedEntry, checkpoint: input,
  }).record;
}
