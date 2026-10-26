import { resolve } from "node:path";
import { defineConfig, normalizePath } from "vite";
import type { Plugin } from "vite";
import { loadSourceContent, REPOSITORY_ROOT } from "../content/build.ts";
import { collectionAppearance, whaleAppearance } from "./appearance.ts";

const virtualId = "virtual:haifeng-content";
const resolvedId = `\0${virtualId}`;

/** Development only: compile the same chapter project as packaged game and editor. */
function localContent(): Plugin {
  let content: ReturnType<typeof loadSourceContent> | null = null;
  return {
    name: "haifeng-local-content",
    apply: "serve",
    resolveId(id) { if (id === virtualId) return resolvedId; },
    async load(id) {
      if (id !== resolvedId) return;
      content ??= loadSourceContent();
      const { content: story } = await content;
      const locations = Object.fromEntries(story.resources.map(resource => [
        resource.id,
        encodeURI(`/@fs/${normalizePath(resolve(REPOSITORY_ROOT, "海风与布丁", resource.path))}`),
      ]));
      // A checked compiler emits this JS module; the browser does not cast
      // unchecked JSON or load a second interpreter. No remote content endpoint.
      return `export const development = true;
      export async function loadContent() {
        return { locations: ${JSON.stringify(locations)}, content: ${JSON.stringify(story)} };
      }`;
    },
  };
}

export default defineConfig({
  root: resolve(REPOSITORY_ROOT, "apps/game"),
  plugins: [localContent(), whaleAppearance(), collectionAppearance()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      strict: true,
      allow: [
        resolve(REPOSITORY_ROOT, "apps/game"),
        resolve(REPOSITORY_ROOT, "packages"),
        resolve(REPOSITORY_ROOT, "海风与布丁/assets"),
      ],
    },
  },
});
