/** Host clock: monotonic elapsed time, never calendar time. */
export interface Clock {
  now(): number;
  schedule(delayMs: number, callback: () => void): () => void;
}

/** A cancellable delay measured only while active. No overdue background catch-up. */
export class ActiveTimer {
  readonly #clock: Clock;
  readonly #done: () => void;
  readonly #tick: (() => void) | undefined;
  #remaining: number;
  #startedAt = 0;
  #cancel: (() => void) | null = null;
  #running = false;
  #finished = false;

  constructor(clock: Clock, durationMs: number, done: () => void, tick?: () => void) {
    if (!Number.isFinite(durationMs) || durationMs < 0) throw new Error("有效计时需要非负有限时长");
    this.#clock = clock;
    this.#remaining = durationMs;
    this.#done = done;
    this.#tick = tick;
  }

  remaining(): number {
    return this.#running ? Math.max(0, this.#remaining - Math.max(0, this.#clock.now() - this.#startedAt)) : this.#remaining;
  }

  setPaused(paused: boolean): void {
    if (this.#finished || paused === !this.#running) return;
    if (paused) {
      this.#remaining = this.remaining();
      this.#running = false;
      this.#cancel?.();
      this.#cancel = null;
    } else {
      this.#running = true;
      this.#startedAt = this.#clock.now();
      this.arm();
    }
  }

  private arm(): void {
    this.#cancel = this.#clock.schedule(Math.min(this.remaining(), this.#tick ? 50 : 1000), () => {
      this.#cancel = null;
      if (!this.#running || this.#finished) return;
      if (this.remaining() === 0) {
        this.#remaining = 0;
        this.#running = false;
        this.#finished = true;
        this.#done();
      } else {
        this.#tick?.();
        if (this.#running && !this.#finished) this.arm();
      }
    });
  }

  cancel(): void {
    this.#remaining = this.remaining();
    this.#finished = true;
    this.#running = false;
    this.#cancel?.();
    this.#cancel = null;
  }
}
