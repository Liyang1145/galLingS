import type { GameCheckpoint } from "./checkpoint.ts";

export interface RollbackTarget {
  id: number;
  nodeId: string;
  chapter: string;
  speaker: string;
  text: string;
  crossesChoice: boolean;
}

export interface RollbackFrame {
  id: number;
  choiceVersion: number;
  dialogueStart: number;
  checkpoint: GameCheckpoint;
  label: { chapter: string; speaker: string; text: string };
}

/** Session-local progress only. Capacity is explicit; nothing here writes global records. */
export class RollbackHistory {
  readonly #capacity: number;
  readonly #frames: RollbackFrame[] = [];

  constructor(capacity: number) {
    // The development slice is bounded by the legacy player's 500 visits.
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 500) {
      throw new Error("试播回退容量必须是 1～500 的整数");
    }
    this.#capacity = capacity;
  }

  has(id: number): boolean {
    return this.#frames.some(frame => frame.id === id);
  }

  count(currentId: number): number {
    return this.#frames.length - (this.has(currentId) ? 1 : 0);
  }

  record(frame: RollbackFrame): void {
    const detached = structuredClone(frame);
    const index = this.#frames.findIndex(item => item.id === frame.id);
    if (index >= 0) this.#frames[index] = detached;
    else {
      this.#frames.push(detached);
      if (this.#frames.length > this.#capacity) this.#frames.shift();
    }
  }

  targets(currentId: number, choiceVersion: number): RollbackTarget[] {
    return this.#frames.filter(frame => frame.id !== currentId).map(frame => ({
      id: frame.id, nodeId: frame.checkpoint.story.nodeId, ...frame.label,
      crossesChoice: frame.choiceVersion !== choiceVersion,
    }));
  }

  read(id: number, currentId: number): RollbackFrame | null {
    const frame = this.#frames.find(item => item.id === id && item.id !== currentId);
    return frame ? structuredClone(frame) : null;
  }

  truncate(id: number): void {
    const index = this.#frames.findIndex(frame => frame.id === id);
    if (index < 0) throw new Error("回退目标已不在当前会话历史中");
    this.#frames.length = index + 1;
  }

  clear(): void {
    this.#frames.length = 0;
  }
}
