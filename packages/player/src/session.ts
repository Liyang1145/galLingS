import { createStoryRuntime, restoreStoryRuntime } from "../../story-runtime/src/index.ts";
import type { RuntimeCommand, RuntimeResult, RuntimeView, StoryFact, StoryRuntime } from "../../story-runtime/src/index.ts";
import type { Diagnostic, PlayerProjection, StoryContent } from "../../story-model/src/model.ts";
import { ActiveTimer } from "./clock.ts";
import type { Clock } from "./clock.ts";
import type { GameCheckpoint, PlaybackCheckpoint } from "./checkpoint.ts";
import { prepareGameRestore } from "./checkpoint.ts";
import { RollbackHistory } from "./rollback.ts";
import type { RollbackTarget } from "./rollback.ts";
import { readReadingValue } from "./reading-preferences.ts";
import { StoryFeedback } from "./ui-sounds.ts";
import type { InteractionFeedback, ScheduledFeedback } from "./ui-sounds.ts";

export type RestoreVoice = "silent" | "replay" | "resume";

export type DialogueEntry =
  | { kind: "line"; nodeId: string; chapter: string; speaker: string; text: string; voiceId: string | null }
  | { kind: "choice"; nodeId: string; chapter: string; text: string; timedOut: boolean };

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
  mode: "enter" | "retry" | "restore";
  restore: { playback: PlaybackCheckpoint; voice: RestoreVoice } | null;
  paused: boolean;
  skipping: boolean;
  sceneReady(): void;
  textReady(): void;
  voiceEnded(): void;
  problem(problem: MediaProblem): void;
}

export interface Playback {
  finishText(): void;
  setPaused(paused: boolean): void;
  setSkipping(skipping: boolean): void;
  capture(): PlaybackCheckpoint;
  cancel(): void;
}

export interface PresentationEndContext {
  paused: boolean;
  problem(problem: MediaProblem): void;
}

export interface PresentationAdapter {
  present(view: RuntimeView, context: PresentationContext): Playback;
  /** Optional audible feedback, never a second story decision path. */
  interaction?(feedback: InteractionFeedback): void;
  /** Finish entry playback while retaining terminal feedback until explicit disposal. */
  end?(context: PresentationEndContext): void;
  /** Lifecycle updates for terminal feedback after entry playback has ended. */
  setPaused?(paused: boolean): void;
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
  canCheckpoint: boolean;
  dialogueCount: number;
  rollbackCount: number;
  rollbackIssue: string | null;
  /** This session's ending was first unlocked by a confirmed global transaction. */
  newEnding: boolean;
}

export type SessionIntent =
  | { type: "next"; token: SessionToken }
  | { type: "choose"; token: SessionToken; choiceId: string }
  | { type: "pause"; reason: "menu" | "background" | "host" | "history" | "operation" | "exit"; paused: boolean }
  | { type: "auto"; enabled: boolean }
  | { type: "auto-wait"; multiplier: number }
  | { type: "ending-unlocked"; token: SessionToken; endingId: string }
  | { type: "skip"; enabled: boolean }
  | { type: "retry" };

interface Options {
  content: StoryContent;
  player: PlayerProjection;
  generation: number;
  clock: Clock;
  presentation: PresentationAdapter;
  /** Scope-isolated read history; the application owns its persistence. */
  seen: Set<string>;
  /** Apply lifecycle state before the first presentation or effective timer starts. */
  initialPauses?: readonly ("background" | "host")[];
  /** The caller must explicitly select voice behaviour for this development slice. */
  resume?: { checkpoint: unknown; voice: RestoreVoice };
  /** No hidden product default. The trial application supplies its bounded capacity. */
  rollback?: { capacity: number };
  /** Used for newly scheduled reading waits, never to retime an existing checkpoint. */
  autoWaitMultiplier?: number;
  onChange(view: SessionView): void;
  onFacts?(facts: readonly StoryFact[]): void;
  onDiagnostic?(diagnostic: Diagnostic): void;
}

