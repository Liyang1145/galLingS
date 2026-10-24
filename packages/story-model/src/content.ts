import { CONTENT_FORMAT, PLAYER_VARIABLES } from "./model.ts";
import type {
  Assignment, Expression, Flow, Presentation, Resource, SourceLocation, StoryContent, StoryNode, Value, ValueType,
} from "./model.ts";
import { expressionType } from "./expression.ts";
import { array, at, json, jsonObject, knownFields, numeric, object, reject, string } from "./read.ts";

export function oneOf<T extends string>(input: unknown, values: readonly T[], source: SourceLocation): T {
  const value = string(input, source);
  const found = values.find(item => item === value);
  if (found === undefined) reject("CONTENT_ENUM", `不支持的值「${value}」`, source);
  return found;
}

export function nonempty(input: unknown, source: SourceLocation): string {
  const value = string(input, source);
  if (!value.trim()) reject("CONTENT_EMPTY", "标识不能为空", source);
  return value;
}

export function nonnegative(input: unknown, source: SourceLocation): number {
  const value = numeric(input, source);
  if (value < 0) reject("CONTENT_RANGE", "值不能为负数", source);
  return value;
}

export function hash(input: unknown, source: SourceLocation): string {
  const value = string(input, source);
  if (!/^[a-f0-9]{64}$/u.test(value)) reject("CONTENT_HASH", "需要完整的小写 SHA-256", source);
  return value;
}

