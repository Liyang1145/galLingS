import type { ButtonCue } from "../ui-sounds.ts";

interface ButtonSoundOptions {
  /** The application explicitly supplies operation buttons, never choices or storage slots. */
  buttons: readonly HTMLButtonElement[];
  signal: AbortSignal;
  enabled(): boolean;
  play(cue: ButtonCue): void;
}

/** Bind once per consumer lifetime, outside story rendering. */
export function connectButtonSounds(options: ButtonSoundOptions): void {
  const { signal } = options;
  for (const button of new Set(options.buttons)) {
    const play = (cue: ButtonCue): void => {
      if (signal.aborted || !button.isConnected || button.matches(":disabled")
        || button.closest("[hidden], [inert], [aria-disabled='true']") || !options.enabled()) return;
      options.play(cue);
    };
    // Capture observes the current session before the operation can pause, end or replace it.
    button.addEventListener("click", () => play("btnClick"), { signal, capture: true });
    // pointerenter does not bubble from descendants; touch/pen never pretend to hover.
    button.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse") play("btnHover");
    }, { signal });
  }
}