export interface GameSession {
  view(): SessionView;
  dialogueHistory(): DialogueEntry[];
  rollbackTargets(): RollbackTarget[];
  rollback(request: RollbackRequest): Promise<RollbackResult>;
  send(intent: SessionIntent): void;
  captureCheckpoint(token: SessionToken): Promise<CheckpointResult>;
  dispose(): void;
}

export type CheckpointResult =
  | { accepted: true; checkpoint: GameCheckpoint }
  | { accepted: false; code: string; message: string };

export interface RollbackRequest {
  token: SessionToken;
  targetId: number;
  currentPlayer: PlayerProjection;
  voice: RestoreVoice;
  crossChoices: boolean;
}

export type RollbackResult =
  | { accepted: true; nodeId: string }
  | { accepted: false; code: string; message: string };

type Event =
  | { type: "intent"; intent: SessionIntent }
  | { type: "checkpoint"; token: SessionToken; resolve(result: CheckpointResult): void }
  | { type: "rollback"; request: RollbackRequest; resolve(result: RollbackResult): void }
  | { type: "scene"; epoch: number }
  | { type: "text"; epoch: number }
  | { type: "voice"; epoch: number }
  | { type: "media"; epoch: number; problem: MediaProblem }
  | { type: "timer"; token: SessionToken; purpose: "choice" | "advance"; waitVoice: boolean };

class Session implements GameSession {
  readonly #options: Options;
  readonly #runtime: StoryRuntime;
  readonly #queue: Event[] = [];
  readonly #pauses = new Set<string>();
  readonly #dialogue: { order: number; value: DialogueEntry }[] = [];
  readonly #rollback: RollbackHistory | null;
  readonly #storyFeedback: StoryFeedback;
  readonly #feedbackTimers = new Set<ActiveTimer>();
  #pendingFeedback: readonly ScheduledFeedback[] = [];
  #dialogueOrder = 0;
  #dialogueStart = 0;
  #visitSequence = 0;
  #visit = 0;
  #choiceVersion = 0;
  #choiceFeedbackActive = false;
  #choiceAnnounced = false;
  #announceChoices = false;
  #rollbackIssue: string | null = null;
  #draining = false;
  #disposed = false;
  #epoch = 0;
  #controller = new AbortController();
  #playback: Playback | null = null;
  #choice: ActiveTimer | null = null;
  #advance: ActiveTimer | null = null;
  #auto = false;
  #endingConfirmed = false;
  #autoWaitMultiplier: number;
  #skipping = false;
  #voiceDone = true;
  #autoDue = false;
  #advanceWaitVoice = false;
  #problem: MediaProblem | null = null;
  #retryChoiceRemaining: number | null = null;
  #pendingAdvance: { remainingMs: number; waitVoice: boolean } | null = null;
  #restoreAudio: PresentationContext["restore"] = null;
  #restoring: GameCheckpoint | null = null;

