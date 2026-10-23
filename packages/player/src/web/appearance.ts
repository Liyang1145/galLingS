import type { StoryContent } from "../../../story-model/src/model.ts";
import { AUTHOR_FONTS, readAuthorAppearance } from "../appearance.ts";
import type { AuthorAppearance, AuthorCover, WhaleArtwork } from "../appearance.ts";
import type { ResourceAccess } from "./resources.ts";

const cssUrl = (url: string): string => `url(${JSON.stringify(url)})`;
const alpha = (hex: string, value: number): string =>
  hex + Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, "0");
const light = (hex: string): boolean => Number.parseInt(hex.slice(1, 3), 16) * 0.299
  + Number.parseInt(hex.slice(3, 5), 16) * 0.587 + Number.parseInt(hex.slice(5, 7), 16) * 0.114 > 150;

/** Scoped CSS only. Author settings never become arbitrary CSS, HTML or script. */
export function applyAuthorAppearance(
  root: HTMLElement, content: StoryContent, resources: ResourceAccess, artwork?: WhaleArtwork,
): AuthorAppearance {
  const appearance = readAuthorAppearance(content);
  const t = appearance.theme;
  const wide = t.layout === "wide";
  const background = t.imageId ? `${cssUrl(resources.url(t.imageId))} center/100% 100% no-repeat`
    : wide ? `linear-gradient(${alpha(t.box, 0)},${alpha(t.box, t.alpha)} 40%)`
    : `linear-gradient(${alpha(t.box, t.alpha * 0.9)},${alpha(t.box, Math.min(1, t.alpha * 1.08))})`;
  const values = {
    "--author-panel": background,
    "--author-border": t.imageId || wide ? "0" : t.preset === "scifi" ? `1px solid ${t.accent}`
      : t.preset === "wafu" ? `2px solid ${alpha(t.accent, 0.7)}` : `1px solid ${light(t.box) ? "#00000022" : "#ffffff22"}`,
    "--author-shadow": t.preset === "scifi" ? `0 0 14px ${alpha(t.accent, 0.45)}` : t.preset === "pastel" ? "0 4px 18px #ff8fb144" : "none",
    "--author-radius": `${t.radius}px`, "--author-side": wide ? "0px" : "60px",
    "--author-bottom": wide ? "0px" : "28px", "--author-height": wide ? "220px" : "190px",
    "--author-name-bg": wide ? "transparent" : t.name,
    "--author-name-fg": wide ? t.accent : light(t.name) ? "#222222" : "#ffffff",
    "--author-name-radius": `${Math.min(t.radius, 20)}px`,
    "--author-name-border": wide ? "0" : `1px solid ${light(t.name) ? "#00000022" : "#ffffff30"}`,
    "--author-text": t.text, "--author-size": `${t.size}px`, "--author-font": AUTHOR_FONTS[t.font],
    "--author-choice-bg": alpha(t.box, Math.max(0.75, t.alpha)),
    "--author-choice-hover": t.name === "#000000" ? alpha(t.accent, 0.35) : t.name,
    "--author-choice-border": `1px solid ${t.preset === "scifi" ? t.accent : light(t.box) ? "#00000030" : "#ffffff40"}`,
    "--author-choice-radius": `${Math.min(t.radius, 30)}px`, "--author-accent": t.accent,
  };
  for (const [key, value] of Object.entries(values)) root.style.setProperty(key, value);
  root.dataset.theme = t.preset;
  root.dataset.authorLayout = t.layout;
  root.dataset.whale = String(artwork !== undefined);
  for (const key of ["menu", "choice", "dialogue"] as const) {
    if (artwork) root.style.setProperty(`--whale-${key}`, cssUrl(artwork[key]));
    else root.style.removeProperty(`--whale-${key}`);
  }
  return appearance;
}

/** Title media has its own cancellable lifetime and never starts a story session. */
export function connectTitleCover(options: {
  root: HTMLElement; title: HTMLElement; menu: HTMLElement; status: HTMLElement;
  retry: HTMLButtonElement; cover: AuthorCover; resources: ResourceAccess;
}): { retry(): void; dispose(): void } {
  let closed = false;
  let active: { image: HTMLImageElement; events: AbortController } | null = null;
  const cancel = (): void => {
    active?.events.abort();
    active?.image.removeAttribute("src");
    active?.image.remove();
    active = null;
  };
  options.root.dataset.titlePosition = options.cover.title;
  options.root.dataset.coverStyle = options.cover.configured ? options.cover.style : "theme";
  options.root.style.setProperty("--cover-title-y", `${options.cover.titleY}px`);
  options.menu.dataset.authorPosition = options.cover.menu;
  options.title.hidden = options.cover.title === "hide";
  const failed = (): void => {
    options.status.textContent = `标题背景未能读取或解码：${options.cover.imageId}。可重试本地封面；主线入口仍可使用。`;
    options.retry.hidden = false;
  };
  const retry = (): void => {
    if (closed) return;
    cancel();
    options.retry.hidden = true;
    if (!options.cover.imageId) { options.status.textContent = ""; return; }
    options.status.textContent = "正在读取本地标题背景……";
    const image = document.createElement("img");
    image.className = "title-cover";
    image.alt = "";
    const events = new AbortController();
    active = { image, events };
    image.addEventListener("load", () => {
      if (!closed && active?.image === image) options.status.textContent = "";
    }, { signal: events.signal });
    image.addEventListener("error", () => {
      if (!closed && active?.image === image) failed();
    }, { signal: events.signal });
    options.root.prepend(image);
    try { image.src = options.resources.url(options.cover.imageId); }
    catch { failed(); }
  };
  const events = new AbortController();
  options.retry.addEventListener("click", retry, { signal: events.signal });
  retry();
  return {
    retry,
    dispose: () => {
      closed = true;
      events.abort();
      cancel();
    },
  };
}
