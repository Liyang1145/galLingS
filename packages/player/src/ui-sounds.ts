import type { StoryContent } from "../../story-model/src/model.ts";
import { at, knownFields, object, reject, string } from "../../story-model/src/read.ts";

export const UI_SOUND_KEYS = [
  "choiceShow", "choiceConfirm", "timeoutTick", "timeoutSilence",
  "favorUp", "favorDown", "tailfin", "cg", "save", "chapterEnd", "endingNew", "btnClick", "btnHover",
] as const;
export type UiSoundKey = (typeof UI_SOUND_KEYS)[number];
export type UiSounds = Partial<Record<UiSoundKey, string>>;
export type InteractionFeedback =
  | { type: "choices"; active: boolean; timed: boolean; announce: boolean }
  | { type: "cue"; cue: "choiceConfirm" | "timeoutSilence" | "save" };

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
  // Variable-related events are preserved for the next feedback slice.
  for (const key of ["favorVar", "tailVar"]) {
    if (data[key] !== undefined && !string(data[key], at(source, key)).trim()) {
      reject("UI_SOUND_VARIABLE", "提示音变量名不能为空", at(source, key));
    }
  }
  return sounds;
}
