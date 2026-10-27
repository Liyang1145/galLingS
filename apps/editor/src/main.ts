import { editorSessionToken } from "./session.ts";
import { authorChoiceField } from "../../../packages/story-model/src/author.ts";
import type { AuthorTextField } from "../../../packages/story-model/src/author.ts";
import { EditorProjectDraft } from "./project-draft.ts";
import { AuthorRequestError, readAuthorDocument, readAuthorFailure } from "./document.ts";
import type { AuthorDocument } from "./document.ts";
import { EditorPreview } from "./preview.ts";
import type { PreviewStart } from "./preview.ts";
import { PreviewCheckpoints } from "./checkpoint-panel.ts";
import { AuthorDraftImporter } from "./imports.ts";
import type { DraftImportSnapshot } from "./imports.ts";
import { AuthorSourceComparison } from "./reconcile.ts";
import { authorTextKey } from "../../../packages/story-model/src/author-draft.ts";
import type { AuthorDraftBase } from "../../../packages/story-model/src/author-draft.ts";
import type { AuthorWorkspaceModel, AuthorWorkspacePatch } from "../../../packages/story-model/src/author-workspace.ts";
import { downloadDraft } from "./download.ts";
import { AuthorReferences } from "./references.ts";
import { AuthorFlow } from "./flow.ts";
import { AuthorChanges } from "./changes.ts";
import { AuthorScene } from "./scene.ts";
import { AuthorDiagnostic } from "./diagnostic.ts";
import type { DiagnosticContext } from "./diagnostic.ts";
import { PreviewProblemPanel } from "./preview-problem.ts";
import { AuthorLogicEditor } from "./logic-editor.ts";
import { AuthorWorkspace } from "./workspace.ts";
import { AuthorStructureEditor } from "./structure.ts";
import { AuthorAssetLibrary } from "./asset-library.ts";
import { AuthorStageEditor } from "./stage-editor.ts";
import { AuthorPerformanceEditor } from "./performance-editor.ts";
import "../../game/src/style.css";
import "./style.css";

type AuthorNode = AuthorDocument["content"]["nodes"][number];

function element<T extends HTMLElement>(id: string, kind: { new(...args: never[]): T }): T {
  const result = document.getElementById(id);
  if (!(result instanceof kind)) throw new Error(`编辑页面缺少元素：${id}`);
  return result;
}
const button = (id: string): HTMLButtonElement => element(id, HTMLButtonElement);
const el = {
  reload: button("reload"), save: button("save"), export: button("export"),
  compare: button("compare-source"), cancelCompare: button("cancel-source-comparison"),
  undo: button("undo-draft"), redo: button("redo-draft"), history: element("draft-history", HTMLElement),
  importFile: element("import-file", HTMLInputElement), importPanel: element("import-panel", HTMLElement),
  discard: element("discard", HTMLInputElement), discardLabel: element("discard-label", HTMLElement),
  message: element("message", HTMLElement), source: element("source-info", HTMLElement),
  search: element("search", HTMLInputElement), count: element("count", HTMLElement),
  nodes: element("nodes", HTMLSelectElement), nodeTitle: element("node-title", HTMLElement),
  nodePrevious: button("nodes-previous"), nodeNext: button("nodes-next"), nodeCurrent: button("nodes-current"),
  nodePage: element("nodes-page", HTMLElement),
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
  controls: element("preview-controls", HTMLElement), hide: button("hide-ui"),
  surface: element("preview-surface", HTMLElement), fullscreen: button("fullscreen"),
  fullscreenStatus: element("fullscreen-status", HTMLElement),
  changed: controls,
  stopped: () => checkpoints?.invalidatePending("预览已停止，未采用旧检查点读取；此前待用数据保留。"),
});
const events = new AbortController();
const createDraftHistory = (): EditorProjectDraft => new EditorProjectDraft({ maxEntries: 100, maxUnits: 2_000_000 });
let drafts = createDraftHistory();
let baseline: AuthorDocument | null = null;
let selected = "";
let revision = 0;
let requestEpoch = 0;
let requestController: AbortController | null = null;
let operation: "load" | "compare" | "preview" | "save" | null = null;
let disposed = false;
let importer: AuthorDraftImporter | null = null;
let sourceComparison: AuthorSourceComparison | null = null;
let references: AuthorReferences | null = null;
let flow: AuthorFlow | null = null;
let checkpoints: PreviewCheckpoints | null = null;
let changes: AuthorChanges | null = null;
let sceneInspector: AuthorScene | null = null;
let authorDiagnostic: AuthorDiagnostic | null = null;
let previewProblem: PreviewProblemPanel | null = null;
let choiceText: AuthorLogicEditor | null = null;
let structureEditor: AuthorStructureEditor | null = null;
let assetLibrary: AuthorAssetLibrary | null = null;
let stageEditor: AuthorStageEditor | null = null;
let performanceEditor: AuthorPerformanceEditor | null = null;
const NODE_PAGE_SIZE = 200;
let nodePage = 0;
let nodeList: {
  source: AuthorDocument | null; revision: number; query: string;
  matches: readonly AuthorNode[];
} | null = null;
const workspace = new AuthorWorkspace({
  root: element("editor", HTMLElement),
  timeline: element("node-timeline", HTMLFieldSetElement),
  cards: element("node-cards", HTMLElement),
  empty: element("preview-empty", HTMLElement),
  select: selectNode,
});

