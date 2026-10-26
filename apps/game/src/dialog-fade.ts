import playerStyles from "./style.css?inline";
import shellStyles from "./shell.css?inline";

interface Options {
  surface: HTMLElement;
  dialogs: readonly HTMLDialogElement[];
  enabled(): boolean;
  issue(message: string): void;
}
interface Snapshot {
  host: HTMLDivElement;
  scroll: { copy: Element; top: number; left: number }[];
}
interface Fade extends Snapshot {
  target: HTMLDialogElement | null;
  frame: number;
  timer: number;
  animation: Animation | null;
}

const FROZEN = ["opacity", "transform", "filter", "translate", "rotate", "scale",
  "background", "background-position", "color", "border-color", "box-shadow", "outline"] as const;
const ATTRIBUTES = new Set(["id", "class", "style", "hidden", "open", "disabled", "aria-pressed",
  "viewBox", "d", "cx", "cy", "r", "x", "y", "rx", "ry",
  "x1", "x2", "y1", "y2", "points", "width", "height", "fill", "stroke", "preserveAspectRatio"]);
const EXCLUDED = new Set(["script", "style", "link", "audio", "video", "iframe", "object", "embed", "canvas"]);
const STATIC = "* ,*::before,*::after{animation:none!important;transition:none!important;pointer-events:none!important;caret-color:transparent!important}";

/** Only a registered game surface/dialog is passed here, never a document or editor root. */
function snapshot(root: HTMLElement, backdrop: boolean): Snapshot {
  const host = document.createElement("div");
  host.className = "dialog-fade";
  host.inert = true;
  host.setAttribute("aria-hidden", "true");
  if (backdrop) host.style.background = getComputedStyle(root, "::backdrop").background;
  // Only these two build-known game stylesheets; never read document.styleSheets or editor styles.
  const shadow = host.attachShadow({ mode: "closed" });
  const styles = document.createElement("style");
  styles.textContent = `${playerStyles}\n${shellStyles}\n${STATIC}`;
  const body = document.createElement("body");
  body.className = "game-shell";
  if (document.body.dataset.playing) body.dataset.playing = document.body.dataset.playing;
  body.style.cssText = "margin:0;position:relative;width:100vw;height:100vh;background:transparent;overflow:hidden";
  body.style.font = getComputedStyle(document.body).font;
  body.style.color = getComputedStyle(document.body).color;
  const app = document.createElement("main");
  app.id = "app";
  body.append(app);
  shadow.append(styles, body);
  const scroll: Snapshot["scroll"] = [];
  let nodes = 0;
  const copy = (source: Element): HTMLElement | SVGElement | null => {
    if (++nodes > 6000) throw new Error("弹层视觉副本超过有界节点数，保留直接切换");
    if (!(source instanceof HTMLElement || source instanceof SVGElement)
      || EXCLUDED.has(source.localName) || source.matches(".stage-fade,.scene-fade,.dialog-fade")
      || !source.getClientRects().length) return null;
    const style = getComputedStyle(source);
    const rect = source.getBoundingClientRect();
    const target = source instanceof SVGElement
      ? document.createElementNS("http://www.w3.org/2000/svg", source.localName)
      : document.createElement(source === root || source instanceof HTMLDialogElement ? "div" : source.localName);
    // IDs are isolated inside the closed shadow root to preserve ID-based game/slider styling.
    // No focus, form association, event handlers, links, pending image sources or media are copied.
    for (const attribute of source.attributes) {
      if (ATTRIBUTES.has(attribute.name) || attribute.name.startsWith("data-")) {
        target.setAttribute(attribute.name, attribute.value);
      }
    }
    for (const key of FROZEN) target.style.setProperty(key, style.getPropertyValue(key), "important");
    if (source.classList.contains("actor")) {
      for (const key of ["left", "top", "height", "width"]) target.style.setProperty(key, style.getPropertyValue(key), "important");
    }
    // Offscreen boxes retain layout/scroll extent without duplicating their media or deep content.
    const visible = style.visibility !== "hidden" && rect.bottom > 0 && rect.right > 0
      && rect.top < window.innerHeight && rect.left < window.innerWidth;
    if (source instanceof HTMLInputElement && target instanceof HTMLInputElement) {
      target.type = source.type;
      target.min = source.min; target.max = source.max; target.step = source.step;
      target.value = source.value; target.checked = source.checked;
      target.disabled = source.matches(":disabled");
    } else if (source instanceof HTMLSelectElement && target instanceof HTMLSelectElement) {
      for (const option of source.options) target.add(new Option(option.text, option.value, false, option.selected));
      target.disabled = source.matches(":disabled");
    } else if (source instanceof HTMLImageElement && target instanceof HTMLImageElement) {
      // Never start a pending/hidden image attempt on behalf of a visual copy.
      if (visible && source.complete && source.naturalWidth) target.src = source.currentSrc || source.src;
      target.alt = "";
    } else if (source instanceof HTMLProgressElement && target instanceof HTMLProgressElement) {
      target.max = source.max; target.value = source.value;
    } else if (visible) {
      if (source instanceof HTMLDetailsElement && target instanceof HTMLDetailsElement) target.open = source.open;
      for (const child of source.childNodes) {
        if (child instanceof Text) target.append(document.createTextNode(child.data));
        else if (child instanceof Element) {
          const nested = copy(child);
          if (nested) target.append(nested);
        }
      }
    } else {
      target.style.setProperty("width", style.width, "important");
      target.style.setProperty("height", style.height, "important");
    }
    scroll.push({ copy: target, top: source.scrollTop, left: source.scrollLeft });
    return target;
  };
  const view = copy(root);
  if (!view) throw new Error("当前游戏画面不可采样");
  const rect = root.getBoundingClientRect();
  for (const [key, value] of Object.entries({
    position: "fixed", inset: "auto", left: `${rect.left}px`, top: `${rect.top}px`,
    display: getComputedStyle(root).display, width: `${rect.width}px`, height: `${rect.height}px`, margin: "0",
    transform: "none", translate: "none", rotate: "none", scale: "none",
  })) view.style.setProperty(key, value, "important");
  app.append(view);
  return { host, scroll };
}

