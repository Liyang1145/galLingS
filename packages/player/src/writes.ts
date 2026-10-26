/** Retain explicit writes for normal-exit coordination. Not a durable journal or autosave. */
interface Write {
  label: string;
  operation: () => Promise<void>;
  settled: Promise<void>;
  pending: boolean;
  failure: unknown;
  failed: boolean;
}

export interface PendingWriteView {
  readonly label: string;
  readonly state: "pending" | "failed";
  readonly issue: string | null;
}

export interface TrackedWriteView {
  readonly label: string;
  readonly state: "pending" | "failed" | "completed" | "superseded";
  readonly issue: string | null;
}

/** An explicit retry capability bound to one operation, not a lookup of a later selected key. */
export interface TrackedWrite {
  readonly result: Promise<void>;
  view(): Readonly<TrackedWriteView>;
  retry(): Promise<void>;
}

function issue(write: Write): string | null {
  return write.failed ? write.failure instanceof Error ? write.failure.message
    : typeof write.failure === "string" ? write.failure : "保存未完成" : null;
}

export class PendingWrites {
  readonly #writes = new Map<string, Write>();
  readonly #listeners = new Set<() => void>();

  run(key: string, operation: () => Promise<void>, label = "保存操作"): Promise<void> {
    return this.track(key, operation, label).result;
  }

  track(key: string, operation: () => Promise<void>, label = "保存操作"): TrackedWrite {
    if (this.#writes.get(key)?.pending) throw new Error("同一槽位仍在保存，请等待原写入完成");
    const write: Write = { label, operation, settled: Promise.resolve(), pending: false, failed: false, failure: null };
    this.#writes.set(key, write);
    const result = this.begin(key, write);
    return Object.freeze({
      result,
      view: (): Readonly<TrackedWriteView> => Object.freeze({
        label: write.label,
        state: write.pending ? "pending" : !write.failed ? "completed"
          : this.#writes.get(key) === write ? "failed" : "superseded",
        issue: issue(write),
      }),
      retry: (): Promise<void> => this.retryOriginal(key, write),
    });
  }

  private begin(key: string, write: Write): Promise<void> {
    write.pending = true;
    write.failed = false;
    write.failure = null;
    const task = Promise.resolve().then(write.operation);
    write.settled = task.then(() => {
      write.pending = false;
      if (this.#writes.get(key) === write) this.#writes.delete(key);
      this.notify();
    }, (error: unknown) => {
      write.pending = false;
      write.failed = true;
      write.failure = error;
      this.notify();
    });
    this.notify();
    return task;
  }

  private retryOriginal(key: string, write: Write): Promise<void> {
    if (this.#writes.get(key) !== write) {
      return Promise.reject(new Error(write.failed
        ? "原写入已由新的操作替代，不能用旧按钮重试"
        : "原写入已完成，无需重试"));
    }
    if (write.pending || !write.failed) return Promise.reject(new Error("原写入并非已失败状态，请等待已有操作"));
    return this.begin(key, write);
  }

  /** Detached display metadata only: no operation, storage key, checkpoint or error object. */
  view(): readonly Readonly<PendingWriteView>[] {
    return Object.freeze([...this.#writes.values()].map(write => Object.freeze({
      label: write.label, state: write.pending ? "pending" as const : "failed" as const,
      issue: issue(write),
    })));
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  private notify(): void {
    for (const listener of [...this.#listeners]) {
      try { listener(); }
      catch { /* Display observers cannot change a write result or exit readiness. */ }
    }
  }

  /** Caller must first stop accepting new writes; cancellation does not abort a storage transaction. */
  async settle(): Promise<void> {
    while ([...this.#writes.values()].some(write => write.pending)) {
      await Promise.all([...this.#writes.values()].map(write => write.settled));
    }
    const failed = [...this.#writes.values()].find(write => write.failed);
    if (failed) throw failed.failure;
  }

  /** Explicit user retry reuses the original captured payload, never later live progress. */
  async retryFailed(): Promise<void> {
    const attempts = [...this.#writes.entries()].filter(([, write]) => write.failed);
    await Promise.allSettled(attempts.map(([key, write]) => this.retryOriginal(key, write)));
    await this.settle();
  }
}