function message(value: string, error = false): void {
  el.message.textContent = value;
  el.message.classList.toggle("problem", error);
}

function selectedNode() { return baseline?.content.nodes.find(node => node.id === selected); }
const key = authorTextKey;
function textFor(nodeId: string, field: AuthorTextField, original: string): string {
  return drafts.get(key(nodeId, field))?.after
    ?? baseline?.editable[nodeId]?.find(entry => entry.field === field)?.value ?? original;
}
function patch(): AuthorWorkspacePatch {
  if (!baseline) throw new Error("尚未读取作者源");
  return drafts.patch();
}
function draftBase(source: AuthorDocument): AuthorDraftBase {
  return {
    sourceSha256: source.sourceSha256,
    nodes: source.content.nodes.map(node => ({
      id: node.id,
      fields: (source.editable[node.id] ?? []).map(entry => ({
        ...entry, value: source === baseline ? drafts.get(key(node.id, entry.field))?.before ?? entry.value : entry.value,
      })),
    })),
  };
}

function sourceBusy(): boolean { return operation === "save" || operation === "load" || operation === "compare"; }

function controls(): void {
  const locked = sourceBusy();
  workspace.setState(!!baseline && !locked && !disposed, preview.running);
  stageEditor?.setState(!!baseline && !locked && !disposed, preview.running);
  assetLibrary?.setEnabled(!!baseline && !locked && !disposed);
  performanceEditor?.setEnabled(!!baseline && !locked && !disposed);
  if (preview.running) assetLibrary?.stopAudio();
  const reviewing = !!importer?.active || !!sourceComparison?.active;
  const node = selectedNode();
  const fields = baseline?.editable[selected] ?? [];
  el.reload.disabled = operation !== null || reviewing;
  el.compare.disabled = !baseline || !drafts.size || drafts.extended || operation !== null || reviewing || !!sourceComparison?.hasRecovery;
  el.compare.title = drafts.extended ? "结构、素材等工程修改请先导出完整工程草稿，再重新读取处理来源差异。" : "";
  el.cancelCompare.hidden = operation !== "compare";
  el.cancelCompare.disabled = operation !== "compare";
  el.discard.disabled = locked;
  el.discardLabel.hidden = drafts.size === 0;
  el.save.disabled = !baseline || !drafts.size || operation !== null || reviewing;
  el.export.disabled = !baseline || !drafts.size;
  const history = drafts.status;
  el.undo.disabled = !baseline || locked || history.undo === null;
  el.redo.disabled = !baseline || locked || history.redo === null;
  el.undo.title = history.undo ? `撤销：${history.undo}` : "没有可撤销的草稿操作";
  el.redo.title = history.redo ? `重做：${history.redo}` : "没有可重做的草稿操作";
  el.history.textContent = `草稿历史：可撤销 ${history.undoSteps} 步，可重做 ${history.redoSteps} 步。`
    + (history.limited ? "较早历史或超过容量的操作已不再保留；当前草稿仍可导出或保存。" : "连续编辑同一字段合为一步；仅在本页保留，保存或重读成功后清空。");
  el.previewStart.disabled = !baseline || operation !== null || reviewing;
  el.previewSelected.disabled = !node || operation !== null || reviewing;
  el.reset.disabled = !node || locked || ![...drafts.values()].some(edit => edit.nodeId === selected);
  el.speaker.disabled = !node || locked || !fields.some(entry => entry.field === "speaker");
  el.text.disabled = !node || locked || !fields.some(entry => entry.field === "text");
  choiceText?.setEnabled(!!node && !locked && !disposed);
  structureEditor?.setEnabled(!!baseline && !locked && !disposed);
  el.nodes.disabled = locked;
  el.search.disabled = locked;
  nodePaging();
  importer?.setEnabled(!!baseline && operation === null && !sourceComparison?.active);
  sourceComparison?.setEnabled(!!baseline && operation === null && !importer?.active);
  references?.setAvailable(!!baseline && !locked);
  flow?.setAvailable(!!baseline && !locked);
  changes?.setAvailable(!!baseline && !locked);
  sceneInspector?.setAvailable(!!baseline && !locked);
  authorDiagnostic?.setAvailable(!disposed && !locked);
  previewProblem?.refresh();
  checkpoints?.setEnabled(!disposed && !!baseline && operation === null && !reviewing);
}

