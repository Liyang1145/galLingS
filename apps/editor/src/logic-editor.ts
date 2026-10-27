import { authorChoiceField } from "../../../packages/story-model/src/author.ts";
import type { AuthorFieldValue, AuthorTextField } from "../../../packages/story-model/src/author.ts";
import type { StoryNode } from "../../../packages/story-model/src/model.ts";

interface Options {
  root: HTMLElement;
  read(nodeId: string, field: AuthorTextField, original: string): string;
  update(nodeId: string, field: AuthorTextField, after: string): void;
  closeGroup(): void;
  notice(message: string): void;
  targets(): readonly StoryNode[];
  navigate(nodeId: string): void;
}
interface InputDefinition {
  title: string;
  hint: string;
  kind?: "target" | "default";
}
interface InputContext {
  node: StoryNode;
  signal: AbortSignal;
  current(): boolean;
}
const PAGE_SIZE = 20;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  value.textContent = text;
  return value;
}

/** Node and choice fields share one guarded input and author-draft lifecycle. */
export class AuthorLogicEditor {
  readonly #options: Options;
  readonly #events = new AbortController();
  #rowsEvents = new AbortController();
  readonly #fields = element("fieldset");
  readonly #status = element("p");
  readonly #rows = element("div");
  readonly #previous = element("button", "选项上一页");
  readonly #next = element("button", "选项下一页");
  readonly #suggestions = element("datalist");
  #node: StoryNode | undefined;
  #editable = new Set<AuthorTextField>();
  #page = 0;
  #generation = 0;
  #enabled = false;
  #closed = false;

