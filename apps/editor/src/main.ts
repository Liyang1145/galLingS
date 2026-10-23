import { token } from "virtual:haifeng-editor";
import type { AuthorTextEdit, AuthorTextPatch } from "../../../packages/story-model/src/author.ts";
import { readAuthorDocument } from "./document.ts";
import type { AuthorDocument } from "./document.ts";
import { EditorPreview } from "./preview.ts";
import { AuthorDraftImporter } from "./imports.ts";
import type { DraftImportSnapshot } from "./imports.ts";
import { authorTextKey } from "../../../packages/story-model/src/author-draft.ts";
import { downloadDraft } from "./download.ts";
import "../../game/src/style.css";
import "./style.css";

function element<T extends HTMLElement>(id: string, kind: { new(...args: never[]): T }): T {
  const result = document.getElementById(id);
  if (!(result instanceof kind)) throw new Error(`编辑页面缺少元素：${id}`);
  return result;
}
const button = (id: string): HTMLButtonElement => element(id, HTMLButtonElement);
const el = {
  reload: button("reload"), save: button("save"), export: button("export"),
  importFile: element("import-file", HTMLInputElement), importPanel: element("import-panel", HTMLElement),
  discard: element("discard", HTMLInputElement), discardLabel: element("discard-label", HTMLElement),
  message: element("message", HTMLElement), source: element("source-info", HTMLElement),
  search: element("search", HTMLInputElement), count: element("count", HTMLElement),
  nodes: element("nodes", HTMLSelectElement), nodeTitle: element("node-title", HTMLElement),
  speaker: element("speaker", HTMLInputElement), text: element("text", HTMLTextAreaElement),
  fieldNote: element("field-note", HTMLElement), reset: button("reset-node"),
  previewStart: button("preview-start"), previewSelected: button("preview-selected"),
};
const preview = new EditorPreview({
  stage: element("stage", HTMLElement), scene: element("scene", HTMLElement),
  choices: element("choices", HTMLElement), note: element("preview-note", HTMLElement),
  status: element("preview-status", HTMLElement), debug: element("debug", HTMLElement),
  next: button("next"), pause: button("pause"), auto: button("auto"), audio: button("audio"),
  retry: button("retry"), stop: button("stop"),
});
const events = new AbortController();
const drafts = new Map<string, AuthorTextEdit>();
let baseline: AuthorDocument | null = null;
let selected = "";
let revision = 0;
let requestEpoch = 0;
let requestController: AbortController | null = null;
let operation: "load" | "preview" | "save" | null = null;
let disposed = false;
let importer: AuthorDraftImporter | null = null;

function message(value: string, error = false): void {
  el.message.textContent = value;
  el.message.classList.toggle("problem", error);
}

function selectedNode() { return baseline?.content.nodes.find(node => node.id === selected); }
const key = authorTextKey;
function textFor(nodeId: string, field: "speaker" | "text", original: string): string {
  return drafts.get(key(nodeId, field))?.after ?? original;
}
function patch(): AuthorTextPatch {
  if (!baseline) throw new Error("尚未读取作者源");
  return { format: "haifeng.author-text-patch/1", sourceSha256: baseline.sourceSha256, edits: [...drafts.values()] };
}

function controls(): void {
  const locked = operation === "save" || operation === "load";
  const reviewing = !!importer?.active;
  const node = selectedNode();
  const fields = baseline?.editable[selected] ?? [];
  el.reload.disabled = operation !== null || reviewing;
  el.discard.disabled = locked;
  el.discardLabel.hidden = drafts.size === 0;
  el.save.disabled = !baseline || !drafts.size || operation !== null || reviewing;
  el.export.disabled = !baseline || !drafts.size;
  el.previewStart.disabled = !baseline || operation !== null || reviewing;
  el.previewSelected.disabled = !node || operation !== null || reviewing;
  el.reset.disabled = !node || locked;
  el.speaker.disabled = !node || locked || !fields.includes("speaker");
  el.text.disabled = !node || locked || !fields.includes("text");
  el.nodes.disabled = locked;
  el.search.disabled = locked;
  importer?.setEnabled(!!baseline && operation === null);
}

