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

export class PendingWrites {
  readonly #writes = new Map<string, Write>();
  readonly #listeners = new Set<() => void>();

  run(key: string, operation: () => Promise<void>, label = "保存操作"): Promise<void> {
    if (this.#writes.get(key)?.pending) throw new Error("同一槽位仍在保存，请等待原写入完成");
    const write: Write = { label, operation, settled: Promise.resolve(), pending: true, failed: false, failure: null };
    this.#writes.set(key, write);
    const task = Promise.resolve().then(operation);
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

  /** Detached display metadata only: no operation, storage key, checkpoint or error object. */
  view(): readonly Readonly<PendingWriteView>[] {
    return Object.freeze([...this.#writes.values()].map(write => Object.freeze({
      label: write.label, state: write.pending ? "pending" as const : "failed" as const,
      issue: write.failed ? write.failure instanceof Error ? write.failure.message
        : typeof write.failure === "string" ? write.failure : "保存未完成" : null,
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
    await Promise.allSettled(attempts.map(([key, write]) => this.run(key, write.operation, write.label)));
    await this.settle();
  }
}
