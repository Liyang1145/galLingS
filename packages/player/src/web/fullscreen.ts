import { setButtonLabel } from "./button-label.ts";

export interface FullscreenState {
  supported: boolean;
  active: boolean;
  pending: boolean;
  issue: string | null;
}

/** Display capability only. Native adapters must not expose story or storage operations. */
export interface FullscreenDriver {
  readonly escapeExits: boolean;
  read(): FullscreenState;
  request(active: boolean): void;
  subscribe(changed: () => void): () => void;
  dispose(): void;
}

function browserFullscreen(root: HTMLElement): FullscreenDriver {
  const listeners = new Set<() => void>();
  let wanted: boolean | null = null;
  let pending = false;
  let disposed = false;
  let issue: string | null = null;
  const active = (): boolean => document.fullscreenElement === root;
  const supported = (): boolean => document.fullscreenEnabled === true
    && typeof root.requestFullscreen === "function" && typeof document.exitFullscreen === "function";
  const notify = (): void => { for (const listener of listeners) listener(); };
  const changed = (): void => {
    if (!pending) wanted = null; // A browser/OS exit must never trigger automatic re-entry.
    notify();
  };
  const reconcile = (): void => {
    if (pending || wanted === null || wanted === active()) return;
    const target = wanted;
    pending = true;
    notify();
    // Invoke before yielding: entering requires the original user activation.
    let operation: Promise<void>;
    try {
      if (target) {
        if (!supported()) throw new Error("当前浏览器不提供页面全屏，请使用窗口模式继续。");
        if (document.fullscreenElement) throw new Error("其他区域正在全屏，请先退出该区域。");
        operation = root.requestFullscreen({ navigationUI: "hide" });
      } else operation = document.exitFullscreen();
    } catch (error: unknown) { operation = Promise.reject(error); }
    void operation.then(() => {
      issue = null;
    }, (error: unknown) => {
      issue = error instanceof Error ? error.message : "全屏请求未完成";
      // A cancelled enter still needs to leave if the browser adopted it before rejecting.
      if (wanted === target) wanted = null;
    }).finally(() => {
      pending = false;
      notify();
      if (wanted !== null && wanted !== target && wanted !== active()) reconcile();
    });
  };
  document.addEventListener("fullscreenchange", changed);
  return {
    escapeExits: true,
    read: () => ({ supported: supported(), active: active(), pending, issue }),
    request: target => {
      if (disposed && target) return;
      issue = null;
      wanted = target;
      reconcile();
      notify();
    },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    dispose: () => {
      disposed = true;
      document.removeEventListener("fullscreenchange", changed);
      listeners.clear();
      wanted = false;
      reconcile(); // Also leaves an enter which finishes after disposal.
    },
  };
}

export interface FullscreenControl {
  button: HTMLButtonElement;
  status: HTMLElement;
  state?: HTMLOutputElement;
}

interface FullscreenOptions {
  root: HTMLElement;
  surface: HTMLElement;
  button: HTMLButtonElement;
  status: HTMLElement;
  additionalControls?: readonly FullscreenControl[];
  keyboardScopes: readonly Node[];
  enabled(): boolean;
  changed?(): void;
  driver?: FullscreenDriver;
}

/** Shares fullscreen controls/layout between game and preview without owning a game session. */
export class PlayerFullscreen {
  readonly #options: FullscreenOptions;
  readonly #driver: FullscreenDriver;
  readonly #controls: readonly FullscreenControl[];
  readonly #events = new AbortController();
  readonly #unsubscribe: () => void;
  #active = false;
  #closed = false;
  #focus: HTMLElement | null = null;
  #scroll: { x: number; y: number } | null = null;

  constructor(options: FullscreenOptions) {
    this.#options = options;
    this.#controls = [{ button: options.button, status: options.status }, ...(options.additionalControls ?? [])];
    if (new Set(this.#controls.map(control => control.button)).size !== this.#controls.length) {
      throw new Error("全屏控件不能重复绑定同一按钮");
    }
    this.#driver = options.driver ?? browserFullscreen(options.root);
    this.#unsubscribe = this.#driver.subscribe(() => this.refresh());
    const { signal } = this.#events;
    for (const control of this.#controls) {
      control.button.addEventListener("click", () => this.toggle(), { signal });
    }
    document.addEventListener("keydown", event => {
      const target = event.target;
      if (event.defaultPrevented || event.repeat || event.isComposing || !(target instanceof Node)
        || !options.keyboardScopes.some(scope => scope.contains(target))) return;
      if (event.key === "Escape" && this.#driver.escapeExits && this.#driver.read().active) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.#driver.request(false);
        return;
      }
      if ((event.key === "F11" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)
        || (event.key === "Enter" && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey)) {
        if (!options.enabled() || !this.#driver.read().supported || document.hidden) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.toggle();
      }
    }, { signal, capture: true });
    this.refresh();
  }

  toggle(): void {
    if (this.#closed || !this.#options.enabled() || document.hidden) return;
    const state = this.#driver.read();
    if (!state.supported || state.pending) return;
    if (!state.active) {
      this.#focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.#scroll = { x: window.scrollX, y: window.scrollY };
    }
    this.#driver.request(!state.active);
  }

  refresh(): void {
    if (this.#closed) return;
    const state = this.#driver.read();
    const { root, surface, button } = this.#options;
    root.dataset.playerFullscreen = String(state.active);
    surface.dataset.fullscreen = String(state.active);
    const label = state.pending ? "正在切换全屏…" : state.active ? "退出全屏" : "全屏显示";
    const message = state.issue ? `显示切换未完成：${state.issue}`
      : !state.supported ? "当前环境尚未提供此全屏控制，可继续使用窗口模式。"
      : state.pending ? "正在等待显示切换确认…"
      : state.active ? "已进入全屏；可用按钮、F11 或 Alt+Enter 返回。"
      : "";
    for (const control of this.#controls) {
      control.button.disabled = !this.#options.enabled() || !state.supported || state.pending;
      setButtonLabel(control.button, label);
      control.button.setAttribute("aria-pressed", String(state.active));
      if (control.status.textContent !== message) control.status.textContent = message;
      const mode = !state.supported ? "全屏控制暂不可用" : state.pending ? "正在切换"
        : state.issue ? "显示状态待确认" : state.active ? "全屏" : "窗口";
      if (control.state && control.state.value !== mode) control.state.value = mode;
    }
    if (this.#active === state.active) return;
    this.#active = state.active;
    this.#options.changed?.();
    if (state.active) {
      surface.scrollIntoView({ block: "start" });
      if (!document.querySelector("dialog[open]")) button.focus({ preventScroll: true });
    } else {
      if (this.#scroll) window.scrollTo(this.#scroll.x, this.#scroll.y);
      if (this.#focus?.isConnected && !this.#focus.closest("[inert]") && !document.querySelector("dialog[open]")) {
        this.#focus.focus({ preventScroll: true });
      }
      this.#focus = null;
      this.#scroll = null;
    }
  }

  /** Stop/dispose can cancel a pending enter; its completion is followed by exit, not adoption. */
  reset(): void {
    if (!this.#closed) this.#driver.request(false);
  }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#events.abort();
    this.#unsubscribe();
    this.#driver.dispose();
    delete this.#options.root.dataset.playerFullscreen;
    delete this.#options.surface.dataset.fullscreen;
  }
}