function nodeForm(): void {
  const node = selectedNode();
  if (!node) {
    el.nodeTitle.textContent = "请选择节点";
    el.speaker.value = el.text.value = "";
  } else {
    el.nodeTitle.textContent = `${node.chapter || "未标章节"} · ${node.id}`;
    el.speaker.value = textFor(node.id, "speaker", node.presentation.speaker);
    el.text.value = textFor(node.id, "text", node.presentation.text);
  }
  const fields = baseline?.editable[selected] ?? [];
  el.fieldNote.textContent = fields.length === 2
    ? "仅改已有说话人和对白字符串；选项、变量、流转、素材及演出保留。预览与保存都会调用同一内容转换器。"
    : "缺失或非字符串字段在本片只读，不会自动添加字段。节点 ID、顺序、选项、变量、流转、素材及演出保留。";
  controls();
}

function list(): void {
  const query = el.search.value.trim().toLocaleLowerCase();
  const matches = baseline?.content.nodes.filter(node => [
    node.id, node.chapter, textFor(node.id, "speaker", node.presentation.speaker),
    textFor(node.id, "text", node.presentation.text),
  ].some(value => value.toLocaleLowerCase().includes(query))) ?? [];
  const options = matches.slice(0, 200).map(node => {
    const option = document.createElement("option");
    const edited = drafts.has(key(node.id, "speaker")) || drafts.has(key(node.id, "text"));
    option.value = node.id;
    option.textContent = `${edited ? "＊" : ""}${node.id} · ${node.chapter} · ${textFor(node.id, "text", node.presentation.text).slice(0, 55)}`;
    return option;
  });
  el.nodes.replaceChildren(...options);
  el.nodes.value = selected;
  el.count.textContent = `匹配 ${matches.length} 个节点，显示前 ${Math.min(matches.length, 200)} 个；草稿修改 ${drafts.size} 个字段。`;
}

function change(field: "speaker" | "text"): void {
  const node = selectedNode();
  if (!node || operation === "load" || operation === "save") return;
  if (!baseline?.editable[node.id]?.includes(field)) return;
  const editKey = key(node.id, field);
  const before = node.presentation[field];
  const after = el[field].value;
  if (before === after) drafts.delete(editKey);
  else if (!drafts.has(editKey) && drafts.size >= 1000) {
    el[field].value = before;
    message("本片单次最多修改 1000 个字段；请先保存或导出已有草稿。", true);
    return;
  } else drafts.set(editKey, { nodeId: node.id, field, before, after });
  revision++;
  importer?.invalidate();
  el.discard.checked = false;
  preview.draftChanged();
  list();
  controls();
}

