import type { Plugin } from "vite";
import type { CollectionSkin, WhaleSkin } from "../../packages/player/src/appearance.ts";
import { readWhaleSkin } from "../content/appearance.ts";
import { readCollectionSkin } from "../content/collection-appearance.ts";

/** Same immutable artwork bytes for game, packaged game and isolated editor preview. */
export function whaleAppearance(prepared?: WhaleSkin): Plugin {
  const virtual = "virtual:haifeng-appearance";
  const resolved = `\0${virtual}`;
  let pending: Promise<WhaleSkin> | null = null;
  return {
    name: "haifeng-whale-appearance",
    resolveId(id) { if (id === virtual) return resolved; },
    async load(id) {
      if (id !== resolved) return;
      pending ??= prepared ? Promise.resolve(prepared) : readWhaleSkin();
      return `export const whaleSkin = ${JSON.stringify(await pending)};`;
    },
  };
}

/** Game-only decoration: the isolated editor does not load the collection artwork. */
export function collectionAppearance(prepared?: CollectionSkin): Plugin {
  const virtual = "virtual:haifeng-collection-appearance";
  const resolved = `\0${virtual}`;
  let pending: Promise<CollectionSkin> | null = null;
  return {
    name: "haifeng-collection-appearance",
    resolveId(id) { if (id === virtual) return resolved; },
    async load(id) {
      if (id !== resolved) return;
      pending ??= prepared ? Promise.resolve(prepared) : readCollectionSkin();
      return `export const collectionSkin = ${JSON.stringify(await pending)};`;
    },
  };
}
