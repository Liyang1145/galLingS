import { CONTENT_FORMAT, PLAYER_VARIABLES } from "../../packages/story-model/src/model.ts";
import type {
  Choice, Flow, JsonObject, Resource, SourceLocation, StoryContent, StoryNode, Value, ValueType,
} from "../../packages/story-model/src/model.ts";
import { parseAssignments, parseExpression } from "../../packages/story-model/src/expression.ts";
import type { VariableTypes } from "../../packages/story-model/src/expression.ts";
import {
  array, at, boolean, json, jsonObject, knownFields, numeric, object, optionalString, reject, string,
} from "../../packages/story-model/src/read.ts";

const SOURCE = "海风与布丁/game.js";
const ROOT: SourceLocation = { file: SOURCE, field: "" };
const LINE_FIELDS = [
  "id", "label", "chapter", "speaker", "text", "bg", "sprites", "set", "choices", "jump", "jumpIf",
  "ending", "ctime", "cdef", "agent", "trans", "fx", "mood", "wait", "acts", "voice", "se",
  "bgm", "amb", "ambv", "amb2", "amb2v", "ambience", "seEvents", "_seGain",
  "_musicCue", "_musicFadeOutMs", "typeMul", "holdMs", "motionCount",
];
const CHOICE_FIELDS = ["text", "target", "cond", "set"];
const SPRITE_FIELDS = ["uid", "asset", "x", "y", "h", "flip", "in", "out", "look", "poseSwitch"];

export interface ChoiceIdentity {
  id: string;
  nodeId: string;
  sourceIndex: number;
  legacy: { text: string; target: string; cond: string; set: string };
}

export function readLegacyExport(text: string): unknown {
  const prefix = /^\uFEFF?\s*window\.VN_GAME\s*=\s*/u.exec(text);
  if (!prefix) return reject("LEGACY_WRAPPER", "只接受 window.VN_GAME = 纯 JSON 的导出", ROOT);
  const payload = text.slice(prefix[0].length).trim().replace(/;\s*$/u, "");
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return reject("LEGACY_JSON", "导出不是单个纯 JSON 对象，禁止执行 JavaScript 读取", ROOT);
  }
}

export function parseChoiceIdentities(value: unknown): ChoiceIdentity[] {
  const source = { file: "docs/rebuild/baseline/choices.json", field: "" };
  const ids = new Set<string>();
  return array(value, source).map((item, index) => {
    const where = at(source, String(index));
    const entry = object(item, where);
    knownFields(entry, ["id", "nodeId", "sourceIndex", "legacy"], where);
    const id = string(entry.id, at(where, "id"));
    if (!id || ids.has(id)) reject("CHOICE_ID", "空白或重复选项 ID", where);
    ids.add(id);
    const legacy = object(entry.legacy, at(where, "legacy"));
    knownFields(legacy, CHOICE_FIELDS, at(where, "legacy"));
    const sourceIndex = numeric(entry.sourceIndex, at(where, "sourceIndex"));
    if (!Number.isSafeInteger(sourceIndex) || sourceIndex < 0) reject("CHOICE_ID", "来源下标无效", where);
    return {
      id, nodeId: string(entry.nodeId, at(where, "nodeId")), sourceIndex,
      legacy: {
        text: string(legacy.text, at(where, "legacy.text")),
        target: string(legacy.target, at(where, "legacy.target")),
        cond: string(legacy.cond, at(where, "legacy.cond")),
        set: string(legacy.set, at(where, "legacy.set")),
      },
    };
  });
}

function choiceKey(nodeId: string, choice: ChoiceIdentity["legacy"]): string {
  return JSON.stringify([nodeId, choice.text, choice.target, choice.cond, choice.set]);
}

export { canonical } from "../../packages/story-model/src/integrity.ts";