function nodeForm(): void {
  drafts.closeGroup();
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
  el.fieldNote.textContent = "编辑已有对白与逻辑，缺失字段只读。修改仅在本页保留，保存后才写入作者源。";
  choiceText?.show(node, fields);
  references?.select(selected);
  flow?.select(selected);
  controls();
  sceneInspector?.refresh();
  structureEditor?.refresh();
  assetLibrary?.refresh();
  stageEditor?.refresh();
  performanceEditor?.refresh();
}

function changeProject(label: string, update: (model: AuthorWorkspaceModel) => void, nextSelected?: string): void {
  if (disposed || !baseline || sourceBusy()) throw new Error("作者操作进行中，请稍后编辑工程");
  const change = drafts.change(label, update);
  if (!change.changed) return;
  if (nextSelected) selected = nextSelected;
  draftChanged({ refreshForm: true, revealSelected: true });
  message(`${label}已保留到本页草稿${change.overflow ? "；本次操作超出历史容量，未保留撤销记录" : "，可撤销"}。预览确认后再保存。`);
}

function nodePaging(): void {
  const locked = disposed || !baseline || sourceBusy();
  const total = nodeList?.matches.length ?? 0;
  el.nodePrevious.disabled = locked || nodePage === 0;
  el.nodeNext.disabled = locked || (nodePage + 1) * NODE_PAGE_SIZE >= total;
  el.nodeCurrent.disabled = locked || !selectedNode();
}

function list(options: { resetPage?: boolean; revealSelected?: boolean; resetScroll?: boolean } = {}): void {
  const query = el.search.value.trim().toLocaleLowerCase();
  const previousPage = nodePage;
  const sameSource = nodeList?.source === baseline;
  const sameQuery = nodeList?.query === query;
  if (!nodeList || !sameSource || !sameQuery || nodeList.revision !== revision) {
    nodeList = { source: baseline, revision, query, matches: baseline?.content.nodes.filter(node => [
      node.id, node.chapter, textFor(node.id, "speaker", node.presentation.speaker),
      textFor(node.id, "text", node.presentation.text),
      ...(node.flow.kind === "choice" ? node.flow.choices.flatMap(choice => [
        choice.id, ...(["text", "cond", "set", "target"] as const).map(property =>
          textFor(node.id, authorChoiceField(choice.id, property), property === "text" ? choice.text : "")),
      ]) : []),
    ].some(value => value.toLocaleLowerCase().includes(query))) ?? [] };
  }
  const matches = nodeList.matches;
  if (options.resetPage || !sameSource || !sameQuery) nodePage = 0;
  const selectedIndex = matches.findIndex(node => node.id === selected);
  if (options.revealSelected && selectedIndex >= 0) nodePage = Math.floor(selectedIndex / NODE_PAGE_SIZE);
  const pages = Math.ceil(matches.length / NODE_PAGE_SIZE);
  nodePage = Math.min(nodePage, Math.max(0, pages - 1));
  const offset = nodePage * NODE_PAGE_SIZE;
  const visible = matches.slice(offset, offset + NODE_PAGE_SIZE);
  const changedNodes = new Set([...drafts.values()].map(edit => edit.nodeId));
  const optionFor = (node: AuthorNode): HTMLOptionElement => {
    const option = document.createElement("option");
    const edited = changedNodes.has(node.id);
    option.value = node.id;
    option.textContent = `${edited ? "＊" : ""}${node.id} · ${node.chapter} · ${textFor(node.id, "text", node.presentation.text).slice(0, 55)}`;
    return option;
  };
  const rows: (HTMLOptionElement | HTMLOptGroupElement)[] = visible.map(optionFor);
  const current = selectedNode();
  const pinned = !!current && !visible.some(node => node.id === current.id);
  if (current && pinned) {
    const group = document.createElement("optgroup");
    group.label = selectedIndex < 0 ? "当前编辑节点（不匹配筛选）" : "当前编辑节点（不在本页）";
    group.append(optionFor(current));
    rows.unshift(group);
  }
  const scroll = el.nodes.scrollTop;
  el.nodes.replaceChildren(...rows);
  el.nodes.value = selected;
  if (!options.revealSelected) {
    el.nodes.scrollTop = !options.resetPage && !options.resetScroll
      && sameSource && sameQuery && previousPage === nodePage ? scroll : 0;
  }
  const count = !baseline ? "读取作者源后可浏览节点。"
    : `共 ${baseline.content.nodes.length} 个节点，匹配 ${matches.length} 个；`
      + (visible.length ? `本页第 ${offset + 1}～${offset + visible.length} 项。` : "本页没有匹配项。")
      + (pinned ? selectedIndex < 0 ? "当前编辑节点不匹配筛选，另固定显示。" : "当前编辑节点在其他页，另固定显示。" : "")
      + `草稿修改 ${drafts.size} 个字段。`;
  if (el.count.textContent !== count) el.count.textContent = count;
  el.nodePage.textContent = pages ? `第 ${nodePage + 1} / ${pages} 页` : baseline ? "无匹配页" : "尚未读取节点";
  workspace.nodes((current && pinned ? [current, ...visible] : visible).map(node => ({
    id: node.id, chapter: node.chapter,
    speaker: textFor(node.id, "speaker", node.presentation.speaker),
    text: textFor(node.id, "text", node.presentation.text),
    changed: changedNodes.has(node.id), pinned: pinned && node.id === selected,
  })), selected, options.revealSelected === true);
  nodePaging();
}

