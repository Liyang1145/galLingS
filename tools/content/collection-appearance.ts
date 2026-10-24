import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CollectionSkin } from "../../packages/player/src/appearance.ts";
import { at, object, reject, string } from "../../packages/story-model/src/read.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const STYLESHEET = "海风与布丁/game-polish.css";
const ICONS = "海风与布丁/player.js";
const sha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

async function localFile(file: string): Promise<Buffer> {
  const filename = resolve(ROOT, file);
  if (await realpath(filename) !== filename) {
    reject("UI_COLLECTION_PATH", "收藏外观来源路径已改变", { file, field: "" });
  }
  return readFile(filename);
}

/** Read existing CSS and a pure JSON icon table, never evaluate the legacy player. */
export async function readCollectionSkin(): Promise<CollectionSkin> {
  const [styleBytes, iconBytes] = await Promise.all([localFile(STYLESHEET), localFile(ICONS)]);
  const decode = (bytes: Uint8Array): string => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const styles = decode(styleBytes);
  const declarations = [...styles.matchAll(/body\.game \[data-audio-panel="music"\] button\s*\{([^}]*)\}/gu)];
  const block = declarations[0]?.[1];
  const styleSource = { file: STYLESHEET, field: "music-card.background" };
  if (declarations.length !== 1 || !block) {
    reject("UI_COLLECTION_STYLE", "缺少唯一的原配乐卡片样式，不能猜测装饰来源", styleSource);
  }
  const urls = [...block.matchAll(/url\("([^"]+)"\)/gu)];
  const path = urls[0]?.[1];
  if (urls.length !== 1 || !path || !/^assets\/[A-Za-z0-9_/-]+\.webp$/u.test(path)
    || path.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    reject("UI_COLLECTION_IMAGE", "配乐装饰须为作品内唯一的原 WebP 路径", styleSource);
  }
  const file = `海风与布丁/${path}`;
  const backdrop = await localFile(file);
  if (backdrop.length < 12 || backdrop.length > 2 * 1024 * 1024
    || backdrop.toString("ascii", 0, 4) !== "RIFF" || backdrop.toString("ascii", 8, 12) !== "WEBP"
    || backdrop.readUInt32LE(4) + 8 !== backdrop.length) {
    reject("UI_COLLECTION_IMAGE", "原配乐装饰不是大小有界且长度匹配的 WebP", { file, field: "" });
  }
  const matches = [...decode(iconBytes).matchAll(/^const ICON = (\{[^\r\n]+\});\r?$/gmu)];
  const tableText = matches[0]?.[1];
  const iconSource = { file: ICONS, field: "ICON" };
  if (matches.length !== 1 || !tableText) {
    reject("UI_COLLECTION_ICONS", "缺少唯一的原静态图标表，不执行脚本或猜测替代图标", iconSource);
  }
  let input: unknown;
  try { input = JSON.parse(tableText); }
  catch { reject("UI_COLLECTION_ICONS", "原图标表须为纯 JSON", iconSource); }
  const table = object(input, iconSource);
  const icon = (name: string): string => {
    const shapes = string(table[name], at(iconSource, name));
    // Only the exact inert shape forms used by the selected original icons are accepted.
    if (shapes.length > 32 * 1024 || !/^(?:<path d="[A-Za-z0-9.,+\s-]+"\/>|<circle cx="[0-9.+-]+" cy="[0-9.+-]+" r="[0-9.+-]+"\/>)+$/u.test(shapes)) {
      reject("UI_COLLECTION_ICON", "声音图标只接受原 path/circle，无脚本、事件、样式或外链", at(iconSource, name));
    }
    return shapes;
  };
  return {
    artwork: {
      musicBackdrop: `data:image/webp;base64,${backdrop.toString("base64")}`,
      soundIcons: { music: icon("music"), ambience: icon("waves"), effect: icon("bell") },
      controlIcons: {
        next: icon("arrow-right"), history: icon("scroll-text"), auto: icon("circle-play"), skip: icon("fast-forward"),
        saves: icon("save"), settings: icon("settings"), hide: icon("eye"), audio: icon("volume-2"),
      },
    },
    source: {
      stylesheet: { file: STYLESHEET, sha256: sha256(styleBytes), blockSha256: sha256(block) },
      backdrop: { file, sha256: sha256(backdrop), bytes: backdrop.byteLength },
      icons: {
        file: ICONS, sha256: sha256(iconBytes), blockSha256: sha256(tableText),
        names: ["music", "waves", "bell", "arrow-right", "scroll-text", "circle-play", "fast-forward", "save", "settings", "eye", "volume-2"],
      },
    },
  };
}
