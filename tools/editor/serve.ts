import { createServer } from "node:http";
import { realpath } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonical } from "../../packages/story-model/src/integrity.ts";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { REPOSITORY_ROOT } from "../content/build.ts";
import { createEditorApi, EDITOR_HOST, EDITOR_ORIGIN } from "./api.ts";
import { checkedEditorFile, editorFileBytes, editorFiles, editorPackageId, editorRuntimeInputs, insideEditorRoot, readEditorPackage } from "./package.ts";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".woff": "font/woff", ".woff2": "font/woff2",
};

/** Explicitly serves one checked frontend with the current fixed-file author API. No Vite transforms. */
async function serve(id: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/u.test(id)) throw new Error("需要 editor:build 输出的完整编辑产物摘要");
  const root = await realpath(REPOSITORY_ROOT);
  const output = resolve(root, "dist/editor", id);
  if (await realpath(output) !== output || !insideEditorRoot(root, output)) throw new Error("编辑产物目录边界无效");
  const bytes = await editorFileBytes(output, "editor-package.json");
  if (bytes.byteLength > 4 * 1024 * 1024) throw new Error("编辑清单超过大小限制");
  const manifest = readEditorPackage(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown);
  if (editorPackageId(manifest) !== id) throw new Error("编辑清单与目录摘要不符");
  const frontend = resolve(output, "frontend");
  if (canonical(await editorFiles(frontend)) !== canonical(manifest.frontend)
    || canonical(await editorRuntimeInputs(root)) !== canonical(manifest.runtimeInputs)) {
    throw new Error("编辑前端或本机运行输入已变化，请重新构建；没有启动作者服务");
  }
  const api = createEditorApi({
    async beforeOperation() {
      if (canonical(await editorRuntimeInputs(root)) !== canonical(manifest.runtimeInputs)) {
        throw new ContentError("EDITOR_RUNTIME_CHANGED", "本机编辑运行输入已变化，请停止服务并重新构建；未执行本次作者操作", {
          file: "editor-package.json", field: "runtimeInputs",
        });
      }
    },
  });
  // Validate injection before listening, without putting this runtime token in any output file.
  api.html(new TextDecoder("utf-8", { fatal: true }).decode(await editorFileBytes(frontend, "index.html")));
  const files = new Map(manifest.frontend.map(file => [`/${file.path.split("/").map(encodeURIComponent).join("/")}`, file]));
  const server = createServer((request, response) => {
    if (request.headers.host !== EDITOR_HOST) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      response.end("请使用固定本机编辑地址。");
      return;
    }
    api.middleware(request, response, () => {
      const url = request.url === "/" ? "/index.html" : request.url ?? "";
      const file = files.get(url);
      if (!file || (request.method !== "GET" && request.method !== "HEAD")) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        response.end("没有此已登记的编辑前端文件。");
        return;
      }
      void (async () => {
        try {
          const source = await checkedEditorFile(frontend, file);
          const data = file.path === "index.html"
            ? Buffer.from(api.html(new TextDecoder("utf-8", { fatal: true }).decode(source)), "utf8") : source;
          response.writeHead(200, {
            "Content-Type": TYPES[extname(file.path).toLowerCase()] ?? "application/octet-stream",
            "Content-Length": data.byteLength, "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
          });
          response.end(request.method === "HEAD" ? undefined : data);
        } catch {
          if (response.headersSent) { response.destroy(); return; }
          response.writeHead(409, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
          response.end("编辑前端已改变或读取失败，请停止服务并重新构建，不采用变化后的文件。");
        }
      })();
    });
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen({ host: "127.0.0.1", port: 5174, exclusive: true }, () => {
      server.off("error", fail);
      done();
    });
  });
  server.on("error", () => {
    console.error("本机编辑服务发生错误，停止接收新连接；已有保存结果须重新读取确认。");
    process.exitCode = 1;
    server.close();
  });
  const close = (): void => {
    console.log("正在停止本机编辑服务，等待已有请求结束；不会新增保存。");
    server.close(() => { process.off("SIGINT", close); process.off("SIGTERM", close); });
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  console.log(`编辑集成试用：${EDITOR_ORIGIN}（产物 ${id}）`);
  console.log("只服务当前仓库；显式“保存到作者源”会修改现有作品文件，不是玩家游戏入口。");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("用法：npm run editor:serve -- <editor:build 输出的完整摘要>");
    process.exitCode = 1;
  } else {
    serve(args[0]!).catch((error: unknown) => {
      if (error instanceof ContentError) console.error(JSON.stringify(error.diagnostic, null, 2));
      else if (error instanceof Error) console.error(error.message);
      console.error("编辑集成服务未启动：请检查产物摘要、文件/运行输入是否一致及固定端口 5174 是否空闲。没有执行构建或写作者源。");
      process.exitCode = 1;
    });
  }
}
