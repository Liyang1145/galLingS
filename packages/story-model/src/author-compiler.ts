import { CONTENT_FORMAT, PLAYER_VARIABLES } from "./model.ts";
import type {
  Choice, JsonObject, Resource, SourceLocation, StoryContent, StoryNode, Value, ValueType,
} from "./model.ts";
import { localPath, nonempty, oneOf } from "./content.ts";
import { AUTHOR_FILE, authorLocation } from "./author-location.ts";
import type { AuthorCompilerInput } from "./author-workspace.ts";
import { compileAuthorChoice } from "./author-choice.ts";
import { compileAuthorLogic } from "./author-logic.ts";
import type { VariableTypes } from "./expression.ts";
import {
  array, at, boolean, json, jsonObject, knownFields, numeric, object, optionalString, reject, string,
} from "./read.ts";

const SOURCE = AUTHOR_FILE;
const ROOT: SourceLocation = { file: SOURCE, field: "" };
const LINE_FIELDS = [
  "id", "label", "speaker", "text", "bg", "sprites", "set", "choices", "jump", "jumpIf",
  "ending", "ctime", "cdef", "agent", "trans", "fx", "mood", "wait", "acts", "voice", "se",
  "bgm", "amb", "ambv", "amb2", "amb2v", "ambience", "seEvents", "_seGain",
  "_musicCue", "_musicFadeOutMs", "typeMul", "holdMs", "motionCount",
];
const CHOICE_FIELDS = ["id", "text", "target", "cond", "set"];
const SPRITE_FIELDS = ["uid", "asset", "x", "y", "h", "flip", "in", "out", "look", "poseSwitch"];

/** Compile human-authored expressions and stable references, never execute author code. */
export function compileAuthorProject(project: AuthorCompilerInput): StoryContent {
  const definitions = project.variables.map((item, index) => {
    const where = authorLocation("variables.json", String(index));
    const variable = object(item, where);
    knownFields(variable, ["name", "type", "initial"], where);
    const name = string(variable.name, at(where, "name"));
    if (!/^[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*$/u.test(name)) reject("VARIABLE", "变量名不合法", where);
    if ((PLAYER_VARIABLES as readonly string[]).includes(name)) reject("VARIABLE", "变量名与只读玩家投影冲突", where);
    const type = oneOf(variable.type, ["number", "string", "boolean"] as const, at(where, "type"));
    const initial: Value = typeof variable.initial === "string" || typeof variable.initial === "boolean"
      ? variable.initial : numeric(variable.initial, at(where, "initial"));
    if (typeof initial !== type) reject("VARIABLE", "变量声明类型与初值不一致", where);
    return { name, type, initial };
  });
  const writable: Record<string, ValueType> = Object.create(null) as Record<string, ValueType>;
  for (const variable of definitions) {
    if (Object.hasOwn(writable, variable.name)) reject("VARIABLE", "变量重复", authorLocation("variables.json"));
    writable[variable.name] = variable.type;
  }
  const readable: VariableTypes = { ...writable, "周目": "number", "结局数": "number" };
  const resources: Resource[] = [];
  const resourceMap = new Map<string, Resource>();
  for (const { key, record: asset, where } of project.assets) {
    const id = string(asset.id, at(where, "id"));
    if (id !== key || !id) reject("ASSET_ID", "资源键必须等于非空资源 ID", where);
    const kind = string(asset.type, at(where, "type"));
    if (!["bg", "ch", "bgm", "se", "vo"].includes(kind)) reject("ASSET_KIND", "未支持资源种类", where);
    const path = localPath(asset.src, at(where, "src"));
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

  const rawNodes = project.nodes;
  if (!rawNodes.length) reject("EMPTY_STORY", "作品节点不能为空", at(ROOT, "chapters"));
  const nodeIds = new Set<string>();
  const labels = new Map<string, string>();
  const records = rawNodes.map(({ record, where, chapter }) => {
    const id = nonempty(record.id, at(where, "id"));
    knownFields(record, LINE_FIELDS, where);
    if (!id || nodeIds.has(id)) reject("NODE_ID", "空白或重复节点 ID", where);
    nodeIds.add(id);
    const label = optionalString(record.label, at(where, "label"));
    if (label) {
      if (labels.has(label)) reject("LABEL", `重复标签「${label}」`, where);
      labels.set(label, id);
    }
    return { id, record, where, label, chapter };
  });
  const usedIdentities = new Set<string>();
  const nodes: StoryNode[] = records.map(({ id, record: line, where, label, chapter }, index) => {
    const loc = (field: string): SourceLocation => at(where, field);
    const text = (field: string): string => optionalString(line[field], loc(field));
    if (line.agent !== null && line.agent !== undefined) reject("AGENT_NODE", "新主线不支持内嵌 Agent 节点", loc("agent"));
    const sequential = records[index + 1]?.id ?? null;
    const rawChoices = array(line.choices, loc("choices"));
    const jump = text("jump");
    const ending = text("ending");
    const choices: Choice[] = rawChoices.map((item, choiceIndex) => {
      const source = loc(`choices.${choiceIndex}`);
      const record = object(item, source);
      knownFields(record, CHOICE_FIELDS, source);
      const choice = {
        id: nonempty(record.id, at(source, "id")),
        text: string(record.text, at(source, "text")),
        target: optionalString(record.target, at(source, "target")),
        cond: optionalString(record.cond, at(source, "cond")),
        set: optionalString(record.set, at(source, "set")),
      };
      if (usedIdentities.has(choice.id)) {
        reject("CHOICE_ID", "选项身份重复；改文字或移动位置不能重新分配已有身份", source);
      }
      usedIdentities.add(choice.id);
      return compileAuthorChoice(choice, { source, writable, readable, nodeIds, sequential });
    });
    const logic = compileAuthorLogic({
      set: text("set"), jump, jumpIf: text("jumpIf"), ending,
      ctime: nonNegative(line.ctime, loc("ctime")), cdef: text("cdef"),
    }, choices, { source: where, writable, readable, nodeIds, sequential });
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
      id, label, chapter, source: where, enter: logic.enter, flow: logic.flow,
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
  const entryNodeId = project.entryNodeId;
  if (!nodeIds.has(entryNodeId)) reject("TARGET", `不存在入口节点「${entryNodeId}」`, at(ROOT, "entryNodeId"));
  return {
    format: CONTENT_FORMAT, workId: project.workId, title: project.title, revision: "pending", entryNodeId,
    variables: definitions, nodes, resources,
    source: { file: SOURCE, sha256: project.sourceSha256, settings: project.settings, metadata: project.metadata },
  };
}
