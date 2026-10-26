import type { CollectionArtwork } from "../../../packages/player/src/appearance.ts";

/** Markup is emitted only by the checked path/circle source extractor, never from dialogue or a save. */
export function createUiIcon(shapes: string, className: string): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.classList.add("ui-icon", className);
  icon.innerHTML = shapes;
  return icon;
}

/** Decorate existing controls once; no listeners, input intents, sound cues or layout timers. */
export function decoratePlayControls(root: HTMLElement, artwork: CollectionArtwork["controlIcons"]): void {
  const keys = new Map<string, keyof typeof artwork>([
    ["next", "next"], ["dialogue-history-open", "history"], ["auto", "auto"], ["skip", "skip"],
    ["toolbar-saves", "saves"], ["toolbar-settings", "settings"], ["hide-ui", "hide"], ["audio", "audio"],
  ]);
  for (const button of root.querySelectorAll<HTMLButtonElement>("button")) {
    const label = document.createElement("span");
    label.dataset.playerLabel = "";
    label.className = "control-label";
    label.textContent = button.textContent;
    const key = keys.get(button.id);
    button.replaceChildren(...(key ? [createUiIcon(artwork[key], "control-icon"), label] : [label]));
  }
}
