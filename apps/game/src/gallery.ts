import type { StoryContent } from "../../../packages/story-model/src/model.ts";
import { galleryCatalog, playerProjection } from "../../../packages/player/src/records.ts";
import type { PlayerRecords } from "../../../packages/player/src/records.ts";
import type { ResourceAccess } from "../../../packages/player/src/web/resources.ts";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = text;
  result.className = className;
  return result;
}
const action = (text: string): HTMLButtonElement => {
  const button = element("button", text);
  button.type = "button";
  return button;
};

interface ImageRequest {
  image: HTMLImageElement;
  events: AbortController;
  decoding: boolean;
}
type ImageState = { kind: "loading" | "ready" } | { kind: "failed"; message: string };

/** Owns one local image attempt; decoding cannot adopt into another attempt or a closed panel. */
class GalleryImage {
  readonly #root: HTMLElement;
  readonly #resources: ResourceAccess;
  readonly #className: string;
  readonly #lazy: boolean;
  readonly #changed: (state: ImageState) => void;
  #active: ImageRequest | null = null;

  constructor(root: HTMLElement, resources: ResourceAccess, className: string, lazy: boolean,
    changed: (state: ImageState) => void) {
    this.#root = root;
    this.#resources = resources;
    this.#className = className;
    this.#lazy = lazy;
    this.#changed = changed;
  }

