export interface SceneFadeSurface {
  stage: HTMLElement;
  choices: HTMLElement;
}

const FROZEN = ["opacity", "transform", "filter", "translate", "rotate", "scale", "background-position"] as const;

/** Copies only the known player scene and choices, with no listeners or live capabilities. */
export function captureSceneFade(scene: HTMLElement, surface: SceneFadeSurface): HTMLDivElement {
  if (scene.parentElement !== surface.stage || surface.choices.parentElement !== surface.stage) {
    throw new Error("场面与选择须属于本次过渡的同一舞台");
  }
  const host = document.createElement("div");
  host.className = "scene-fade";
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  const scroll: { source: HTMLElement; copy: HTMLElement }[] = [];
  for (const root of [scene, surface.choices]) {
    const copy = root.cloneNode(true) as HTMLElement;
    const sources = [root, ...root.querySelectorAll<HTMLElement>("*")];
    const copies = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
    for (const [index, source] of sources.entries()) {
      const target = copies[index]!;
      target.removeAttribute("id");
      scroll.push({ source, copy: target });
      if (!source.getClientRects().length) continue;
      const style = getComputedStyle(source);
      for (const key of FROZEN) {
        // Keep the two author canvases on the live stage scale; their children are still images.
        if (source === root && ["transform", "translate", "rotate", "scale"].includes(key)) continue;
        target.style.setProperty(key, style.getPropertyValue(key));
      }
      if (source.classList.contains("actor")) {
        for (const key of ["left", "top", "height", "width"]) target.style.setProperty(key, style.getPropertyValue(key));
      }
    }
    host.append(copy);
  }
  try {
    surface.stage.append(host);
    // cloneNode does not retain scroll positions; assign them only after the copy has layout.
    for (const item of scroll) {
      item.copy.scrollTop = item.source.scrollTop;
      item.copy.scrollLeft = item.source.scrollLeft;
    }
    return host;
  } catch (error: unknown) {
    host.remove();
    throw error;
  }
}
