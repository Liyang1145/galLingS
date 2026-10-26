import type { StoryContent } from "../../../packages/story-model/src/model.ts";
import { createReferenceIndex, referenceKey } from "../../../packages/story-model/src/references.ts";
import type {
  ContentReference, ContentReferenceIndex, ReferenceDefinition, ReferenceRole, ReferenceTarget,
} from "../../../packages/story-model/src/references.ts";
import { playerReferences } from "../../../packages/player/src/references.ts";

export interface ReferenceOrigin {
  readonly content: StoryContent;
  readonly sourceSha256: string;
  readonly revision: number;
}
export interface ReferenceSnapshot extends ReferenceOrigin {
  readonly textOverrides: ReadonlyMap<string, string>;
}

interface ReferenceOptions {
  root: HTMLElement;
  capture(): ReferenceSnapshot | null;
  current(snapshot: ReferenceSnapshot): boolean;
  selected(): string;
  navigate(nodeId: string): void;
}

const PAGE_SIZE = 50;
const KINDS: Readonly<Record<ReferenceTarget["kind"], string>> = {
  node: "节点", resource: "资源", variable: "变量", ending: "结局", choice: "选项", sprite: "立绘实例",
};
const ROLES: Readonly<Record<ReferenceRole, string>> = {
  entry: "作品入口", next: "后续流转", "branch-then": "条件成立目标", "branch-otherwise": "条件另一目标",
  "choice-target": "选项目标", "empty-target": "无可见选项目标", "timeout-default": "超时默认选项", ending: "结局声明",
  background: "背景", sprite: "立绘资源", music: "配乐", ambience: "环境声", voice: "对白语音", sound: "一次性音效",
  "actor-action": "角色动作目标", read: "变量读取", write: "变量写入", text: "对白占位符",
  theme: "对白主题图片", cover: "标题封面", "ui-sound": "交互提示音", "feedback-variable": "反馈变量", "readout-variable": "话末数值变量",
};
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = text;
  result.className = className;
  return result;
}
function action(text: string, name: string): HTMLButtonElement {
  const button = element("button", text);
  button.type = "button";
  button.dataset.referenceAction = name;
  return button;
}
function targetLabel(target: ReferenceTarget): string {
  return `${KINDS[target.kind]} ${target.id}${"nodeId" in target ? ` · 节点 ${target.nodeId}` : ""}`;
}

/** Read-only, revision-bound inspection. No editor write API or player session is available here. */
export class AuthorReferences {
  readonly #options: ReferenceOptions;
  readonly #events = new AbortController();
  readonly #refresh = action("按当前草稿刷新引用", "refresh");
  readonly #status = element("p", "读取作者源后可查看引用。", "help");
  readonly #views = element("fieldset");
  readonly #outHeading = element("h4");
  readonly #outList = element("ol");
  readonly #outCount = element("span");
  readonly #query = element("input");
  readonly #kind = element("select");
  readonly #targets = element("select");
  readonly #targetCount = element("span");
  readonly #inHeading = element("h4");
  readonly #inList = element("ol");
  readonly #inCount = element("span");
  readonly #outPrevious = action("上一页", "out-previous");
  readonly #outNext = action("下一页", "out-next");
  readonly #targetPrevious = action("上一页", "target-previous");
  readonly #targetNext = action("下一页", "target-next");
  readonly #inPrevious = action("上一页", "in-previous");
  readonly #inNext = action("下一页", "in-next");
  #snapshot: ReferenceSnapshot | null = null;
  #index: ContentReferenceIndex | null = null;
  #catalog: readonly ReferenceDefinition[] = [];
  #definitions = new Map<string, ReferenceDefinition>();
  #target: ReferenceTarget | null = null;
  #selected = "";
  #outPage = 0;
  #targetPage = 0;
  #inPage = 0;
  #version = 0;
  #stale = true;
  #available = false;
  #closed = false;

