import type { SourceLocation, StoryContent } from "../../story-model/src/model.ts";
import { at, knownFields, numeric, object, reject, string } from "../../story-model/src/read.ts";

const PRESET_NAMES = ["default", "wafu", "pastel", "scifi", "retro", "minimal"] as const;
const FONT_NAMES = ["sans", "serif", "kai", "round"] as const;
type Preset = (typeof PRESET_NAMES)[number];
type Font = (typeof FONT_NAMES)[number];
type Position = "left" | "center" | "right";

export interface AuthorTheme {
  preset: Preset;
  box: string;
  alpha: number;
  text: string;
  name: string;
  accent: string;
  font: Font;
  size: number;
  radius: number;
  layout: "float" | "wide";
  imageId: string | null;
}

export interface AuthorCover {
  imageId: string | null;
  configured: boolean;
  menu: Position;
  title: Position | "hide";
  style: "glass" | "theme";
  titleY: number;
}

export interface AuthorAppearance { theme: AuthorTheme; cover: AuthorCover }
export interface WhaleArtwork { menu: string; choice: string; dialogue: string }
export interface WhaleSkin {
  artwork: WhaleArtwork;
  source: { file: string; sha256: string; blockSha256: string };
}
/** Game UI decoration from checked legacy sources, separate from story resources. */
export interface CollectionArtwork {
  musicBackdrop: string;
  soundIcons: Readonly<Record<"music" | "ambience" | "effect", string>>;
  controlIcons: Readonly<Record<"next" | "history" | "auto" | "skip" | "saves" | "settings" | "hide" | "audio", string>>;
}
export interface CollectionSkin {
  artwork: CollectionArtwork;
  source: {
    stylesheet: { file: string; sha256: string; blockSha256: string };
    backdrop: { file: string; sha256: string; bytes: number };
    icons: { file: string; sha256: string; blockSha256: string; names: readonly string[] };
  };
}

export const AUTHOR_FONTS: Readonly<Record<Font, string>> = {
  sans: '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif',
  serif: '"Songti SC","SimSun","Noto Serif SC",serif',
  kai: '"Kaiti SC","KaiTi","STKaiti",serif',
  round: '"Yuanti SC","YouYuan","Microsoft YaHei",sans-serif',
};

const PRESETS: Record<Preset, Omit<AuthorTheme, "preset" | "imageId">> = {
  default: { box: "#0c0f1a", alpha: 0.86, text: "#ffffff", name: "#2b3655", accent: "#7aa2ff", font: "sans", size: 26, radius: 14, layout: "float" },
  wafu: { box: "#2a1b12", alpha: 0.88, text: "#f5ead6", name: "#8c2f23", accent: "#d8a24a", font: "serif", size: 26, radius: 4, layout: "float" },
  pastel: { box: "#fffafc", alpha: 0.86, text: "#5a3a4a", name: "#ff8fb1", accent: "#ff8fb1", font: "round", size: 26, radius: 26, layout: "float" },
  scifi: { box: "#021018", alpha: 0.78, text: "#bff8ff", name: "#00a3b4", accent: "#36f1ff", font: "sans", size: 25, radius: 0, layout: "float" },
  retro: { box: "#f3e6c4", alpha: 0.95, text: "#3b2a1a", name: "#6b4a2b", accent: "#b5651d", font: "serif", size: 26, radius: 2, layout: "float" },
  minimal: { box: "#000000", alpha: 0.5, text: "#ffffff", name: "#000000", accent: "#ffffff", font: "sans", size: 26, radius: 0, layout: "wide" },
};

function option<const Options extends readonly string[]>(value: unknown, options: Options, source: SourceLocation): Options[number] {
  const input = string(value, source);
  for (const candidate of options) if (candidate === input) return candidate;
  return reject("APPEARANCE_OPTION", `需要 ${options.join(" / ")} 中的一项`, source);
}

function color(value: unknown, source: SourceLocation): string {
  const input = string(value, source);
  if (!/^#[0-9a-f]{6}$/iu.test(input)) reject("APPEARANCE_COLOR", "主题颜色需要 #rrggbb", source);
  return input;
}

/** Read author settings only; approved release CSS precedence is applied by the view. */
export function readAuthorAppearance(content: StoryContent): AuthorAppearance {
  const settings = content.source.settings;
  const source = { file: content.source.file, field: "settings" };
  const image = (value: unknown, where: SourceLocation, backgroundOnly = false): string | null => {
    if (value === undefined || value === null || value === "") return null;
    const id = string(value, where);
    const resource = content.resources.find(item => item.id === id);
    if (!resource || (resource.kind !== "bg" && (backgroundOnly || resource.kind !== "ch"))) {
      reject("APPEARANCE_IMAGE", `外观需要已登记的${backgroundOnly ? "背景" : "图片"}资源：${id}`, where);
    }
    return id;
  };
  const themeSource = at(source, "theme");
  const input = settings.theme === undefined || settings.theme === null ? {} : object(settings.theme, themeSource);
  knownFields(input, ["preset", "box", "alpha", "text", "name", "accent", "font", "size", "radius", "layout", "img"], themeSource);
  const preset = option(input.preset === undefined ? "default" : input.preset, PRESET_NAMES, at(themeSource, "preset"));
  const base = PRESETS[preset];
  const alpha = numeric(input.alpha, at(themeSource, "alpha"), base.alpha);
  const size = numeric(input.size, at(themeSource, "size"), base.size);
  const radius = numeric(input.radius, at(themeSource, "radius"), base.radius);
  if (alpha < 0 || alpha > 1) reject("APPEARANCE_ALPHA", "主题透明度需要在 0～1 之间", at(themeSource, "alpha"));
  if (size <= 0) reject("APPEARANCE_SIZE", "主题字号必须大于零", at(themeSource, "size"));
  if (radius < 0) reject("APPEARANCE_RADIUS", "主题圆角不能小于零", at(themeSource, "radius"));
  const theme: AuthorTheme = {
    preset, alpha, size, radius,
    box: color(input.box === undefined ? base.box : input.box, at(themeSource, "box")),
    text: color(input.text === undefined ? base.text : input.text, at(themeSource, "text")),
    name: color(input.name === undefined ? base.name : input.name, at(themeSource, "name")),
    accent: color(input.accent === undefined ? base.accent : input.accent, at(themeSource, "accent")),
    font: option(input.font === undefined ? base.font : input.font, FONT_NAMES, at(themeSource, "font")),
    layout: option(input.layout === undefined ? base.layout : input.layout, ["float", "wide"], at(themeSource, "layout")),
    imageId: image(input.img, at(themeSource, "img")),
  };
  const coverSource = at(source, "cover");
  const cover = settings.cover === undefined || settings.cover === null ? {} : object(settings.cover, coverSource);
  knownFields(cover, ["img", "menu", "title", "style", "ty"], coverSource);
  const imageId = image(cover.img, at(coverSource, "img"), true);
  const menu = option(cover.menu === undefined ? "center" : cover.menu, ["left", "center", "right"], at(coverSource, "menu"));
  const title = option(cover.title === undefined ? "center" : cover.title, ["left", "center", "right", "hide"], at(coverSource, "title"));
  const style = option(cover.style === undefined ? "glass" : cover.style, ["glass", "theme"], at(coverSource, "style"));
  const titleY = numeric(cover.ty, at(coverSource, "ty"), 186);
  return {
    theme,
    cover: {
      imageId: imageId ?? content.nodes[0]?.presentation.scene.background ?? null,
      configured: imageId !== null, menu: imageId ? menu : "center", title: imageId ? title : "center", style, titleY,
    },
  };
}
