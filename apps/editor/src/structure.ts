import type { AuthorWorkspaceModel } from "../../../packages/story-model/src/author-workspace.ts";
import { newAuthorNode } from "../../../packages/story-model/src/author-workspace.ts";
import type { JsonObject } from "../../../packages/story-model/src/model.ts";

interface Options {
  root: HTMLElement;
  cards: HTMLElement;
  read(): AuthorWorkspaceModel | null;
  selected(): string;
  change(label: string, update: (model: AuthorWorkspaceModel) => void, selected?: string): void;
  navigate(id: string): void;
  notice(message: string): void;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag); value.textContent = text; return value;
}
const fresh = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
function nodeAt(model: AuthorWorkspaceModel, id: string) {
  const chapter = model.chapters.find(chapter => chapter.nodes.some(node => node.id === id));
  const node = chapter?.nodes.find(node => node.id === id);
  if (!chapter || !node) throw new Error("请先选择一个已有节点");
  return { chapter, node, index: chapter.nodes.indexOf(node) };
}

/** Author structure controls. Deletions affect only this draft and can be undone. */
export class AuthorStructureEditor {
  readonly #options: Options;
  readonly #events = new AbortController();
  #view = new AbortController();
  readonly #fields = element("fieldset");
  readonly #body = element("div");
  #enabled = false;
  #chapter = "";
  #selected = "";

