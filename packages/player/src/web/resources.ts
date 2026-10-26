import type { JsonObject, Resource, StoryContent } from "../../../story-model/src/model.ts";

export interface ResourceAccess {
  get(id: string): Resource;
  url(id: string): string;
}

export function createResourceAccess(content: StoryContent, locations: Readonly<Record<string, string>>): ResourceAccess {
  const entries = new Map(content.resources.map(resource => [resource.id, resource]));
  return {
    get(id) {
      const resource = entries.get(id);
      if (!resource) throw new Error(`资源未登记：${id}`);
      return resource;
    },
    url(id) {
      if (!entries.has(id) || !Object.hasOwn(locations, id) || !locations[id]) throw new Error(`资源没有本地位置：${id}`);
      return locations[id]!;
    },
  };
}

export function setting(settings: JsonObject, key: string, fallback: number): number {
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export const volume = (value: number): number => Math.max(0, Math.min(1, value));