function selectNode(nodeId: string): void {
  if (disposed || sourceBusy() || !baseline?.content.nodes.some(node => node.id === nodeId)) return;
  const moved = selected !== nodeId;
  selected = nodeId;
  list();
  nodeForm();
  workspace.open("dialogue");
  if (moved) element("panel-dialogue", HTMLElement).scrollTop = 0;
}

function change(field: "speaker" | "text"): void {
  const node = selectedNode();
  if (!node) return;
  try {
    updateText(node.id, field, el[field].value);
  } catch (error: unknown) {
    el[field].value = textFor(node.id, field, node.presentation[field]);
    message(error instanceof Error ? error.message : "草稿修改未采用", true);
  }
}

function updateText(nodeId: string, field: AuthorTextField, after: string): void {
  if (disposed || sourceBusy() || selected !== nodeId || !baseline?.editable[nodeId]?.some(entry => entry.field === field)) {
    throw new Error("当前节点或可编辑字段已改变，未采用旧字段输入。");
  }
  const result = drafts.update(nodeId, field, after, key(nodeId, field));
  if (!result.changed) return;
  draftChanged();
  if (result.overflow) message("草稿已更新；本次操作超过历史容量，未保留撤销记录，可导出当前草稿。");
}

function draftChanged(options: { cancelImport?: boolean; refreshForm?: boolean; revealSelected?: boolean } = {}): void {
  baseline = drafts.document();
  if (!baseline.content.nodes.some(node => node.id === selected)) selected = baseline.content.entryNodeId;
  revision++;
  if (options.cancelImport !== false) importer?.invalidate();
  sourceComparison?.invalidate();
  references?.invalidate();
  flow?.invalidate();
  changes?.invalidate();
  sceneInspector?.invalidate();
  authorDiagnostic?.refresh();
  checkpoints?.invalidatePending("草稿已变化，未采用旧检查点读取；已有待用数据保留，恢复时仍须匹配当前修订。");
  el.discard.checked = false;
  preview.draftChanged();
  previewProblem?.refresh();
  list({ revealSelected: options.revealSelected === true });
  if (options.refreshForm) nodeForm();
  else controls();
  assetLibrary?.refresh();
  stageEditor?.refresh();
  performanceEditor?.refresh();
}

function historyStep(direction: "undo" | "redo"): void {
  if (disposed || !baseline || sourceBusy()) return;
  try {
    const step = direction === "undo" ? drafts.undo() : drafts.redo();
    if (!step) return;
    if (step.nodeId !== null) selected = step.nodeId;
    draftChanged({ refreshForm: true, revealSelected: step.nodeId !== null });
    message(`已${direction === "undo" ? "撤销" : "重做"}：${step.label}。仅更新本页草稿，请重新预览当前修改。`);
  } catch (error: unknown) {
    message(error instanceof Error ? error.message : "草稿历史未采用", true);
  }
}