/** One visual transaction; native dialogs, focus and pause ownership change synchronously. */
export class DialogFade {
  readonly #options: Options;
  readonly #dialogs: ReadonlySet<HTMLDialogElement>;
  readonly #reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  readonly #events = new AbortController();
  readonly #resize: ResizeObserver;
  #active: Fade | null = null;
  #disposed = false;
  #width: number;
  #height: number;

  constructor(options: Options) {
    this.#options = options;
    this.#dialogs = new Set(options.dialogs);
    this.#width = options.surface.clientWidth;
    this.#height = options.surface.clientHeight;
    const { signal } = this.#events;
    this.#reduced.addEventListener("change", () => { if (this.#reduced.matches) this.cancel(); }, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.cancel(); }, { signal });
    window.addEventListener("resize", () => this.cancel(), { signal });
    for (const dialog of this.#dialogs) {
      dialog.addEventListener("close", () => {
        if (!dialog.open && this.#active?.target === dialog) this.cancel();
      }, { signal });
    }
    this.#resize = new ResizeObserver(() => {
      const width = options.surface.clientWidth, height = options.surface.clientHeight;
      if (width !== this.#width || height !== this.#height) this.cancel();
      this.#width = width; this.#height = height;
    });
    this.#resize.observe(options.surface);
  }

