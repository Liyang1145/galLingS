import type { GameSession, SessionToken } from "../session.ts";
import { setButtonLabel } from "./button-label.ts";

interface InputOptions {
  stage: HTMLElement;
  scene: HTMLElement;
  choices: HTMLElement;
  controls: HTMLElement;
  hide: HTMLButtonElement;
  keyboardScopes: readonly Node[];
  session(): GameSession | null;
  enabled(): boolean;
  unlockAudio(): void;
  menu(): void;
  history?: () => void;
}

interface Gesture {
  pointerId: number;
  owner: GameSession;
  token: SessionToken;
  x: number;
  y: number;
  timer: number | null;
  moved: boolean;
  done: boolean;
  cancelled: boolean;
}

const INTERACTIVE = "button,a,input,textarea,select,summary,[contenteditable],[role='button'],[role='slider']";
const STAGE_CONTROLS = `${INTERACTIVE},.choices,.menu-overlay,.title-screen`;
const sameToken = (a: SessionToken, b: SessionToken): boolean =>
  a.session === b.session && a.epoch === b.epoch && a.step === b.step;

/** Browser input only: dispatch intents to the same session, never calculate story outcomes. */
export class PlayerInput {
  readonly #options: InputOptions;
  readonly #events = new AbortController();
  readonly #inert = new Map<HTMLElement, boolean>();
  readonly #pointers = new Set<number>();
  readonly #controls = new Set<string>();
  #owner: GameSession | null = null;
  #held: GameSession | null = null;
  #gesture: Gesture | null = null;
  #tap: { owner: GameSession; token: SessionToken } | null = null;
  #suppressed: { pointerId: number; until: number } | null = null;
  #hidden = false;
  #closed = false;