  constructor(options: ReferenceOptions) {
    this.#options = options;
    const header = element("div", "", "controls");
    header.append(element("h3", "引用与影响查询"), this.#refresh);
    const columns = element("div", "", "reference-columns");
    const outgoing = element("section");
    outgoing.append(this.#outHeading, this.#outList,
      this.pager(this.#outCount, this.#outPrevious, this.#outNext));
    const incoming = element("section");
    const queryLabel = element("label");
    queryLabel.append(element("span", "查找引用目标（ID、变量名、资源路径或选项文字）"), this.#query);
    this.#query.type = "search";
    const kindLabel = element("label");
    kindLabel.append(element("span", "目标类型"), this.#kind);
    const all = element("option", "全部类型");
    all.value = "";
    this.#kind.append(all);
    for (const [kind, label] of Object.entries(KINDS)) {
      const option = element("option", label);
      option.value = kind;
      this.#kind.append(option);
    }
    this.#targets.size = 6;
    this.#targets.setAttribute("aria-label", "选择引用目标");
    this.#inHeading.tabIndex = -1;
    incoming.append(queryLabel, kindLabel, this.#targets,
      this.pager(this.#targetCount, this.#targetPrevious, this.#targetNext), this.#inHeading, this.#inList,
      this.pager(this.#inCount, this.#inPrevious, this.#inNext));
    columns.append(outgoing, incoming);
    this.#views.append(element("legend", "只读引用结果"), columns);
    options.root.classList.add("reference-panel");
    options.root.append(header, this.#status, element("p",
      "查询当前草稿的结构引用，不计算路线可达性。零引用不代表素材可删除；旧工具、来源元数据及仓库外消费者不在此查询中。",
      "help"), this.#views);
    const { signal } = this.#events;
    options.root.addEventListener("click", event => this.click(event), { signal });
    const filter = (): void => {
      if (!this.valid()) return;
      this.#targetPage = 0;
      this.renderTargets();
    };
    this.#query.addEventListener("input", filter, { signal });
    this.#kind.addEventListener("change", filter, { signal });
    this.#targets.addEventListener("change", () => {
      if (!this.valid()) return;
      const definition = this.#definitions.get(this.#targets.value);
      if (definition) this.choose(definition.target);
    }, { signal });
    this.renderOutgoing();
    this.renderTargets();
    this.renderIncoming();
    this.enabled();
  }

  private pager(count: HTMLElement, previous: HTMLButtonElement, next: HTMLButtonElement): HTMLElement {
    const controls = element("div", "", "controls reference-pager");
    controls.append(previous, count, next);
    return controls;
  }

  setAvailable(available: boolean): void {
    this.#available = available;
    this.enabled();
  }

  private enabled(): void {
    this.#refresh.disabled = this.#closed || !this.#available;
    this.#views.disabled = this.#closed || !this.#available || this.#stale || !this.#index;
  }

  invalidate(): void {
    if (this.#closed) return;
    this.#stale = true;
    this.#version++;
    const message = this.#index ? "源或草稿已变化；以下是旧查询，刷新后才能继续定位。" : "读取作者源后可按当前草稿刷新引用。";
    if (this.#status.textContent !== message) this.#status.textContent = message;
    this.enabled();
  }

  refresh(): void {
    if (this.#closed) return;
    const snapshot = this.#options.capture();
    if (!snapshot) { this.invalidate(); return; }
    try {
      const index = createReferenceIndex(snapshot.content, {
        textOverrides: snapshot.textOverrides, additional: playerReferences(snapshot.content),
      });
      this.#snapshot = snapshot;
      this.#index = index;
      this.#catalog = index.definitions();
      this.#definitions = new Map(this.#catalog.map(definition => [referenceKey(definition.target), definition]));
      this.#stale = false;
      this.#version++;
      this.#selected = this.#options.selected();
      this.#target = this.#selected ? { kind: "node", id: this.#selected } : null;
      this.#outPage = this.#inPage = this.#targetPage = 0;
      this.#status.textContent = `作者源 ${snapshot.sourceSha256}；内容修订 ${index.revision}；本页草稿代次 ${snapshot.revision}。包含当前对白草稿，不代表正在预览的旧修订。`;
      this.renderOutgoing();
      this.renderTargets();
      this.renderIncoming();
    } catch (error: unknown) {
      this.#index = null;
      this.#snapshot = null;
      this.#catalog = [];
      this.#definitions.clear();
      this.#stale = true;
      this.#version++;
      this.#target = null;
      this.#outPage = this.#inPage = this.#targetPage = 0;
      this.renderOutgoing();
      this.renderTargets();
      this.renderIncoming();
      this.#status.textContent = `引用未能读取：${error instanceof Error ? error.message : "未知错误"}。已有编辑草稿保留。`;
    }
    this.enabled();
  }

  select(nodeId: string): void {
    this.#selected = nodeId;
    if (!this.valid(false)) return;
    this.#outPage = 0;
    this.renderOutgoing();
    if (nodeId) this.choose({ kind: "node", id: nodeId });
    else {
      this.#target = null;
      this.#inPage = 0;
      this.renderTargets();
      this.renderIncoming();
    }
  }

  /** Exact registered resource only. Origin is checked before a stale index may be rebuilt. */
  openResource(assetId: string, origin: ReferenceOrigin): boolean {
    if (this.#closed || !this.#available) return false;
    const captured = this.#options.capture();
    if (!captured || !this.#options.current(captured) || captured.content !== origin.content
      || captured.sourceSha256 !== origin.sourceSha256 || captured.revision !== origin.revision
      || !captured.content.resources.some(resource => resource.id === assetId)) return false;
    if (!this.valid(false)) this.refresh();
    const snapshot = this.#snapshot;
    if (!this.valid() || !snapshot || snapshot.content !== origin.content
      || snapshot.sourceSha256 !== origin.sourceSha256 || snapshot.revision !== origin.revision) return false;
    const target: ReferenceTarget = { kind: "resource", id: assetId };
    if (!this.#definitions.has(referenceKey(target))) return false;
    this.#version++;
    this.renderOutgoing();
    this.choose(target);
    this.#inHeading.focus();
    return true;
  }

  private valid(requireAvailable = true): boolean {
    if (this.#closed || (requireAvailable && !this.#available) || this.#stale || !this.#index || !this.#snapshot) return false;
    if (!this.#options.current(this.#snapshot)) { this.invalidate(); return false; }
    return true;
  }

  private choose(target: ReferenceTarget): void {
    this.#target = target;
    this.#inPage = 0;
    const position = this.filteredTargets().findIndex(item => referenceKey(item.target) === referenceKey(target));
    if (position >= 0) this.#targetPage = Math.floor(position / PAGE_SIZE);
    this.renderTargets();
    this.renderIncoming();
  }

  private page<T>(
    items: readonly T[], requested: number, count: HTMLElement, previous: HTMLButtonElement, next: HTMLButtonElement,
  ): { page: number; items: readonly T[] } {
    const page = Math.max(0, Math.min(requested, Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1)));
    const start = page * PAGE_SIZE;
    count.textContent = items.length ? `${start + 1}–${Math.min(items.length, start + PAGE_SIZE)} / ${items.length} 处` : "0 处";
    previous.disabled = page === 0;
    next.disabled = start + PAGE_SIZE >= items.length;
    return { page, items: items.slice(start, start + PAGE_SIZE) };
  }

  private renderOutgoing(): void {
    const items = this.#index?.outgoing(this.#selected) ?? [];
    const page = this.page(items, this.#outPage, this.#outCount, this.#outPrevious, this.#outNext);
    this.#outPage = page.page;
    this.#outHeading.textContent = this.#selected ? `节点 ${this.#selected} 的引用` : "请选择节点";
    this.#outList.start = page.page * PAGE_SIZE + 1;
    this.#outList.replaceChildren(...page.items.map(reference => this.row(reference)));
  }

  private filteredTargets(): readonly ReferenceDefinition[] {
    const query = this.#query.value.trim().toLocaleLowerCase();
    const kind = this.#kind.value;
    return this.#catalog.filter(item => (!kind || item.target.kind === kind)
      && `${targetLabel(item.target)} ${item.label}`.toLocaleLowerCase().includes(query));
  }

  private renderTargets(): void {
    const items = this.filteredTargets();
    const page = this.page(items, this.#targetPage, this.#targetCount, this.#targetPrevious, this.#targetNext);
    this.#targetPage = page.page;
    const optionFor = (item: ReferenceDefinition): HTMLOptionElement => {
      const option = element("option", `${targetLabel(item.target)} · ${item.label}`);
      option.value = referenceKey(item.target);
      return option;
    };
    const rows: (HTMLOptionElement | HTMLOptGroupElement)[] = page.items.map(optionFor);
    const key = this.#target ? referenceKey(this.#target) : "";
    const current = this.#definitions.get(key);
    if (current && !page.items.some(item => referenceKey(item.target) === key)) {
      const pinned = element("optgroup");
      pinned.label = items.some(item => referenceKey(item.target) === key)
        ? "当前引用目标（不在本页）" : "当前引用目标（不匹配筛选）";
      pinned.append(optionFor(current));
      rows.unshift(pinned);
      this.#targetCount.textContent += "；另保留当前引用目标";
    }
    this.#targets.replaceChildren(...rows);
    this.#targets.value = key;
  }

  private renderIncoming(): void {
    const items = this.#target ? this.#index?.incoming(this.#target) ?? [] : [];
    const page = this.page(items, this.#inPage, this.#inCount, this.#inPrevious, this.#inNext);
    this.#inPage = page.page;
    this.#inHeading.textContent = this.#target ? `${targetLabel(this.#target)} 的使用位置` : "请选择引用目标";
    this.#inList.start = page.page * PAGE_SIZE + 1;
    this.#inList.replaceChildren(...page.items.map(reference => this.row(reference)));
  }

  private row(reference: ContentReference): HTMLElement {
    const row = element("li");
    const target = action(`${ROLES[reference.role]} → ${targetLabel(reference.target)}`, "target");
    target.dataset.referenceKey = referenceKey(reference.target);
    target.dataset.referenceVersion = String(this.#version);
    row.append(target);
    if (reference.nodeId !== null) {
      const jump = action(`定位节点 ${reference.nodeId}`, "jump");
      jump.dataset.referenceNode = reference.nodeId;
      jump.dataset.referenceVersion = String(this.#version);
      row.append(jump);
    } else row.append(element("span", "作品设置或入口", "reference-note"));
    if (reference.choiceId) row.append(element("span", `选项 ${reference.choiceId}`, "reference-note"));
    row.append(element("code", reference.path));
    const location = `${reference.source.file}${reference.source.field ? ` · ${reference.source.field}` : " · 文件根"}`;
    row.append(element("small", `作者来源：${location}`));
    if (reference.range) row.append(element("small", `对白字符串偏移 ${reference.range.start}–${reference.range.end}（末端不含）`));
    if (reference.derived) row.append(element("span", "转换或默认产生的引用", "reference-note"));
    if (!reference.resolved) row.append(element("strong", reference.role === "text"
      ? "未解析；未知对白占位符仍保留原文" : "未解析；未找到对应声明", "reference-unresolved"));
    return row;
  }

  private click(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button");
    if (!(button instanceof HTMLButtonElement) || !this.#options.root.contains(button) || button.disabled) return;
    const action = button.dataset.referenceAction;
    if (action === "refresh") { if (this.#available) this.refresh(); return; }
    if (!this.valid()) return;
    if ((action === "target" || action === "jump") && button.dataset.referenceVersion !== String(this.#version)) return;
    if (action === "target") {
      const definition = this.#definitions.get(button.dataset.referenceKey ?? "");
      if (definition) this.choose(definition.target);
    } else if (action === "jump") {
      const id = button.dataset.referenceNode;
      if (id) this.#options.navigate(id);
    } else if (action === "out-previous") { this.#outPage--; this.renderOutgoing(); }
    else if (action === "out-next") { this.#outPage++; this.renderOutgoing(); }
    else if (action === "target-previous") { this.#targetPage--; this.renderTargets(); }
    else if (action === "target-next") { this.#targetPage++; this.renderTargets(); }
    else if (action === "in-previous") { this.#inPage--; this.renderIncoming(); }
    else if (action === "in-next") { this.#inPage++; this.renderIncoming(); }
  }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#events.abort();
    this.#index = null;
    this.#snapshot = null;
    this.#catalog = [];
    this.#definitions.clear();
    this.#options.root.replaceChildren();
  }
}