async function request(route: string, input: unknown, signal: AbortSignal): Promise<AuthorDocument> {
  const response = await fetch(`/__editor/${route}`, {
    method: "POST", mode: "same-origin", credentials: "same-origin", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", "X-Haifeng-Editor": editorSessionToken() },
    body: JSON.stringify(input),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    let failure: AuthorRequestError;
    try { failure = readAuthorFailure(value); }
    catch { throw new Error(`作者操作失败响应无效（${response.status}），未采用其中的诊断定位；保存结果仍须重新读取确认。`); }
    throw failure;
  }
  return readAuthorDocument(value);
}

function adoptSource(result: AuthorDocument, nextDrafts: EditorProjectDraft): void {
  preview.stop();
  drafts.clear();
  drafts = nextDrafts;
  baseline = result;
  revision++;
  references?.invalidate();
  flow?.invalidate();
  changes?.invalidate();
  sceneInspector?.invalidate();
  authorDiagnostic?.clear();
  el.discard.checked = false;
  if (!result.content.nodes.some(node => node.id === selected)) selected = result.content.entryNodeId;
  el.source.textContent = `作者源 SHA-256：${result.sourceSha256}；节点 ${result.content.nodes.length} 个；内容修订：${result.content.revision}`;
  list({ revealSelected: true });
  nodeForm();
  references?.refresh();
  flow?.refresh();
}

async function perform(kind: "load" | "compare" | "preview" | "save", start: PreviewStart = { kind: "entry" }): Promise<void> {
  if (operation || disposed) return;
  if (importer?.active || sourceComparison?.active) {
    message("先采用或取消本次草稿比较，再读取、预览或保存。");
    return;
  }
  if (kind === "load" && drafts.size && !el.discard.checked) {
    workspace.open("source");
    message("先导出需要保留的草稿；要重新读取，请勾选本次丢弃草稿。", true);
    return;
  }
  if (kind !== "load" && !baseline) return;
  if (kind === "save" && !drafts.size) return;
  if (kind === "compare" && (!drafts.size || sourceComparison?.hasRecovery)) return;
  if (kind === "compare" && drafts.extended) {
    message("工程结构等修改请先导出完整工程草稿，再重新读取处理来源差异。", true);
    return;
  }
  drafts.closeGroup();
  const comparisonSnapshot = kind === "compare" && baseline ? { source: baseline, revision, patch: drafts.textPatch() } : null;
  operation = kind;
  const epoch = ++requestEpoch;
  const draftRevision = revision;
  const diagnosticContext: DiagnosticContext = {
    content: baseline?.content ?? null, sourceSha256: baseline?.sourceSha256 ?? null,
    revision: draftRevision, request: epoch, operation: kind === "compare" ? "load" : kind,
  };
  authorDiagnostic?.clear();
  const controller = new AbortController();
  requestController = controller;
  controls();
  if (kind === "preview") button("stop").disabled = false;
  message(kind === "compare" ? "正在读取磁盘源以比较；原基线、草稿与预览继续保留……" : kind === "load" ? "正在读取作者源并转换内容……"
    : kind === "save" ? "正在检查草稿、保留备份并保存到作者源……" : "正在通过同一转换器准备预览……");
  let sourceAdopted = false;
  try {
    const reading = kind === "load" || kind === "compare";
    const result = await request(reading ? "source" : kind, reading ? {} : patch(), controller.signal);
    if (disposed || epoch !== requestEpoch) return;
    if (draftRevision !== revision) {
      message("请求期间草稿已变化，未采用旧预览结果；请重新预览当前草稿。");
      return;
    }
    if (kind === "compare") {
      if (!comparisonSnapshot || baseline !== comparisonSnapshot.source || !sourceComparison) {
        throw new Error("本次比较缺少原基线身份，未采用读取结果。");
      }
      sourceComparison.offer(comparisonSnapshot, result, draftBase(result));
      workspace.open("source");
      message("磁盘源已读取，请在“文件”面板逐项选择并明确采用；原基线、草稿历史和预览尚未改变。");
    } else if (kind === "preview") {
      if (diagnosticContext.sourceSha256 === null) throw new Error("预览缺少原作者基线身份，请先读取作者源");
      const checkpoint = preview.start(result, start, {
        sourceSha256: diagnosticContext.sourceSha256, revision: draftRevision,
      });
      if (start.kind === "checkpoint" && checkpoint) checkpoints?.confirmed(start.input, checkpoint);
      message(start.kind === "checkpoint"
        ? "已通过共享核心从检查点继续预览，未重执行进入动作或写入作者源/玩家记录。"
        : "已采用本次草稿修订进行预览，未写入作者源。");
    } else {
      const nextDrafts = createDraftHistory();
      nextDrafts.reset(result);
      adoptSource(result, nextDrafts);
      sourceAdopted = true;
      message(kind === "save"
        ? `作者源已保存。原文件备份：${result.backup ?? "未返回备份位置，请检查作品目录"}。预览已停止，请重新预览本次修订。`
        : "已读取当前作者源；编辑保留为本页草稿，保存需点击“保存到作者源”。");
    }
  } catch (error: unknown) {
    if (disposed || epoch !== requestEpoch) return;
    if (error instanceof AuthorRequestError && error.diagnostic) {
      authorDiagnostic?.show(error.diagnostic, diagnosticContext);
      workspace.open("source");
    }
    message(`${error instanceof Error ? error.message : "作者操作失败"}${kind === "save"
      ? " 草稿保留；若连接中断，可保留草稿并与磁盘源比较，不要假定未写入。"
      : " 当前草稿保留。"}`, true);
  } finally {
    if (epoch === requestEpoch) {
      operation = null;
      requestController = null;
      button("stop").disabled = !preview.running;
      controls();
      if (sourceAdopted) {
        changes?.refresh();
        sceneInspector?.refresh();
      }
    }
  }
}

const { signal } = events;
el.reload.addEventListener("click", () => { void perform("load"); }, { signal });
el.compare.addEventListener("click", () => { void perform("compare"); }, { signal });
el.cancelCompare.addEventListener("click", () => {
  if (operation !== "compare") return;
  ++requestEpoch;
  requestController?.abort();
  requestController = null;
  operation = null;
  controls();
  message("已取消采用磁盘比较读取；原基线、草稿历史和预览继续保留。后台读取若尚未结束，下次请求可能需要稍后重试。");
}, { signal });
el.save.addEventListener("click", () => { void perform("save"); }, { signal });
el.undo.addEventListener("click", () => historyStep("undo"), { signal });
el.redo.addEventListener("click", () => historyStep("redo"), { signal });
button("tab-structure").addEventListener("click", () => structureEditor?.refresh(), { signal });
el.previewStart.addEventListener("click", () => { void perform("preview"); }, { signal });
el.previewSelected.addEventListener("click", () => {
  if (selected) void perform("preview", { kind: "selected", nodeId: selected });
}, { signal });
button("stop").addEventListener("click", () => {
  if (operation !== "preview") return;
  ++requestEpoch;
  requestController?.abort();
  operation = null;
  requestController = null;
  controls();
  message("已取消采用预览结果；草稿保留。后台转换若尚未结束，下次请求可能需要稍后重试。");
}, { signal });
el.search.addEventListener("input", () => {
  if (!disposed && !sourceBusy()) list({ resetPage: true });
}, { signal });
const turnNodePage = (direction: -1 | 1): void => {
  if (disposed || !baseline || sourceBusy()) return;
  const last = Math.max(0, Math.ceil((nodeList?.matches.length ?? 0) / NODE_PAGE_SIZE) - 1);
  nodePage = Math.max(0, Math.min(last, nodePage + direction));
  drafts.closeGroup();
  list({ resetScroll: true });
};
el.nodePrevious.addEventListener("click", () => turnNodePage(-1), { signal });
el.nodeNext.addEventListener("click", () => turnNodePage(1), { signal });
el.nodeCurrent.addEventListener("click", () => {
  if (disposed || !selectedNode() || sourceBusy()) return;
  drafts.closeGroup();
  workspace.open("story");
  list({ revealSelected: true });
  el.nodes.focus();
}, { signal });
el.nodes.addEventListener("change", () => {
  selectNode(el.nodes.value);
}, { signal });
for (const field of ["speaker", "text"] as const) {
  const input = el[field];
  input.addEventListener("focus", () => drafts.closeGroup(), { signal });
  input.addEventListener("blur", () => drafts.closeGroup(), { signal });
  input.addEventListener("input", event => {
    const separate = event instanceof InputEvent
      && ["historyUndo", "historyRedo", "insertFromPaste", "insertFromDrop", "deleteByCut"].includes(event.inputType);
    if (separate) drafts.closeGroup();
    change(field);
    if (separate) drafts.closeGroup();
  }, { signal });
}
el.reset.addEventListener("click", () => {
  if (disposed || !selected || sourceBusy()) return;
  const result = drafts.removeNode(selected);
  if (!result.changed) return;
  draftChanged({ refreshForm: true });
  message(result.overflow ? "已还原本节点草稿；本次操作超过历史容量，未保留撤销记录。"
    : "已还原本节点草稿，可用“撤销草稿操作”找回；作者文件未改动。");
}, { signal });
el.export.addEventListener("click", () => {
  if (!baseline || !drafts.size) return;
  drafts.closeGroup();
  const text = drafts.textPatch();
  downloadDraft(drafts.extended || text.edits.length > 1000 ? patch() : text);
  message("已请求下载草稿；结构等工程修改会导出完整工程草稿，文字修改沿用字段比较。可在本入口重新导入，保存仍须明确操作。");
}, { signal });
window.addEventListener("beforeunload", event => {
  if (drafts.size || importer?.active || sourceComparison?.active || sourceComparison?.hasRecovery || operation === "save") {
    event.preventDefault(); event.returnValue = "";
  }
}, { signal });
function dispose(): void {
  if (disposed) return;
  disposed = true;
  ++requestEpoch;
  requestController?.abort();
  preview.dispose();
  importer?.dispose();
  sourceComparison?.dispose();
  references?.dispose();
  flow?.dispose();
  checkpoints?.dispose();
  changes?.dispose();
  sceneInspector?.dispose();
  authorDiagnostic?.dispose();
  previewProblem?.dispose();
  choiceText?.dispose();
  structureEditor?.dispose();
  stageEditor?.dispose();
  assetLibrary?.dispose();
  performanceEditor?.dispose();
  workspace.dispose();
  nodeList = null;
  el.nodes.replaceChildren();
  drafts.clear();
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
    drafts.closeGroup();
    return { revision, patch: drafts.textPatch(), base: draftBase(source) };
  },
  apply(snapshot, result) {
    if (!importCurrent(snapshot) || result.sourceSha256 !== baseline?.sourceSha256) {
      throw new Error("当前源或草稿已改变，请重新导入比较。");
    }
    const change = drafts.replace(result);
    if (change.changed) draftChanged({ cancelImport: false, refreshForm: true });
    message(`导入结果已采用到当前作者源上的草稿${change.overflow ? "，本次操作超过历史容量，未保留撤销记录" : ""}；请预览，确认后再点击“保存到作者源”。`);
  },
  applyWorkspace(snapshot, result) {
    if (!importCurrent(snapshot)) throw new Error("当前源或草稿已改变，请重新导入");
    const change = drafts.replaceWorkspace(result);
    if (change.changed) draftChanged({ cancelImport: false, refreshForm: true });
    message("完整工程草稿已采用到本页；预览确认后再保存到作者源。");
  },
});
sourceComparison = new AuthorSourceComparison({
  root: element("source-comparison", HTMLElement),
  current: snapshot => !disposed && operation === null && baseline === snapshot.source && revision === snapshot.revision,
  apply(snapshot, result, merged) {
    if (disposed || operation !== null || baseline !== snapshot.source || revision !== snapshot.revision
      || importer?.active || merged.sourceSha256 !== result.sourceSha256) {
      throw new Error("原基线、草稿或操作已变化，请重新读取比较。");
    }
    // Validate the entire new history before releasing the original baseline/draft.
    const nextDrafts = createDraftHistory();
    nextDrafts.reset(result);
    const change = nextDrafts.replace(merged);
    adoptSource(result, nextDrafts);
    changes?.refresh();
    sceneInspector?.refresh();
    message(`已采用比较后的新基线与草稿，未写作者文件${change.overflow ? "；本次恢复超过历史容量，未保留撤销记录" : ""}。旧预览已停止，请重新预览后再保存。`);
  },
  changed: controls,
  notice: value => message(value),
});
references = new AuthorReferences({
  root: element("author-references", HTMLElement),
  capture() {
    if (!baseline || disposed) return null;
    return {
      content: baseline.content, sourceSha256: baseline.sourceSha256, revision,
      draft: drafts.inspect(),
    };
  },
  current: snapshot => !disposed && baseline !== null && baseline.content === snapshot.content
    && baseline.sourceSha256 === snapshot.sourceSha256 && revision === snapshot.revision,
  selected: () => selected,
  navigate: navigateNode,
});
function navigateNode(nodeId: string): void {
  if (disposed || sourceBusy()
    || !baseline?.content.nodes.some(node => node.id === nodeId)) return;
  selected = nodeId;
  list({ revealSelected: true });
  nodeForm();
  workspace.open("dialogue");
  el.nodeTitle.focus();
}
flow = new AuthorFlow({
  root: element("author-flow", HTMLElement),
  capture() {
    if (!baseline || disposed) return null;
    return {
      content: baseline.content, sourceSha256: baseline.sourceSha256, revision,
      draft: drafts.inspect(),
    };
  },
  current: snapshot => !disposed && baseline !== null && baseline.content === snapshot.content
    && baseline.sourceSha256 === snapshot.sourceSha256 && revision === snapshot.revision,
  selected: () => selected,
  navigate: navigateNode,
});
checkpoints = new PreviewCheckpoints({
  root: element("preview-checkpoints", HTMLElement),
  canCapture: () => preview.canCheckpoint,
  capture: () => preview.captureCheckpoint(),
  resume(input, voice) { void perform("preview", { kind: "checkpoint", input, voice }); },
});
changes = new AuthorChanges({
  root: element("author-changes", HTMLElement),
  capture() {
    if (!baseline || disposed || sourceBusy()) return null;
    drafts.closeGroup();
    return {
      content: baseline.content, sourceSha256: baseline.sourceSha256, revision,
      edits: Object.freeze([...drafts.values()]),
      structure: drafts.summary(),
    };
  },
  current: snapshot => !disposed && baseline !== null && baseline.content === snapshot.content
    && baseline.sourceSha256 === snapshot.sourceSha256 && revision === snapshot.revision,
  navigate: navigateNode,
});
sceneInspector = new AuthorScene({
  root: element("author-scene", HTMLElement),
  capture: () => baseline && !disposed && selected ? {
    content: baseline.content, sourceSha256: baseline.sourceSha256, revision, nodeId: selected,
  } : null,
  current: snapshot => !disposed && baseline !== null && baseline.content === snapshot.content
    && baseline.sourceSha256 === snapshot.sourceSha256 && revision === snapshot.revision && selected === snapshot.nodeId,
  inspectResource: (snapshot, assetId) => {
    workspace.open("references");
    return references?.openResource(assetId, snapshot) ?? false;
  },
});
authorDiagnostic = new AuthorDiagnostic({
  root: element("author-diagnostic", HTMLElement),
  current: context => !disposed && context.request === requestEpoch && context.revision === revision
    && context.content === (baseline?.content ?? null) && context.sourceSha256 === (baseline?.sourceSha256 ?? null),
  navigate: navigateNode,
});
previewProblem = new PreviewProblemPanel({
  root: element("preview-problem", HTMLElement),
  fallback: el.nodeTitle,
  read: () => preview.problem(),
  current: problem => !disposed && baseline !== null && problem.origin.sourceSha256 === baseline.sourceSha256
    && problem.origin.revision === revision && preview.matchesProblem(problem)
    && baseline.content.nodes.some(node => node.id === problem.nodeId && node.source.file === problem.source.file),
  blocked: () => disposed || operation !== null,
  navigate: navigateNode,
});
choiceText = new AuthorLogicEditor({
  root: element("choice-text", HTMLElement), read: textFor, update: updateText,
  closeGroup: () => drafts.closeGroup(), notice: value => message(value, true),
  targets: () => baseline?.content.nodes ?? [], navigate: navigateNode,
});
structureEditor = new AuthorStructureEditor({
  root: element("author-structure", HTMLElement), cards: element("node-cards", HTMLElement),
  read: () => baseline ? drafts.model : null, selected: () => selected,
  change: changeProject, navigate: navigateNode, notice: value => message(value, true),
});
stageEditor = new AuthorStageEditor({
  root: element("author-stage", HTMLElement), canvas: element("author-canvas", HTMLElement),
  status: element("author-stage-status", HTMLElement),
  read: () => baseline && !disposed && selected ? { document: baseline, model: drafts.model, nodeId: selected } : null,
  change: changeProject, notice: value => message(value, true),
});
assetLibrary = new AuthorAssetLibrary({
  root: element("author-assets", HTMLElement),
  read: () => baseline && !disposed ? { model: drafts.model, locations: baseline.locations } : null,
  use(id, kind) { stageEditor?.useAsset(id, kind); workspace.open("stage"); },
  notice: value => message(value, true),
});
performanceEditor = new AuthorPerformanceEditor({
  root: element("author-performance", HTMLElement),
  read: () => baseline && !disposed && selected ? { model: drafts.model, nodeId: selected } : null,
  change: changeProject,
  preview() { if (selected) void perform("preview", { kind: "selected", nodeId: selected }); },
  notice: value => message(value, true),
});
controls();
void perform("load");
