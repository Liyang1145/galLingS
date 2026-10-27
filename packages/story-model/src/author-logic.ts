import type { Assignment, Choice, Flow, SourceLocation } from "./model.ts";
import type { VariableTypes } from "./expression.ts";
import { parseAssignments, parseExpression } from "./expression.ts";
import { at, reject } from "./read.ts";

/** Shared node logic compilation. No condition evaluation, variable mutation or I/O. */
export function compileAuthorLogic(
  value: { set: string; jump: string; jumpIf: string; ending: string; ctime: number; cdef: string },
  choices: readonly Choice[],
  context: {
    source: SourceLocation; writable: VariableTypes; readable: VariableTypes;
    nodeIds: ReadonlySet<string>; sequential: string | null;
  },
): { enter: Assignment[]; flow: Flow } {
  const { source, sequential } = context;
  const loc = (field: string): SourceLocation => at(source, field);
  if ((choices.length && (value.jump || value.ending)) || (value.jump && value.ending)) {
    reject("FLOW_CONFLICT", "选择、跳转与结局存在冲突，需明确处理", source);
  }
  if (!value.jump && value.jumpIf) reject("FLOW_CONFLICT", "存在条件却没有跳转目标", loc("jumpIf"));
  if (!Number.isFinite(value.ctime) || value.ctime < 0 || !Number.isFinite(value.ctime * 1000)) {
    reject("RANGE", "选择倒计时须是可表示的非负秒数", loc("ctime"));
  }
  const enter = parseAssignments(value.set, context.writable, context.readable, loc("set"));
  if (choices.length) {
    let timeout: Extract<Flow, { kind: "choice" }>["timeout"] = null;
    if (value.ctime > 0) {
      const matches = choices.filter(choice => choice.id === value.cdef);
      if (matches.length !== 1) reject("TIMEOUT_DEFAULT", "超时必须指向唯一的显式默认选项", loc("cdef"));
      timeout = { durationMs: value.ctime * 1000, choiceId: matches[0]!.id, unavailable: "error" };
    } else if (value.cdef) reject("TIMEOUT_DEFAULT", "无倒计时却指定默认选项", loc("cdef"));
    return { enter, flow: { kind: "choice", choices: [...choices], emptyTarget: sequential, timeout } };
  }
  if (value.ctime > 0 || value.cdef) reject("TIMEOUT_DEFAULT", "没有选项的节点不能配置选择倒计时", source);
  if (value.ending) return { enter, flow: { kind: "ending", endingId: value.ending } };
  if (!value.jump) return { enter, flow: { kind: "next", target: sequential } };
  if (!context.nodeIds.has(value.jump)) reject("TARGET", `不存在目标节点「${value.jump}」`, loc("jump"));
  return {
    enter,
    flow: {
      kind: "branch", condition: parseExpression(value.jumpIf, context.readable, loc("jumpIf")),
      then: value.jump, otherwise: sequential,
    },
  };
}