async function request(route: string, input: unknown, signal: AbortSignal): Promise<AuthorDocument> {
  const response = await fetch(`/__editor/${route}`, {
    method: "POST", mode: "same-origin", credentials: "same-origin", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", "X-Haifeng-Editor": token },
    body: JSON.stringify(input),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
      ? value.error : `作者操作失败（${response.status}）`;
    throw new Error(error);
  }
  return readAuthorDocument(value);
}

async function perform(kind: "load" | "preview" | "save", selectedEntry: string | null = null): Promise<void> {
  if (operation || disposed) return;
  if (importer?.active) {
    message("先采用或取消本次导入比较，再读取、预览或保存。");
    return;
  }
  if (kind === "load" && drafts.size && !el.discard.checked) {
    message("先导出需要保留的草稿；要重新读取，请勾选本次丢弃草稿。", true);
    return;
  }
  if (kind !== "load" && !baseline) return;
  if (kind === "save" && !drafts.size) return;
  operation = kind;
  const epoch = ++requestEpoch;
  const draftRevision = revision;
  const controller = new AbortController();
  requestController = controller;
  controls();
  if (kind === "preview") button("stop").disabled = false;
  message(kind === "load" ? "正在读取作者源并转换内容……"
    : kind === "save" ? "正在检查草稿、保留备份并保存到作者源……" : "正在通过同一转换器准备预览……");
  try {
    const result = await request(kind === "load" ? "source" : kind, kind === "load" ? {} : patch(), controller.signal);
    if (disposed || epoch !== requestEpoch) return;
    if (draftRevision !== revision) {
      message("请求期间草稿已变化，未采用旧预览结果；请重新预览当前草稿。");
      return;
    }
    if (kind === "preview") {
      preview.start(result, selectedEntry);
      message("已采用本次草稿修订进行预览，未写入作者源。");
    } else {
      preview.stop();
      baseline = result;
      drafts.clear();
      revision++;
      el.discard.checked = false;
      if (!result.content.nodes.some(node => node.id === selected)) selected = result.content.entryNodeId;
      el.source.textContent = `作者源 SHA-256：${result.sourceSha256}；节点 ${result.content.nodes.length} 个；内容修订：${result.content.revision}`;
      list();
      nodeForm();
      message(kind === "save"
        ? `作者源已保存。原文件备份：${result.backup ?? "未返回备份位置，请检查作品目录"}。预览已停止，请重新预览本次修订。`
        : "已读取当前作者源；编辑保留为本页草稿，保存需点击“保存到作者源”。");
    }
  } catch (error: unknown) {
    if (disposed || epoch !== requestEpoch) return;
    message(`${error instanceof Error ? error.message : "作者操作失败"}${kind === "save"
      ? " 草稿保留；若连接中断，先导出草稿并重新读取确认源文件，不要假定未写入。"
      : " 当前草稿保留。"}`, true);
  } finally {
    if (epoch === requestEpoch) {
      operation = null;
      requestController = null;
      button("stop").disabled = !preview.running;
      controls();
    }
  }
}

const { signal } = events;
el.reload.addEventListener("click", () => { void perform("load"); }, { signal });
el.save.addEventListener("click", () => { void perform("save"); }, { signal });
el.previewStart.addEventListener("click", () => { void perform("preview"); }, { signal });
el.previewSelected.addEventListener("click", () => { if (selected) void perform("preview", selected); }, { signal });
button("stop").addEventListener("click", () => {
  if (operation !== "preview") return;
  ++requestEpoch;
  requestController?.abort();
  operation = null;
  requestController = null;
  controls();
  message("已取消采用预览结果；草稿保留。后台转换若尚未结束，下次请求可能需要稍后重试。");
}, { signal });
el.search.addEventListener("input", list, { signal });
el.nodes.addEventListener("change", () => { selected = el.nodes.value; nodeForm(); }, { signal });
el.speaker.addEventListener("input", () => change("speaker"), { signal });
el.text.addEventListener("input", () => change("text"), { signal });
el.reset.addEventListener("click", () => {
  if (!selected || operation === "load" || operation === "save") return;
  drafts.delete(key(selected, "speaker"));
  drafts.delete(key(selected, "text"));
  revision++;
  importer?.invalidate();
  el.discard.checked = false;
  preview.draftChanged();
  list();
  nodeForm();
}, { signal });
el.export.addEventListener("click", () => {
  if (!baseline || !drafts.size) return;
  downloadDraft(patch());
  message("已请求下载修改草稿；可在本入口重新导入并逐项比较。这是带原摘要的修改记录，不是另一份作者源。");
}, { signal });
window.addEventListener("beforeunload", event => {
  if (drafts.size || importer?.active || operation === "save") { event.preventDefault(); event.returnValue = ""; }
}, { signal });
function dispose(): void {
  if (disposed) return;
  disposed = true;
  ++requestEpoch;
  requestController?.abort();
  preview.dispose();
  importer?.dispose();
  events.abort();
}
window.addEventListener("pagehide", dispose, { once: true, signal });
import.meta.hot?.dispose(dispose);
const importCurrent = (snapshot: DraftImportSnapshot): boolean =>
  !disposed && operation === null && revision === snapshot.revision && baseline?.sourceSha256 === snapshot.base.sourceSha256;
importer = new AuthorDraftImporter({
  input: el.importFile, panel: el.importPanel, changed: controls, notice: value => message(value),
  current: importCurrent,
  capture() {
    const source = baseline;
    if (!source || operation) return null;
    return {
      revision, patch: patch(),
      base: {
        sourceSha256: source.sourceSha256,
        nodes: source.content.nodes.map(node => ({
          id: node.id,
          speaker: source.editable[node.id]?.includes("speaker") ? node.presentation.speaker : null,
          text: source.editable[node.id]?.includes("text") ? node.presentation.text : null,
        })),
      },
    };
  },
  apply(snapshot, result) {
    if (!importCurrent(snapshot) || result.sourceSha256 !== baseline?.sourceSha256) {
      throw new Error("当前源或草稿已改变，请重新导入比较。");
    }
    drafts.clear();
    for (const edit of result.edits) drafts.set(key(edit.nodeId, edit.field), { ...edit });
    revision++;
    el.discard.checked = false;
    preview.draftChanged();
    list();
    nodeForm();
    message("导入结果已采用到当前作者源上的草稿；请预览，确认后再点击“保存到作者源”。");
  },
});
controls();
void perform("load");