/** Paths are data, never absolute locations, URLs or parent-directory escapes. */
export function localPath(input: unknown, source: SourceLocation): string {
  const value = nonempty(input, source);
  let decoded: string;
  try { decoded = decodeURIComponent(value); }
  catch { return reject("CONTENT_PATH", "相对路径编码无效", source); }
  if (/[\\:?#\u0000-\u001f\u007f]/u.test(decoded) || decoded.startsWith("/")
    || decoded.split("/").some(part => !part || part === "." || part === "..")
    || /%[a-f0-9]{2}/iu.test(decoded)) {
    reject("CONTENT_PATH", "需要不含跳转、协议或重复编码的本地相对路径", source);
  }
  return value;
}

export function readSourceLocation(input: unknown, source: SourceLocation): SourceLocation {
  const data = object(input, source);
  knownFields(data, ["file", "field", "nodeId", "index"], source);
  const result: SourceLocation = {
    file: localPath(data.file, at(source, "file")), field: string(data.field, at(source, "field")),
  };
  if (data.nodeId !== undefined) result.nodeId = nonempty(data.nodeId, at(source, "nodeId"));
  if (data.index !== undefined) {
    const index = nonnegative(data.index, at(source, "index"));
    if (!Number.isSafeInteger(index)) reject("CONTENT_SOURCE", "来源下标必须是整数", source);
    result.index = index;
  }
  return result;
}

function flag(input: unknown, source: SourceLocation): boolean {
  if (typeof input !== "boolean") reject("CONTENT_BOOLEAN", "需要明确的布尔值", source);
  return input;
}

function value(input: unknown, source: SourceLocation): Value {
  if (typeof input === "boolean" || typeof input === "string") return input;
  return numeric(input, source);
}

/** Decode external normalized JSON; no conversion through the legacy interpreter. */
export function readStoryContent(input: unknown, file = "content/story.json"): StoryContent {
  const root: SourceLocation = { file, field: "" };
  const data = object(input, root);
  knownFields(data, ["format", "workId", "title", "revision", "entryNodeId", "variables", "nodes", "resources", "source"], root);
  if (data.format !== CONTENT_FORMAT) reject("CONTENT_FORMAT", "不支持的剧情内容格式", root);
  const writable: Record<string, ValueType> = Object.create(null) as Record<string, ValueType>;
  const variables = array(data.variables, at(root, "variables")).map((input, index) => {
    const source = at(root, `variables.${index}`);
    const item = object(input, source);
    knownFields(item, ["name", "type", "initial"], source);
    const name = nonempty(item.name, at(source, "name"));
    if (!/^[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*$/u.test(name)
      || Object.hasOwn(writable, name) || (PLAYER_VARIABLES as readonly string[]).includes(name)) {
      reject("CONTENT_VARIABLE", "变量名无效、重复或与只读玩家投影冲突", source);
    }
    const type = oneOf(item.type, ["number", "string", "boolean"] as const, at(source, "type"));
    const initial = value(item.initial, at(source, "initial"));
    if (typeof initial !== type) reject("CONTENT_VARIABLE", "变量初值类型不匹配", source);
    writable[name] = type;
    return { name, type, initial };
  });
  const readable = { ...writable, "周目": "number", "结局数": "number" } satisfies Record<string, ValueType>;
  function expression(input: unknown, source: SourceLocation): Expression {
    let count = 0;
    function read(input: unknown, source: SourceLocation, depth: number): Expression {
      if (++count > 4096 || depth > 128) reject("CONTENT_EXPRESSION", "表达式过大或嵌套超过 128 层", source);
      const item = object(input, source);
      switch (item.kind) {
        case "literal":
          knownFields(item, ["kind", "value"], source);
          return { kind: "literal", value: value(item.value, at(source, "value")) };
        case "variable":
          knownFields(item, ["kind", "name"], source);
          return { kind: "variable", name: nonempty(item.name, at(source, "name")) };
        case "unary":
          knownFields(item, ["kind", "operator", "operand"], source);
          return {
            kind: "unary", operator: oneOf(item.operator, ["!", "-"] as const, at(source, "operator")),
            operand: read(item.operand, at(source, "operand"), depth + 1),
          };
        case "binary":
          knownFields(item, ["kind", "operator", "left", "right"], source);
          return {
            kind: "binary",
            operator: oneOf(item.operator, ["+", "-", "*", "/", "==", "!=", ">", "<", ">=", "<=", "&&", "||"] as const, at(source, "operator")),
            left: read(item.left, at(source, "left"), depth + 1),
            right: read(item.right, at(source, "right"), depth + 1),
          };
        default: return reject("CONTENT_EXPRESSION", "未知表达式种类", source);
      }
    }
    const result = read(input, source, 0);
    expressionType(result, readable, source);
    return result;
  }
  function actions(input: unknown, source: SourceLocation): Assignment[] {
    return array(input, source).map((input, index) => {
      const where = at(source, String(index));
      const item = object(input, where);
      knownFields(item, ["name", "operator", "expression"], where);
      const name = nonempty(item.name, at(where, "name"));
      const operator = oneOf(item.operator, ["=", "+=", "-="] as const, at(where, "operator"));
      const result = expression(item.expression, at(where, "expression"));
      const type = expressionType(result, readable, where);
      if (!Object.hasOwn(writable, name) || writable[name] !== type || (operator !== "=" && type !== "number")) {
        reject("CONTENT_ASSIGNMENT", "变量不可写或动作类型不匹配", where);
      }
      return { name, operator, expression: result };
    });
  }
  const resources = array(data.resources, at(root, "resources")).map((input, index): Resource => {
    const source = at(root, `resources.${index}`);
    const item = object(input, source);
    knownFields(item, ["id", "kind", "path", "metadata"], source);
    return {
      id: nonempty(item.id, at(source, "id")),
      kind: oneOf(item.kind, ["bg", "ch", "bgm", "se", "vo"] as const, at(source, "kind")),
      path: localPath(item.path, at(source, "path")), metadata: jsonObject(item.metadata, at(source, "metadata")),
    };
  });
  const resourceMap = new Map(resources.map(resource => [resource.id, resource]));
  if (resourceMap.size !== resources.length) reject("CONTENT_RESOURCE", "资源 ID 重复", at(root, "resources"));
  function resource(input: unknown, kind: Resource["kind"], source: SourceLocation): string {
    const id = nonempty(input, source);
    if (resourceMap.get(id)?.kind !== kind) reject("CONTENT_RESOURCE", `资源「${id}」缺失或种类不匹配`, source);
    return id;
  }
  function presentation(input: unknown, source: SourceLocation): Presentation {
    const item = object(input, source);
    knownFields(item, ["speaker", "text", "scene", "performance"], source);
    const sceneSource = at(source, "scene");
    const scene = object(item.scene, sceneSource);
    knownFields(scene, ["background", "sprites", "mood", "music", "ambience"], sceneSource);
    const sprites = array(scene.sprites, at(sceneSource, "sprites")).map((input, index) => {
      const where = at(sceneSource, `sprites.${index}`);
      const sprite = object(input, where);
      knownFields(sprite, ["id", "assetId", "x", "y", "height", "flipped", "enter", "exit", "look", "poseSwitch"], where);
      const height = nonnegative(sprite.height, at(where, "height"));
      if (!height) reject("CONTENT_SPRITE", "立绘高度必须大于零", where);
      return {
        id: nonempty(sprite.id, at(where, "id")), assetId: resource(sprite.assetId, "ch", at(where, "assetId")),
        x: numeric(sprite.x, at(where, "x")), y: numeric(sprite.y, at(where, "y")), height,
        flipped: flag(sprite.flipped, at(where, "flipped")),
        enter: string(sprite.enter, at(where, "enter")), exit: string(sprite.exit, at(where, "exit")),
        look: string(sprite.look, at(where, "look")), poseSwitch: json(sprite.poseSwitch, at(where, "poseSwitch")),
      };
    });
    if (new Set(sprites.map(sprite => sprite.id)).size !== sprites.length) reject("CONTENT_SPRITE", "同场景立绘实例 ID 重复", sceneSource);
    const musicSource = at(sceneSource, "music");
    const track = object(scene.music, musicSource);
    const musicKind = oneOf(track.kind, ["play", "stop"] as const, at(musicSource, "kind"));
    knownFields(track, musicKind === "play" ? ["kind", "assetId", "continuity", "fadeMs"] : ["kind", "fadeMs"], musicSource);
    const fadeMs = nonnegative(track.fadeMs, at(musicSource, "fadeMs"));
    const music: Presentation["scene"]["music"] = musicKind === "stop" ? { kind: "stop", fadeMs } : {
      kind: "play", assetId: resource(track.assetId, "bgm", at(musicSource, "assetId")),
      continuity: oneOf(track.continuity, ["continue"] as const, at(musicSource, "continuity")), fadeMs,
    };
    const ambience = array(scene.ambience, at(sceneSource, "ambience")).map((input, index) => {
      const where = at(sceneSource, `ambience.${index}`);
      const item = object(input, where);
      knownFields(item, ["assetId", "gain"], where);
      return { assetId: resource(item.assetId, "se", at(where, "assetId")), gain: nonnegative(item.gain, at(where, "gain")) };
    });
    if (new Set(ambience.map(track => track.assetId)).size !== ambience.length) reject("CONTENT_MEDIA", "环境声重复", sceneSource);
    const performanceSource = at(source, "performance");
    const performance = object(item.performance, performanceSource);
    knownFields(performance, ["transition", "screenEffect", "actorActions", "voiceId", "sounds", "waitMs", "typeMultiplier", "holdMs", "sourceHints"], performanceSource);
    const typeMultiplier = nonnegative(performance.typeMultiplier, at(performanceSource, "typeMultiplier"));
    if (!typeMultiplier) reject("CONTENT_TYPE_SPEED", "打字倍率必须大于零", performanceSource);
    const actorActions = Object.fromEntries(Object.entries(object(performance.actorActions, at(performanceSource, "actorActions")))
      .map(([id, action]) => [id, string(action, at(performanceSource, `actorActions.${id}`))]));
    const sounds = array(performance.sounds, at(performanceSource, "sounds")).map((input, index) => {
      const where = at(performanceSource, `sounds.${index}`);
      const item = object(input, where);
      knownFields(item, ["assetId", "gain", "delayMs"], where);
      return {
        assetId: resource(item.assetId, "se", at(where, "assetId")), gain: nonnegative(item.gain, at(where, "gain")),
        delayMs: nonnegative(item.delayMs, at(where, "delayMs")),
      };
    });
    return {
      speaker: string(item.speaker, at(source, "speaker")), text: string(item.text, at(source, "text")),
      scene: {
        background: scene.background === null ? null : resource(scene.background, "bg", at(sceneSource, "background")),
        sprites, mood: string(scene.mood, at(sceneSource, "mood")), music, ambience,
      },
      performance: {
        transition: string(performance.transition, at(performanceSource, "transition")),
        screenEffect: string(performance.screenEffect, at(performanceSource, "screenEffect")), actorActions,
        voiceId: performance.voiceId === null ? null : resource(performance.voiceId, "vo", at(performanceSource, "voiceId")),
        sounds, waitMs: nonnegative(performance.waitMs, at(performanceSource, "waitMs")), typeMultiplier,
        holdMs: nonnegative(performance.holdMs, at(performanceSource, "holdMs")),
        sourceHints: jsonObject(performance.sourceHints, at(performanceSource, "sourceHints")),
      },
    };
  }
  const references: { id: string; source: SourceLocation }[] = [];
  const target = (input: unknown, source: SourceLocation): string | null => {
    if (input === null) return null;
    const id = nonempty(input, source);
    references.push({ id, source });
    return id;
  };
  const choiceIds = new Set<string>();
  function flow(input: unknown, source: SourceLocation): Flow {
    const item = object(input, source);
    switch (item.kind) {
      case "next":
        knownFields(item, ["kind", "target"], source);
        return { kind: "next", target: target(item.target, at(source, "target")) };
      case "branch": {
        knownFields(item, ["kind", "condition", "then", "otherwise"], source);
        const then = target(item.then, at(source, "then"));
        if (!then) reject("CONTENT_TARGET", "条件跳转的 then 目标不能为空", source);
        return {
          kind: "branch", condition: expression(item.condition, at(source, "condition")), then,
          otherwise: target(item.otherwise, at(source, "otherwise")),
        };
      }
      case "ending":
        knownFields(item, ["kind", "endingId"], source);
        return { kind: "ending", endingId: nonempty(item.endingId, at(source, "endingId")) };
      case "choice": {
        knownFields(item, ["kind", "choices", "emptyTarget", "timeout"], source);
        const choices = array(item.choices, at(source, "choices")).map((input, index) => {
          const where = at(source, `choices.${index}`);
          const choice = object(input, where);
          knownFields(choice, ["id", "text", "condition", "actions", "target", "source"], where);
          const id = nonempty(choice.id, at(where, "id"));
          if (choiceIds.has(id)) reject("CONTENT_CHOICE", "选项 ID 重复", where);
          choiceIds.add(id);
          return {
            id, text: string(choice.text, at(where, "text")), condition: expression(choice.condition, at(where, "condition")),
            actions: actions(choice.actions, at(where, "actions")), target: target(choice.target, at(where, "target")),
            source: readSourceLocation(choice.source, at(where, "source")),
          };
        });
        if (!choices.length) reject("CONTENT_CHOICE", "选择节点必须包含选项", source);
        let timeout: Extract<Flow, { kind: "choice" }>["timeout"] = null;
        if (item.timeout !== null) {
          const where = at(source, "timeout");
          const timer = object(item.timeout, where);
          knownFields(timer, ["durationMs", "choiceId", "unavailable"], where);
          const durationMs = nonnegative(timer.durationMs, at(where, "durationMs"));
          const choiceId = nonempty(timer.choiceId, at(where, "choiceId"));
          if (!durationMs || !choices.some(choice => choice.id === choiceId)) reject("CONTENT_TIMEOUT", "超时长或默认选项无效", where);
          timeout = { durationMs, choiceId, unavailable: oneOf(timer.unavailable, ["error"] as const, at(where, "unavailable")) };
        }
        return { kind: "choice", choices, emptyTarget: target(item.emptyTarget, at(source, "emptyTarget")), timeout };
      }
      default: return reject("CONTENT_FLOW", "未知流转种类", source);
    }
  }
  const nodes = array(data.nodes, at(root, "nodes")).map((input, index): StoryNode => {
    const base = at(root, `nodes.${index}`);
    const item = object(input, base);
    knownFields(item, ["id", "label", "chapter", "source", "enter", "presentation", "flow"], base);
    const id = nonempty(item.id, at(base, "id"));
    const where = { ...base, nodeId: id, index };
    return {
      id, label: string(item.label, at(where, "label")), chapter: string(item.chapter, at(where, "chapter")),
      source: readSourceLocation(item.source, at(where, "source")), enter: actions(item.enter, at(where, "enter")),
      presentation: presentation(item.presentation, at(where, "presentation")), flow: flow(item.flow, at(where, "flow")),
    };
  });
  const nodeIds = new Set(nodes.map(node => node.id));
  if (!nodes.length || nodeIds.size !== nodes.length) reject("CONTENT_NODES", "节点为空或 ID 重复", at(root, "nodes"));
  const labels = nodes.map(node => node.label).filter(Boolean);
  if (new Set(labels).size !== labels.length) reject("CONTENT_LABEL", "节点标签重复", at(root, "nodes"));
  const entryNodeId = nonempty(data.entryNodeId, at(root, "entryNodeId"));
  references.push({ id: entryNodeId, source: at(root, "entryNodeId") });
  for (const reference of references) {
    if (!nodeIds.has(reference.id)) reject("CONTENT_TARGET", `目标节点「${reference.id}」不存在`, reference.source);
  }
  const source = at(root, "source");
  const provenance = object(data.source, source);
  knownFields(provenance, ["file", "sha256", "metadata", "settings"], source);
  return {
    format: CONTENT_FORMAT, workId: nonempty(data.workId, at(root, "workId")), title: string(data.title, at(root, "title")),
    revision: hash(data.revision, at(root, "revision")), entryNodeId, variables, nodes, resources,
    source: {
      file: localPath(provenance.file, at(source, "file")), sha256: hash(provenance.sha256, at(source, "sha256")),
      metadata: jsonObject(provenance.metadata, at(source, "metadata")), settings: jsonObject(provenance.settings, at(source, "settings")),
    },
  };
}
