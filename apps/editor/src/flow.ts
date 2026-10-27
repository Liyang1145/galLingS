import type { Assignment, Expression, SourceLocation, StoryContent, StoryNode } from "../../../packages/story-model/src/model.ts";

export interface FlowSnapshot {
  readonly content: StoryContent;
  readonly sourceSha256: string;
  readonly revision: number;
  readonly draft: StoryContent;
}

interface FlowOptions {
  root: HTMLElement;
  capture(): FlowSnapshot | null;
  current(snapshot: FlowSnapshot): boolean;
  selected(): string;
  navigate(nodeId: string): void;
}

interface FlowEdge {
  key: string;
  from: string | null;
  to: string | null;
  label: string;
  condition: Expression | null;
  actions: readonly Assignment[];
  source: SourceLocation;
  path: string;
}

const PAGE_SIZE = 8;
const CARD_HEIGHT = 168;
const ROW = 184;
const SVG_NS = "http://www.w3.org/2000/svg";
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = text;
  result.className = className;
  return result;
}
function action(text: string, name: string): HTMLButtonElement {
  const button = element("button", text);
  button.type = "button";
  button.dataset.flowAction = name;
  return button;
}
function expressionText(value: Expression): string {
  switch (value.kind) {
    case "literal": return JSON.stringify(value.value);
    case "variable": return value.name;
    case "unary": return `(${value.operator}${expressionText(value.operand)})`;
    case "binary": return `(${expressionText(value.left)} ${value.operator} ${expressionText(value.right)})`;
  }
}
function actionsText(values: readonly Assignment[]): string {
  return values.length ? values.map(value => `${value.name} ${value.operator} ${expressionText(value.expression)}`).join("\n") : "无";
}

/** Structural flow only: no evaluator, player session, persistence or author write capability. */
export class AuthorFlow {
  readonly #options: FlowOptions;
  readonly #events = new AbortController();
  readonly #refresh = action("按当前草稿刷新流程", "refresh");
  readonly #status = element("p", "读取作者源后可查看流程。", "help");
  readonly #views = element("fieldset");
  readonly #viewport = element("div", "", "flow-viewport");
  readonly #details = element("pre");
  readonly #inCount = element("span");
  readonly #outCount = element("span");
  readonly #inPrevious = action("前驱上一页", "in-previous");
  readonly #inNext = action("前驱下一页", "in-next");
  readonly #outPrevious = action("后继上一页", "out-previous");
  readonly #outNext = action("后继下一页", "out-next");
  #snapshot: FlowSnapshot | null = null;
  #nodes = new Map<string, StoryNode>();
  #incoming = new Map<string, FlowEdge[]>();
  #outgoing = new Map<string, FlowEdge[]>();
  #edges = new Map<string, FlowEdge>();
  #selected = "";
  #inPage = 0;
  #outPage = 0;
  #version = 0;
  #stale = true;
  #available = false;
  #closed = false;

