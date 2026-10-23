import type { StoryContent } from "../../story-model/src/model.ts";
import type { ReferenceInput } from "../../story-model/src/references.ts";
import { object } from "../../story-model/src/read.ts";
import { readAuthorAppearance } from "./appearance.ts";
import { readFeedbackVariables, readUiSounds, UI_SOUND_KEYS } from "./ui-sounds.ts";

/** Only settings consumed by this shared player. No arbitrary metadata/string ID guessing. */
export function playerReferences(content: StoryContent): readonly ReferenceInput[] {
  const references: ReferenceInput[] = [];
  const appearance = readAuthorAppearance(content);
  const settingsReference = (
    kind: "resource" | "variable", id: string, role: ReferenceInput["role"], field: string, derived = false,
  ): void => {
    references.push({
      target: { kind, id }, nodeId: null, choiceId: null, role,
      path: `source.${field}`, source: { file: content.source.file, field }, derived,
    });
  };
  if (appearance.theme.imageId) settingsReference("resource", appearance.theme.imageId, "theme", "settings.theme.img");
  if (appearance.cover.imageId) {
    if (appearance.cover.configured) settingsReference("resource", appearance.cover.imageId, "cover", "settings.cover.img");
    else {
      const first = content.nodes[0];
      if (first) references.push({
        target: { kind: "resource", id: appearance.cover.imageId }, nodeId: first.id, choiceId: null,
        role: "cover", path: "nodes.0.presentation.scene.background", source: first.source, derived: true,
      });
    }
  }
  const sounds = readUiSounds(content);
  for (const key of UI_SOUND_KEYS) {
    const id = sounds[key];
    if (id) settingsReference("resource", id, "ui-sound", `settings.uiSe.${key}`);
  }
  const variables = readFeedbackVariables(content);
  const input = content.source.settings.uiSe;
  const settings = input === undefined || input === null ? {} : object(input, { file: content.source.file, field: "settings.uiSe" });
  if (variables.favor) settingsReference("variable", variables.favor, "feedback-variable", "settings.uiSe.favorVar", settings.favorVar === undefined);
  if (variables.tail) settingsReference("variable", variables.tail, "feedback-variable", "settings.uiSe.tailVar", settings.tailVar === undefined);
  return Object.freeze(references.map(reference => Object.freeze({
    ...reference, target: Object.freeze({ ...reference.target }), source: Object.freeze({ ...reference.source }),
  })));
}
