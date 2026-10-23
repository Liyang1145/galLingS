import type { StoryContent } from "../../../packages/story-model/src/model.ts";
import { galleryCatalog, playerProjection } from "../../../packages/player/src/records.ts";
import type { PlayerRecords } from "../../../packages/player/src/records.ts";
import type { ResourceAccess } from "../../../packages/player/src/web/resources.ts";

/** Viewing achievements never starts a runtime or writes progress/records. */
export function renderGallery(root: HTMLElement, content: StoryContent, resources: ResourceAccess, records: PlayerRecords): void {
  root.replaceChildren();
  const catalog = galleryCatalog(content);
  const cgs = new Set(records.cgIds);
  const endings = new Map(records.endings.map(item => [item.id, item]));
  const stats = document.createElement("p");
  stats.textContent = `周目 ${playerProjection(records)["周目"]} · 通关 ${records.clears.length} 次 · `
    + `结局 ${catalog.endings.filter(id => endings.has(id)).length}/${catalog.endings.length} · `
    + `CG ${catalog.cgs.filter(asset => cgs.has(asset.id)).length}/${catalog.cgs.length}`;
  const heading = document.createElement("h3");
  heading.textContent = "结局收藏";
  const list = document.createElement("ul");
  for (const id of catalog.endings) {
    const item = document.createElement("li");
    const ending = endings.get(id);
    item.textContent = ending ? `${id} · ${new Date(ending.unlockedAt).toLocaleDateString()}` : "尚未解锁的结局";
    list.append(item);
  }
  const cgHeading = document.createElement("h3");
  cgHeading.textContent = "CG 鉴赏";
  const grid = document.createElement("div");
  grid.className = "gallery-grid";
  const viewer = document.createElement("figure");
  viewer.hidden = true;
  const image = document.createElement("img");
  image.className = "gallery-full-image";
  const caption = document.createElement("figcaption");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "收起大图";
  close.onclick = () => { image.removeAttribute("src"); viewer.hidden = true; };
  viewer.append(image, caption, close);
  for (const asset of catalog.cgs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-cg";
    const unlocked = cgs.has(asset.id);
    button.disabled = !unlocked;
    if (!unlocked) button.textContent = "尚未解锁";
    else {
      const name = typeof asset.metadata.name === "string" ? asset.metadata.name : asset.id;
      const thumbnail = document.createElement("img");
      thumbnail.loading = "lazy";
      thumbnail.decoding = "async";
      thumbnail.alt = name;
      thumbnail.src = resources.url(asset.id);
      button.append(thumbnail);
      button.onclick = () => {
        image.alt = name;
        image.src = resources.url(asset.id);
        caption.textContent = name;
        viewer.hidden = false;
        viewer.scrollIntoView({ block: "nearest" });
      };
    }
    grid.append(button);
  }
  root.append(stats, heading, list, cgHeading, viewer, grid);
}
