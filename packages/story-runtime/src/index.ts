import { applyAssignments, evaluate, truthy } from "../../story-model/src/expression.ts";
import { ContentError, PLAYER_VARIABLES } from "../../story-model/src/model.ts";
import type {
  Assignment, Choice, Diagnostic, PlayerProjection, Presentation, SourceLocation, StoryContent, StoryNode, Value,
} from "../../story-model/src/model.ts";
import { at, jsonObject, knownFields, numeric, object, reject, string } from "../../story-model/src/read.ts";

export type Phase = "presenting" | "ready" | "choosing" | "ended";
export type Terminal = { kind: "ending"; endingId: string } | { kind: "script-end" } | null;
export type RuntimeCommand =
  | { type: "presented"; step: number }
  | { type: "advance"; step: number }
  | { type: "choose"; step: number; choiceId: string }
  | { type: "timeout"; step: number };

export interface RuntimeView {
  nodeId: string;
  step: number;
  phase: Phase;
  chapter: string;
  variables: Record<string, Value>;
  player: PlayerProjection;
  presentation: Presentation;
  choices: { id: string; text: string }[];
  timeout: { durationMs: number; choiceId: string } | null;
  terminal: Terminal;
}

export type StoryFact =
  | { type: "entered"; nodeId: string }
  | { type: "chosen"; nodeId: string; choiceId: string; timedOut: boolean }
  | { type: "ending"; nodeId: string; endingId: string };

export interface StorySnapshot {
  format: "haifeng.story-snapshot/1";
  workId: string;
  contentRevision: string;
  nodeId: string;
  variables: Record<string, Value>;
  player: PlayerProjection;
  phase: Phase;
  terminal: Terminal;
}

export interface RuntimeResult {
  accepted: boolean;
  view: RuntimeView;
  facts: StoryFact[];
  presentation: { mode: "enter" | "restore"; value: Presentation } | null;
  error: Diagnostic | null;
}

export interface StoryRuntime {
  view(): RuntimeView;
  dispatch(command: RuntimeCommand): RuntimeResult;
  snapshot(): StorySnapshot;
  restore(snapshot: unknown, currentPlayer: PlayerProjection): RuntimeResult;
}

interface State {
  nodeId: string;
  variables: Record<string, Value>;
  player: PlayerProjection;
  phase: Phase;
  terminal: Terminal;
}

const SNAPSHOT_SOURCE: SourceLocation = { file: "story-snapshot", field: "" };

function projection(input: unknown, source: SourceLocation): PlayerProjection {
  const record = object(input, source);
  knownFields(record, PLAYER_VARIABLES, source);
  const cycle = numeric(record["周目"], at(source, "周目"));
  const endings = numeric(record["结局数"], at(source, "结局数"));
  if (!Number.isSafeInteger(cycle) || cycle < 1 || !Number.isSafeInteger(endings) || endings < 0) {
    reject("PLAYER_PROJECTION", "周目必须是正整数，结局数必须是非负整数", source);
  }
  return { "周目": cycle, "结局数": endings };
}

class Runtime implements StoryRuntime {
  readonly #content: StoryContent;
  readonly #nodes: Map<string, StoryNode>;
  #state: State;
  #step = 1;

