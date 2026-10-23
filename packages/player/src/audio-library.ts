import type { Resource, SourceLocation, StoryContent } from "../../story-model/src/model.ts";
import { at, boolean, numeric, reject, string } from "../../story-model/src/read.ts";
import type { AudioChannel } from "./preferences.ts";

export const LIBRARY_CATEGORIES = ["music", "ambience", "effect"] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];
export interface LibraryEntry {
  readonly assetId: string;
  readonly name: string;
  readonly category: LibraryCategory;
  readonly channel: AudioChannel;
  readonly durationSeconds: number | null;
  readonly auditionOnly: boolean;
  readonly gain: number;
}

/** Explicit author labels only; registration, names and playback history never infer a category. */
export function readLibraryEntry(resource: Resource, source: SourceLocation): LibraryEntry | null {
  const metadata = resource.metadata;
  const category = metadata.audioCategory;
  if (category === undefined || category === null || category === "") return null;
  if (category !== "music" && category !== "ambience" && category !== "effect") {
    reject("LIBRARY_CATEGORY", "声音收藏类别需要 music / ambience / effect", at(source, "audioCategory"));
  }
  if (resource.kind !== "bgm" && resource.kind !== "se" && resource.kind !== "vo") {
    reject("LIBRARY_RESOURCE", `声音收藏需要已登记的声音资源：${resource.id}`, at(source, "audioCategory"));
  }
  const name = metadata.name === undefined ? resource.id : string(metadata.name, at(source, "name"));
  const durationSeconds = metadata.dur === undefined ? null : numeric(metadata.dur, at(source, "dur"));
  if (durationSeconds !== null && durationSeconds < 0) {
    reject("LIBRARY_DURATION", "素材标注时长不能为负数", at(source, "dur"));
  }
  const gain = category === "music" ? numeric(metadata.playbackGain, at(source, "playbackGain"), 1) : 1;
  const channel: AudioChannel = category === "effect" ? "effects" : category;
  return Object.freeze({
    assetId: resource.id,
    name: name.replace(/^作者原声[ ·]+/u, "").replace(/^(环境|剧情|UI)_/u, "").replace(/_/gu, " ") || resource.id,
    category, channel,
    durationSeconds, auditionOnly: boolean(metadata.auditionOnly, at(source, "auditionOnly")),
    gain: Math.max(0, Math.min(1, gain)),
  });
}

/** Pure read, in original resource order; does not resolve URLs or decode media. */
export function readAudioLibrary(content: StoryContent): readonly LibraryEntry[] {
  const entries: LibraryEntry[] = [];
  for (const resource of content.resources) {
    const entry = readLibraryEntry(resource, { file: content.source.file, field: `assets.${resource.id}` });
    if (entry) entries.push(entry);
  }
  return Object.freeze(entries);
}
