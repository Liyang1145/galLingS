import type { WhaleSkin } from "../../packages/player/src/appearance.ts";
import { at, knownFields, reject, string } from "../../packages/story-model/src/read.ts";
import { readUiDefinition, uiSha256, WHALE_UI_SOURCE } from "./ui-source.ts";

/** Read the three original SVG payloads from their independent UI definition. */
export async function readWhaleSkin(): Promise<WhaleSkin> {
  const { data, sha256 } = await readUiDefinition(WHALE_UI_SOURCE);
  const source = { file: WHALE_UI_SOURCE, field: "" };
  knownFields(data, ["menu", "choice", "dialogue"], source);
  const artwork = (key: string): string => {
    const where = at(source, key);
    const uri = string(data[key], where);
    const payload = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/]+={0,2})$/u.exec(uri)?.[1];
    if (!payload) reject("UI_SOURCE_IMAGE", `鲸鱼皮肤图需要原 SVG 数据：${key}`, where);
    const image = Buffer.from(payload, "base64");
    let svg: string;
    try { svg = new TextDecoder("utf-8", { fatal: true }).decode(image); }
    catch { return reject("UI_SOURCE_SVG", `鲸鱼皮肤图不是有效 UTF-8：${key}`, where); }
    const markup = svg.replace(/<!--[\s\S]*?-->/gu, "");
    // Current art consists of local SVG shapes/gradients and fragment-only uses.
    if (image.byteLength > 256 * 1024 || image.toString("base64") !== payload || !svg.startsWith("<svg ")
      || !svg.trimEnd().endsWith("</svg>") || /<(?:script|foreignObject|image|style|animate|set)\b|<!|<\?|(?:\s|:)on[a-z]+\s*=/iu.test(markup)
      || [...markup.matchAll(/(?:\b(?:href|src)\s*=\s*["'])([^"']*)["']/giu)].some(match => !match[1]?.startsWith("#"))
      || [...markup.matchAll(/url\(([^)]*)\)/giu)].some(match => !match[1]?.startsWith("#"))) {
      reject("UI_SOURCE_SVG", `鲸鱼皮肤图需要无脚本、无外链的现有 SVG：${key}`, where);
    }
    return `data:image/svg+xml;base64,${payload}`;
  };
  const images = { menu: artwork("menu"), choice: artwork("choice"), dialogue: artwork("dialogue") };
  return { artwork: images, source: { file: WHALE_UI_SOURCE, sha256, blockSha256: uiSha256(JSON.stringify(images)) } };
}
