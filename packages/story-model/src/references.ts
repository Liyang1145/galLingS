import { PLAYER_VARIABLES } from "./model.ts";
import type { Assignment, Expression, SourceLocation, StoryContent } from "./model.ts";
import { dialoguePlaceholders } from "./text.ts";

export type ReferenceTarget =
  | { readonly kind: "node" | "resource" | "variable" | "ending"; readonly id: string }
  | { readonly kind: "choice" | "sprite"; readonly nodeId: string; readonly id: string };
export type ReferenceRole =
  | "entry" | "next" | "branch-then" | "branch-otherwise" | "choice-target" | "empty-target"
  | "timeout-default" | "ending" | "background" | "sprite" | "music" | "ambience" | "voice" | "sound"
  | "actor-action" | "read" | "write" | "text" | "theme" | "cover" | "ui-sound" | "feedback-variable";

export interface ReferenceInput {
  readonly target: ReferenceTarget;
  readonly nodeId: string | null;
  readonly choiceId: string | null;
  readonly role: ReferenceRole;
  /** Path in normalized content; never presented as an exact original author token location. */
  readonly path: string;
  readonly source: Readonly<SourceLocation>;
  readonly derived: boolean;
  readonly range?: { readonly start: number; readonly end: number };
}
export interface ContentReference extends ReferenceInput { readonly resolved: boolean }
export interface ReferenceDefinition {
  readonly target: ReferenceTarget;
  readonly label: string;
}
export interface ContentReferenceIndex {
  readonly workId: string;
  readonly revision: string;
  definitions(): readonly ReferenceDefinition[];
  outgoing(nodeId: string): readonly ContentReference[];
  incoming(target: ReferenceTarget): readonly ContentReference[];
}

export function referenceKey(target: ReferenceTarget): string {
  return JSON.stringify("nodeId" in target ? [target.kind, target.nodeId, target.id] : [target.kind, target.id]);
}

