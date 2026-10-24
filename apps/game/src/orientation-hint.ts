interface Options {
  root: HTMLElement;
  accept: HTMLButtonElement;
  focusTarget(): HTMLElement;
}

/** Page-local display advice; no session, storage, fullscreen or orientation-lock capability. */
export function connectOrientationHint(options: Options): { dispose(): void } {
  // The game stage fills the viewport; this matches its existing 1.15 portrait threshold.
  const portraitTouch = window.matchMedia("(max-aspect-ratio: 20/23) and (pointer: coarse)");
  const events = new AbortController();
  let accepted = false;
  let closed = false;
  const refresh = (): void => {
    if (closed) return;
    const hadFocus = options.root.contains(document.activeElement);
    options.root.hidden = accepted || !portraitTouch.matches;
    if (hadFocus && options.root.hidden) options.focusTarget().focus({ preventScroll: true });
  };
  portraitTouch.addEventListener("change", refresh, { signal: events.signal });
  options.accept.addEventListener("click", () => {
    accepted = true;
    refresh();
  }, { signal: events.signal });
  refresh();
  return {
    dispose: () => {
      if (closed) return;
      closed = true;
      events.abort();
      options.root.hidden = true;
    },
  };
}
