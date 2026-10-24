export type GamePanel = "saves" | "settings" | "rollback" | "tools";

interface Options {
  dialogs: Readonly<Record<GamePanel, HTMLDialogElement>>;
  enabled(): boolean;
  acquirePause(): () => void;
  changed(): void;
  dismissed(): void;
}

/** Owns only shell dialogs and their pause lease; progress stays with the application. */
export class GamePanels {
  readonly #options: Options;
  readonly #events = new AbortController();
  #current: { name: GamePanel; dialog: HTMLDialogElement; release: () => void } | null = null;
  #disposed = false;

  constructor(options: Options) {
    this.#options = options;
    const { signal } = this.#events;
    for (const dialog of Object.values(options.dialogs)) {
      dialog.addEventListener("cancel", event => {
        event.preventDefault();
        this.close();
      }, { signal });
      dialog.addEventListener("close", () => {
        // A delayed close event must not close the same dialog after it was reopened.
        if (!dialog.open && this.#current?.dialog === dialog) this.close();
      }, { signal });
      for (const button of dialog.querySelectorAll<HTMLButtonElement>("[data-panel-close]")) {
        button.addEventListener("click", () => this.close(), { signal });
      }
    }
  }

  get active(): GamePanel | null { return this.#current?.name ?? null; }

  open(name: GamePanel): boolean {
    if (this.#disposed || !this.#options.enabled() || this.#current) return false;
    const dialog = this.#options.dialogs[name];
    const release = this.#options.acquirePause();
    this.#current = { name, dialog, release };
    try {
      dialog.showModal();
      this.#options.changed();
      return true;
    } catch (error: unknown) {
      this.#current = null;
      if (dialog.open) dialog.close();
      release();
      this.#options.changed();
      throw error;
    }
  }

  close(reason: "dismiss" | "leave" = "dismiss"): boolean {
    const current = this.#current;
    if (!current) return false;
    this.#current = null;
    current.dialog.close();
    if (reason === "dismiss") this.#options.dismissed();
    current.release();
    this.#options.changed();
    return true;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.close("leave");
    this.#events.abort();
  }
}
