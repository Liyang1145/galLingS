import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { defineConfig, normalizePath } from "vite";
import type { Plugin } from "vite";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { REPOSITORY_ROOT } from "../content/build.ts";
import { authorFields, previewAuthorText, readAuthorSource, saveAuthorText } from "./source.ts";
import { whaleAppearance } from "../dev/appearance.ts";

const ORIGIN = "http://127.0.0.1:5174";
const HOST = "127.0.0.1:5174";
const VIRTUAL = "virtual:haifeng-editor";
const MAX_BODY = 4 * 1024 * 1024;

function reply(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += bytes.byteLength;
    if (size > MAX_BODY) throw new ContentError("AUTHOR_LIMIT", "草稿请求超过 4 MiB", { file: "author-text-patch", field: "" });
    chunks.push(bytes);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))) as unknown;
}

function document(
  loaded: Awaited<ReturnType<typeof readAuthorSource>>["loaded"],
  editable: ReturnType<typeof authorFields>,
  backup: string | null = null,
): unknown {
  return {
    content: loaded.content, sourceSha256: loaded.content.source.sha256, editable, backup,
    locations: Object.fromEntries(loaded.content.resources.map(resource => [
      resource.id, encodeURI(`/@fs/${normalizePath(resolve(REPOSITORY_ROOT, "海风与布丁", resource.path))}`),
    ])),
  };
}

/** Development-only, fixed-file editing API. Never included by game builds. */
function authorEditor(): Plugin {
  const token = randomBytes(32).toString("hex");
  let pending = false;
  return {
    name: "haifeng-author-editor",
    apply: "serve",
    resolveId(id) { if (id === VIRTUAL) return `\0${VIRTUAL}`; },
    load(id) {
      if (id === `\0${VIRTUAL}`) return `export const token = ${JSON.stringify(token)};`;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const route = request.url;
        if (!route?.startsWith("/__editor/")) { next(); return; }
        // Reject hostile Host/Origin even if a browser can reach this loopback port.
        if (request.headers.host !== HOST || request.headers.origin !== ORIGIN
          || request.headers["x-haifeng-editor"] !== token
          || request.headers["content-type"] !== "application/json"
          || request.method !== "POST") {
          reply(response, 403, { error: "编辑请求来源或会话无效；请从本机编辑入口重新打开" });
          return;
        }
        if (!["/__editor/source", "/__editor/preview", "/__editor/save"].includes(route)) {
          reply(response, 404, { error: "没有此编辑操作" });
          return;
        }
        if (pending) { reply(response, 409, { error: "另一个作者操作尚未完成，请稍后重试" }); return; }
        pending = true;
        void (async () => {
          try {
            const input = await body(request);
            if (route === "/__editor/source") {
              const source = await readAuthorSource();
              reply(response, 200, document(source.loaded, source.editable));
            } else if (route === "/__editor/preview") {
              const preview = await previewAuthorText(input);
              reply(response, 200, document(preview.loaded, authorFields(preview.updated)));
            } else {
              const saved = await saveAuthorText(input);
              // Save is already committed; no fallible filesystem work here.
              reply(response, 200, document(saved.loaded, saved.editable, saved.backup));
            }
          } catch (error: unknown) {
            if (error instanceof ContentError) reply(response, error.diagnostic.code === "AUTHOR_CONFLICT" ? 409 : 422,
              { error: error.message, diagnostic: error.diagnostic });
            else reply(response, 400, {
              error: "作者操作未确认完成；草稿保留。保存请求若中断，先重新读取源确认结果。",
              // Do not expose filesystem errors containing machine paths.
            });
          } finally { pending = false; }
        })();
      });
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
        resolve(REPOSITORY_ROOT, "apps/game/src/style.css"), resolve(REPOSITORY_ROOT, "海风与布丁/assets"),
      ],
    },
  },
});