  constructor(options: Options) {
    this.#options = options;
    options.root.classList.add("structure-panel");
    this.#fields.append(element("legend", "剧情结构"), this.#body);
    options.root.append(this.#fields);
    const { signal } = this.#events;
    options.cards.addEventListener("dragstart", event => {
      if (!this.#enabled || !(event.target instanceof Element)) return;
      const card = event.target.closest<HTMLElement>("[data-node-id]");
      if (!card || !event.dataTransfer) return;
      event.dataTransfer.setData("application/x-haifeng-node", card.dataset.nodeId!);
      event.dataTransfer.effectAllowed = "move";
    }, { signal });
    options.cards.addEventListener("dragover", event => {
      if (this.#enabled && event.dataTransfer?.types.includes("application/x-haifeng-node")) {
        event.preventDefault(); event.dataTransfer.dropEffect = "move";
      }
    }, { signal });
    options.cards.addEventListener("drop", event => {
      if (!this.#enabled || !(event.target instanceof Element)) return;
      const source = event.dataTransfer?.getData("application/x-haifeng-node");
      const target = event.target.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
      if (!source || !target || source === target) return;
      event.preventDefault();
      this.perform(() => options.change("拖动节点排序", model => {
        const from = nodeAt(model, source), to = nodeAt(model, target);
        from.chapter.nodes.splice(from.index, 1);
        to.chapter.nodes.splice(to.chapter.nodes.indexOf(to.node), 0, from.node);
      }, source));
    }, { signal });
    this.refresh();
  }
  setEnabled(enabled: boolean): void { this.#enabled = enabled; this.#fields.disabled = !enabled; }
  private perform(action: () => void): void {
    if (!this.#enabled) return;
    try { action(); } catch (error: unknown) { this.#options.notice(error instanceof Error ? error.message : "结构操作未采用"); }
  }
  private button(text: string, action: () => void, disabled = false): HTMLButtonElement {
    const button = element("button", text);
    button.type = "button"; button.disabled = disabled;
    button.addEventListener("click", () => this.perform(action), { signal: this.#view.signal });
    return button;
  }
  private label(text: string, input: HTMLElement): HTMLLabelElement {
    const label = element("label", text); label.append(input); return label;
  }
  private group(title: string): HTMLElement {
    const section = element("section"); section.append(element("h3", title)); this.#body.append(section); return section;
  }
  private controls(...buttons: HTMLElement[]): HTMLElement {
    const group = element("div"); group.className = "controls"; group.append(...buttons); return group;
  }

  refresh(): void {
    this.#view.abort(); this.#view = new AbortController(); this.#body.replaceChildren();
    const model = this.#options.read();
    if (!model) { this.#body.append(element("p", "读取作者工程后可管理章节、节点与选项。")); return; }
    const selected = this.#options.selected();
    const location = model.chapters.find(chapter => chapter.nodes.some(node => node.id === selected));
    if (selected !== this.#selected || !model.chapters.some(chapter => chapter.id === this.#chapter)) {
      this.#chapter = location?.id ?? model.chapters[0]!.id;
    }
    this.#selected = selected;
    const currentChapter = model.chapters.find(chapter => chapter.id === this.#chapter)!;
    const currentNode = location?.nodes.find(node => node.id === selected);
    const project = this.group("作品开局");
    project.append(element("p", `当前入口：${model.entryNodeId}`), this.controls(
      this.button("定位开局", () => this.#options.navigate(model.entryNodeId)),
      this.button("将所选节点设为开局", () => this.#options.change("更换作品开局", draft => { draft.entryNodeId = selected; }), !currentNode),
    ));

    const chapters = this.group("章节管理");
    const chapterSelect = element("select");
    chapterSelect.setAttribute("aria-label", "管理章节");
    for (const chapter of model.chapters) chapterSelect.add(new Option(`${chapter.title || "未命名"} · ${chapter.nodes.length} 句`, chapter.id));
    chapterSelect.value = currentChapter.id;
    chapterSelect.addEventListener("change", () => { this.#chapter = chapterSelect.value; this.refresh(); }, { signal: this.#view.signal });
    const title = element("input"); title.value = currentChapter.title; title.maxLength = 1000;
    title.setAttribute("aria-label", "章节名称");
    const chapterIndex = model.chapters.indexOf(currentChapter);
    const order = (direction: -1 | 1) => this.#options.change("调整章节顺序", draft => {
      const index = draft.chapters.findIndex(chapter => chapter.id === currentChapter.id);
      const other = index + direction;
      if (other < 0 || other >= draft.chapters.length) return;
      [draft.chapters[index], draft.chapters[other]] = [draft.chapters[other]!, draft.chapters[index]!];
    });
    const newTitle = element("input"); newTitle.placeholder = "新章节名称"; newTitle.maxLength = 1000;
    newTitle.setAttribute("aria-label", "新章节名称");
    chapters.append(chapterSelect, this.label("章节名称", title), this.controls(
      this.button("重命名章节", () => this.#options.change("重命名章节", draft => {
        draft.chapters.find(chapter => chapter.id === currentChapter.id)!.title = title.value;
      })),
      this.button("章节前移", () => order(-1), chapterIndex === 0),
      this.button("章节后移", () => order(1), chapterIndex === model.chapters.length - 1),
    ), this.label("新章节", newTitle), this.button("新增章节", () => {
      const id = fresh("chapter");
      this.#chapter = id;
      this.#options.change("新增章节", draft => {
        draft.chapters.splice(chapterIndex + 1, 0, { id, title: newTitle.value.trim() || "新章节", nodes: [] });
      });
    }));
    const destination = element("select"); destination.setAttribute("aria-label", "合并章节的目标");
    for (const chapter of model.chapters.filter(chapter => chapter.id !== currentChapter.id)) {
      destination.add(new Option(chapter.title || chapter.id, chapter.id));
    }
    chapters.append(this.label("合并到其他章节", destination), this.button("合并节点并移除本章", () => {
      this.#chapter = destination.value;
      this.#options.change("合并章节", draft => {
        const from = draft.chapters.find(chapter => chapter.id === currentChapter.id)!;
        const to = draft.chapters.find(chapter => chapter.id === destination.value);
        if (!to) throw new Error("请选择目标章节");
        to.nodes.push(...from.nodes);
        draft.chapters = draft.chapters.filter(chapter => chapter !== from);
      });
    }, model.chapters.length < 2));

    const nodes = this.group("节点管理");
    const add = (before: boolean) => {
      const id = fresh("node");
      this.#options.change("新增节点", draft => {
        const chapter = draft.chapters.find(chapter => chapter.id === currentChapter.id)!;
        const index = chapter.nodes.findIndex(node => node.id === selected);
        chapter.nodes.splice(index < 0 ? chapter.nodes.length : index + (before ? 0 : 1), 0, newAuthorNode(id));
      }, id);
    };
    nodes.append(this.controls(this.button("在前面新增", () => add(true)), this.button("在后面新增", () => add(false))));
    if (currentNode && location) {
      const nodeIndex = location.nodes.indexOf(currentNode);
      const move = (direction: -1 | 1) => this.#options.change("调整节点顺序", draft => {
        const { chapter, index } = nodeAt(draft, selected);
        const other = index + direction;
        if (other < 0 || other >= chapter.nodes.length) return;
        [chapter.nodes[index], chapter.nodes[other]] = [chapter.nodes[other]!, chapter.nodes[index]!];
      });
      nodes.append(element("p", `所选节点 ${selected}`), this.controls(
        this.button("节点前移", () => move(-1), nodeIndex === 0),
        this.button("节点后移", () => move(1), nodeIndex === location.nodes.length - 1),
        this.button("移到所管理章节末尾", () => this.#options.change("跨章节移动节点", draft => {
          const from = nodeAt(draft, selected);
          const to = draft.chapters.find(chapter => chapter.id === currentChapter.id)!;
          from.chapter.nodes.splice(from.index, 1); to.nodes.push(from.node);
        }), location.id === currentChapter.id),
      ));
    }
    const replacement = element("input");
    replacement.placeholder = "被引用时填写替代节点 ID";
    replacement.setAttribute("aria-label", "删除后的替代节点");
    const confirmed = element("input"); confirmed.type = "checkbox";
    nodes.append(this.label("删除后的入口与显式跳转替代", replacement),
      this.label("确认删除所选节点或所管理章节的节点；可撤销", confirmed));
    const remove = (chapter: boolean) => {
      if (!confirmed.checked) throw new Error("请先勾选删除确认");
      this.#options.change(chapter ? "删除章节及节点" : "删除节点", draft => {
        const removed = new Set(chapter ? draft.chapters.find(value => value.id === currentChapter.id)!.nodes.map(node => String(node.id)) : [selected]);
        const remaining = draft.chapters.flatMap(value => value.nodes).filter(node => !removed.has(String(node.id)));
        if (!remaining.length) throw new Error("作品至少要保留一个节点");
        const target = replacement.value.trim();
        if (target && !remaining.some(node => node.id === target)) throw new Error("替代节点不存在或也在本次删除范围内");
        if (removed.has(draft.entryNodeId)) {
          if (!target) throw new Error("删除范围含作品入口，请填写新的入口节点");
          draft.entryNodeId = target;
        }
        for (const node of remaining) {
          if (typeof node.jump === "string" && removed.has(node.jump)) {
            if (!target) throw new Error(`节点 ${node.id} 跳转到删除范围，请先填写替代节点`);
            node.jump = target;
          }
          for (const choice of node.choices as JsonObject[]) {
            if (typeof choice.target === "string" && removed.has(choice.target)) {
              if (!target) throw new Error(`选项 ${choice.id} 指向删除范围，请先填写替代节点`);
              choice.target = target;
            }
          }
        }
        if (chapter && draft.chapters.length < 2) throw new Error("至少保留一个章节，可只删除节点");
        for (const item of draft.chapters) item.nodes = item.nodes.filter(node => !removed.has(String(node.id)));
        if (chapter) draft.chapters = draft.chapters.filter(item => item.id !== currentChapter.id);
      });
    };
    nodes.append(this.controls(
      this.button("删除所选节点", () => remove(false), !currentNode),
      this.button("删除所管理章节", () => remove(true), model.chapters.length < 2),
    ), element("p", "删除会检查入口及显式跳转。排序与跨章移动会改变按顺序继续的路线，请在保存前预览。"));

    if (currentNode) {
      const options = this.group("当前节点的选项");
      const select = element("select"); select.size = 5; select.setAttribute("aria-label", "管理已有选项");
      const choices = currentNode.choices as JsonObject[];
      for (const choice of choices) select.add(new Option(`${choice.text || "未填写"} · ${choice.id}`, String(choice.id)));
      if (choices.length) select.selectedIndex = 0;
      const clearFlow = element("input"); clearFlow.type = "checkbox";
      options.append(select, this.label("新增选项时允许清除当前节点的跳转或结局", clearFlow));
      const reorder = (direction: -1 | 1) => this.#options.change("调整选项顺序", draft => {
        const { node } = nodeAt(draft, selected); const values = node.choices as JsonObject[];
        const index = values.findIndex(choice => choice.id === select.value), other = index + direction;
        if (index < 0 || other < 0 || other >= values.length) return;
        [values[index], values[other]] = [values[other]!, values[index]!];
      });
      options.append(this.controls(
        this.button("新增选项", () => this.#options.change("新增选项", draft => {
          const { node } = nodeAt(draft, selected);
          if ((node.jump || node.ending) && !clearFlow.checked) throw new Error("当前节点已有跳转或结局，请勾选允许清除后再新增选项");
          if (clearFlow.checked) { node.jump = ""; node.jumpIf = ""; node.ending = ""; }
          (node.choices as JsonObject[]).push({ id: fresh("choice"), text: "新选项", cond: "", set: "", target: "" });
        })),
        this.button("选项前移", () => reorder(-1), choices.length < 2),
        this.button("选项后移", () => reorder(1), choices.length < 2),
        this.button("删除选项", () => this.#options.change("删除选项", draft => {
          const { node } = nodeAt(draft, selected);
          node.choices = (node.choices as JsonObject[]).filter(choice => choice.id !== select.value);
          if (!(node.choices as JsonObject[]).length || node.cdef === select.value) { node.ctime = 0; node.cdef = ""; }
        }), !choices.length),
      ), element("p", "删除默认项或最后一个选项时，会同时取消该节点的选择倒计时。选项身份在排序时保持不变。"));
    }
    for (const card of this.#options.cards.querySelectorAll<HTMLElement>("[data-node-id]")) card.draggable = true;
    this.#fields.disabled = !this.#enabled;
  }
  dispose(): void { this.#events.abort(); this.#view.abort(); this.#options.root.replaceChildren(); }
}
