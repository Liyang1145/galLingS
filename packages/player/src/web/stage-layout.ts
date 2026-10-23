/** One stage coordinate scale for the scene, title and choice canvas. No story or timer access. */
export function connectStageLayout(stage: HTMLElement): { dispose(): void } {
  let closed = false;
  const update = (width: number): void => {
    if (closed || !Number.isFinite(width) || width <= 0) return;
    const scale = width / 1280;
    stage.style.setProperty("--stage-scale", String(scale));
    stage.style.setProperty("--stage-unit", `${1 / scale}px`);
    stage.dataset.smallStage = String(scale < 0.75);
  };
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) if (entry.target === stage) update(entry.contentRect.width);
  });
  update(stage.clientWidth);
  resize.observe(stage);
  return {
    dispose: () => {
      if (closed) return;
      closed = true;
      resize.disconnect();
      stage.style.removeProperty("--stage-scale");
      stage.style.removeProperty("--stage-unit");
      delete stage.dataset.smallStage;
    },
  };
}
