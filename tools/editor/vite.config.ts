import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { REPOSITORY_ROOT } from "../content/build.ts";
import { createEditorApi } from "./api.ts";
import { whaleAppearance } from "../dev/appearance.ts";

/** Development-only, fixed-file editing API. Never included by game builds. */
function authorEditor(): Plugin {
  const api = createEditorApi();
  return {
    name: "haifeng-author-editor",
    apply: "serve",
    transformIndexHtml: html => api.html(html),
    configureServer(server) {
      server.middlewares.use(api.middleware);
    },
  };
}

export default defineConfig({
  root: resolve(REPOSITORY_ROOT, "apps/editor"),
  plugins: [authorEditor(), whaleAppearance()],
  server: {
    host: "127.0.0.1", port: 5174, strictPort: true, cors: false,
    fs: {
      strict: true,
      allow: [
        resolve(REPOSITORY_ROOT, "apps/editor"), resolve(REPOSITORY_ROOT, "packages"),
        resolve(REPOSITORY_ROOT, "apps/game/src/style.css"),
      ],
    },
  },
});
