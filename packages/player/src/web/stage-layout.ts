const PROPERTIES = [
  "--stage-scale", "--stage-unit", "--stage-left", "--stage-top", "--stage-canvas-height",
  "--portrait-scene-top", "--portrait-dialogue-top", "--portrait-dialogue-height",
  "--portrait-choice-top", "--portrait-choice-height", "--portrait-title-top", "--portrait-text-scale",
] as const;

/** Shared author-coordinate layout only; resizing never accesses story, media or timers. */
export function connectStageLayout(stage: HTMLElement): { dispose(): void } {
  let closed = false;
  const update = (width: number, height: number): void => {
    if (closed || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    const portrait = height > width * 1.15;
    const scale = portrait ? width / 1280 : Math.min(width / 1280, height / 720);
    stage.style.setProperty("--stage-scale", String(scale));
    stage.style.setProperty("--stage-unit", `${1 / scale}px`);
    stage.style.setProperty("--stage-left", `${(width - 1280 * scale) / 2}px`);
    stage.style.setProperty("--stage-top", portrait ? "0px" : `${(height - 720 * scale) / 2}px`);
    stage.style.setProperty("--stage-canvas-height", `${portrait ? height / scale : 720}px`);
    stage.dataset.layout = portrait ? "portrait" : "landscape";
    stage.dataset.smallStage = String(!portrait && scale < 0.75);
    if (!portrait) {
      for (const property of PROPERTIES) if (property.startsWith("--portrait-")) stage.style.removeProperty(property);
      return;
    }
    // The original fit() rules, adapted to the trial's controls remaining outside the stage.
    const sceneHeight = 720 * scale;
    const top = Math.round(Math.min(48, Math.max(0, (height - sceneHeight - 480) / 3)));
    const dialogueTop = top + sceneHeight + 16;
    const dialogueHeight = Math.round(Math.max(150, Math.min(240, (height - dialogueTop - 16) * 0.62)));
    let choiceTop = dialogueTop + dialogueHeight + 10;
    let choiceHeight = height - 14 - choiceTop;
    if (choiceHeight < 150) {
      choiceTop = top + 6;
      choiceHeight = dialogueTop + dialogueHeight - top - 12;
    }
    const coordinate = (value: number): string => `${value / scale}px`;
    stage.style.setProperty("--portrait-scene-top", coordinate(top));
    stage.style.setProperty("--portrait-dialogue-top", coordinate(dialogueTop));
    stage.style.setProperty("--portrait-dialogue-height", coordinate(dialogueHeight));
    stage.style.setProperty("--portrait-choice-top", coordinate(choiceTop));
    stage.style.setProperty("--portrait-choice-height", coordinate(Math.max(0, choiceHeight)));
    stage.style.setProperty("--portrait-title-top", `${top + 28}px`);
    stage.style.setProperty("--portrait-text-scale", String(0.68 / scale));
  };
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) if (entry.target === stage) update(entry.contentRect.width, entry.contentRect.height);
  });
  update(stage.clientWidth, stage.clientHeight);
  resize.observe(stage);
  return {
    dispose: () => {
      if (closed) return;
      closed = true;
      resize.disconnect();
      for (const property of PROPERTIES) stage.style.removeProperty(property);
      delete stage.dataset.smallStage;
      delete stage.dataset.layout;
    },
  };
}