  constructor(content: StoryContent, initial: { player: PlayerProjection } | { snapshot: unknown; currentPlayer: PlayerProjection | null }) {
    // Content is typed output of the checked compiler, not unchecked JSON.
    this.#content = structuredClone(content);
    this.#nodes = new Map(this.#content.nodes.map(node => [node.id, node]));
    if (this.#nodes.size !== this.#content.nodes.length) {
      reject("NODE_ID", "重复节点 ID", { file: content.source.file, field: "nodes" });
    }
    if ("snapshot" in initial) {
      // Inspection starts from already effective state, without entering even
      // the story's opening node or producing any facts.
      this.#state = this.parseSnapshot(initial.snapshot);
      if (initial.currentPlayer) this.refreshProjection(this.#state, initial.currentPlayer);
    } else {
      this.#state = {
        nodeId: content.entryNodeId,
        variables: Object.fromEntries(content.variables.map(variable => [variable.name, variable.initial])),
        player: projection(initial.player, at(SNAPSHOT_SOURCE, "player")), phase: "presenting", terminal: null,
      };
      const node = this.node(this.#state);
      this.apply(node.enter, this.#state);
    }
    // Eagerly evaluate the view before exposing a partially usable instance.
    this.view();
  }

  private node(state: State): StoryNode {
    const node = this.#nodes.get(state.nodeId);
    if (!node) reject("NODE_REFERENCE", `节点「${state.nodeId}」不存在`, {
      file: this.#content.source.file, field: "nodeId", nodeId: state.nodeId,
    });
    return node;
  }

  private values(state: State): Record<string, Value> {
    return { ...state.variables, ...state.player };
  }

  private apply(actions: readonly Assignment[], state: State): void {
    const values = this.values(state);
    for (const action of actions) {
      if (!Object.hasOwn(state.variables, action.name)) {
        reject("READ_ONLY", `不可写变量「${action.name}」`, this.node(state).source);
      }
    }
    applyAssignments(actions, values);
    state.variables = Object.fromEntries(this.#content.variables.map(variable => [variable.name, values[variable.name]!]));
  }

  private visible(state: State): Choice[] {
    const flow = this.node(state).flow;
    if (flow.kind !== "choice") return [];
    const values = this.values(state);
    return flow.choices.filter(choice => truthy(evaluate(choice.condition, values)));
  }

  private describe(state: State, step: number): RuntimeView {
    const node = this.node(state);
    const presentation = structuredClone(node.presentation);
    const values = this.values(state);
    presentation.text = presentation.text.replace(/\{([^{}\s]{1,16})\}/gu, (match, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : match);
    const choices = this.visible(state);
    const timeout = node.flow.kind === "choice" && state.phase === "choosing" ? node.flow.timeout : null;
    return {
      nodeId: node.id, step, phase: state.phase, chapter: node.chapter,
      variables: structuredClone(state.variables), player: { ...state.player }, presentation,
      choices: state.phase === "choosing" ? choices.map(choice => ({ id: choice.id, text: choice.text })) : [],
      timeout: timeout ? { durationMs: timeout.durationMs, choiceId: timeout.choiceId } : null,
      terminal: structuredClone(state.terminal),
    };
  }

  view(): RuntimeView {
    return this.describe(this.#state, this.#step);
  }

  private failure(code: string, message: string, source = this.node(this.#state).source): RuntimeResult {
    return { accepted: false, view: this.view(), facts: [], presentation: null, error: { code, message, source } };
  }

  private commit(candidate: State, facts: StoryFact[], mode: "enter" | "restore" | null): RuntimeResult {
    if (!Number.isSafeInteger(this.#step + 1)) throw new Error("步骤编号已耗尽");
    const view = this.describe(candidate, this.#step + 1);
    // No live mutation before all candidate calculations/description succeed.
    this.#state = candidate;
    this.#step++;
    return {
      accepted: true, view, facts,
      presentation: mode ? { mode, value: structuredClone(view.presentation) } : null, error: null,
    };
  }

  private enter(target: string | null, candidate: State, facts: StoryFact[]): "enter" | null {
    if (target === null) {
      candidate.phase = "ended";
      candidate.terminal = { kind: "script-end" };
      return null;
    }
    candidate.nodeId = target;
    candidate.phase = "presenting";
    candidate.terminal = null;
    const node = this.node(candidate);
    this.apply(node.enter, candidate);
    facts.push({ type: "entered", nodeId: target });
    return "enter";
  }

  dispatch(command: RuntimeCommand): RuntimeResult {
    if (!Number.isSafeInteger(command.step) || command.step !== this.#step) {
      return this.failure("STALE_STEP", "旧步骤或重复回调已拒绝");
    }
    if (this.#state.phase === "ended") return this.failure("ENDED", "剧情已结束");
    const candidate = structuredClone(this.#state);
    const facts: StoryFact[] = [];
    const node = this.node(candidate);
    let mode: "enter" | null = null;
    try {
      switch (command.type) {
        case "presented":
          if (candidate.phase !== "presenting") return this.failure("PHASE", "当前没有等待完成的呈现");
          candidate.phase = this.visible(candidate).length ? "choosing" : "ready";
          break;
        case "advance": {
          if (candidate.phase !== "ready") return this.failure("PHASE", "当前尚不可继续，需先完成呈现或作出选择");
          const flow = node.flow;
          if (flow.kind === "ending") {
            candidate.phase = "ended";
            candidate.terminal = { kind: "ending", endingId: flow.endingId };
            facts.push({ type: "ending", nodeId: node.id, endingId: flow.endingId });
          } else if (flow.kind === "branch") {
            mode = this.enter(truthy(evaluate(flow.condition, this.values(candidate))) ? flow.then : flow.otherwise, candidate, facts);
          } else if (flow.kind === "next") {
            mode = this.enter(flow.target, candidate, facts);
          } else {
            if (this.visible(candidate).length) return this.failure("CHOICE_REQUIRED", "必须选择有效选项");
            mode = this.enter(flow.emptyTarget, candidate, facts);
          }
          break;
        }
        case "choose":
        case "timeout": {
          if (candidate.phase !== "choosing" || node.flow.kind !== "choice") return this.failure("PHASE", "当前不是开放选择");
          const timedOut = command.type === "timeout";
          if (timedOut && !node.flow.timeout) return this.failure("NO_TIMEOUT", "当前选择没有超时策略");
          const choiceId = command.type === "choose" ? command.choiceId : node.flow.timeout!.choiceId;
          const choice = this.visible(candidate).find(item => item.id === choiceId);
          if (!choice) return this.failure("CHOICE_UNAVAILABLE", timedOut ? "超时默认选项不可用" : "选项不存在或被条件隐藏");
          this.apply(choice.actions, candidate);
          facts.push({ type: "chosen", nodeId: node.id, choiceId: choice.id, timedOut });
          mode = this.enter(choice.target, candidate, facts);
          break;
        }
        default:
          return this.failure("COMMAND", "未知剧情操作");
      }
      return this.commit(candidate, facts, mode);
    } catch (error: unknown) {
      if (error instanceof ContentError) {
        return { accepted: false, view: this.view(), facts: [], presentation: null, error: error.diagnostic };
      }
      return this.failure("STORY_STATE", error instanceof Error ? error.message : "剧情计算失败", node.source);
    }
  }

  snapshot(): StorySnapshot {
    return {
      format: "haifeng.story-snapshot/1", workId: this.#content.workId, contentRevision: this.#content.revision,
      ...structuredClone(this.#state),
    };
  }

  private parseSnapshot(input: unknown): State {
    const source = SNAPSHOT_SOURCE;
    const record = object(input, source);
    knownFields(record, ["format", "workId", "contentRevision", "nodeId", "variables", "player", "phase", "terminal"], source);
    if (record.format !== "haifeng.story-snapshot/1") reject("SNAPSHOT_FORMAT", "不支持的剧情快照格式", source);
    if (record.workId !== this.#content.workId) reject("SNAPSHOT_WORK", "快照属于其他作品", source);
    if (record.contentRevision !== this.#content.revision) reject("SNAPSHOT_REVISION", "快照内容修订不兼容", source);
    const nodeId = string(record.nodeId, at(source, "nodeId"));
    const variables = jsonObject(record.variables, at(source, "variables"));
    knownFields(variables, this.#content.variables.map(variable => variable.name), at(source, "variables"));
    const values: Record<string, Value> = Object.create(null) as Record<string, Value>;
    for (const variable of this.#content.variables) {
      const value = variables[variable.name];
      if (!Object.hasOwn(variables, variable.name) || typeof value !== variable.type
        || (typeof value === "number" && !Number.isFinite(value))) {
        reject("SNAPSHOT_VARIABLE", `变量「${variable.name}」缺失或类型不匹配`, at(source, `variables.${variable.name}`));
      }
      values[variable.name] = value as Value;
    }
    const phase = string(record.phase, at(source, "phase"));
    if (!["presenting", "ready", "choosing", "ended"].includes(phase)) reject("SNAPSHOT_PHASE", "未知逻辑阶段", source);
    let terminal: Terminal = null;
    if (record.terminal !== null) {
      const data = object(record.terminal, at(source, "terminal"));
      if (data.kind === "ending") {
        knownFields(data, ["kind", "endingId"], at(source, "terminal"));
        terminal = { kind: "ending", endingId: string(data.endingId, at(source, "terminal.endingId")) };
      } else if (data.kind === "script-end") {
        knownFields(data, ["kind"], at(source, "terminal"));
        terminal = { kind: "script-end" };
      } else reject("SNAPSHOT_TERMINAL", "未知结束状态", source);
    }
    const candidate: State = {
      nodeId, variables: values, player: projection(record.player, at(source, "player")),
      phase: phase as Phase, terminal,
    };
    const node = this.node(candidate);
    const visible = this.visible(candidate);
    if ((candidate.phase === "ended") !== (terminal !== null)) reject("SNAPSHOT_PHASE", "结束阶段与结束信息不匹配", source);
    if (candidate.phase === "choosing" && (node.flow.kind !== "choice" || !visible.length)) {
      reject("SNAPSHOT_PHASE", "快照选择阶段没有有效选项", source);
    }
    if (candidate.phase === "ready" && visible.length) reject("SNAPSHOT_PHASE", "有有效选项的节点不能绕过选择", source);
    if (terminal?.kind === "ending" && (node.flow.kind !== "ending" || node.flow.endingId !== terminal.endingId)) {
      reject("SNAPSHOT_TERMINAL", "结局与当前节点不一致", source);
    }
    if (terminal?.kind === "script-end") {
      const flow = node.flow;
      const hasEnd = flow.kind === "next" ? flow.target === null
        : flow.kind === "branch" ? flow.otherwise === null
        : flow.kind === "choice" ? flow.emptyTarget === null || flow.choices.some(choice => choice.target === null)
        : false;
      if (!hasEnd) reject("SNAPSHOT_TERMINAL", "当前节点没有脚本结束去向", source);
    }
    return candidate;
  }

  private refreshProjection(candidate: State, player: PlayerProjection): void {
    candidate.player = projection(player, at(SNAPSHOT_SOURCE, "currentPlayer"));
    if (candidate.phase === "ready" || candidate.phase === "choosing") {
      candidate.phase = this.visible(candidate).length ? "choosing" : "ready";
    }
  }

  restore(snapshot: unknown, currentPlayer: PlayerProjection): RuntimeResult {
    try {
      const candidate = this.parseSnapshot(snapshot);
      this.refreshProjection(candidate, currentPlayer);
      // No enter/apply and no entered/chosen/ending facts on restoration.
      // Commit allocates a fresh step, invalidating all old callbacks.
      return this.commit(candidate, [], "restore");
    } catch (error: unknown) {
      if (error instanceof ContentError) {
        return { accepted: false, view: this.view(), facts: [], presentation: null, error: error.diagnostic };
      }
      return this.failure("SNAPSHOT_STATE", error instanceof Error ? error.message : "快照恢复失败", SNAPSHOT_SOURCE);
    }
  }
}

export function createStoryRuntime(
  content: StoryContent,
  player: PlayerProjection,
): { runtime: StoryRuntime; initial: RuntimeResult } {
  const runtime: StoryRuntime = new Runtime(content, { player });
  const view = runtime.view();
  return {
    runtime,
    initial: {
      accepted: true, view, facts: [{ type: "entered", nodeId: view.nodeId }],
      presentation: { mode: "enter", value: structuredClone(view.presentation) }, error: null,
    },
  };
}

/** Validate and describe an external snapshot without touching a live runtime. */
export function inspectStorySnapshot(
  content: StoryContent, input: unknown,
): { snapshot: StorySnapshot; view: RuntimeView } {
  const runtime = new Runtime(content, { snapshot: input, currentPlayer: null });
  return { snapshot: runtime.snapshot(), view: runtime.view() };
}

/** Resume already effective progress with the latest independent global projection. */
export function restoreStoryRuntime(
  content: StoryContent, input: unknown, currentPlayer: PlayerProjection,
): { runtime: StoryRuntime; initial: RuntimeResult } {
  const runtime: StoryRuntime = new Runtime(content, { snapshot: input, currentPlayer });
  const view = runtime.view();
  return { runtime, initial: {
    accepted: true, view, facts: [], presentation: { mode: "restore", value: structuredClone(view.presentation) }, error: null,
  } };
}