  constructor(options: FlowOptions) {
    this.#options = options;
    const header = element("div", "", "controls");
    header.append(element("h3", "节点流转定位"), this.#refresh);
    const pager = element("div", "", "controls flow-pager");
    pager.append(this.#inPrevious, this.#inCount, this.#inNext, this.#outPrevious, this.#outCount, this.#outNext);
    this.#views.append(element("legend", "当前节点的一层前驱与后继"), pager, this.#viewport,
      element("h4", "节点或流转详情（只读）"), this.#details);
    options.root.classList.add("flow-panel");
    options.root.append(header, this.#status, element("p",
      "只读结构图，不执行条件或动作，不表示路线可达或已验证。左右每页最多八条连线；点击节点只定位编辑表单，查看流转显示条件、动作及来源。",
      "help"), this.#views);
    options.root.addEventListener("click", event => this.click(event), { signal: this.#events.signal });
    this.enabled();
  }

  setAvailable(available: boolean): void { this.#available = available; this.enabled(); }

  private enabled(): void {
    this.#refresh.disabled = this.#closed || !this.#available;
    this.#views.disabled = this.#closed || !this.#available || this.#stale || !this.#snapshot;
  }

  invalidate(): void {
    if (this.#closed) return;
    this.#stale = true;
    this.#version++;
    this.#status.textContent = this.#snapshot
      ? "源或草稿已变化；以下是旧流程，刷新后才能继续定位。"
      : "读取作者源后可按当前草稿刷新流程。";
    this.enabled();
  }

  refresh(): void {
    if (this.#closed) return;
    try {
      const snapshot = this.#options.capture();
      if (!snapshot) { this.invalidate(); return; }
      this.#nodes = new Map(snapshot.draft.nodes.map(node => [node.id, node]));
      this.#incoming.clear();
      this.#outgoing.clear();
      this.#edges.clear();
      const add = (edge: FlowEdge): void => {
        if (edge.from !== null && !this.#nodes.has(edge.from)) throw new Error(`流转来源节点不存在：${edge.from}`);
        if (edge.to !== null && !this.#nodes.has(edge.to)) throw new Error(`流转目标节点不存在：${edge.to}`);
        this.#edges.set(edge.key, edge);
        if (edge.from !== null) {
          const items = this.#outgoing.get(edge.from);
          if (items) items.push(edge);
          else this.#outgoing.set(edge.from, [edge]);
        }
        if (edge.to !== null) {
          const items = this.#incoming.get(edge.to);
          if (items) items.push(edge);
          else this.#incoming.set(edge.to, [edge]);
        }
      };
      add({
        key: "entry", from: null, to: snapshot.content.entryNodeId, label: "作品入口",
        condition: null, actions: [], source: { file: snapshot.content.source.file, field: "" }, path: "entryNodeId",
      });
      snapshot.draft.nodes.forEach((node, index) => {
        const flow = node.flow;
        const edge = (path: string, to: string | null, label: string, condition: Expression | null = null,
          actions: readonly Assignment[] = [], source = node.source): void => add({
          key: JSON.stringify([node.id, path]), from: node.id, to, label, condition, actions, source,
          path: `nodes.${index}.${path}`,
        });
        switch (flow.kind) {
          case "next": edge("flow.target", flow.target, flow.target === null ? "脚本末尾" : "后续节点"); break;
          case "branch":
            edge("flow.then", flow.then, "条件成立", flow.condition);
            edge("flow.otherwise", flow.otherwise, "条件不成立", flow.condition);
            break;
          case "ending": edge("flow.endingId", null, `结局：${flow.endingId}`); break;
          case "choice":
            flow.choices.forEach((choice, choiceIndex) => {
              const timeout = flow.timeout?.choiceId === choice.id ? ` · 超时默认 ${flow.timeout.durationMs / 1000}s` : "";
              edge(`flow.choices.${choiceIndex}.target`, choice.target, `选项 ${choice.id}：${choice.text}${timeout}`,
                choice.condition, choice.actions, choice.source);
            });
            edge("flow.emptyTarget", flow.emptyTarget, "无可见选项时");
            break;
          default: {
            const unsupported: never = flow;
            throw new Error(`未支持的流转：${JSON.stringify(unsupported)}`);
          }
        }
      });
      this.#snapshot = snapshot;
      this.#selected = this.#options.selected();
      this.#inPage = this.#outPage = 0;
      this.#stale = false;
      this.#status.textContent = `作者源 ${snapshot.sourceSha256}；基线内容修订 ${snapshot.content.revision}；本页草稿代次 ${snapshot.revision}。结构覆盖 ${this.#nodes.size} 个节点，采用当前对白及选项条件、动作和目标草稿。`;
      this.render();
    } catch (error: unknown) {
      this.#snapshot = null;
      this.#nodes.clear();
      this.#incoming.clear();
      this.#outgoing.clear();
      this.#edges.clear();
      this.#viewport.replaceChildren();
      this.#details.textContent = "";
      this.#stale = true;
      this.#version++;
      this.#status.textContent = `流程未能读取：${error instanceof Error ? error.message : "未知错误"}。已有草稿和预览保留。`;
    }
    this.enabled();
  }

  select(nodeId: string): void {
    this.#selected = nodeId;
    if (!this.valid(false)) return;
    this.#inPage = this.#outPage = 0;
    this.render();
  }

  private valid(requireAvailable = true): boolean {
    if (this.#closed || this.#stale || !this.#snapshot || (requireAvailable && !this.#available)) return false;
    if (!this.#options.current(this.#snapshot)) { this.invalidate(); return false; }
    return true;
  }

  private page(items: readonly FlowEdge[], requested: number, count: HTMLElement,
    previous: HTMLButtonElement, next: HTMLButtonElement, label: string): { page: number; items: readonly FlowEdge[] } {
    const page = Math.max(0, Math.min(requested, Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1)));
    const start = page * PAGE_SIZE;
    count.textContent = items.length ? `${label} ${start + 1}–${Math.min(start + PAGE_SIZE, items.length)} / ${items.length}` : `${label} 0 条`;
    previous.disabled = page === 0;
    next.disabled = start + PAGE_SIZE >= items.length;
    return { page, items: items.slice(start, start + PAGE_SIZE) };
  }

  private nodeCard(nodeId: string | null, empty: string): HTMLElement {
    const card = element("article", "", "flow-card");
    const node = nodeId === null ? null : this.#nodes.get(nodeId);
    if (!node) { card.append(element("strong", empty)); return card; }
    const jump = action(node.id, "jump");
    jump.dataset.flowNode = node.id;
    jump.dataset.flowVersion = String(this.#version);
    const entry = node.id === this.#snapshot?.content.entryNodeId ? "作品入口 · " : "";
    card.append(jump, element("small", `${entry}${node.chapter || "未标章节"}${node.label ? ` · ${node.label}` : ""}`));
    const field = (name: "speaker" | "text"): string => node.presentation[name];
    const speaker = field("speaker");
    card.append(element("p", `${speaker ? `${speaker}：` : ""}${field("text").replace(/\s+/gu, " ").slice(0, 160) || "演出节点"}`));
    return card;
  }

  private edgeCard(edge: FlowEdge, incoming: boolean): HTMLElement {
    const nodeId = incoming ? edge.from : edge.to;
    const card = this.nodeCard(nodeId, incoming ? "作品入口" : "本段结束");
    const details = action(edge.label.length > 160 ? `${edge.label.slice(0, 160)}…` : edge.label, "details");
    details.dataset.flowEdge = edge.key;
    details.dataset.flowVersion = String(this.#version);
    details.title = edge.label.slice(0, 512);
    card.append(details);
    if (nodeId === this.#selected) card.append(element("small", "回到当前节点"));
    return card;
  }

  private render(): void {
    this.#version++;
    const incoming = this.page(this.#incoming.get(this.#selected) ?? [], this.#inPage,
      this.#inCount, this.#inPrevious, this.#inNext, "前驱");
    const outgoing = this.page(this.#outgoing.get(this.#selected) ?? [], this.#outPage,
      this.#outCount, this.#outPrevious, this.#outNext, "后继");
    this.#inPage = incoming.page;
    this.#outPage = outgoing.page;
    const rows = Math.max(1, incoming.items.length, outgoing.items.length);
    const height = 40 + rows * CARD_HEIGHT + (rows - 1) * (ROW - CARD_HEIGHT);
    const canvas = element("div", "", "flow-canvas");
    canvas.style.height = `${height}px`;
    const before = element("div", "", "flow-column");
    before.setAttribute("role", "group");
    before.setAttribute("aria-label", "当前页前驱");
    before.append(...incoming.items.map(edge => this.edgeCard(edge, true)));
    const center = element("div", "", "flow-center");
    center.setAttribute("role", "group");
    center.setAttribute("aria-label", "当前节点");
    const current = this.nodeCard(this.#selected, "请选择节点");
    current.classList.add("flow-current");
    center.append(current);
    const after = element("div", "", "flow-column");
    after.setAttribute("role", "group");
    after.setAttribute("aria-label", "当前页后继");
    after.append(...outgoing.items.map(edge => this.edgeCard(edge, false)));
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 960 ${height}`);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const line = (x1: number, y1: number, x2: number, y2: number): void => {
      const path = document.createElementNS(SVG_NS, "path");
      const middle = (x1 + x2) / 2;
      path.setAttribute("d", `M${x1} ${y1} C${middle} ${y1} ${middle} ${y2} ${x2} ${y2} M${x2 - 6} ${y2 - 4} L${x2} ${y2} L${x2 - 6} ${y2 + 4}`);
      svg.append(path);
    };
    incoming.items.forEach((_, index) => line(300, 20 + CARD_HEIGHT / 2 + index * ROW, 340, height / 2));
    outgoing.items.forEach((_, index) => line(620, height / 2, 660, 20 + CARD_HEIGHT / 2 + index * ROW));
    canvas.append(svg, before, center, after);
    this.#viewport.replaceChildren(canvas);
    this.#viewport.scrollTop = Math.max(0, height / 2 - this.#viewport.clientHeight / 2);
    this.#viewport.scrollLeft = Math.max(0, (960 - this.#viewport.clientWidth) / 2);
    const node = this.#nodes.get(this.#selected);
    this.#details.textContent = node
      ? `当前节点：${node.id}\n流转种类：${node.flow.kind}\n进入动作（只读，不执行）：\n${actionsText(node.enter)}\n作者来源：${node.source.file} · ${node.source.field}\n点击连线条目查看其条件、选项动作和规范化字段路径。`
      : "请选择节点。";
  }

  private click(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!(button instanceof HTMLButtonElement) || !this.#options.root.contains(button) || button.disabled) return;
    const action = button.dataset.flowAction;
    if (action === "refresh") { if (this.#available) this.refresh(); return; }
    if (!this.valid()) return;
    if ((action === "jump" || action === "details") && button.dataset.flowVersion !== String(this.#version)) return;
    if (action === "jump") {
      const nodeId = button.dataset.flowNode;
      if (nodeId && this.#nodes.has(nodeId)) this.#options.navigate(nodeId);
    } else if (action === "details") {
      const edge = this.#edges.get(button.dataset.flowEdge ?? "");
      if (edge) this.#details.textContent = `${edge.label}\n来源：${edge.from ?? "作品入口"}\n目标：${edge.to ?? "本段结束"}\n条件（只读，不求值）：${edge.condition ? expressionText(edge.condition) : "无"}\n选项动作（只读，不执行）：\n${actionsText(edge.actions)}\n规范化路径：${edge.path}\n作者来源：${edge.source.file} · ${edge.source.field}`;
    } else {
      if (action === "in-previous") this.#inPage--;
      else if (action === "in-next") this.#inPage++;
      else if (action === "out-previous") this.#outPage--;
      else if (action === "out-next") this.#outPage++;
      else return;
      this.render();
    }
  }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#events.abort();
    this.#snapshot = null;
    this.#nodes.clear();
    this.#incoming.clear();
    this.#outgoing.clear();
    this.#edges.clear();
    this.#options.root.replaceChildren();
  }
}
