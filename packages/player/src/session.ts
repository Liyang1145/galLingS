import { createStoryRuntime } from "../../story-runtime/src/index.ts";
import type { RuntimeCommand, RuntimeResult, RuntimeView, StoryFact, StoryRuntime } from "../../story-runtime/src/index.ts";
import type { Diagnostic, PlayerProjection, StoryContent } from "../../story-model/src/model.ts";
import { ActiveTimer } from "./clock.ts";
import type { Clock } from "./clock.ts";

export interface SessionToken {
  session: number;
  epoch: number;
  step: number;
}

export interface MediaProblem {
  code: string;
  message: string;
  blocking: boolean;
}

export interface PresentationContext {
  signal: AbortSignal;
  clock: Clock;
  mode: "enter" | "retry";
  paused: boolean;
  skipping: boolean;
  textReady(): void;
  voiceEnded(): void;
  problem(problem: MediaProblem): void;
}

export interface Playback {
  finishText(): void;
  setPaused(paused: boolean): void;
  setSkipping(skipping: boolean): void;
  cancel(): void;
}

export interface PresentationAdapter {
  present(view: RuntimeView, context: PresentationContext): Playback;
  dispose(): void;
}

export interface SessionView {
  story: RuntimeView;
  token: SessionToken;
  paused: string[];
  auto: boolean;
  skipping: boolean;
  choiceRemainingMs: number | null;
  problem: MediaProblem | null;
  disposed: boolean;
}

export type SessionIntent =
  | { type: "next"; token: SessionToken }
  | { type: "choose"; token: SessionToken; choiceId: string }
  | { type: "pause"; reason: "menu" | "background" | "host"; paused: boolean }
  | { type: "auto"; enabled: boolean }
  | { type: "skip"; enabled: boolean }
  | { type: "retry" };

interface Options {
  content: StoryContent;
  player: PlayerProjection;
  generation: number;
  clock: Clock;
  presentation: PresentationAdapter;
  /** Isolated, in-memory read history for this development application. */
  seen: Set<string>;
  onChange(view: SessionView): void;
  onFacts?(facts: readonly StoryFact[]): void;
  onDiagnostic?(diagnostic: Diagnostic): void;
}

export interface GameSession {
  view(): SessionView;
  send(intent: SessionIntent): void;
  dispose(): void;
}

type Event =
  | { type: "intent"; intent: SessionIntent }
  | { type: "text"; epoch: number }
  | { type: "voice"; epoch: number }
  | { type: "media"; epoch: number; problem: MediaProblem }
  | { type: "timer"; token: SessionToken; purpose: "choice" | "advance"; waitVoice: boolean };

class Session implements GameSession {
  readonly #options: Options;
  readonly #runtime: StoryRuntime;
  readonly #queue: Event[] = [];
  readonly #pauses = new Set<string>();
  #draining = false;
  #disposed = false;
  #epoch = 0;
  #controller = new AbortController();
  #playback: Playback | null = null;
  #choice: ActiveTimer | null = null;
  #advance: ActiveTimer | null = null;
  #auto = false;
  #skipping = false;
  #voiceDone = true;
  #autoDue = false;
  #problem: MediaProblem | null = null;
  #retryChoiceRemaining: number | null = null;

  constructor(options: Options) {
    if (!Number.isSafeInteger(options.generation) || options.generation < 1) throw new Error("会话代次必须是正整数");
    this.#options = options;
    const { runtime, initial } = createStoryRuntime(options.content, options.player);
    this.#runtime = runtime;
    // Keep synchronous adapter callbacks queued until the playback handle exists.
    this.#draining = true;
    this.adopt(initial);
    this.#draining = false;
    this.drain();
  }