/** No filesystem, globals, DOM or execution of the legacy interpreter. */
export function convertLegacyGame(
  input: unknown,
  identities: readonly ChoiceIdentity[],
  sourceSha256: string,
  revision: string,
): StoryContent {
  const game = object(input, ROOT);
  if (game.v !== 3) reject("LEGACY_VERSION", "只支持当前已记录的 VN Studio v3 输入", at(ROOT, "v"));
  const workId = string(game.id, at(ROOT, "id"));
  if (!workId) reject("WORK_ID", "作品 ID 不能为空", at(ROOT, "id"));
  const definitions = array(game.vars, at(ROOT, "vars")).map((item, index) => {
    const where = at(ROOT, `vars.${index}`);
    const variable = object(item, where);
    knownFields(variable, ["name", "init", "global"], where);
    if (boolean(variable.global, at(where, "global"))) {
      reject("GLOBAL_VARIABLE", "可写跨局变量尚未接入，不得当作普通变量迁移", where);
    }
    const name = string(variable.name, at(where, "name"));
    if (!/^[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*$/u.test(name)) reject("VARIABLE", "变量名不合法", where);
    if ((PLAYER_VARIABLES as readonly string[]).includes(name)) reject("VARIABLE", "变量名与只读玩家投影冲突", where);
    const initialText = string(variable.init, at(where, "init")).trim();
    const initial: Value = initialText === "true" ? true : initialText === "false" ? false
      : initialText !== "" && Number.isFinite(Number(initialText)) ? Number(initialText) : initialText;
    return { name, type: typeof initial as ValueType, initial };
  });
  const writable: Record<string, ValueType> = Object.create(null) as Record<string, ValueType>;
  for (const variable of definitions) {
    if (Object.hasOwn(writable, variable.name)) reject("VARIABLE", "变量重复", at(ROOT, "vars"));
    writable[variable.name] = variable.type;
  }
  const readable: VariableTypes = { ...writable, "周目": "number", "结局数": "number" };
  const resources: Resource[] = [];
  const resourceMap = new Map<string, Resource>();
  for (const [key, value] of Object.entries(object(game.assets, at(ROOT, "assets")))) {
    const where = at(ROOT, `assets.${key}`);
    const asset = object(value, where);
    const id = string(asset.id, at(where, "id"));
    if (id !== key || !id) reject("ASSET_ID", "资源键必须等于非空资源 ID", where);
    const kind = string(asset.type, at(where, "type"));
    if (!["bg", "ch", "bgm", "se", "vo"].includes(kind)) reject("ASSET_KIND", "未支持资源种类", where);
    const path = string(asset.src, at(where, "src"));
    let decoded: string;
    try { decoded = decodeURIComponent(path); }
    catch { return reject("ASSET_PATH", "资源路径编码无效", where); }
    if (!path || /[\\:?#\u0000-\u001f]/u.test(decoded) || decoded.startsWith("/")
      || decoded.split("/").some(part => part === ".." || part === "." || part === "")) {
      reject("ASSET_PATH", "资源必须使用不含上级跳转的本地相对路径", where);
    }
    const metadata = jsonObject(
      Object.fromEntries(Object.entries(asset).filter(([field]) => !["id", "type", "src"].includes(field))), where,
    );
    const resource: Resource = { id, kind: kind as Resource["kind"], path, metadata };
    resources.push(resource);
    resourceMap.set(id, resource);
  }
  function resourceId(value: unknown, where: SourceLocation, kinds: Resource["kind"][]): string | null {
    const id = optionalString(value, where);
    if (!id) return null;
    const resource = resourceMap.get(id);
    if (!resource || !kinds.includes(resource.kind)) reject("ASSET_REFERENCE", `资源「${id}」不存在或种类不匹配`, where);
    return id;
  }
  function nonNegative(value: unknown, where: SourceLocation, fallback = 0): number {
    const n = numeric(value, where, fallback);
    if (n < 0) reject("RANGE", "值不能为负数", where);
    return n;
  }

  const rawNodes = array(game.lines, at(ROOT, "lines"));
  if (!rawNodes.length) reject("EMPTY_STORY", "作品节点不能为空", at(ROOT, "lines"));
  const nodeIds = new Set<string>();
  const labels = new Map<string, string>();
  const records = rawNodes.map((item, index) => {
    const base = at(ROOT, `lines.${index}`);
    const record = object(item, base);
    const id = string(record.id, at(base, "id"));
    const where: SourceLocation = { ...base, nodeId: id, index };
    knownFields(record, LINE_FIELDS, where);
    if (!id || nodeIds.has(id)) reject("NODE_ID", "空白或重复节点 ID", where);
    nodeIds.add(id);
    const label = optionalString(record.label, at(where, "label"));
    if (label) {
      if (labels.has(label)) reject("LABEL", `重复标签「${label}」`, where);
      labels.set(label, id);
    }
    return { id, record, where, label };
  });
  const labelTarget = (label: string, where: SourceLocation): string => {
    const target = labels.get(label);
    if (!target) return reject("TARGET", `不存在目标标签「${label}」`, where);
    return target;
  };
  const identityMap = new Map<string, ChoiceIdentity>();
  for (const identity of identities) {
    const key = choiceKey(identity.nodeId, identity.legacy);
    if (identityMap.has(key)) reject("CHOICE_MAPPING", "选项映射存在歧义，需显式维护身份", ROOT);
    identityMap.set(key, identity);
  }
  const usedIdentities = new Set<string>();
  const nodes: StoryNode[] = records.map(({ id, record: line, where, label }, index) => {
    const loc = (field: string): SourceLocation => at(where, field);
    const text = (field: string): string => optionalString(line[field], loc(field));
    if (line.agent !== null && line.agent !== undefined) reject("AGENT_NODE", "新主线不支持内嵌 Agent 节点", loc("agent"));
    const sequential = records[index + 1]?.id ?? null;
    const rawChoices = array(line.choices, loc("choices"));
    const jump = text("jump");
    const ending = text("ending");
    if ((rawChoices.length && (jump || ending)) || (jump && ending)) {
      reject("FLOW_CONFLICT", "选择、跳转与结局存在冲突，需显式处理而非猜优先级", where);
    }
    const actions = (value: string, source: SourceLocation) => parseAssignments(value, writable, readable, source);
    const choices: Choice[] = rawChoices.map((item, choiceIndex) => {
      const source = loc(`choices.${choiceIndex}`);
      const record = object(item, source);
      knownFields(record, CHOICE_FIELDS, source);
      const legacy = {
        text: string(record.text, at(source, "text")),
        target: optionalString(record.target, at(source, "target")),
        cond: optionalString(record.cond, at(source, "cond")),
        set: optionalString(record.set, at(source, "set")),
      };
      const identity = identityMap.get(choiceKey(id, legacy));
      if (!identity || usedIdentities.has(identity.id)) {
        reject("CHOICE_MAPPING", "找不到唯一固定选项身份；请显式更新映射，不按下标重建", source);
      }
      usedIdentities.add(identity.id);
      return {
        id: identity.id, text: legacy.text, condition: parseExpression(legacy.cond, readable, at(source, "cond")),
        actions: actions(legacy.set, at(source, "set")),
        target: legacy.target ? labelTarget(legacy.target, at(source, "target")) : sequential, source,
      };
    });
    const durationMs = nonNegative(line.ctime, loc("ctime")) * 1000;
    const defaultLabel = text("cdef");
    let flow: Flow;
    if (choices.length) {
      let timeout: Extract<Flow, { kind: "choice" }>["timeout"] = null;
      if (durationMs > 0) {
        const defaultTarget = labelTarget(defaultLabel, loc("cdef"));
        const matches = choices.filter(choice => choice.target === defaultTarget);
        if (matches.length !== 1) reject("TIMEOUT_DEFAULT", "超时必须指向唯一的显式默认选项", loc("cdef"));
        timeout = { durationMs, choiceId: matches[0]!.id, unavailable: "error" };
      } else if (defaultLabel) reject("TIMEOUT_DEFAULT", "无倒计时却指定默认选项", loc("cdef"));
      flow = { kind: "choice", choices, emptyTarget: sequential, timeout };
    } else {
      if (durationMs > 0 || defaultLabel) reject("TIMEOUT_DEFAULT", "没有选项的节点不能配置选择倒计时", where);
      flow = ending ? { kind: "ending", endingId: ending }
        : jump ? {
          kind: "branch", condition: parseExpression(text("jumpIf"), readable, loc("jumpIf")),
          then: labelTarget(jump, loc("jump")), otherwise: sequential,
        } : { kind: "next", target: sequential };
    }
    if (!jump && text("jumpIf")) reject("FLOW_CONFLICT", "存在条件却没有跳转目标", loc("jumpIf"));
    const sprites = array(line.sprites, loc("sprites")).map((item, spriteIndex) => {
      const source = loc(`sprites.${spriteIndex}`);
      const sprite = object(item, source);
      knownFields(sprite, SPRITE_FIELDS, source);
      const assetId = resourceId(sprite.asset, at(source, "asset"), ["ch"]);
      if (!assetId) reject("SPRITE", "立绘资源不能为空", source);
      const height = nonNegative(sprite.h, at(source, "h"));
      if (height === 0) reject("SPRITE", "立绘高度必须大于零", source);
      return {
        id: string(sprite.uid, at(source, "uid")), assetId,
        x: numeric(sprite.x, at(source, "x")), y: numeric(sprite.y, at(source, "y")), height,
        flipped: boolean(sprite.flip, at(source, "flip")),
        enter: optionalString(sprite.in, at(source, "in")), exit: optionalString(sprite.out, at(source, "out")),
        look: optionalString(sprite.look, at(source, "look")),
        poseSwitch: sprite.poseSwitch === undefined ? null : json(sprite.poseSwitch, at(source, "poseSwitch")),
      };
    });
    if (new Set(sprites.map(sprite => sprite.id)).size !== sprites.length || sprites.some(sprite => !sprite.id)) {
      reject("SPRITE_ID", "同场景的立绘实例 ID 必须非空且唯一", loc("sprites"));
    }
    const ambience = array(line.ambience ?? [], loc("ambience")).map((item, ambienceIndex) => {
      const source = loc(`ambience.${ambienceIndex}`);
      const track = object(item, source);
      knownFields(track, ["id", "gain"], source);
      const assetId = resourceId(track.id, at(source, "id"), ["se"]);
      if (!assetId) reject("AMBIENCE", "环境声资源不能为空", source);
      return { assetId, gain: nonNegative(track.gain, at(source, "gain"), 1) };
    });
    if (new Set(ambience.map(track => track.assetId)).size !== ambience.length) reject("AMBIENCE", "环境声重复", loc("ambience"));
    const sounds = array(line.seEvents ?? [], loc("seEvents")).map((item, soundIndex) => {
      const source = loc(`seEvents.${soundIndex}`);
      const effect = object(item, source);
      knownFields(effect, ["id", "gain", "delayMs"], source);
      const assetId = resourceId(effect.id, at(source, "id"), ["se"]);
      if (!assetId) reject("SOUND", "音效资源不能为空", source);
      return {
        assetId, gain: nonNegative(effect.gain, at(source, "gain"), 1),
        delayMs: nonNegative(effect.delayMs, at(source, "delayMs")),
      };
    });
    const legacySound = resourceId(line.se, loc("se"), ["se"]);
    if (legacySound) sounds.unshift({ assetId: legacySound, gain: nonNegative(line._seGain, loc("_seGain"), 1), delayMs: 0 });
    const actorActions = Object.fromEntries(Object.entries(object(line.acts ?? {}, loc("acts")))
      .map(([actor, action]) => [actor, string(action, loc(`acts.${actor}`))]));
    const musicId = resourceId(line.bgm, loc("bgm"), ["bgm"]);
    const fadeMs = nonNegative(line._musicFadeOutMs, loc("_musicFadeOutMs"), 600);
    const typeMultiplier = nonNegative(line.typeMul, loc("typeMul"), 1);
    if (!typeMultiplier) reject("TYPE_SPEED", "打字倍率必须大于零", loc("typeMul"));
    const sourceHints: JsonObject = {};
    for (const field of ["amb", "ambv", "amb2", "amb2v", "_musicCue", "motionCount"]) {
      if (line[field] !== undefined) sourceHints[field] = json(line[field], loc(field));
    }
    return {
      id, label, chapter: text("chapter"), source: where, enter: actions(text("set"), loc("set")), flow,
      presentation: {
        speaker: text("speaker"), text: text("text"),
        scene: {
          background: resourceId(line.bg, loc("bg"), ["bg"]), sprites, mood: text("mood"),
          music: musicId ? { kind: "play", assetId: musicId, continuity: "continue", fadeMs } : { kind: "stop", fadeMs },
          ambience,
        },
        performance: {
          transition: text("trans"), screenEffect: text("fx"), actorActions,
          voiceId: resourceId(line.voice, loc("voice"), ["vo"]), sounds,
          waitMs: nonNegative(line.wait, loc("wait")) * 1000, typeMultiplier,
          holdMs: nonNegative(line.holdMs, loc("holdMs")), sourceHints,
        },
      },
    };
  });
  if (usedIdentities.size !== identities.length) reject("CHOICE_MAPPING", "存在未消费的旧选项映射；删除/修改选项必须显式处理", ROOT);
  const entryNodeId = nodes.find(node => node.chapter)?.id ?? nodes[0]!.id;
  const settings = jsonObject(game.settings, at(ROOT, "settings"));
  const metadata = jsonObject(Object.fromEntries(
    Object.entries(game).filter(([field]) => !["id", "title", "vars", "lines", "assets", "settings"].includes(field)),
  ), ROOT);
  return {
    format: CONTENT_FORMAT, workId, title: string(game.title, at(ROOT, "title")), revision, entryNodeId,
    variables: definitions, nodes, resources,
    source: { file: SOURCE, sha256: sourceSha256, settings, metadata },
  };
}
