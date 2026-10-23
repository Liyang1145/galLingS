/** Retain explicit writes for normal-exit coordination. Not a durable journal or autosave. */
interface Write {
  operation: () => Promise<void>;
  settled: Promise<void>;
  pending: boolean;
  failure: unknown;
  failed: boolean;
}

export class PendingWrites {
  readonly #writes = new Map<string, Write>();

  run(key: string, operation: () => Promise<void>): Promise<void> {
    if (this.#writes.get(key)?.pending) throw new Error("同一槽位仍在保存，请等待原写入完成");
    const write: Write = { operation, settled: Promise.resolve(), pending: true, failed: false, failure: null };
    this.#writes.set(key, write);
    const task = Promise.resolve().then(operation);
    write.settled = task.then(() => {
      write.pending = false;
      if (this.#writes.get(key) === write) this.#writes.delete(key);
    }, (error: unknown) => {
      write.pending = false;
      write.failed = true;
      write.failure = error;
    });
    return task;
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
    await Promise.allSettled(attempts.map(([key, write]) => this.run(key, write.operation)));
    await this.settle();
  }
}