  constructor(options: Options) {
    if (!Number.isSafeInteger(options.generation) || options.generation < 1) throw new Error("会话代次必须是正整数");
    this.#options = options;
    this.#storyFeedback = new StoryFeedback(options.content);
    const autoWait = options.autoWaitMultiplier === undefined
      ? options.content.source.settings.autoMul : options.autoWaitMultiplier;
    this.#autoWaitMultiplier = readReadingValue("autoWaitMultiplier", autoWait === undefined ? 1 : autoWait);
    for (const reason of options.initialPauses ?? []) {
      if (reason !== "background" && reason !== "host") throw new Error("初始暂停原因无效");
      this.#pauses.add(reason);
    }
    this.#rollback = options.rollback ? new RollbackHistory(options.rollback.capacity) : null;
    const restored = options.resume ? prepareGameRestore(options.content, options.resume.checkpoint, options.player) : null;
    if (options.resume && !["silent", "replay", "resume"].includes(options.resume.voice)) throw new Error("需要明确的本次读档语音方式");
    const { runtime, initial } = restored
      ? restoreStoryRuntime(options.content, restored.checkpoint.story, options.player)
      : createStoryRuntime(options.content, options.player);
    this.#restoring = restored?.checkpoint ?? null;
    this.#restoreAudio = restored && options.resume
      ? { playback: restored.checkpoint.presentation.playback, voice: options.resume.voice } : null;
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
      canCheckpoint: this.canCheckpoint(), dialogueCount: this.#dialogue.length,
      rollbackCount: this.#rollback?.count(this.#visit) ?? 0, rollbackIssue: this.#rollbackIssue,
      newEnding: this.#endingConfirmed,
    };
  }

  dialogueHistory(): DialogueEntry[] {
    return structuredClone(this.#dialogue.map(item => item.value));
  }

  rollbackTargets(): RollbackTarget[] {
    return this.#rollback?.targets(this.#visit, this.#choiceVersion) ?? [];
  }

  rollback(request: RollbackRequest): Promise<RollbackResult> {
    if (this.#disposed) return Promise.resolve({ accepted: false, code: "DISPOSED", message: "会话已离开，不能回退" });
    return new Promise(resolve => this.enqueue({ type: "rollback", request: structuredClone(request), resolve }));
  }

  private appendDialogue(entry: DialogueEntry): void {
    this.#dialogue.push({ order: ++this.#dialogueOrder, value: entry });
    // Preserve the old dialogue backlog bound, separate from rollback policy.
    if (this.#dialogue.length > 300) this.#dialogue.shift();
  }

  private publish(): void {
    if (!this.#disposed) this.#options.onChange(this.view());
  }

  send(intent: SessionIntent): void {
    this.enqueue({ type: "intent", intent });
  }

  captureCheckpoint(token: SessionToken): Promise<CheckpointResult> {
    if (this.#disposed) return Promise.resolve({ accepted: false, code: "DISPOSED", message: "会话已离开，不能保存" });
    return new Promise(resolve => this.enqueue({ type: "checkpoint", token: { ...token }, resolve }));
  }

  private canCheckpoint(): boolean {
    const view = this.#runtime.view();
    return !this.#disposed && !!this.#playback && !this.#pauses.has("loading") && !this.#pauses.has("error")
      && (view.phase === "ready" || view.phase === "choosing");
  }

  private capture(event: Extract<Event, { type: "checkpoint" }>): void {
    if (!this.current(event.token)) {
      event.resolve({ accepted: false, code: "STALE_CHECKPOINT", message: "保存请求对应的步骤已改变，请重新保存" });
      return;
    }
    if (!this.canCheckpoint()) {
      event.resolve({ accepted: false, code: "CHECKPOINT_NOT_READY", message: "请在场面就绪、文字完整显示后保存；本切片暂不保存结局或媒体错误状态" });
      return;
    }
    event.resolve({ accepted: true, checkpoint: this.sampleCheckpoint() });
  }

  /** Everything is sampled synchronously inside one queued operation. */
  private sampleCheckpoint(): GameCheckpoint {
    const story = this.#runtime.snapshot();
    const playback = this.#playback!.capture();
    const checkpoint: GameCheckpoint = {
      format: "haifeng.game-checkpoint/1", story,
      presentation: { kind: "target-scene", playback },
      timing: {
        choiceRemainingMs: this.#choice?.remaining() ?? null,
        advance: this.#advance ? { remainingMs: this.#advance.remaining(), waitVoice: this.#advanceWaitVoice } : null,
        waitingForVoice: this.#autoDue, voiceDone: this.#voiceDone,
      },
      controls: { auto: this.#auto, skipping: this.#skipping },
    };
    return structuredClone(checkpoint);
  }

  private rememberCurrent(refresh = false): void {
    if (!this.#rollback || !this.canCheckpoint() || (!refresh && this.#rollback.has(this.#visit))) return;
    try {
      const view = this.#runtime.view();
      this.#rollback.record({
        id: this.#visit, choiceVersion: this.#choiceVersion, dialogueStart: this.#dialogueStart,
        checkpoint: this.sampleCheckpoint(),
        label: { chapter: view.chapter, speaker: view.presentation.speaker, text: view.presentation.text },
      });
      this.#rollbackIssue = null;
    } catch (error: unknown) {
      // A failed memory capture must not invent media/time or block mainline play.
      this.#rollbackIssue = `未能更新回退检查点：${error instanceof Error ? error.message : "捕获失败"}。已有历史保持原值。`;
    }
  }

  private restoreHistory(event: Extract<Event, { type: "rollback" }>): void {
    const { request } = event;
    const refuse = (code: string, message: string): void => event.resolve({ accepted: false, code, message });
    if (!this.current(request.token)) return refuse("STALE_ROLLBACK", "回退请求对应的步骤已改变，请重新选择");
    if (!this.canCheckpoint()) return refuse("ROLLBACK_NOT_READY", "请在场面就绪、文字完整显示后回退；本切片不支持结局后回退");
    if (typeof request.crossChoices !== "boolean" || !["silent", "replay", "resume"].includes(request.voice)) {
      return refuse("ROLLBACK_POLICY", "需要明确本次跨选择策略和语音方式");
    }
    const frame = this.#rollback?.read(request.targetId, this.#visit);
    if (!frame) return refuse("ROLLBACK_TARGET", "目标不在当前会话保留的历史中");
    if (!request.crossChoices && frame.choiceVersion !== this.#choiceVersion) {
      return refuse("ROLLBACK_CHOICE_BOUNDARY", "本次设置不跨选择，请选当前选择之后的位置");
    }
    let prepared: GameCheckpoint;
    try {
      prepared = prepareGameRestore(this.#options.content, frame.checkpoint, request.currentPlayer).checkpoint;
    } catch (error: unknown) {
      return refuse("ROLLBACK_CHECKPOINT", error instanceof Error ? error.message : "回退检查点校验失败");
    }
    // Only the core adopts progress. Nothing is inversely calculated or re-entered.
    const result = this.#runtime.restore(prepared.story, request.currentPlayer);
    if (!result.accepted) return refuse(result.error?.code ?? "ROLLBACK_STATE", result.error?.message ?? "回退准备失败");
    this.#rollback!.truncate(frame.id);
    this.#choiceVersion = frame.choiceVersion;
    const retained = this.#dialogue.filter(item => item.order <= frame.dialogueStart);
    this.#dialogue.length = 0;
    this.#dialogue.push(...retained);
    this.#auto = this.#skipping = false;
    this.#restoring = prepared;
    this.#restoreAudio = { playback: prepared.presentation.playback, voice: request.voice };
    this.#rollbackIssue = null;
    try {
      // Fresh core step and render epoch invalidate pre-rollback callbacks.
      this.adopt(result, frame.id);
    } catch (error: unknown) {
      // Progress was already adopted; media failure is retried at this same point.
      this.fail(error);
    }
    event.resolve({ accepted: true, nodeId: result.view.nodeId });
  }

  private fail(error: unknown): void {
    this.cancelEntryFeedback();
    this.#problem = { code: "SESSION", message: error instanceof Error ? error.message : "会话操作失败", blocking: true };
    this.#pauses.add("error");
    this.pauseWork();
    this.publish();
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
          if (event.type === "checkpoint") {
            event.resolve({ accepted: false, code: "CHECKPOINT_CAPTURE", message: error instanceof Error ? error.message : "检查点捕获失败" });
            continue;
          }
          if (event.type === "rollback") {
            event.resolve({ accepted: false, code: "ROLLBACK_STATE", message: error instanceof Error ? error.message : "回退操作失败" });
          }
          this.fail(error);
        }
      }
    } finally {
      this.#draining = false;
    }
  }

  private handle(event: Event): void {
    if (event.type === "intent") return this.intent(event.intent);
    if (event.type === "checkpoint") return this.capture(event);
    if (event.type === "rollback") return this.restoreHistory(event);
    if (event.type === "timer") {
      if (!this.current(event.token) || this.#pauses.size) return;
      if (event.purpose === "choice") {
        this.command({ type: "timeout", step: event.token.step });
      } else {
        if (event.waitVoice && this.#auto && !this.#skipping && !this.#voiceDone) {
          this.#advance = null;
          this.#autoDue = true;
        }
        else this.command({ type: "advance", step: event.token.step });
      }
      return;
    }
    if (event.epoch !== this.#epoch) return;
    if (event.type === "scene") {
      this.#pauses.delete("loading");
      this.pauseWork();
      this.startEntryFeedback();
      this.rememberCurrent();
      this.publish();
    } else if (event.type === "media") {
      if (this.#problem?.blocking && !event.problem.blocking) return;
      this.#problem = event.problem;
      if (event.problem.blocking) {
        this.cancelEntryFeedback();
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
    if (intent.type === "ending-unlocked") {
      const view = this.#runtime.view();
      if (!this.current(intent.token) || this.#endingConfirmed || view.phase !== "ended"
        || view.terminal?.kind !== "ending" || view.terminal.endingId !== intent.endingId) return;
      this.#endingConfirmed = true;
      this.feedback({ type: "cue", cue: "endingNew" });
      this.publish();
      return;
    }
    if (intent.type === "auto-wait") {
      this.#autoWaitMultiplier = readReadingValue("autoWaitMultiplier", intent.multiplier);
      this.publish();
      return;
    }
    if (intent.type === "pause") {
      if (intent.paused) this.#pauses.add(intent.reason);
      else this.#pauses.delete(intent.reason);
      this.pauseWork();
      this.publish();
      return;
    }
    if (intent.type === "retry") {
      if (this.#runtime.view().phase === "ended") return;
      this.#pauses.delete("error");
      this.#problem = null;
      this.render(this.#restoring ? "restore" : "retry");
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
        if (this.#skipping) this.cancelEntryFeedback();
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
    const before = this.#runtime.view();
    // Refresh the departure point before choice actions/next-node entry mutate progress.
    if (command.type !== "presented") this.rememberCurrent(true);
    const result = this.#runtime.dispatch(command);
    if (!result.accepted) {
      if (result.error) {
        this.cancelEntryFeedback();
        this.#options.onDiagnostic?.(result.error);
        this.#problem = { code: result.error.code, message: result.error.message, blocking: true };
        this.#pauses.add("error");
        this.pauseWork();
        this.publish();
      }
      return;
    }
    for (const fact of result.facts) {
      if (fact.type !== "chosen") continue;
      this.stopChoiceFeedback();
      this.feedback({ type: "cue", cue: fact.timedOut ? "timeoutSilence" : "choiceConfirm" });
      this.#choiceVersion++;
      // Accepted choices come from this exact pre-dispatch core view.
      const choice = before.choices.find(candidate => candidate.id === fact.choiceId)!;
      this.appendDialogue({
        kind: "choice", nodeId: fact.nodeId, chapter: before.chapter,
        text: choice.text, timedOut: fact.timedOut,
      });
    }
    const feedback = this.#storyFeedback.transition(before, result);
    this.adopt(result, undefined, feedback);
  }

  private adopt(result: RuntimeResult, restoredVisit?: number, feedback: readonly ScheduledFeedback[] = []): void {
    if (result.presentation) {
      this.#choiceAnnounced = false;
      this.#announceChoices = result.presentation.mode === "enter";
      this.#visit = restoredVisit ?? ++this.#visitSequence;
      this.#dialogueStart = this.#dialogueOrder;
    }
    if (result.presentation && result.view.presentation.text) {
      const { speaker, text } = result.view.presentation;
      this.appendDialogue({
        kind: "line", nodeId: result.view.nodeId, chapter: result.view.chapter, speaker, text,
        voiceId: result.view.presentation.performance.voiceId,
      });
    }
    if (result.presentation?.mode === "enter") {
      this.#restoreAudio = null;
      this.#entryWasRead = this.#options.seen.has(result.view.nodeId);
      this.#options.seen.add(result.view.nodeId);
      if (!this.#entryWasRead) this.#skipping = false;
      this.#problem = null;
      this.render("enter", this.#skipping ? [] : feedback);
    } else if (result.presentation?.mode === "restore") {
      this.#entryWasRead = this.#options.seen.has(result.view.nodeId);
      this.#problem = null;
      this.render("restore");
    }
    if (result.view.phase === "choosing") {
      this.#skipping = false;
      this.#playback?.setSkipping(false);
    }
    if (result.view.phase === "ended") {
      this.stopChoiceFeedback();
      this.stopTimers();
      this.#controller.abort();
      this.#playback?.cancel();
      if (this.#options.presentation.end) {
        const epoch = this.#epoch;
        this.#options.presentation.end({
          paused: this.#pauses.size > 0,
          problem: problem => this.enqueue({ type: "media", epoch, problem }),
        });
      } else this.#options.presentation.dispose();
      this.#auto = this.#skipping = false;
    } else this.configureProgress();
    this.rememberCurrent();
    if (result.facts.length) this.#options.onFacts?.(structuredClone(result.facts));
    this.publish();
  }

  private render(mode: "enter" | "retry" | "restore", feedback: readonly ScheduledFeedback[] = []): void {
    this.stopChoiceFeedback();
    this.#retryChoiceRemaining = mode === "restore" ? this.#restoring!.timing.choiceRemainingMs
      : mode === "retry" ? this.#choice?.remaining() ?? null : null;
    this.#pendingAdvance = mode === "restore" ? this.#restoring!.timing.advance
      : mode === "retry" && this.#advance ? { remainingMs: this.#advance.remaining(), waitVoice: this.#advanceWaitVoice } : null;
    if (mode === "retry" && this.#restoreAudio) {
      try { this.#restoreAudio = { ...this.#restoreAudio, playback: this.#playback!.capture() }; }
      catch { /* A scene which never became ready still uses the prepared data. */ }
    }
    this.stopTimers();
    this.#controller.abort();
    this.#playback?.cancel();
    this.#controller = new AbortController();
    this.#epoch++;
    this.#pendingFeedback = feedback;
    this.#pauses.add("loading");
    this.#voiceDone = !this.#runtime.view().presentation.performance.voiceId || this.#skipping
      || this.#restoreAudio?.voice === "silent"
      || (this.#restoreAudio?.voice === "resume" && (this.#restoreAudio.playback.voice?.state !== "active"
        || this.#restoreAudio.playback.voice.positionMs === null));
    this.#autoDue = false;
    const epoch = this.#epoch;
    this.#playback = this.#options.presentation.present(this.#runtime.view(), {
      signal: this.#controller.signal, clock: this.#options.clock, mode,
      restore: this.#restoreAudio ? structuredClone(this.#restoreAudio) : null,
      paused: this.#pauses.size > 0, skipping: this.#skipping,
      sceneReady: () => this.enqueue({ type: "scene", epoch }),
      textReady: () => this.enqueue({ type: "text", epoch }),
      voiceEnded: () => this.enqueue({ type: "voice", epoch }),
      problem: problem => this.enqueue({ type: "media", epoch, problem }),
    });
    this.#restoring = null;
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
        else if (pause || performance.waitMs > 0) this.scheduleAdvance(this.#pendingAdvance?.remainingMs ?? (performance.waitMs || 2000));
        else if (this.#auto) this.scheduleAdvance(this.#pendingAdvance?.remainingMs
          ?? (1200 + view.presentation.text.length * 60) * this.#autoWaitMultiplier, this.#pendingAdvance?.waitVoice ?? true);
      }
    }
    this.#pendingAdvance = null;
    this.pauseWork();
  }

  private scheduleAdvance(milliseconds: number, waitVoice = false): void {
    this.#advance?.cancel();
    this.#advanceWaitVoice = waitVoice;
    const token = this.token();
    this.#advance = new ActiveTimer(this.#options.clock, milliseconds,
      () => this.enqueue({ type: "timer", token, purpose: "advance", waitVoice }));
    this.#advance.setPaused(this.#pauses.size > 0);
  }

  private pauseWork(): void {
    const paused = this.#pauses.size > 0;
    this.#choice?.setPaused(paused);
    this.#advance?.setPaused(paused);
    for (const timer of this.#feedbackTimers) timer.setPaused(paused);
    const view = this.#runtime.view();
    if (view.phase === "ended") this.#options.presentation.setPaused?.(paused);
    else this.#playback?.setPaused(paused);
    if (view.phase === "choosing" && !this.#pauses.has("loading") && !this.#pauses.has("error")) {
      if (!this.#choiceFeedbackActive) {
        this.#choiceFeedbackActive = true;
        const announce = this.#announceChoices && !this.#choiceAnnounced && !this.#skipping;
        this.#choiceAnnounced = true;
        this.feedback({ type: "choices", active: true, timed: view.timeout !== null, announce });
      }
    } else this.stopChoiceFeedback();
  }

  private feedback(feedback: InteractionFeedback): void {
    try { this.#options.presentation.interaction?.(feedback); }
    catch (error: unknown) {
      if (!this.#problem?.blocking) this.#problem = {
        code: "UI_AUDIO", blocking: false,
        message: `交互提示音未播放：${error instanceof Error ? error.message : "声音不可用"}`,
      };
    }
  }

  private stopChoiceFeedback(): void {
    if (!this.#choiceFeedbackActive) return;
    this.#choiceFeedbackActive = false;
    this.feedback({ type: "choices", active: false, timed: false, announce: false });
  }

  private startEntryFeedback(): void {
    const cues = this.#pendingFeedback;
    this.#pendingFeedback = [];
    if (this.#disposed || this.#skipping || this.#pauses.size) return;
    const epoch = this.#epoch;
    for (const plan of cues) {
      if (plan.delayMs === 0) this.feedback({ type: "cue", cue: plan.cue });
      else {
        const timer = new ActiveTimer(this.#options.clock, plan.delayMs, () => {
          this.#feedbackTimers.delete(timer);
          if (!this.#disposed && epoch === this.#epoch && !this.#skipping && !this.#pauses.size) {
            this.feedback({ type: "cue", cue: plan.cue });
          }
        });
        this.#feedbackTimers.add(timer);
        timer.setPaused(false);
      }
    }
  }

  private cancelEntryFeedback(): void {
    this.#pendingFeedback = [];
    for (const timer of this.#feedbackTimers) timer.cancel();
    this.#feedbackTimers.clear();
  }

  private stopTimers(): void {
    this.cancelEntryFeedback();
    this.#choice?.cancel();
    this.#advance?.cancel();
    this.#choice = this.#advance = null;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.stopChoiceFeedback();
    this.#disposed = true;
    this.#epoch++;
    for (const event of this.#queue) {
      if (event.type === "checkpoint") event.resolve({ accepted: false, code: "DISPOSED", message: "保存前会话已离开" });
      else if (event.type === "rollback") event.resolve({ accepted: false, code: "DISPOSED", message: "回退前会话已离开" });
    }
    this.#queue.length = 0;
    this.#dialogue.length = 0;
    this.#rollback?.clear();
    this.stopTimers();
    this.#controller.abort();
    this.#playback?.cancel();
    this.#options.presentation.dispose();
  }
}

export function createGameSession(options: Options): GameSession {
  return new Session(options);
}
