import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { WhaleSkin } from "../../packages/player/src/appearance.ts";
import { reject } from "../../packages/story-model/src/read.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FILE = "海风与布丁/index.html";
const sha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Extract three existing image declarations; never load or execute the legacy page. */
export async function readWhaleSkin(): Promise<WhaleSkin> {
  const filename = resolve(ROOT, FILE);
  if (await realpath(filename) !== filename) reject("UI_SOURCE_PATH", "鲸鱼皮肤来源路径已改变", { file: FILE, field: "" });
  const bytes = await readFile(filename);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const start = "<!-- WHALE_UI_APPROVED_START -->";
  const end = "<!-- WHALE_UI_APPROVED_END -->";
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  const source = { file: FILE, field: "WHALE_UI_APPROVED" };
  if (from < 0 || to < 0 || text.indexOf(start, from + start.length) >= 0 || text.indexOf(end, to + end.length) >= 0) {
    reject("UI_SOURCE_MARKER", "现有鲸鱼 UI 标记缺失或重复，不能猜测来源", source);
  }
  const block = text.slice(from + start.length, to);
  const artwork = (key: string): string => {
    const pattern = new RegExp(`--whale-${key}:url\\("data:image/svg\\+xml;base64,([A-Za-z0-9+/]+={0,2})"\\)`, "gu");
    const matches = [...block.matchAll(pattern)];
    const payload = matches[0]?.[1];
    if (matches.length !== 1 || !payload) reject("UI_SOURCE_IMAGE", `缺少唯一的鲸鱼皮肤图：${key}`, source);
    const image = Buffer.from(payload, "base64");
    const svg = new TextDecoder("utf-8", { fatal: true }).decode(image);
    const markup = svg.replace(/<!--[\s\S]*?-->/gu, "");
    // Current art consists of local SVG shapes/gradients and fragment-only uses.
    if (image.byteLength > 256 * 1024 || image.toString("base64") !== payload || !svg.startsWith("<svg ")
      || !svg.trimEnd().endsWith("</svg>") || /<(?:script|foreignObject|image|style|animate|set)\b|<!|<\?|(?:\s|:)on[a-z]+\s*=/iu.test(markup)
      || [...markup.matchAll(/(?:\b(?:href|src)\s*=\s*["'])([^"']*)["']/giu)].some(match => !match[1]?.startsWith("#"))
      || [...markup.matchAll(/url\(([^)]*)\)/giu)].some(match => !match[1]?.startsWith("#"))) {
      reject("UI_SOURCE_SVG", `鲸鱼皮肤图需要无脚本、无外链的现有 SVG：${key}`, source);
    }
    return `data:image/svg+xml;base64,${payload}`;
  };
  return {
    artwork: { menu: artwork("menu"), choice: artwork("choice"), dialogue: artwork("dialogue") },
    source: { file: FILE, sha256: sha256(bytes), blockSha256: sha256(block) },
  };
}
