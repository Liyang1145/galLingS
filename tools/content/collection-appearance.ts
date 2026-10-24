import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CollectionSkin } from "../../packages/player/src/appearance.ts";
import { ContentError } from "../../packages/story-model/src/model.ts";
import { at, knownFields, object, reject, string } from "../../packages/story-model/src/read.ts";
import { COLLECTION_UI_SOURCE, readUiDefinition, uiSha256 } from "./ui-source.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ICON_NAMES = ["music", "waves", "bell", "arrow-right", "scroll-text", "circle-play", "fast-forward", "save", "settings", "eye", "volume-2"] as const;

async function localFile(file: string): Promise<Buffer> {
  const filename = resolve(ROOT, file);
  const source = { file, field: "" };
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.size > 2 * 1024 * 1024 || await realpath(filename) !== filename) {
      reject("UI_COLLECTION_PATH", "收藏外观来源须为固定位置的有界普通文件", source);
    }
    return await readFile(filename);
  } catch (error: unknown) {
    if (error instanceof ContentError) throw error;
    return reject("UI_COLLECTION_READ", "无法读取原配乐装饰文件", source);
  }
}

/** Read the independent game decoration definition and the unchanged original WebP. */
export async function readCollectionSkin(): Promise<CollectionSkin> {
  const { data, sha256 } = await readUiDefinition(COLLECTION_UI_SOURCE);
  const source = { file: COLLECTION_UI_SOURCE, field: "" };
  knownFields(data, ["musicBackdrop", "icons"], source);
  const file = string(data.musicBackdrop, at(source, "musicBackdrop"));
  if (!/^海风与布丁\/assets\/[A-Za-z0-9_/-]+\.webp$/u.test(file)
    || file.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    reject("UI_COLLECTION_IMAGE", "配乐装饰须为作品内的原 WebP 路径", at(source, "musicBackdrop"));
  }
  const backdrop = await localFile(file);
  if (backdrop.length < 12 || backdrop.length > 2 * 1024 * 1024
    || backdrop.toString("ascii", 0, 4) !== "RIFF" || backdrop.toString("ascii", 8, 12) !== "WEBP"
    || backdrop.readUInt32LE(4) + 8 !== backdrop.length) {
    reject("UI_COLLECTION_IMAGE", "原配乐装饰不是大小有界且长度匹配的 WebP", { file, field: "" });
  }
  const iconSource = at(source, "icons");
  const table = object(data.icons, iconSource);
  knownFields(table, ICON_NAMES, iconSource);
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
      definition: { file: COLLECTION_UI_SOURCE, sha256 },
      backdrop: { file, sha256: uiSha256(backdrop), bytes: backdrop.byteLength },
      icons: { blockSha256: uiSha256(JSON.stringify(table)), names: ICON_NAMES },
    },
  };
}
