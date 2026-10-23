export interface BackgroundShot {
  origin: string;
  scale: number;
  duration: number;
}

interface CameraOwner {
  backgroundId: string;
  shot: BackgroundShot;
  animation: Animation | null;
}

/** A scene-owned camera can span lines; it never reports story completion or enters a checkpoint. */
export class BackgroundCamera {
  readonly #image: HTMLImageElement;
  #owner: CameraOwner | null = null;
  #paused = true;
  #closed = false;

  constructor(image: HTMLImageElement) { this.#image = image; }

  update(backgroundId: string | null, shot: BackgroundShot | null, options: {
    mode: "enter" | "stable"; enabled: boolean; paused: boolean;
  }): void {
    if (this.#closed) return;
    this.#paused = options.paused;
    if (backgroundId === null || !shot || !options.enabled) { this.clear(); return; }
    const previous = this.#owner;
    if (options.mode === "enter" && previous?.backgroundId === backgroundId
      && previous.shot.origin === shot.origin && previous.shot.scale === shot.scale
      && previous.shot.duration === shot.duration) {
      this.setPaused(options.paused);
      return;
    }
    this.clear();
    const owner: CameraOwner = { backgroundId, shot: { ...shot }, animation: null };
    this.#owner = owner;
    this.#image.style.transformOrigin = shot.origin;
    this.#image.style.scale = shot.scale > 1 ? String(shot.scale) : "";
    if (options.mode === "stable" || shot.scale <= 1) return;
    const animation = this.#image.animate([{ scale: "1" }, { scale: String(shot.scale) }], {
      duration: shot.duration, easing: "cubic-bezier(.2,.65,.3,1)", fill: "none",
    });
    owner.animation = animation;
    this.setPaused(this.#paused);
    void animation.finished.then(() => {
      if (this.#owner !== owner || owner.animation !== animation) return;
      owner.animation = null;
      // The underlying style is already the stable target; release the finished effect.
      animation.cancel();
    }, () => {
      if (this.#owner === owner && owner.animation === animation) owner.animation = null;
    });
  }

  setPaused(paused: boolean): void {
    if (this.#closed) return;
    this.#paused = paused;
    const animation = this.#owner?.animation;
    // play() on a finished effect can start it again before its completion microtask runs.
    if (!animation || animation.playState === "finished") return;
    if (paused) animation.pause();
    else if (animation.playState !== "running") animation.play();
  }

  /** Progress recovery and terminal presentation normalize to the same stable target. */
  settle(): void {
    if (this.#closed) return;
    const owner = this.#owner;
    if (!owner) return;
    const animation = owner.animation;
    owner.animation = null;
    animation?.cancel();
    this.#image.style.transformOrigin = owner.shot.origin;
    this.#image.style.scale = owner.shot.scale > 1 ? String(owner.shot.scale) : "";
  }

  /** Skip, missing shot, background replacement and disposal invalidate the original owner first. */
  clear(): void {
    if (this.#closed) return;
    const previous = this.#owner;
    this.#owner = null;
    previous?.animation?.cancel();
    this.#image.style.scale = "";
    this.#image.style.transformOrigin = "";
  }

  dispose(): void {
    if (this.#closed) return;
    this.clear();
    this.#closed = true;
  }
}
