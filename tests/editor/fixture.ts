import { assembleAuthorProject, RESOURCE_FILES } from "../../tools/content/source.ts";
import type { AuthorProject } from "../../tools/content/source.ts";
import { compileAuthorProject } from "../../tools/content/compile.ts";
import { authorFields } from "../../tools/editor/patch.ts";
import { authorWorkspace } from "../../tools/editor/workspace.ts";
import type { AuthorDraftBase } from "../../packages/story-model/src/author-draft.ts";
import { createHash } from "node:crypto";
import { contentRevisionText } from "../../packages/story-model/src/integrity.ts";

export function fixture(): AuthorProject {
  const node = (id: string) => ({
    id, label: id, speaker: "鲸鱼小姐", text: `节点 ${id}`, set: "", jump: "", jumpIf: "", ending: "",
    sprites: [], choices: [], ctime: 0, cdef: "", acts: {},
  });
  const nodes = [
    node("start"),
    {
      ...node("menu"), ctime: 5, cdef: "choice-a",
      choices: [
        { id: "choice-a", text: "相同文字", target: "", cond: "", set: "" },
        { id: "choice-b", text: "相同文字", target: "end", cond: "", set: "好感 += 1" },
      ],
    },
    { ...node("end"), ending: "完成" },
  ];
  const values: Record<string, unknown> = {
    "project.json": {
      format: "haifeng.author-project/1", workId: "editor-fixture", title: "编辑器试用",
      entryNodeId: "start", chapters: [{ id: "trial", file: "chapters/trial.json" }],
    },
    "variables.json": [{ name: "好感", type: "number", initial: 0 }],
    "settings.json": {},
    "origins.json": { format: "haifeng.author-origins/1", migration: {}, metadata: {} },
    "resources/index.json": [],
    "chapters/trial.json": { format: "haifeng.author-chapter/1", id: "trial", title: "试用章", nodes },
  };
  for (const file of RESOURCE_FILES) values[file] = {};
  const files = new Map(Object.entries(values).map(([file, value]) => {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    return [file, Buffer.from(file.startsWith("chapters/") ? `\uFEFF${text.replace(/\n/gu, "\r\n")}` : text)];
  }));
  return assembleAuthorProject(files);
}

export function compile(project: AuthorProject) {
  const content = compileAuthorProject(project);
  return { ...content, revision: createHash("sha256").update(contentRevisionText(content, [])).digest("hex") };
}

export function base(project: AuthorProject): AuthorDraftBase {
  const fields = authorFields(project);
  return { sourceSha256: project.sourceSha256, nodes: project.nodes.map(node => ({
    id: String(node.record.id), fields: fields[String(node.record.id)]!,
  })) };
}

export function documentFor(project: AuthorProject) {
  return { content: compile(project), sourceSha256: project.sourceSha256, editable: authorFields(project), workspace: authorWorkspace(project), locations: {}, backup: null };
}
