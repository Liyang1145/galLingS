import type { PreviewProblem } from "./preview.ts";

interface Options {
  root: HTMLElement;
  fallback: HTMLElement;
  read(): Readonly<PreviewProblem> | null;
  current(problem: Readonly<PreviewProblem>): boolean;
  blocked(): boolean;
  navigate(nodeId: string): void;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, value = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = value;
  return result;
}

/** Issue display and an explicit read-only editing intent, outside preview input/fullscreen. */
export class PreviewProblemPanel {
  readonly #options: Options;
  #events = new AbortController();
  #key = "";
  #snapshot: Readonly<PreviewProblem> | null = null;
  #button = element("button");
  readonly #status = element("p");
  #closed = false;

  constructor(options: Options) {
    this.#options = options;
    options.root.classList.add("preview-problem-panel");
    options.root.hidden = true;
  }

  refresh(): void {
    if (this.#closed) return;
    const problem = this.#options.read();
    if (!problem) { this.clear(); return; }
    const key = JSON.stringify(problem);
    const ownedFocus = this.#options.root.contains(document.activeElement);
    const rebuilt = key !== this.#key;
    if (key !== this.#key) {
      this.#events.abort();
      this.#events = new AbortController();
      this.#key = key;
      this.#snapshot = problem;
      this.#button = element("button", "在编辑区定位这个预览节点");
      this.#button.type = "button";
      this.#button.addEventListener("click", () => {
        if (this.#snapshot === problem && !this.#options.blocked() && this.#options.current(problem)) {
          this.#options.navigate(problem.nodeId);
        } else this.refresh();
      }, { signal: this.#events.signal });
      const heading = element("h3", "运行预览问题");
      const data = element("dl");
      for (const [name, value] of [
        ["问题代码", problem.problem.code], ["问题说明", problem.problem.message],
        ["是否阻断", problem.problem.blocking ? "是" : "否"],
        ["当前预览节点", `${problem.nodeId} · ${problem.chapter || "未标章节"}`],
        ["该节点作者来源", `${problem.source.file} · ${problem.source.field}`],
        ["运行预览内容修订", problem.contentRevision],
        ["预览候选作者源摘要", problem.candidateSourceSha256],
        ["启动时作者基线摘要", problem.origin.sourceSha256],
        ["启动时本页草稿代次", String(problem.origin.revision)],
        ["会话 / 呈现 / 步骤", `${problem.token.session} / ${problem.token.epoch} / ${problem.token.step}`],
      ] as const) data.append(element("dt", name), element("dd", value));
      this.#options.root.replaceChildren(heading, data,
        element("p", "来源属于问题发生时的当前预览节点，不代表已确定错误字段或目标资源。定位只切换编辑表单；原“重试当前媒体”仍在预览操作栏。"),
        this.#status, this.#button);
      this.#options.root.hidden = false;
    }
    const permitted = !this.#options.blocked() && this.#options.current(problem);
    this.#button.disabled = !permitted;
    const status = this.#options.blocked() ? "作者操作正在准备或页面已离开，暂不能定位。"
      : permitted ? "启动时基线与草稿仍匹配，可以只读定位；这不会暂停、重试或重启预览。"
      : "原预览或启动时草稿已不匹配，不能用旧预览定位后来修改的内容；可重新预览当前草稿。";
    if (this.#status.textContent !== status) this.#status.textContent = status;
    if (rebuilt && ownedFocus && !this.#options.blocked()) {
      if (permitted) this.#button.focus({ preventScroll: true });
      else this.focusFallback();
    }
  }

  private focusFallback(): void {
    const fallback = this.#options.fallback;
    if (fallback.isConnected && fallback.getClientRects().length && !fallback.closest("[inert]")) {
      fallback.focus({ preventScroll: true });
    }
  }
  private clear(): void {
    if (!this.#snapshot) return;
    const ownedFocus = this.#options.root.contains(document.activeElement);
    this.#events.abort();
    this.#snapshot = null;
    this.#key = "";
    this.#options.root.hidden = true;
    this.#options.root.replaceChildren();
    if (ownedFocus && !this.#closed && !this.#options.blocked()) this.focusFallback();
  }
  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.clear();
    this.#events.abort();
  }
}
