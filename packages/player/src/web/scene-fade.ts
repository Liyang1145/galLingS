export interface SceneFadeSurface {
  stage: HTMLElement;
  choices: HTMLElement;
}

const FROZEN = ["opacity", "visibility", "transform", "filter", "translate", "rotate", "scale", "background-position"] as const;

/** Copies only the known player scene and choices, with no listeners or live capabilities. */
export function captureSceneFade(scene: HTMLElement, surface: SceneFadeSurface): HTMLDivElement {
  return capturePlayerLayers(surface.stage, [scene, surface.choices], "scene-fade");
}

/** Explicit sibling layers only; never copy the page, other fades or production controls. */
export function capturePlayerLayers(
  stage: HTMLElement, roots: readonly HTMLElement[], className: "scene-fade" | "stage-fade",
): HTMLDivElement {
  if (!roots.length || new Set(roots).size !== roots.length || roots.some(root => root.parentElement !== stage)) {
    throw new Error("过渡图层须为本次舞台内不重复的直接子节点");
  }
  const host = document.createElement("div");
  host.className = className;
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  const scroll: { source: HTMLElement; copy: HTMLElement }[] = [];
  for (const root of roots) {
    const copy = root.cloneNode(true) as HTMLElement;
    const sources = [root, ...root.querySelectorAll<HTMLElement>("*")];
    const copies = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
    for (const [index, source] of sources.entries()) {
      const target = copies[index]!;
      target.removeAttribute("id");
      target.removeAttribute("autofocus");
      scroll.push({ source, copy: target });
      if (!source.getClientRects().length) continue;
      const style = getComputedStyle(source);
      for (const key of FROZEN) {
        // Keep author canvases on the live stage scale; their children are still images.
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
    stage.append(host);
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