  private token(): SessionToken {
    return { session: this.#options.generation, epoch: this.#epoch, step: this.#runtime.view().step };
  }

  private current(token: SessionToken): boolean {
    const now = this.token();
    return token.session === now.session && token.epoch === now.epoch && token.step === now.step;
  }

  view(): SessionView {
    return {
      story: this.#runtime.view(), token: this.token(), paused: [...this.#pauses],
      auto: this.#auto, skipping: this.#skipping, choiceRemainingMs: this.#choice?.remaining() ?? null,
      problem: this.#problem ? { ...this.#problem } : null, disposed: this.#disposed,
    };
  }

  private publish(): void {
    if (!this.#disposed) this.#options.onChange(this.view());
  }

  send(intent: SessionIntent): void {
    this.enqueue({ type: "intent", intent });
  }

  private enqueue(event: Event): void {
    if (this.#disposed) return;
    this.#queue.push(event);
    this.drain();
  }

  private drain(): void {
    if (this.#draining || this.#disposed) return;
    this.#draining = true;
    try {
      while (this.#queue.length && !this.#disposed) {
        const event = this.#queue.shift()!;
        try { this.handle(event); }
        catch (error: unknown) {
          this.#problem = { code: "SESSION", message: error instanceof Error ? error.message : "会话操作失败", blocking: true };
          this.#pauses.add("error");
          this.pauseWork();
          this.publish();
        }
      }
    } finally {
      this.#draining = false;
    }
  }

  private handle(event: Event): void {
    if (event.type === "intent") return this.intent(event.intent);
    if (event.type === "timer") {
      if (!this.current(event.token) || this.#pauses.size) return;
      if (event.purpose === "choice") {
        this.#choice = null;
        this.command({ type: "timeout", step: event.token.step });
      } else if (event.waitVoice && this.#auto && !this.#skipping && !this.#voiceDone) {
        this.#autoDue = true;
      } else this.command({ type: "advance", step: event.token.step });
      return;
    }
    if (event.epoch !== this.#epoch) return;
    if (event.type === "media") {
      this.#problem = event.problem;
      if (event.problem.blocking) {
        this.#pauses.add("error");
        this.pauseWork();
      }
      this.publish();
    } else if (event.type === "text") {
      const view = this.#runtime.view();
      if (view.phase === "presenting") this.command({ type: "presented", step: view.step });
    } else {
      this.#voiceDone = true;
      if (this.#autoDue) {
        this.#autoDue = false;
        this.scheduleAdvance(400);
      }
    }
  }

  private intent(intent: SessionIntent): void {
    if (intent.type === "pause") {
      if (intent.paused) this.#pauses.add(intent.reason);
      else this.#pauses.delete(intent.reason);
      this.pauseWork();
      this.publish();
      return;
    }
    if (intent.type === "retry") {
      this.#pauses.delete("error");
      this.#problem = null;
      this.render("retry");
      this.configureProgress();
      this.publish();
      return;
    }
    if (intent.type === "auto" || intent.type === "skip") {
      if (intent.type === "auto") this.#auto = intent.enabled;
      else {
        const view = this.#runtime.view();
        // A fresh node was marked read on entry; don't permit the current unread
        // presentation to be skipped just because it is now in the seen set.
        this.#skipping = intent.enabled && this.#entryWasRead && view.phase !== "choosing";
        this.#playback?.setSkipping(this.#skipping);
        if (this.#skipping) this.#playback?.finishText();
      }
      this.configureProgress();
      this.publish();
      return;
    }
    if (!this.current(intent.token) || this.#pauses.size) return;
    const view = this.#runtime.view();
    if (intent.type === "choose") this.command({ type: "choose", choiceId: intent.choiceId, step: view.step });
    else if (view.phase === "presenting") this.#playback?.finishText();
    else if (view.phase === "ready") this.command({ type: "advance", step: view.step });
  }

  #entryWasRead = false;

  private command(command: RuntimeCommand): void {
    const result = this.#runtime.dispatch(command);
    if (!result.accepted) {
      if (result.error) {
        this.#options.onDiagnostic?.(result.error);
        this.#problem = { code: result.error.code, message: result.error.message, blocking: true };
        this.#pauses.add("error");
        this.pauseWork();
        this.publish();
      }
      return;
    }
    this.adopt(result);
  }

  private adopt(result: RuntimeResult): void {
    if (result.presentation?.mode === "enter") {
      this.#entryWasRead = this.#options.seen.has(result.view.nodeId);
      this.#options.seen.add(result.view.nodeId);
      if (!this.#entryWasRead) this.#skipping = false;
      this.#problem = null;
      this.render("enter");
    }
    if (result.view.phase === "choosing") {
      this.#skipping = false;
      this.#playback?.setSkipping(false);
    }
    if (result.view.phase === "ended") {
      this.stopTimers();
      this.#controller.abort();
      this.#playback?.cancel();
      this.#options.presentation.dispose();
      this.#auto = this.#skipping = false;
    } else this.configureProgress();
    if (result.facts.length) this.#options.onFacts?.(structuredClone(result.facts));
    this.publish();
  }

  private render(mode: "enter" | "retry"): void {
    this.#retryChoiceRemaining = mode === "retry" ? this.#choice?.remaining() ?? null : null;
    this.stopTimers();
    this.#controller.abort();
    this.#playback?.cancel();
    this.#controller = new AbortController();
    this.#epoch++;
    this.#voiceDone = !this.#runtime.view().presentation.performance.voiceId || this.#skipping;
    this.#autoDue = false;
    const epoch = this.#epoch;
    this.#playback = this.#options.presentation.present(this.#runtime.view(), {
      signal: this.#controller.signal, clock: this.#options.clock, mode,
      paused: this.#pauses.size > 0, skipping: this.#skipping,
      textReady: () => this.enqueue({ type: "text", epoch }),
      voiceEnded: () => this.enqueue({ type: "voice", epoch }),
      problem: problem => this.enqueue({ type: "media", epoch, problem }),
    });
  }

  private configureProgress(): void {
    const view = this.#runtime.view();
    this.#advance?.cancel();
    this.#advance = null;
    this.#autoDue = false;
    if (view.phase === "choosing") {
      if (view.timeout && !this.#choice) {
        const token = this.token();
        this.#choice = new ActiveTimer(this.#options.clock, this.#retryChoiceRemaining ?? view.timeout.durationMs,
          () => this.enqueue({ type: "timer", token, purpose: "choice", waitVoice: false }), () => this.publish());
        this.#retryChoiceRemaining = null;
      }
    } else {
      this.#choice?.cancel();
      this.#choice = null;
      if (view.phase === "ready") {
        const performance = view.presentation.performance;
        const pause = !view.presentation.text;
        if (this.#skipping) this.scheduleAdvance(60);
        else if (pause || performance.waitMs > 0) this.scheduleAdvance(performance.waitMs || 2000);
        else if (this.#auto) this.scheduleAdvance((1200 + view.presentation.text.length * 60) * this.autoMultiplier(), true);
      }
    }
    this.pauseWork();
  }

  private autoMultiplier(): number {
    const value = this.#options.content.source.settings.autoMul;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
  }

  private scheduleAdvance(milliseconds: number, waitVoice = false): void {
    this.#advance?.cancel();
    const token = this.token();
    this.#advance = new ActiveTimer(this.#options.clock, milliseconds,
      () => this.enqueue({ type: "timer", token, purpose: "advance", waitVoice }));
    this.#advance.setPaused(this.#pauses.size > 0);
  }

  private pauseWork(): void {
    const paused = this.#pauses.size > 0;
    this.#choice?.setPaused(paused);
    this.#advance?.setPaused(paused);
    this.#playback?.setPaused(paused);
  }

  private stopTimers(): void {
    this.#choice?.cancel();
    this.#advance?.cancel();
    this.#choice = this.#advance = null;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#epoch++;
    this.#queue.length = 0;
    this.stopTimers();
    this.#controller.abort();
    this.#playback?.cancel();
    this.#options.presentation.dispose();
  }
}

export function createGameSession(options: Options): GameSession {
  return new Session(options);
}