  open(dialog: HTMLDialogElement, before: () => void = () => {}): void {
    this.registered(dialog);
    this.cancel();
    const source = [...this.#dialogs].find(item => item.open) ?? this.#options.surface;
    const captured = this.capture(source, source instanceof HTMLDialogElement);
    try { before(); dialog.showModal(); }
    catch (error: unknown) { captured?.host.remove(); throw error; }
    if (captured) this.begin(captured, dialog, dialog);
  }

  close(dialog: HTMLDialogElement, animate = true): void {
    this.registered(dialog);
    if (!dialog.open) return;
    this.cancel();
    const captured = animate ? this.capture(dialog, true) : null;
    dialog.close();
    if (captured) this.begin(captured, document.body, null);
  }

  /** A registered dialog's internal UI changes immediately; only its old view is retained. */
  change(dialog: HTMLDialogElement, change: () => void): void {
    this.registered(dialog);
    this.cancel();
    const captured = dialog.open ? this.capture(dialog, false) : null;
    try { change(); }
    catch (error: unknown) { captured?.host.remove(); throw error; }
    if (captured && dialog.open) this.begin(captured, dialog, dialog);
    else captured?.host.remove();
  }

  private registered(dialog: HTMLDialogElement): void {
    if (!this.#dialogs.has(dialog)) throw new Error("弹层不属于当前游戏的视觉过渡范围");
  }

  private allowed(): boolean {
    return !this.#disposed && !document.hidden && !this.#reduced.matches && this.#options.enabled();
  }

  private capture(root: HTMLElement, backdrop: boolean): Snapshot | null {
    if (!this.allowed()) return null;
    try { return snapshot(root, backdrop); }
    catch (error: unknown) { this.issue(error); return null; }
  }

  private begin(captured: Snapshot, parent: HTMLElement, target: HTMLDialogElement | null): void {
    const item: Fade = { ...captured, target, frame: 0, timer: 0, animation: null };
    this.#active = item;
    try {
      parent.append(item.host);
      for (const saved of item.scroll) { saved.copy.scrollTop = saved.top; saved.copy.scrollLeft = saved.left; }
      item.scroll.length = 0;
      item.frame = window.requestAnimationFrame(() => {
        item.frame = 0;
        if (!this.current(item)) { this.release(item); return; }
        try {
          const images = target ? [...target.querySelectorAll("img")].filter(image => {
            if (item.host.contains(image) || image.complete || !image.getClientRects().length) return false;
            const rect = image.getBoundingClientRect();
            return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
          }) : [];
          if (!images.length) { this.reveal(item); return; }
          item.timer = window.setTimeout(() => this.reveal(item), 180);
          void Promise.allSettled(images.map(image => image.decode())).then(() => this.reveal(item));
        } catch (error: unknown) { this.fail(item, error); }
      });
    } catch (error: unknown) { this.fail(item, error); }
  }

  private current(item: Fade): boolean {
    return this.#active === item && this.allowed() && item.host.isConnected && (!item.target || item.target.open);
  }

  private reveal(item: Fade): void {
    if (this.#active !== item || item.animation) return;
    if (!this.current(item)) { this.release(item); return; }
    window.clearTimeout(item.timer);
    try {
      if (typeof item.host.animate !== "function") { this.release(item); return; }
      item.animation = item.host.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 360, easing: "ease-in-out", fill: "forwards" });
      item.timer = window.setTimeout(() => this.release(item), 560);
      void item.animation.finished.then(() => this.release(item), () => this.release(item));
    } catch (error: unknown) { this.fail(item, error); }
  }

  private issue(error: unknown): void {
    // A diagnostic observer cannot reject an already accepted UI operation.
    try { this.#options.issue(error instanceof Error ? error.message : "弹层视觉过渡未完成"); }
    catch { /* Visual reporting never owns dialog or gameplay success. */ }
  }

  private fail(item: Fade, error: unknown): void {
    const current = this.#active === item && !this.#disposed;
    this.release(item);
    if (current) this.issue(error);
  }

  private release(item: Fade): void {
    if (this.#active !== item) return;
    this.#active = null;
    window.cancelAnimationFrame(item.frame);
    window.clearTimeout(item.timer);
    item.animation?.cancel();
    item.host.remove();
    item.scroll.length = 0;
  }

  cancel(): void { if (this.#active) this.release(this.#active); }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancel();
    this.#events.abort();
    this.#resize.disconnect();
  }
}