  load(id: string, name: string): void {
    this.clear();
    const image = element("img", "", this.#className);
    image.alt = name;
    image.decoding = "async";
    image.loading = this.#lazy ? "lazy" : "eager";
    const item: ImageRequest = { image, events: new AbortController(), decoding: false };
    this.#active = item;
    this.#changed({ kind: "loading" });
    const failed = (error: unknown): void => {
      if (this.#active !== item) return;
      this.clear();
      this.#changed({ kind: "failed", message: error instanceof Error ? error.message : "本地图片读取或解码失败" });
    };
    const loaded = (): void => {
      if (this.#active !== item || item.decoding) return;
      item.decoding = true;
      try {
        void image.decode().then(() => {
          if (this.#active !== item) return;
          if (!image.naturalWidth || !image.naturalHeight) { failed(new Error("图片没有可显示尺寸")); return; }
          this.#changed({ kind: "ready" });
        }, failed);
      } catch (error: unknown) { failed(error); }
    };
    image.addEventListener("load", loaded, { signal: item.events.signal });
    image.addEventListener("error", () => failed(new Error(`本地图片读取或解码失败：${id}`)), { signal: item.events.signal });
    this.#root.append(image);
    try {
      image.src = this.#resources.url(id);
      if (image.complete && image.naturalWidth) loaded();
    } catch (error: unknown) { failed(error); }
  }

  clear(): void {
    const item = this.#active;
    this.#active = null;
    if (!item) return;
    item.events.abort();
    item.image.removeAttribute("src");
    item.image.remove();
  }
}

/** Viewing committed achievements has no runtime, record-writing or unlocking capability. */
export class GalleryPanel {
  readonly #root: HTMLElement;
  readonly #content: StoryContent;
  readonly #resources: ResourceAccess;
  readonly #catalog: ReturnType<typeof galleryCatalog>;
  readonly #transition: (change: () => void) => void;
  #events: AbortController | null = null;
  #images: GalleryImage[] = [];
  #open = false;
  #disposed = false;

  constructor(root: HTMLElement, content: StoryContent, resources: ResourceAccess,
    transition: (change: () => void) => void = change => change()) {
    this.#root = root;
    this.#content = content;
    this.#resources = resources;
    this.#catalog = galleryCatalog(content);
    this.#transition = transition;
  }

  open(records: PlayerRecords): void {
    if (this.#disposed) return;
    if (records.workId !== this.#content.workId) throw new Error("鉴赏记录不属于当前作品");
    this.close();
    this.#open = true;
    this.#events = new AbortController();
    const { signal } = this.#events;
    const cgs = new Set(records.cgIds);
    const endings = new Map(records.endings.map(item => [item.id, item]));
    const catalog = this.#catalog;
    const stats = element("p", `周目 ${playerProjection(records)["周目"]} · 通关 ${records.clears.length} 次 · `
      + `结局 ${catalog.endings.filter(id => endings.has(id)).length}/${catalog.endings.length} · `
      + `CG ${catalog.cgs.filter(asset => cgs.has(asset.id)).length}/${catalog.cgs.length}`, "gallery-stats");
    const list = element("ul", "", "gallery-endings");
    for (const id of catalog.endings) {
      const ending = endings.get(id);
      const item = element("li");
      item.dataset.unlocked = String(!!ending);
      item.append(element("strong", ending ? id : "尚未解锁的结局"));
      if (ending) {
        const time = element("time", new Date(ending.unlockedAt).toLocaleDateString());
        time.dateTime = new Date(ending.unlockedAt).toISOString();
        item.append(time);
      }
      list.append(item);
    }
    if (!catalog.endings.length) list.append(element("li", "当前作品尚未登记结局。"));
    const directory = element("div", "", "gallery-directory");
    const grid = element("div", "", "gallery-grid");
    const viewer = element("figure", "", "gallery-viewer");
    viewer.hidden = true;
    viewer.tabIndex = -1;
    viewer.setAttribute("aria-label", "已解锁 CG 大图");
    const fullImageRoot = element("div", "", "gallery-image-host");
    const caption = element("figcaption");
    const viewerHeading = element("div", "", "gallery-viewer-heading");
    const viewerContent = element("div", "", "gallery-viewer-content");
    const nameLabel = element("strong");
    const identity = element("small");
    caption.append(nameLabel, identity);
    const fullStatus = element("p", "", "gallery-image-status");
    fullStatus.setAttribute("role", "status");
    fullStatus.setAttribute("aria-live", "polite");
    const retryFull = action("重试本地大图");
    const close = action("返回鉴赏目录");
    let directoryScroll = 0;
    let selected: { id: string; name: string; button: HTMLButtonElement } | null = null;
    const fullImage = new GalleryImage(fullImageRoot, this.#resources, "gallery-full-image", false, state => {
      if (!this.#open || !selected) return;
      const current = selected;
      const update = (): void => {
        if (!this.#open || selected !== current) return;
        retryFull.hidden = state.kind !== "failed";
        fullImageRoot.hidden = state.kind !== "ready";
        fullStatus.textContent = state.kind === "loading" ? `正在读取本地大图：${current.name}（${current.id}）……`
          : state.kind === "ready" ? `已显示：${current.name}`
          : `大图未能显示：${current.name}（${current.id}）。${state.message}。可重试本地图片，收藏记录仍保留。`;
      };
      // Loading/failure belong to the original request. Only accepted decoded content fades in.
      if (state.kind === "ready") this.#transition(update);
      else update();
    });
    this.#images.push(fullImage);
    retryFull.hidden = true;
    retryFull.addEventListener("click", () => {
      if (this.#open && selected) this.#transition(() => {
        if (selected) fullImage.load(selected.id, selected.name);
      });
    }, { signal });
    const closeViewer = (restoreFocus: boolean): void => {
      if (!this.#open || !selected) return;
      fullImage.clear();
      viewer.hidden = true;
      directory.hidden = false;
      this.#root.dataset.galleryView = "directory";
      fullStatus.textContent = "";
      const previous = selected;
      selected = null;
      this.#root.scrollTop = directoryScroll;
      if (restoreFocus && previous?.button.isConnected) previous.button.focus({ preventScroll: true });
    };
    close.addEventListener("click", () => {
      if (this.#open && selected) this.#transition(() => closeViewer(true));
    }, { signal });
    viewerHeading.append(caption, close);
    viewerContent.append(fullStatus, fullImageRoot, retryFull);
    viewer.append(viewerHeading, viewerContent);
    for (const asset of catalog.cgs) {
      const card = element("article", "", "gallery-card");
      const button = action("");
      button.className = "gallery-cg";
      if (!cgs.has(asset.id)) {
        button.disabled = true;
        button.textContent = "尚未解锁";
        card.append(button);
        grid.append(card);
        continue;
      }
      const name = typeof asset.metadata.name === "string" ? asset.metadata.name : asset.id;
      button.setAttribute("aria-label", `查看已解锁 CG：${name}`);
      const thumbnailStatus = element("p", "", "gallery-image-status");
      const retryThumbnail = action("重试缩略图");
      const thumbnail = new GalleryImage(button, this.#resources, "", true, state => {
        if (!this.#open) return;
        retryThumbnail.hidden = state.kind !== "failed";
        button.dataset.imageReady = String(state.kind === "ready");
        thumbnailStatus.textContent = state.kind === "loading" ? `${name} · 缩略图待读取`
          : state.kind === "ready" ? name
          : `${name}（${asset.id}）缩略图不可用：${state.message}。仍可点开本地大图。`;
      });
      this.#images.push(thumbnail);
      retryThumbnail.hidden = true;
      retryThumbnail.addEventListener("click", () => { if (this.#open) thumbnail.load(asset.id, name); }, { signal });
      button.addEventListener("click", () => {
        if (!this.#open) return;
        this.#transition(() => {
          directoryScroll = this.#root.scrollTop;
          selected = { id: asset.id, name, button };
          nameLabel.textContent = name;
          identity.textContent = asset.id;
          directory.hidden = true;
          viewer.hidden = false;
          this.#root.dataset.galleryView = "image";
          this.#root.scrollTop = viewerContent.scrollTop = 0;
          fullImage.load(asset.id, name);
          close.focus({ preventScroll: true });
        });
      }, { signal });
      card.append(button, thumbnailStatus, retryThumbnail);
      grid.append(card);
      thumbnail.load(asset.id, name);
    }
    if (!catalog.cgs.length) grid.append(element("p", "当前作品尚未登记 CG。"));
    const cgSection = element("section", "", "gallery-cg-section");
    cgSection.setAttribute("aria-label", "CG 鉴赏");
    cgSection.append(element("h3", "CG 鉴赏"), grid);
    const endingSection = element("section");
    endingSection.setAttribute("aria-label", "结局收藏");
    endingSection.hidden = true;
    endingSection.append(element("h3", "结局收藏"), list);
    const nav = element("nav", "", "gallery-tabs");
    nav.setAttribute("aria-label", "鉴赏分类");
    const cgTab = action(`CG ${catalog.cgs.filter(asset => cgs.has(asset.id)).length}/${catalog.cgs.length}`);
    const endingTab = action(`结局 ${catalog.endings.filter(id => endings.has(id)).length}/${catalog.endings.length}`);
    cgTab.setAttribute("aria-pressed", "true");
    endingTab.setAttribute("aria-pressed", "false");
    const selectTab = (showCG: boolean): void => {
      if (!this.#open || showCG === !cgSection.hidden) return;
      this.#transition(() => {
        // Category changes clear the original attempt before its decode can publish.
        if (!showCG) closeViewer(false);
        cgSection.hidden = !showCG;
        endingSection.hidden = showCG;
        cgTab.setAttribute("aria-pressed", String(showCG));
        endingTab.setAttribute("aria-pressed", String(!showCG));
      });
    };
    cgTab.addEventListener("click", () => selectTab(true), { signal });
    endingTab.addEventListener("click", () => selectTab(false), { signal });
    nav.append(cgTab, endingTab);
    directory.append(nav, cgSection, endingSection, stats);
    this.#root.dataset.galleryView = "directory";
    this.#root.append(directory, viewer);
  }

  close(): void {
    this.#open = false;
    this.#events?.abort();
    this.#events = null;
    for (const image of this.#images) image.clear();
    this.#images = [];
    this.#root.replaceChildren();
    delete this.#root.dataset.galleryView;
  }

  dispose(): void {
    this.close();
    this.#disposed = true;
  }
}
