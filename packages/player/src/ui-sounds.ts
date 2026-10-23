import type { StoryContent } from "../../story-model/src/model.ts";
import { at, knownFields, object, reject, string } from "../../story-model/src/read.ts";
import type { RuntimeResult, RuntimeView } from "../../story-runtime/src/index.ts";
import { galleryCatalog } from "./records.ts";

export const UI_SOUND_KEYS = [
  "choiceShow", "choiceConfirm", "timeoutTick", "timeoutSilence",
  "favorUp", "favorDown", "tailfin", "cg", "save", "chapterEnd", "endingNew", "btnClick", "btnHover",
] as const;
export type UiSoundKey = (typeof UI_SOUND_KEYS)[number];
export type UiSounds = Partial<Record<UiSoundKey, string>>;
export type StoryCue = "favorUp" | "favorDown" | "tailfin" | "cg" | "chapterEnd";
export interface ScheduledFeedback {
  cue: StoryCue;
  delayMs: number;
}
export type InteractionFeedback =
  | { type: "choices"; active: boolean; timed: boolean; announce: boolean }
  | { type: "cue"; cue: "choiceConfirm" | "timeoutSilence" | "save" | "endingNew" | StoryCue };

/** Read author resource identities; never manufacture a replacement sound. */
export function readUiSounds(content: StoryContent): UiSounds {
  const source = { file: content.source.file, field: "settings.uiSe" };
  const input = content.source.settings.uiSe;
  if (input === undefined || input === null) return {};
  const data = object(input, source);
  knownFields(data, [...UI_SOUND_KEYS, "favorVar", "tailVar"], source);
  const resources = new Map(content.resources.map(resource => [resource.id, resource]));
  const sounds: UiSounds = {};
  for (const key of UI_SOUND_KEYS) {
    if (data[key] === undefined || data[key] === null || data[key] === "") continue;
    const id = string(data[key], at(source, key));
    if (resources.get(id)?.kind !== "se") {
      reject("UI_SOUND_RESOURCE", `交互提示音需要已登记的音效资源：${id}`, at(source, key));
    }
    sounds[key] = id;
  }
  for (const key of ["favorVar", "tailVar"]) {
    if (data[key] !== undefined && !string(data[key], at(source, key)).trim()) {
      reject("UI_SOUND_VARIABLE", "提示音变量名不能为空", at(source, key));
    }
  }
  return sounds;
}

/** Map already-committed core output to sound cues; never evaluate author actions. */
export class StoryFeedback {
  readonly #sounds: UiSounds;
  readonly #favor: string | null;
  readonly #tail: string | null;
  readonly #cgs: Set<string>;
  readonly #chapterEnds: Set<string>;
  readonly #enterDelay: Map<string, number>;

  constructor(content: StoryContent) {
    this.#sounds = readUiSounds(content);
    const source = { file: content.source.file, field: "settings.uiSe" };
    const input = content.source.settings.uiSe;
    const settings = input === undefined || input === null ? {} : object(input, source);
    const variable = (key: string, fallback: string): string | null => {
      const name = settings[key] === undefined ? fallback : string(settings[key], at(source, key));
      const declared = content.variables.find(item => item.name === name);
      if (declared && declared.type === "number") return name;
      if (settings[key] !== undefined) reject("UI_SOUND_VARIABLE", `提示音需要已声明的数值变量：${name}`, at(source, key));
      return null;
    };
    this.#favor = variable("favorVar", "好感");
    this.#tail = variable("tailVar", "尾鳍");
    this.#cgs = new Set(galleryCatalog(content).cgs.map(resource => resource.id));
    const nodes = new Map(content.nodes.map(node => [node.id, node]));
    this.#chapterEnds = new Set(content.nodes.filter(node => node.flow.kind === "ending"
      || (node.flow.kind === "next" && node.flow.target !== null && !!nodes.get(node.flow.target)?.chapter))
      .map(node => node.id));
    // An immediate authored action sound reserves a short gap before variable feedback.
    this.#enterDelay = new Map(content.nodes.map(node => [
      node.id, node.presentation.performance.sounds.some(sound => sound.delayMs === 0) ? 350 : 0,
    ]));
  }

  transition(before: RuntimeView, result: RuntimeResult): ScheduledFeedback[] {
    if (!result.accepted || result.presentation?.mode !== "enter") return [];
    const cues: ScheduledFeedback[] = [];
    const add = (cue: StoryCue, delayMs = 0): void => {
      if (this.#sounds[cue]) cues.push({ cue, delayMs });
    };
    for (const group of result.variableChanges) {
      const delay = group.origin === "choice" ? 300 : this.#enterDelay.get(group.nodeId) ?? 0;
      const favor = group.changes.find(change => change.name === this.#favor);
      if (favor && typeof favor.before === "number" && typeof favor.after === "number") {
        if (favor.after > favor.before) add("favorUp", delay);
        else if (favor.after < favor.before) add("favorDown", delay);
      }
      const tail = group.changes.find(change => change.name === this.#tail);
      if (tail && typeof tail.before === "number" && typeof tail.after === "number" && tail.after > tail.before) {
        add("tailfin", delay);
      }
    }
    const { scene, text } = result.view.presentation;
    if (scene.background && scene.background !== before.presentation.scene.background && this.#cgs.has(scene.background)) add("cg");
    if (text && this.#chapterEnds.has(result.view.nodeId)) add("chapterEnd");
    return cues;
  }
}
