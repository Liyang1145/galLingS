import type { AuthorProject } from "../content/source.ts";
import { assembleAuthorProject, authorLocation, RESOURCE_FILES } from "../content/source.ts";
import { authorJson } from "../content/json.ts";
import type { JsonObject } from "../../packages/story-model/src/model.ts";
import { canonical } from "../../packages/story-model/src/integrity.ts";
import { readAuthorWorkspace, readAuthorWorkspacePatch } from "../../packages/story-model/src/author-workspace.ts";
import type { AuthorWorkspaceModel } from "../../packages/story-model/src/author-workspace.ts";
import { reject } from "../../packages/story-model/src/read.ts";

export function authorWorkspace(project: AuthorProject): AuthorWorkspaceModel {
  const manifest = authorJson(project.files.get("project.json")!, authorLocation("project.json").file).value as {
    chapters: { id: string; file: string }[];
  };
  const origins = authorJson(project.files.get("origins.json")!, authorLocation("origins.json").file).value as JsonObject;
  return readAuthorWorkspace({
    workId: project.workId, title: project.title, entryNodeId: project.entryNodeId,
    chapters: manifest.chapters.map(item => {
      const chapter = authorJson(project.files.get(item.file)!, authorLocation(item.file).file).value as JsonObject;
      return { id: item.id, title: chapter.title, nodes: chapter.nodes };
    }),
    variables: project.variables, settings: project.settings, metadata: project.metadata, migration: origins.migration,
    assets: project.assets.map(({ key, record }) => ({ key, record })),
  });
}

/** Retain exact bytes outside changed values, and raw node/choice tokens when reordering arrays. */
function rewrite(bytes: Uint8Array, next: unknown, file: string): Uint8Array {
  const document = authorJson(bytes, authorLocation(file).file);
  const render = (before: unknown, after: unknown, path: (string | number)[]): string => {
    const token = document.values.get(JSON.stringify(path))!;
    const original = document.text.slice(token.start, token.end);
    if (canonical(before) === canonical(after)) return original;
    if (before && after && !Array.isArray(before) && !Array.isArray(after)
      && typeof before === "object" && typeof after === "object") {
      const old = before as Record<string, unknown>;
      const desired = after as Record<string, unknown>;
      const keys = Object.keys(old);
      if (keys.length === Object.keys(desired).length && keys.every(key => Object.hasOwn(desired, key))) {
        const replacements = keys.map(key => ({
          ...document.values.get(JSON.stringify([...path, key]))!,
          text: render(old[key], desired[key], [...path, key]),
        })).sort((a, b) => b.start - a.start);
        let result = original;
        for (const item of replacements) {
          result = result.slice(0, item.start - token.start) + item.text + result.slice(item.end - token.start);
        }
        return result;
      }
    }
    if (Array.isArray(before) && Array.isArray(after)) {
      const identity = (item: unknown): string | null => item && typeof item === "object" && !Array.isArray(item)
        && "id" in item && typeof item.id === "string" ? item.id : null;
      if (before.length === after.length && before.every((item, index) => identity(item) === identity(after[index]))) {
        const replacements = after.map((item, index) => ({
          ...document.values.get(JSON.stringify([...path, index]))!,
          text: render(before[index], item, [...path, index]),
        })).sort((a, b) => b.start - a.start);
        let result = original;
        for (const item of replacements) result = result.slice(0, item.start - token.start) + item.text + result.slice(item.end - token.start);
        return result;
      }
      const indices = new Map(before.map((item, index) => [identity(item), index]));
      const newline = document.text.includes("\r\n") ? "\r\n" : "\n";
      return "[" + (after.length ? newline + after.map((item, index) => {
        const id = identity(item);
        const oldIndex = id === null ? index < before.length ? index : undefined : indices.get(id);
        return "    " + (oldIndex === undefined ? JSON.stringify(item, null, 2).replace(/\n/gu, newline)
          : render(before[oldIndex], item, [...path, oldIndex]));
      }).join(`,${newline}`) + newline + "  " : "") + "]";
    }
    return JSON.stringify(after);
  };
  const root = document.values.get("[]")!;
  return Buffer.from(document.text.slice(0, root.start) + render(document.value, next, [])
    + document.text.slice(root.end), "utf8");
}

/** Fixed author files only. Chapter paths are derived from validated IDs, never supplied by a client. */
export function prepareWorkspacePatch(original: AuthorProject, input: unknown): {
  updated: AuthorProject; changed: ReadonlyMap<string, Uint8Array | null>;
} {
  const patch = readAuthorWorkspacePatch(input);
  if (patch.sourceSha256 !== original.sourceSha256) {
    reject("AUTHOR_CONFLICT", "作者源已改变，请先导出工程草稿再重新读取", authorLocation("project.json"));
  }
  const model = patch.workspace;
  if (model.workId !== original.workId && !patch.replaceProject) reject("AUTHOR_ID", "导入其他作品须明确采用完整项目替换", authorLocation("project.json"));
  const oldManifest = authorJson(original.files.get("project.json")!, authorLocation("project.json").file).value as JsonObject;
  const registered = oldManifest.chapters as { id: string; file: string }[];
  const paths = new Map(registered.map(item => [item.id, item.file]));
  const nextFiles = new Map(original.files);
  const changed = new Map<string, Uint8Array | null>();
  const put = (file: string, value: unknown): void => {
    const before = original.files.get(file);
    const bytes = before ? rewrite(before, value, file) : Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    nextFiles.set(file, bytes);
    if (!before || Buffer.compare(Buffer.from(before), Buffer.from(bytes))) changed.set(file, bytes);
  };
  const chapters = model.chapters.map(chapter => ({ id: chapter.id, file: paths.get(chapter.id) ?? `chapters/${chapter.id}.json` }));
  put("project.json", { ...oldManifest, workId: model.workId, title: model.title, entryNodeId: model.entryNodeId, chapters });
  for (const [index, chapter] of model.chapters.entries()) {
    put(chapters[index]!.file, { format: "haifeng.author-chapter/1", id: chapter.id, title: chapter.title, nodes: chapter.nodes });
  }
  for (const old of registered) {
    if (!chapters.some(item => item.file === old.file)) { nextFiles.delete(old.file); changed.set(old.file, null); }
  }
  put("variables.json", model.variables);
  put("settings.json", model.settings);
  const origins = authorJson(original.files.get("origins.json")!, authorLocation("origins.json").file).value as JsonObject;
  put("origins.json", { ...origins, metadata: model.metadata, migration: model.migration });
  put("resources/index.json", model.assets.map(asset => asset.key));
  for (const [index, file] of RESOURCE_FILES.entries()) {
    const kind = ["bg", "ch", "bgm", "se", "vo"][index];
    put(file, Object.fromEntries(model.assets.filter(asset => asset.record.type === kind).map(asset => [asset.key, asset.record])));
  }
  // Assembly rejects missing, duplicate or unsupported resource kinds and invalid chapter sets.
  return { updated: assembleAuthorProject(nextFiles), changed };
}
