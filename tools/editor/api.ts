import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { authorFields, previewAuthorText, readAuthorSource, saveAuthorText } from "./source.ts";
import { EditorMedia } from "./media.ts";

export const EDITOR_HOST = "127.0.0.1:5174";
export const EDITOR_ORIGIN = `http://${EDITOR_HOST}`;
export const EDITOR_SESSION_MARKER = "__HAIFENG_EDITOR_SESSION__";
const MAX_BODY = 4 * 1024 * 1024;

export function assertEditorSessionMarker(html: string): void {
  if (html.split(EDITOR_SESSION_MARKER).length !== 2) throw new Error("编辑页面缺少唯一的本机服务会话标记");
}

function reply(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
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

/** Same bounded API for development and built editor. No server or token is created on import. */
export function createEditorApi(options: { beforeOperation?(): Promise<void> } = {}): {
  html(source: string): string;
  middleware(request: IncomingMessage, response: ServerResponse, next: () => void): void;
} {
  const token = randomBytes(32).toString("hex");
  const media = new EditorMedia();
  let pending = false;
  const document = (
    loaded: Awaited<ReturnType<typeof readAuthorSource>>["loaded"],
    editable: ReturnType<typeof authorFields>, backup: string | null = null,
  ): unknown => ({
    content: loaded.content, sourceSha256: loaded.content.source.sha256, editable, backup,
    locations: media.register(loaded.files),
  });
  return {
    html(source) {
      assertEditorSessionMarker(source);
      return source.replace(EDITOR_SESSION_MARKER, token);
    },
    middleware(request, response, next) {
      const route = request.url;
      if (!route?.startsWith("/__editor/")) { next(); return; }
      const site = request.headers["sec-fetch-site"];
      if (request.headers.host !== EDITOR_HOST || (site !== undefined && site !== "same-origin")
        || (request.headers.origin !== undefined && request.headers.origin !== EDITOR_ORIGIN)) {
        reply(response, 403, { error: "编辑请求来源无效；请从本机编辑入口重新打开" });
        return;
      }
      // Media requests cannot carry the author JSON header. Only exact
      // resources returned by this server's converter can be read here.
      if (route.startsWith("/__editor/media/")) {
        void media.respond(request, response);
        return;
      }
      if (request.headers.origin !== EDITOR_ORIGIN || request.headers["x-haifeng-editor"] !== token
        || request.headers["content-type"] !== "application/json" || request.method !== "POST") {
        reply(response, 403, { error: "编辑请求来源或会话无效；请从本机编辑入口重新打开" });
        return;
      }
      if (!["/__editor/source", "/__editor/preview", "/__editor/save"].includes(route)) {
        reply(response, 404, { error: "没有此编辑操作" }); return;
      }
      if (pending) { reply(response, 409, { error: "另一个作者操作尚未完成，请稍后重试" }); return; }
      pending = true;
      void (async () => {
        try {
          const input = await body(request);
          await options.beforeOperation?.();
          if (route === "/__editor/source") {
            const source = await readAuthorSource();
            reply(response, 200, document(source.loaded, source.editable));
          } else if (route === "/__editor/preview") {
            const preview = await previewAuthorText(input);
            reply(response, 200, document(preview.loaded, authorFields(preview.updated)));
          } else {
            const saved = await saveAuthorText(input);
            // Save is already committed; only pure response assembly follows.
            reply(response, 200, document(saved.loaded, saved.editable, saved.backup));
          }
        } catch (error: unknown) {
          if (response.headersSent) { response.destroy(); return; }
          if (error instanceof ContentError) reply(response, error.diagnostic.code === "AUTHOR_CONFLICT" ? 409 : 422,
            { error: error.message, diagnostic: error.diagnostic });
          else reply(response, 400, {
            error: "作者操作未确认完成；草稿保留。保存请求若中断，先重新读取源确认结果。",
          });
        } finally { pending = false; }
      })();
    },
  };
}