  constructor(options: InputOptions) {
    this.#options = options;
    for (const target of [options.scene, options.choices, ...options.controls.querySelectorAll("button")]) {
      if (target !== options.hide) this.#inert.set(target, target.inert);
    }
    const { signal } = this.#events;
    options.hide.addEventListener("click", () => this.toggleHidden(), { signal });
    options.stage.addEventListener("click", event => this.click(event), { signal, capture: true });
    options.stage.addEventListener("pointerdown", event => this.pointerDown(event), { signal });
    options.stage.addEventListener("contextmenu", event => {
      if (!this.current() || !(event.target instanceof Element) || event.target.closest(STAGE_CONTROLS)) return;
      event.preventDefault();
      if (this.#gesture || (event instanceof PointerEvent && event.pointerType === "touch")) return;
      this.toggleHidden();
    }, { signal });
    options.stage.addEventListener("wheel", event => {
      if (event.ctrlKey || event.metaKey || event.deltaY >= 0 || !options.history || !this.current()
        || !(event.target instanceof Element) || event.target.closest(STAGE_CONTROLS)) return;
      const text = event.target.closest(".dialogue-text");
      if (text && text.scrollHeight > text.clientHeight + 2) return;
      event.preventDefault();
      this.openHistory();
    }, { signal, passive: false });
    document.addEventListener("keydown", event => this.keyDown(event), { signal });
    document.addEventListener("keyup", event => {
      if (event.key !== "Control") return;
      this.#controls.delete(event.code || event.key);
      if (this.#controls.size === 0) this.releaseHold();
    }, { signal });
    document.addEventListener("focusin", event => {
      if (!(event.target instanceof Node) || !this.inScope(event.target)
        || (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable]"))) {
        this.releaseHold();
      }
    }, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.reset(); }, { signal });
    window.addEventListener("blur", () => { this.reset(); this.#pointers.clear(); }, { signal });
    window.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse") return;
      this.#pointers.add(event.pointerId);
      if (this.#pointers.size > 1) this.cancelGesture();
    }, { signal, capture: true });
    window.addEventListener("pointermove", event => this.pointerMove(event), { signal });
    for (const type of ["pointerup", "pointercancel"] as const) {
      window.addEventListener(type, event => this.pointerEnd(event, type === "pointercancel"), { signal });
    }
    this.refresh();
  }

  private available(allowEnded = false): GameSession | null {
    if (this.#closed || document.hidden || !this.#options.enabled()) return null;
    const owner = this.#options.session();
    if (!owner) return null;
    const view = owner.view();
    if (view.disposed || (!allowEnded && view.story.phase === "ended")) return null;
    return owner;
  }

  private current(allowLoading = false): GameSession | null {
    const owner = this.available();
    if (!owner || owner.view().paused.some(reason => !(allowLoading && reason === "loading"))) return null;
    return owner;
  }

  private inScope(target: Node): boolean {
    return this.#options.keyboardScopes.some(scope => scope.contains(target));
  }

  private setHidden(hidden: boolean): void {
    this.#hidden = hidden;
    const { stage, controls, hide } = this.#options;
    const active = document.activeElement;
    const moveFocus = hidden && active instanceof HTMLElement && [...this.#inert.keys()].some(element => element.contains(active));
    stage.dataset.uiHidden = controls.dataset.uiHidden = String(hidden);
    for (const [element, initial] of this.#inert) element.inert = hidden || initial;
    setButtonLabel(hide, hidden ? "显示界面" : "隐藏界面");
    hide.setAttribute("aria-pressed", String(hidden));
    if (moveFocus) hide.focus({ preventScroll: true });
  }

  /** Restore only. The caller can consume this action before opening a menu or advancing. */
  reveal(): boolean {
    if (!this.#hidden) return false;
    this.setHidden(false);
    return true;
  }

  toggleHidden(): void {
    if (this.#closed) return;
    if (this.reveal()) return;
    if (this.current()) this.setHidden(true);
  }

  next(): void {
    if (this.#closed || this.reveal()) return;
    const owner = this.current();
    if (!owner) return;
    this.#options.unlockAudio();
    owner.send({ type: "next", token: owner.view().token });
  }

  menu(): void {
    if (this.#closed || this.reveal() || !this.available(true)) return;
    this.releaseHold();
    this.cancelGesture();
    this.#options.menu();
  }

  toggleAuto(): void {
    const owner = this.current();
    if (!owner) return;
    const enabled = !owner.view().auto;
    this.releaseHold();
    owner.send({ type: "auto", enabled });
  }

  toggleSkip(): void {
    const owner = this.current();
    if (!owner) return;
    const enabled = !owner.view().skipping;
    this.#held = null; // Explicit button control supersedes ownership of a held key.
    this.#controls.clear();
    owner.send({ type: "skip", enabled });
  }

  private openHistory(): void {
    if (!this.#options.history || !this.current()) return;
    this.reveal();
    this.releaseHold();
    this.#options.history();
  }

  private releaseHold(): void {
    const owner = this.#held;
    this.#held = null;
    this.#controls.clear();
    if (owner && owner === this.#options.session() && !owner.view().disposed) owner.send({ type: "skip", enabled: false });
  }

  private cancelGesture(): void {
    const gesture = this.#gesture;
    if (!gesture) return;
    if (gesture.timer !== null) window.clearTimeout(gesture.timer);
    gesture.timer = null;
    gesture.cancelled = true;
  }

  reset(): void {
    this.cancelGesture();
    this.releaseHold();
    this.reveal();
  }

  /** Called after session updates; loading is an internal pause, not permission to change inputs. */
  refresh(): void {
    if (this.#closed) return;
    const owner = this.#options.session();
    const view = owner?.view();
    if (owner !== this.#owner) {
      this.reset();
      this.#owner = owner;
    }
    if (!view || view.disposed || view.story.phase === "ended" || !this.#options.enabled()
      || document.hidden || view.paused.some(reason => reason !== "loading")) this.reset();
    else {
      if (view.story.phase === "choosing") this.releaseHold();
      if (this.#gesture && (view.paused.length > 0 || !sameToken(this.#gesture.token, view.token))) this.cancelGesture();
    }
    this.#options.hide.disabled = !this.current(this.#hidden);
  }

  private click(event: MouseEvent): void {
    const suppressed = this.#suppressed;
    const followUp = suppressed && event.detail > 0 && performance.now() < suppressed.until
      && (!(event instanceof PointerEvent) || event.pointerId < 0 || event.pointerId === suppressed.pointerId);
    if (followUp || (suppressed && performance.now() >= suppressed.until)) this.#suppressed = null;
    const tap = this.#tap;
    this.#tap = null;
    const owner = this.#options.session();
    const staleTap = tap && (!owner || owner !== tap.owner || !sameToken(tap.token, owner.view().token));
    if (followUp || staleTap || this.#hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!followUp && !staleTap) this.reveal();
      return;
    }
    if (!(event.target instanceof Element) || event.target.closest(STAGE_CONTROLS)) return;
    if (window.getSelection()?.isCollapsed === false) return;
    this.next();
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing || event.repeat || !(event.target instanceof Node)
      || !this.inScope(event.target)) return;
    if (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable]")) return;
    if (event.key === "Control" && !event.altKey && !event.metaKey) {
      const owner = this.current();
      if (!owner || owner.view().story.phase === "choosing") return;
      this.#controls.add(event.code || event.key);
      if (this.#held || owner.view().skipping) return;
      this.#held = owner;
      owner.send({ type: "skip", enabled: true });
      return;
    }
    if (event.altKey || event.metaKey || event.ctrlKey) { this.releaseHold(); return; }
    if (event.key === "Escape") {
      if (this.available(true)) { event.preventDefault(); this.menu(); }
      return;
    }
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
    if (!this.current(this.#hidden)) return;
    if ([" ", "Enter", "ArrowRight"].includes(event.key)) { event.preventDefault(); this.next(); }
    else if (event.key.toLowerCase() === "h") { event.preventDefault(); this.toggleHidden(); }
    else if (event.key.toLowerCase() === "a") { event.preventDefault(); this.toggleAuto(); }
  }

  private pointerDown(event: PointerEvent): void {
    // A new physical press must never be mistaken for the previous gesture's synthetic click.
    this.#suppressed = null;
    this.#tap = null;
    if (event.button !== 0 || !this.current() || !(event.target instanceof Element)
      || event.target.closest(STAGE_CONTROLS)) return;
    this.#options.stage.focus({ preventScroll: true });
    if (event.pointerType === "mouse" || this.#pointers.size > 1) return;
    const text = event.target.closest(".dialogue-text");
    if (text && text.scrollHeight > text.clientHeight + 2) return;
    const owner = this.current();
    if (!owner) return;
    this.cancelGesture();
    const gesture: Gesture = {
      pointerId: event.pointerId, owner, token: owner.view().token, x: event.clientX, y: event.clientY,
      timer: null, moved: false, done: false, cancelled: false,
    };
    this.#gesture = gesture;
    gesture.timer = window.setTimeout(() => {
      gesture.timer = null;
      if (gesture !== this.#gesture || gesture.cancelled || gesture.moved || gesture.done
        || owner !== this.current() || !sameToken(gesture.token, owner.view().token)) return;
      gesture.done = true;
      this.toggleHidden();
      try { navigator.vibrate?.(15); } catch { /* Optional device feedback does not affect story or input. */ }
    }, 550);
  }

  private pointerMove(event: PointerEvent): void {
    const gesture = this.#gesture;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.cancelled || gesture.done) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 12) {
      gesture.moved = true;
      if (gesture.timer !== null) window.clearTimeout(gesture.timer);
      gesture.timer = null;
    }
    if (dy > 60 && dy > Math.abs(dx) * 1.5 && this.#options.history && gesture.owner === this.current()
      && sameToken(gesture.token, gesture.owner.view().token)) {
      gesture.done = true;
      this.openHistory();
    }
  }

  private pointerEnd(event: PointerEvent, cancelled: boolean): void {
    this.#pointers.delete(event.pointerId);
    const gesture = this.#gesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.timer !== null) window.clearTimeout(gesture.timer);
    this.#gesture = null;
    if (cancelled || gesture.cancelled || gesture.done || gesture.moved) {
      this.#suppressed = { pointerId: event.pointerId, until: performance.now() + 350 };
    } else this.#tap = { owner: gesture.owner, token: gesture.token };
  }

  dispose(): void {
    if (this.#closed) return;
    this.reset();
    this.#closed = true;
    this.#events.abort();
    this.#gesture = this.#tap = this.#suppressed = null;
    this.#pointers.clear();
    for (const [element, initial] of this.#inert) element.inert = initial;
    delete this.#options.stage.dataset.uiHidden;
    delete this.#options.controls.dataset.uiHidden;
  }
}
