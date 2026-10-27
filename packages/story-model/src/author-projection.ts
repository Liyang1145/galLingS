import { authorChoiceField, authorChoiceId, readAuthorTextPatch } from "./author.ts";
import type { AuthorTextField } from "./author.ts";
import { authorDraftFields, authorTextKey } from "./author-draft.ts";
import type { AuthorDraftBase } from "./author-draft.ts";
import { compileAuthorChoice } from "./author-choice.ts";
import { compileAuthorLogic } from "./author-logic.ts";
import { PLAYER_VARIABLES } from "./model.ts";
import type { StoryContent } from "./model.ts";
import type { VariableTypes } from "./expression.ts";
import { reject } from "./read.ts";

/** Read-only draft structure for inspection, not a packaged revision or a running story. */
export function projectAuthorDraft(content: StoryContent, base: AuthorDraftBase, input: unknown): StoryContent {
  const patch = readAuthorTextPatch(input);
  const source = { file: content.source.file, field: "" };
  if (patch.sourceSha256 !== base.sourceSha256 || patch.sourceSha256 !== content.source.sha256) {
    reject("DRAFT_BASE", "草稿结构与当前作者基线不一致", source);
  }
  if (!patch.edits.length) return content;
  const originals = authorDraftFields(base);
  const edits = new Map<string, Map<AuthorTextField, string>>();
  const nodes = new Map(content.nodes.map(node => [node.id, node]));
  const nodeIds = new Set(nodes.keys());
  for (const edit of patch.edits) {
    const node = nodes.get(edit.nodeId);
    const choiceId = authorChoiceId(edit.field);
    if (!node || originals.get(authorTextKey(edit.nodeId, edit.field))?.before !== edit.before
      || (choiceId !== null && (node.flow.kind !== "choice" || !node.flow.choices.some(choice => choice.id === choiceId)))) {
      reject("DRAFT_BASE", "草稿原值与已有可编辑字段不一致", { ...source, nodeId: edit.nodeId, field: edit.field });
    }
    const fields = edits.get(edit.nodeId) ?? new Map<AuthorTextField, string>();
    fields.set(edit.field, edit.after);
    edits.set(edit.nodeId, fields);
  }
  const writable: VariableTypes = Object.fromEntries(content.variables.map(variable => [variable.name, variable.type]));
  const readable: VariableTypes = { ...writable, ...Object.fromEntries(PLAYER_VARIABLES.map(name => [name, "number"] as const)) };
  return {
    ...content,
    // The original revision is a baseline label; only explicit server compilation produces a new revision.
    nodes: content.nodes.map((node, index) => {
      const changes = edits.get(node.id);
      if (!changes) return node;
      const value = (field: AuthorTextField, fallback: string): string => changes.get(field)
        ?? originals.get(authorTextKey(node.id, field))?.before ?? fallback;
      const flow = node.flow;
      const sequential = content.nodes[index + 1]?.id ?? null;
      const context = { source: node.source, writable, readable, nodeIds, sequential };
      const choices = flow.kind === "choice" ? flow.choices.map(choice => compileAuthorChoice({
        id: choice.id,
        text: value(authorChoiceField(choice.id), choice.text),
        cond: value(authorChoiceField(choice.id, "cond"), ""),
        set: value(authorChoiceField(choice.id, "set"), ""),
        target: value(authorChoiceField(choice.id, "target"), ""),
      }, { ...context, source: choice.source })) : [];
      const logic = compileAuthorLogic({
        set: value("set", ""),
        jump: value("jump", flow.kind === "branch" ? flow.then : ""),
        jumpIf: value("jumpIf", ""),
        ending: value("ending", flow.kind === "ending" ? flow.endingId : ""),
        ctime: flow.kind === "choice" && flow.timeout ? flow.timeout.durationMs / 1000 : 0,
        cdef: value("cdef", flow.kind === "choice" ? flow.timeout?.choiceId ?? "" : ""),
      }, choices, context);
      return {
        ...node, enter: logic.enter, flow: logic.flow,
        presentation: {
          ...node.presentation,
          speaker: value("speaker", node.presentation.speaker), text: value("text", node.presentation.text),
        },
      };
    }),
  };
}
