import { capturePlayerLayers } from "./scene-fade.ts";

interface Options {
  stage: HTMLElement;
  layers(): readonly HTMLElement[];
  enabled(): boolean;
  issue(message: string): void;
}

interface Fade {
  host: HTMLDivElement;
  frame: number;
  timer: number;
  animation: Animation | null;
  width: number;
  height: number;
}

/** Visual transactions only. No session, progress, effective clock or storage capability. */
export class StageFade {
  readonly #options: Options;
  readonly #reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  readonly #events = new AbortController();
  readonly #resize: ResizeObserver;
  #active: Fade | null = null;
  #closed = false;

  constructor(options: Options) {
    this.#options = options;
    this.#reduced.addEventListener("change", () => { if (this.#reduced.matches) this.cancel(); },
      { signal: this.#events.signal });
    this.#resize = new ResizeObserver(() => {
      const item = this.#active;
      if (item && (item.width !== options.stage.clientWidth || item.height !== options.stage.clientHeight)) this.cancel();
    });
    this.#resize.observe(options.stage);
  }

  /** Call immediately before an accepted UI change, after asynchronous preparation. */
  begin(): void {
    this.cancel();
    if (this.#closed || !this.#options.enabled() || this.#reduced.matches) return;
    try {
      const item: Fade = {
        host: capturePlayerLayers(this.#options.stage, this.#options.layers(), "stage-fade"),
        frame: 0, timer: 0, animation: null,
        width: this.#options.stage.clientWidth, height: this.#options.stage.clientHeight,
      };
      this.#active = item;
      item.frame = window.requestAnimationFrame(() => {
        item.frame = 0;
        if (!this.current(item)) { this.release(item); return; }
        try {
          // Like the old VN_FADE, wait at most 180 ms for visible DOM images.
          // Neither this wait nor the fade delays the accepted UI/story operation.
          const images = this.#options.layers().flatMap(layer => [...layer.querySelectorAll("img")])
            .filter(image => image.getClientRects().length && !image.complete);
          const ready = images.map(image => image.decode());
          if (!ready.length) { this.reveal(item); return; }
          item.timer = window.setTimeout(() => this.reveal(item), 180);
          void Promise.allSettled(ready).then(() => this.reveal(item));
        } catch (error: unknown) { this.fail(item, error); }
      });
    } catch (error: unknown) {
      this.cancel();
      this.#options.issue(error instanceof Error ? error.message : "旧界面未能采样");
    }
  }

  private current(item: Fade): boolean {
    return !this.#closed && this.#active === item && item.host.isConnected
      && !this.#reduced.matches && this.#options.enabled();
  }

  private reveal(item: Fade): void {
    if (this.#active !== item || item.animation) return;
    if (!this.current(item)) { this.release(item); return; }
    window.clearTimeout(item.timer);
    item.timer = 0;
    try {
      if (typeof item.host.animate !== "function") { this.release(item); return; }
      item.animation = item.host.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 360, easing: "ease-in-out", fill: "forwards" });
      item.timer = window.setTimeout(() => this.release(item), 560);
      void item.animation.finished.then(() => this.release(item), () => this.release(item));
    } catch (error: unknown) { this.fail(item, error); }
  }

  private fail(item: Fade, error: unknown): void {
    const current = this.#active === item && !this.#closed;
    this.release(item);
    if (current) this.#options.issue(error instanceof Error ? error.message : "界面淡出未能完成");
  }

  private release(item: Fade): void {
    if (this.#active !== item) return;
    this.#active = null;
    window.cancelAnimationFrame(item.frame);
    window.clearTimeout(item.timer);
    item.animation?.cancel();
    item.host.remove();
  }

  cancel(): void {
    if (this.#active) this.release(this.#active);
  }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.cancel();
    this.#events.abort();
    this.#resize.disconnect();
  }
}
