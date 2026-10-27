import type { Choice, SourceLocation } from "./model.ts";
import type { VariableTypes } from "./expression.ts";
import { parseAssignments, parseExpression } from "./expression.ts";
import { at, reject } from "./read.ts";

/** The shared author-choice compiler. Parses structure only, never evaluates a route. */
export function compileAuthorChoice(
  value: { id: string; text: string; cond: string; set: string; target: string },
  context: {
    source: SourceLocation;
    writable: VariableTypes;
    readable: VariableTypes;
    nodeIds: ReadonlySet<string>;
    sequential: string | null;
  },
): Choice {
  const { source } = context;
  if (value.target && !context.nodeIds.has(value.target)) {
    reject("TARGET", `不存在目标节点「${value.target}」`, at(source, "target"));
  }
  return {
    id: value.id, text: value.text,
    condition: parseExpression(value.cond, context.readable, at(source, "cond")),
    actions: parseAssignments(value.set, context.writable, context.readable, at(source, "set")),
    target: value.target || context.sequential, source,
  };
}