/** Structural references only. Never evaluates conditions, runs actions or decides reachability. */
export function createReferenceIndex(
  content: StoryContent,
  options: {
    readonly textOverrides?: ReadonlyMap<string, string>;
    readonly additional?: readonly ReferenceInput[];
  } = {},
): ContentReferenceIndex {
  const definitions: ReferenceDefinition[] = [];
  const declared = new Set<string>();
  const catalogKeys = new Set<string>();
  const references: ReferenceInput[] = [];
  const define = (target: ReferenceTarget, label: string): void => {
    const key = referenceKey(target);
    if (declared.has(key)) return;
    declared.add(key);
    catalogKeys.add(key);
    definitions.push(Object.freeze({ target: Object.freeze({ ...target }), label }));
  };
  const nodeIds = new Set(content.nodes.map(node => node.id));
  for (const id of options.textOverrides?.keys() ?? []) {
    if (!nodeIds.has(id)) throw new Error(`对白引用覆盖的节点不存在：${id}`);
  }
  for (const variable of content.variables) define({ kind: "variable", id: variable.name }, `剧情变量 · ${variable.type}`);
  for (const id of PLAYER_VARIABLES) define({ kind: "variable", id }, "只读玩家投影");
  for (const resource of content.resources) define({ kind: "resource", id: resource.id }, `${resource.kind} · ${resource.path}`);
  for (const node of content.nodes) {
    define({ kind: "node", id: node.id }, `${node.chapter || "未标章节"}${node.label ? ` · ${node.label}` : ""}`);
    for (const sprite of node.presentation.scene.sprites) {
      define({ kind: "sprite", nodeId: node.id, id: sprite.id }, `立绘实例 · ${node.id} · ${sprite.assetId}`);
    }
    if (node.flow.kind === "choice") {
      for (const choice of node.flow.choices) define({ kind: "choice", nodeId: node.id, id: choice.id }, choice.text);
    } else if (node.flow.kind === "ending") define({ kind: "ending", id: node.flow.endingId }, "内容声明的结局");
  }
  references.push({
    target: { kind: "node", id: content.entryNodeId }, nodeId: null, choiceId: null,
    role: "entry", path: "entryNodeId", source: { file: content.source.file, field: "" }, derived: true,
  });
  content.nodes.forEach((node, index) => {
    const base = `nodes.${index}`;
    const add = (
      target: ReferenceTarget, role: ReferenceRole, path: string, choiceId: string | null = null,
      source: Readonly<SourceLocation> = node.source, derived = false,
      range?: { readonly start: number; readonly end: number },
    ): void => {
      references.push({ target, nodeId: node.id, choiceId, role, path: `${base}.${path}`, source, derived,
        ...(range ? { range } : {}) });
    };
    const expression = (input: Expression, path: string, choiceId: string | null, source: Readonly<SourceLocation>): void => {
      const stack = [{ input, path }];
      while (stack.length) {
        const current = stack.pop()!;
        switch (current.input.kind) {
          case "variable": add({ kind: "variable", id: current.input.name }, "read", current.path, choiceId, source); break;
          case "unary": stack.push({ input: current.input.operand, path: `${current.path}.operand` }); break;
          case "binary":
            stack.push({ input: current.input.right, path: `${current.path}.right` });
            stack.push({ input: current.input.left, path: `${current.path}.left` });
            break;
          case "literal": break;
        }
      }
    };
    const actions = (items: readonly Assignment[], path: string, choiceId: string | null, source: Readonly<SourceLocation>): void => {
      items.forEach((action, actionIndex) => {
        const where = `${path}.${actionIndex}`;
        const target: ReferenceTarget = { kind: "variable", id: action.name };
        add(target, "write", `${where}.name`, choiceId, source);
        if (action.operator !== "=") add(target, "read", `${where}.name`, choiceId, source, true);
        expression(action.expression, `${where}.expression`, choiceId, source);
      });
    };
    actions(node.enter, "enter", null, node.source);
    const { scene, performance } = node.presentation;
    const resource = (id: string | null, role: ReferenceRole, path: string): void => {
      if (id !== null) add({ kind: "resource", id }, role, `presentation.${path}`);
    };
    resource(scene.background, "background", "scene.background");
    scene.sprites.forEach((sprite, spriteIndex) => resource(sprite.assetId, "sprite", `scene.sprites.${spriteIndex}.assetId`));
    if (scene.music.kind === "play") resource(scene.music.assetId, "music", "scene.music.assetId");
    scene.ambience.forEach((track, trackIndex) => resource(track.assetId, "ambience", `scene.ambience.${trackIndex}.assetId`));
    resource(performance.voiceId, "voice", "performance.voiceId");
    performance.sounds.forEach((sound, soundIndex) => resource(sound.assetId, "sound", `performance.sounds.${soundIndex}.assetId`));
    for (const id of Object.keys(performance.actorActions)) {
      add({ kind: "sprite", nodeId: node.id, id }, "actor-action", `presentation.performance.actorActions[${JSON.stringify(id)}]`);
    }
    const text = options.textOverrides?.get(node.id) ?? node.presentation.text;
    for (const placeholder of dialoguePlaceholders(text)) {
      add({ kind: "variable", id: placeholder.name }, "text", "presentation.text", null, node.source, false,
        { start: placeholder.start, end: placeholder.end });
    }
    const flow = node.flow;
    switch (flow.kind) {
      case "next":
        if (flow.target !== null) add({ kind: "node", id: flow.target }, "next", "flow.target");
        break;
      case "branch":
        expression(flow.condition, "flow.condition", null, node.source);
        add({ kind: "node", id: flow.then }, "branch-then", "flow.then");
        if (flow.otherwise !== null) add({ kind: "node", id: flow.otherwise }, "branch-otherwise", "flow.otherwise");
        break;
      case "ending": add({ kind: "ending", id: flow.endingId }, "ending", "flow.endingId"); break;
      case "choice":
        flow.choices.forEach((choice, choiceIndex) => {
          const path = `flow.choices.${choiceIndex}`;
          expression(choice.condition, `${path}.condition`, choice.id, choice.source);
          actions(choice.actions, `${path}.actions`, choice.id, choice.source);
          if (choice.target !== null) add({ kind: "node", id: choice.target }, "choice-target", `${path}.target`, choice.id, choice.source);
        });
        if (flow.emptyTarget !== null) add({ kind: "node", id: flow.emptyTarget }, "empty-target", "flow.emptyTarget");
        if (flow.timeout) add({ kind: "choice", nodeId: node.id, id: flow.timeout.choiceId }, "timeout-default", "flow.timeout.choiceId");
        break;
    }
  });
  references.push(...(options.additional ?? []));
  const incoming = new Map<string, ContentReference[]>();
  const outgoing = new Map<string, ContentReference[]>();
  for (const reference of references) {
    const key = referenceKey(reference.target);
    const frozen: ContentReference = Object.freeze({
      ...reference, target: Object.freeze({ ...reference.target }), source: Object.freeze({ ...reference.source }),
      ...(reference.range ? { range: Object.freeze({ ...reference.range }) } : {}), resolved: declared.has(key),
    });
    const uses = incoming.get(key) ?? [];
    uses.push(frozen);
    incoming.set(key, uses);
    if (reference.nodeId !== null) {
      const from = outgoing.get(reference.nodeId) ?? [];
      from.push(frozen);
      outgoing.set(reference.nodeId, from);
    }
    // Unknown dialogue placeholders remain literal; expose them for lookup instead of inventing a declaration.
    if (!catalogKeys.has(key)) {
      catalogKeys.add(key);
      definitions.push(Object.freeze({ target: frozen.target, label: "未解析的引用（不是已声明定义）" }));
    }
  }
  const catalog = Object.freeze(definitions);
  const none: readonly ContentReference[] = Object.freeze([]);
  for (const values of incoming.values()) Object.freeze(values);
  for (const values of outgoing.values()) Object.freeze(values);
  return Object.freeze({
    workId: content.workId, revision: content.revision,
    definitions: () => catalog,
    outgoing: (nodeId: string) => outgoing.get(nodeId) ?? none,
    incoming: (target: ReferenceTarget) => incoming.get(referenceKey(target)) ?? none,
  });
}