  constructor(options: Options) {
    this.#options = options;
    options.root.classList.add("choice-text-panel");
    this.#status.className = "help";
    this.#status.setAttribute("role", "status");
    const pager = element("div");
    pager.className = "controls";
    this.#previous.type = this.#next.type = "button";
    pager.append(this.#previous, this.#next);
    this.#fields.append(element("legend", "节点与选项逻辑"), this.#status, this.#rows, pager);
    this.#suggestions.id = `${options.root.id}-target-suggestions`;
    options.root.append(this.#fields, this.#suggestions);
    const turn = (direction: -1 | 1): void => {
      if (!this.#enabled || this.#closed || this.#node?.flow.kind !== "choice") return;
      options.closeGroup();
      const last = Math.max(0, Math.ceil(this.#node.flow.choices.length / PAGE_SIZE) - 1);
      this.#page = Math.max(0, Math.min(last, this.#page + direction));
      options.closeGroup();
      this.render();
    };
    this.#previous.addEventListener("click", () => turn(-1), { signal: this.#events.signal });
    this.#next.addEventListener("click", () => turn(1), { signal: this.#events.signal });
    this.render();
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled && !this.#closed;
    this.#fields.disabled = !this.#enabled;
  }

  show(node: StoryNode | undefined, editable: readonly AuthorFieldValue[]): void {
    if (this.#closed) return;
    if (this.#node !== node) this.#page = 0;
    this.#node = node;
    this.#editable = new Set(editable.map(entry => entry.field));
    this.render();
  }

  private render(): void {
    const generation = ++this.#generation;
    this.#rowsEvents.abort();
    this.#rowsEvents = new AbortController();
    this.#rows.replaceChildren();
    this.#suggestions.replaceChildren();
    this.#fields.disabled = !this.#enabled;
    const node = this.#node;
    const choices = node?.flow.kind === "choice" ? node.flow.choices : [];
    const pages = Math.ceil(choices.length / PAGE_SIZE);
    this.#page = Math.min(this.#page, Math.max(0, pages - 1));
    this.#previous.disabled = this.#page === 0;
    this.#next.disabled = (this.#page + 1) * PAGE_SIZE >= choices.length;
    this.#previous.hidden = this.#next.hidden = pages <= 1;
    this.#status.textContent = node
      ? `节点 ${node.id} · ${choices.length} 个选项${pages > 1 ? `，第 ${this.#page + 1} / ${pages} 页` : ""}。修改先保留在草稿，预览和保存时统一校验。`
      : "选择节点后可编辑已有逻辑字段。";
    if (!node) return;
    const context: InputContext = {
      node, signal: this.#rowsEvents.signal,
      current: () => !this.#closed && this.#enabled && generation === this.#generation,
    };
    const logic = element("section");
    logic.append(element("h3", "节点流转与进入动作"));
    for (const [field, title, hint, kind] of [
      ["set", "进入节点时的变量动作", "留空不修改变量，例如：好感 += 5", undefined],
      ["jump", "节点跳转目标", "填写已有节点 ID；留空按作者顺序继续", "target"],
      ["jumpIf", "节点跳转条件", "有跳转目标时留空表示无条件；条件不成立则按作者顺序继续", undefined],
      ["ending", "结局名称", "已有结局字段可修改或清空；不能与跳转或选项同时配置", undefined],
    ] as const) {
      this.input(logic, context, field, "", { title, hint, ...(kind ? { kind } : {}) });
    }
    if (node.flow.kind === "choice") {
      const timing = element("p", node.flow.timeout
        ? `当前选择倒计时 ${node.flow.timeout.durationMs / 1000} 秒，可调整超时默认选项。`
        : "当前选择没有倒计时，超时默认选项应留空。");
      timing.className = "help";
      logic.append(timing);
      this.input(logic, context, "cdef", "", {
        title: "超时默认选项", hint: "按稳定选项 ID 选择；不会自动修改倒计时时长", kind: "default",
      });
    }
    this.#rows.append(logic);
    for (const choice of choices.slice(this.#page * PAGE_SIZE, (this.#page + 1) * PAGE_SIZE)) {
      const section = element("section");
      section.append(element("h3", `选项 ${choice.id}`));
      for (const [property, title, hint] of [
        ["text", "显示文字", ""],
        ["cond", "显示条件", "留空始终显示，例如：好感 >= 10"],
        ["set", "选中后的变量动作", "留空不修改变量，例如：好感 += 5"],
        ["target", "跳转目标", "填写已有节点 ID；留空按作者顺序继续"],
      ] as const) {
        this.input(section, context, authorChoiceField(choice.id, property), property === "text" ? choice.text : "", {
          title, hint, ...(property === "target" ? { kind: "target" } : {}),
        });
      }
      this.#rows.append(section);
    }
  }

  private input(
    section: HTMLElement, context: InputContext, field: AuthorTextField, original: string, definition: InputDefinition,
  ): void {
    const { node, signal, current } = context;
    const label = element("label", definition.title);
    const input = definition.kind === "default" ? element("select")
      : definition.kind === "target" ? element("input") : element("textarea");
    const value = this.#options.read(node.id, field, original);
    if (input instanceof HTMLSelectElement) {
      const empty = element("option", "不设置默认选项");
      empty.value = "";
      input.append(empty);
      const choices = node.flow.kind === "choice" ? node.flow.choices : [];
      for (const choice of choices) {
        const option = element("option", `${choice.id} · ${this.#options.read(node.id, authorChoiceField(choice.id), choice.text).slice(0, 70)}`);
        option.value = choice.id;
        input.append(option);
      }
      if (value && !choices.some(choice => choice.id === value)) {
        const invalid = element("option", `草稿中的未知选项：${value}`);
        invalid.value = value;
        input.append(invalid);
      }
    } else {
      input.maxLength = 100000;
      input.placeholder = definition.hint;
      if (input instanceof HTMLTextAreaElement) input.rows = 2;
    }
    input.value = value;
    input.disabled = !this.#editable.has(field);
    input.dataset.authorField = field;
    label.append(input);
    section.append(label);
    const note = element("p", input.disabled ? "此字段原本不存在或不是字符串，当前只读。" : definition.hint);
    note.className = "help";
    if (definition.hint || input.disabled) section.append(note);
    const suggest = (): void => {
      if (!current() || definition.kind !== "target") return;
      const query = input.value.trim().toLocaleLowerCase();
      const targets = this.#options.targets().filter(target =>
        [target.id, target.chapter, target.presentation.text].some(text => text.toLocaleLowerCase().includes(query)));
      this.#suggestions.replaceChildren(...targets.slice(0, 50).map(target => {
        const option = element("option");
        option.value = target.id;
        option.label = `${target.chapter || "未标章节"} · ${target.presentation.text.slice(0, 55)}`;
        return option;
      }));
      note.textContent = targets.length > 50
        ? `${definition.hint}。匹配 ${targets.length} 项，继续输入可缩小范围。` : definition.hint;
    };
    if (definition.kind === "target") {
      input.setAttribute("list", this.#suggestions.id);
      const locate = element("button", "定位此目标");
      locate.type = "button";
      locate.addEventListener("click", () => {
        if (!current()) return;
        const position = this.#options.targets().findIndex(target => target.id === node.id);
        const target = this.#options.read(node.id, field, original)
          || (position < 0 ? null : this.#options.targets()[position + 1]?.id ?? null);
        if (target && this.#options.targets().some(item => item.id === target)) this.#options.navigate(target);
        else this.#options.notice(target ? "目标节点不存在，请先修改跳转目标。" : "按顺序到达脚本末尾，没有可定位节点。");
      }, { signal });
      section.append(locate);
    }
    input.addEventListener("focus", () => { this.#options.closeGroup(); suggest(); }, { signal });
    input.addEventListener("blur", () => this.#options.closeGroup(), { signal });
    input.addEventListener("input", event => {
      if (!current() || !this.#editable.has(field)) return;
      const separate = event instanceof InputEvent
        && ["historyUndo", "historyRedo", "insertFromPaste", "insertFromDrop", "deleteByCut"].includes(event.inputType);
      if (separate) this.#options.closeGroup();
      try { this.#options.update(node.id, field, input.value); }
      catch (error: unknown) {
        input.value = this.#options.read(node.id, field, original);
        this.#options.notice(error instanceof Error ? error.message : "字段修改未采用");
      } finally {
        if (separate) this.#options.closeGroup();
        suggest();
      }
    }, { signal });
  }

  dispose(): void {
    this.#closed = true;
    ++this.#generation;
    this.#events.abort();
    this.#rowsEvents.abort();
    this.#node = undefined;
    this.#editable.clear();
    this.#options.root.replaceChildren();
  }
}
