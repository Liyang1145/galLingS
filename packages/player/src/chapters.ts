import type { PlayerProjection, StoryContent, Value } from "../../story-model/src/model.ts";

export interface ChapterEntry {
  readonly nodeId: string;
  readonly title: string;
}

export interface ChapterTrial {
  readonly entry: ChapterEntry;
  readonly content: StoryContent;
  readonly initialVariables: Readonly<Record<string, Value>>;
  readonly player: PlayerProjection;
}

/** Explicit chapter markers only, in original node order; no grouping or reachability inference. */
export function chapterCatalog(content: StoryContent): readonly ChapterEntry[] {
  return Object.freeze(content.nodes.filter(node => node.chapter !== "")
    .map(node => Object.freeze({ nodeId: node.id, title: node.chapter })));
}

/** A declared-initial-condition trial, never a reconstruction of the route before this chapter. */
export function prepareChapterTrial(content: StoryContent, nodeId: string): ChapterTrial {
  const entry = chapterCatalog(content).find(chapter => chapter.nodeId === nodeId);
  if (!entry) throw new Error(`试阅起点不是当前作品登记的章节：${nodeId}`);
  const initialVariables = Object.freeze(Object.fromEntries<Value>(
    content.variables.map(variable => [variable.name, variable.initial]),
  ));
  return Object.freeze({
    entry,
    content: { ...content, entryNodeId: nodeId, revision: `chapter-preview:${nodeId}:${content.revision}` },
    initialVariables,
    player: Object.freeze({ "周目": 1, "结局数": 0 }),
  });
}
