import type { Diagnostic, StoryContent } from "../../../packages/story-model/src/model.ts";

export interface DiagnosticContext {
  readonly content: StoryContent | null;
  readonly sourceSha256: string | null;
  readonly revision: number;
  readonly request: number;
  readonly operation: "load" | "preview" | "save";
}
interface Options {
  root: HTMLElement;
  current(context: DiagnosticContext): boolean;
  navigate(nodeId: string): void;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

/** One read-only diagnostic for the original request. Never guesses a node from paths or indices. */
export class AuthorDiagnostic {
  readonly #options: Options;
  #viewEvents = new AbortController();
  #navigate = element("button", "定位诊断节点");
  readonly #location = element("p");
  #context: DiagnosticContext | null = null;
  #diagnostic: Diagnostic | null = null;
  #available = false;
  #closed = false;

  constructor(options: Options) {
    this.#options = options;
    options.root.classList.add("author-diagnostic");
    options.root.hidden = true;
  }

  show(diagnostic: Diagnostic, context: DiagnosticContext): void {
    if (this.#closed) return;
    this.#viewEvents.abort();
    this.#viewEvents = new AbortController();
    this.#navigate = element("button", "定位诊断节点");
    this.#navigate.type = "button";
    this.#diagnostic = diagnostic;
    this.#context = context;
    this.#navigate.addEventListener("click", () => {
      if (this.#context !== context || this.#diagnostic !== diagnostic) return;
      const nodeId = this.target();
      if (nodeId !== null) this.#options.navigate(nodeId);
      else this.refresh();
    }, { signal: this.#viewEvents.signal });
    const source = diagnostic.source;
    const heading = element("h2", "作者操作诊断");
    const details = element("dl");
    for (const [name, value] of [
      ["操作", context.operation === "load" ? "读取作者源" : context.operation === "preview" ? "准备预览" : "保存作者源"],
      ["诊断代码", diagnostic.code], ["说明", diagnostic.message], ["来源文件", source.file],
      ["来源字段", source.field || "（根）"], ["稳定节点 ID", source.nodeId ?? "未提供"],
      ["原来源索引", source.index === undefined ? "未提供" : String(source.index)],
      ["本次请求的源摘要", context.sourceSha256 ?? "尚无已读取源"], ["本页草稿代次", String(context.revision)],
    ] as const) details.append(element("dt", name), element("dd", value));
    const note = element("p", "字段路径与索引仅用于诊断，不等同于原文件 token 行列或可采用的节点身份。");
    if (context.operation === "save") note.append(" 保存未取得完成确认；草稿保留，必要时先导出并重新读取源确认，不要假定文件未写入。");
    this.#options.root.replaceChildren(heading, details, note, this.#location, this.#navigate);
    this.#options.root.hidden = false;
    this.refresh();
  }

  setAvailable(available: boolean): void {
    this.#available = available;
    this.refresh();
  }
  private target(): string | null {
    const context = this.#context;
    const diagnostic = this.#diagnostic;
    if (this.#closed || !this.#available || !context || !diagnostic || !this.#options.current(context)
      || context.operation === "load" || diagnostic.code === "AUTHOR_CONFLICT"
      || !context.content || context.content.source.sha256 !== context.sourceSha256 || !diagnostic.source.nodeId) return null;
    const node = context.content.nodes.find(node => node.id === diagnostic.source.nodeId);
    return node && diagnostic.source.file === node.source.file ? node.id : null;
  }

  refresh(): void {
    if (this.#closed || !this.#context || !this.#diagnostic) return;
    const nodeId = this.target();
    this.#navigate.disabled = nodeId === null;
    const context = this.#context;
    const issue = !this.#available ? "作者读取或保存期间暂不能定位。"
      : !this.#options.current(context) ? "源、草稿或原请求已变化；这条旧诊断只保留说明，不能定位。"
      : context.operation === "load" ? "读取失败涉及尚未采用的源，不能用现有节点列表猜位置。"
      : this.#diagnostic.code === "AUTHOR_CONFLICT" ? "作者源冲突，不能据当前旧基线猜测磁盘节点；请先导出草稿并明确重新读取。"
      : nodeId === null ? "未提供可与本次源匹配的稳定节点身份；保留来源说明，不按下标或文字猜测。"
      : `可定位已读取源中的节点 ${nodeId}；只切换表单，不启动预览、保存或修复内容。`;
    if (this.#location.textContent !== issue) this.#location.textContent = issue;
  }

  clear(): void {
    if (this.#closed) return;
    this.#viewEvents.abort();
    this.#context = null;
    this.#diagnostic = null;
    this.#options.root.hidden = true;
    this.#options.root.replaceChildren();
  }
  dispose(): void {
    if (this.#closed) return;
    this.clear();
    this.#closed = true;
    this.#viewEvents.abort();
  }
}
