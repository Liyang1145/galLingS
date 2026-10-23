import type { StoryContent } from "./model.ts";

export interface ResourceDigest {
  assetId: string;
  /** Original content path, not its eventual installation location. */
  path: string;
  sha256: string;
  bytes: number;
}

/** Object keys are canonical; array order remains meaningful story order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("规范化内容不能包含 undefined");
  return result;
}

/** Same revision input as M1, shared by build and packaged-data readers. */
export function contentRevisionText(content: StoryContent, files: readonly ResourceDigest[]): string {
  const { revision: _revision, source, resources, ...story } = content;
  const { sha256: _rawSourceHash, ...sourceSemantics } = source;
  return canonical({
    ...story, source: sourceSemantics,
    resources: [...resources].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    files: [...files].sort((a, b) => a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0),
  });
}
