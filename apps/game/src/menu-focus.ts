interface Options {
  surface: HTMLElement;
  menu: HTMLElement;
  initial: HTMLButtonElement;
  fallback: HTMLElement;
  background: readonly HTMLElement[];
  owner(): object | null;
  enabled(): boolean;
}

interface FocusLease {
  owner: object;
  previous: HTMLElement | null;
  hidden: ReadonlyMap<HTMLElement, string | null>;
}

/** DOM focus and background interaction only; an opaque owner never exposes a game session. */
export class MenuFocus {
  readonly #options: Options;
  readonly #events = new AbortController();
  #current: FocusLease | null = null;
  #disposed = false;

  constructor(options: Options) {
    this.#options = options;
    const { signal } = this.#events;
    document.addEventListener("keydown", event => {
      if (event.defaultPrevented || event.key !== "Tab" || event.isComposing
        || event.altKey || event.ctrlKey || event.metaKey || !this.active()) return;
      const items = this.focusable();
      const first = items[0], last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        options.menu.focus({ preventScroll: true });
        return;
      }
      const focused = document.activeElement;
      if (!items.some(item => item === focused) || (event.shiftKey ? focused === first : focused === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }, { signal });
    document.addEventListener("focusin", event => {
      if (this.active() && event.target instanceof Node && !options.menu.contains(event.target)) this.focusInitial();
    }, { signal });
    const blockBackground = (event: Event): void => {
      if (!this.active() || !(event.target instanceof Node) || options.menu.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    for (const type of ["pointerdown", "click", "contextmenu"] as const) {
      options.surface.addEventListener(type, blockBackground, { signal, capture: true });
    }
  }

  private active(): boolean {
    return !this.#disposed && !!this.#current && this.#current.owner === this.#options.owner()
      && !this.#options.menu.hidden && this.#options.enabled()
      && !document.querySelector("dialog[open]");
  }

  private visible(element: HTMLElement): boolean {
    return element.isConnected && !!element.getClientRects().length
      && !element.matches(":disabled") && !element.closest("[inert]")
      && getComputedStyle(element).visibility !== "hidden";
  }

  private focusable(): HTMLElement[] {
    return [...this.#options.menu.querySelectorAll<HTMLElement>(
      "button,a[href],input,select,textarea,summary,[tabindex]",
    )].filter(item => item.tabIndex >= 0 && this.visible(item));
  }

  private focusInitial(): void {
    const initial = this.#options.initial;
    const target = this.visible(initial) ? initial : this.focusable()[0] ?? this.#options.menu;
    target.focus({ preventScroll: true });
  }

  refresh(): void {
    if (this.#disposed) return;
    const owner = this.#options.owner();
    const open = !!owner && !this.#options.menu.hidden;
    if (this.#current && (!open || this.#current.owner !== owner)) {
      this.release(this.#current.owner === owner);
    }
    if (open && owner && !this.#current) {
      const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const hidden = new Map<HTMLElement, string | null>();
      for (const element of this.#options.background) {
        hidden.set(element, element.getAttribute("aria-hidden"));
      }
      this.#current = { owner, previous, hidden };
      // Move away from a background control before excluding its accessibility subtree.
      if (this.active()) this.focusInitial();
      for (const element of hidden.keys()) element.setAttribute("aria-hidden", "true");
    }
    if (this.active() && !this.#options.menu.contains(document.activeElement)) this.focusInitial();
  }

  private release(restoreFocus: boolean): void {
    const current = this.#current;
    this.#current = null;
    if (!current) return;
    for (const [element, original] of current.hidden) {
      if (original === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", original);
    }
    const focused = document.activeElement;
    if (!restoreFocus || !this.#options.enabled() || document.querySelector("dialog[open]")
      || (focused !== document.body && !this.#options.menu.contains(focused))) return;
    const target = current.previous && this.visible(current.previous) ? current.previous : this.#options.fallback;
    if (this.visible(target)) target.focus({ preventScroll: true });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#events.abort();
    this.release(false);
  }
}
