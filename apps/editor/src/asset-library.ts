import type { AuthorWorkspaceModel } from "../../../packages/story-model/src/author-workspace.ts";

interface Options {
  root: HTMLElement;
  read(): { model: AuthorWorkspaceModel; locations: Readonly<Record<string, string>> } | null;
  use(id: string, kind: string): void;
  notice(message: string): void;
}
const PAGE = 24;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag); value.textContent = text; return value;
}

/** Registered local assets only. Browsing and auditioning never alter source files. */
export class AuthorAssetLibrary {
  readonly #options: Options;
  readonly #events = new AbortController();
  #view = new AbortController();
  readonly #search = element("input");
  readonly #kind = element("select");
  readonly #grid = element("div");
  readonly #status = element("p");
  readonly #audio = element("audio");
  readonly #previous = element("button", "上一页");
  readonly #next = element("button", "下一页");
  #page = 0;
  #available = false;
  #data: ReturnType<Options["read"]> = null;

  constructor(options: Options) {
    this.#options = options;
    options.root.classList.add("asset-library");
    this.#kind.setAttribute("aria-label", "素材类别");
    for (const [id, name] of [["bg", "背景"], ["ch", "立绘"], ["bgm", "配乐"], ["se", "音效"], ["vo", "语音"]]) {
      this.#kind.add(new Option(name, id));
    }
    this.#search.type = "search"; this.#search.placeholder = "搜索素材名称、ID 或路径";
    this.#search.setAttribute("aria-label", "搜索素材");
    this.#grid.className = "asset-grid";
    this.#status.className = "help"; this.#status.setAttribute("role", "status");
    this.#audio.controls = true; this.#audio.preload = "none"; this.#audio.hidden = true;
    const pager = element("div"); pager.className = "controls";
    this.#previous.type = this.#next.type = "button"; pager.append(this.#previous, this.#next);
    options.root.append(this.#kind, this.#search, this.#status, this.#grid, pager, this.#audio,
      element("p", "点击素材应用到所选节点，也可拖入编辑舞台。试听仅播放所点声音；切换预览会停止试听。"));
    const { signal } = this.#events;
    for (const input of [this.#search, this.#kind]) {
      input.addEventListener(input === this.#search ? "input" : "change", () => { this.#page = 0; this.render(); }, { signal });
    }
    this.#previous.addEventListener("click", () => { this.#page--; this.render(); }, { signal });
    this.#next.addEventListener("click", () => { this.#page++; this.render(); }, { signal });
    this.render();
  }
  setEnabled(enabled: boolean): void {
    const changed = this.#available !== enabled;
    this.#available = enabled;
    this.#search.disabled = this.#kind.disabled = !enabled;
    if (!enabled) this.stopAudio();
    if (changed) this.render();
  }
  refresh(): void {
    const data = this.#options.read();
    const changed = data?.model.assets !== this.#data?.model.assets || data?.locations !== this.#data?.locations;
    this.#data = data;
    if (changed) this.render();
  }
  stopAudio(): void {
    this.#audio.pause();
    if (this.#audio.hasAttribute("src")) { this.#audio.removeAttribute("src"); this.#audio.load(); }
    this.#audio.hidden = true;
  }
  private render(): void {
    this.#view.abort(); this.#view = new AbortController();
    const data = this.#data ?? this.#options.read();
    this.#data = data;
    const query = this.#search.value.trim().toLocaleLowerCase();
    const assets = data?.model.assets.filter(asset => asset.record.type === this.#kind.value
      && [asset.key, asset.record.name, asset.record.src].some(value => String(value ?? "").toLocaleLowerCase().includes(query))) ?? [];
    const pages = Math.ceil(assets.length / PAGE);
    this.#page = Math.max(0, Math.min(this.#page, Math.max(0, pages - 1)));
    this.#previous.disabled = !this.#available || this.#page === 0;
    this.#next.disabled = !this.#available || this.#page + 1 >= pages;
    this.#status.textContent = `${assets.length} 项素材 · ${pages ? `${this.#page + 1} / ${pages} 页` : "无匹配项"}`;
    this.#grid.replaceChildren();
    const { signal } = this.#view;
    for (const asset of assets.slice(this.#page * PAGE, (this.#page + 1) * PAGE)) {
      const card = element("div"); card.className = "asset-card"; card.dataset.assetId = asset.key;
      const use = element("button"); use.type = "button"; use.disabled = !this.#available;
      use.setAttribute("aria-label", `使用素材 ${asset.key}`); use.draggable = this.#available;
      const url = data!.locations[asset.key];
      const kind = String(asset.record.type);
      if (["bg", "ch"].includes(kind) && url) {
        const image = element("img"); image.src = url; image.loading = "lazy"; image.alt = ""; image.draggable = false;
        image.addEventListener("error", () => { image.hidden = true; card.classList.add("asset-unavailable"); }, { signal });
        use.append(image);
      } else use.append(element("span", kind === "vo" ? "◉" : "♫"));
      use.append(element("strong", typeof asset.record.name === "string" ? asset.record.name : asset.key), element("small", asset.key));
      use.addEventListener("click", () => {
        if (this.#available) {
          try { this.#options.use(asset.key, kind); }
          catch (error: unknown) { this.#options.notice(error instanceof Error ? error.message : "素材未应用"); }
        }
      }, { signal });
      use.addEventListener("dragstart", event => {
        if (!this.#available || !event.dataTransfer) return;
        event.dataTransfer.setData("application/x-haifeng-asset", asset.key);
        event.dataTransfer.effectAllowed = "copy";
      }, { signal });
      card.append(use);
      if (!["bg", "ch"].includes(kind)) {
        const audition = element("button", "试听"); audition.type = "button";
        audition.disabled = !this.#available || !url;
        audition.addEventListener("click", () => {
          this.stopAudio();
          if (!this.#available || !url) return;
          this.#audio.hidden = false; this.#audio.src = url;
          void this.#audio.play().catch(error => this.#options.notice(`试听未开始：${error instanceof Error ? error.message : "无法播放"}`));
        }, { signal });
        card.append(audition);
      }
      this.#grid.append(card);
    }
  }
  dispose(): void { this.stopAudio(); this.#events.abort(); this.#view.abort(); this.#options.root.replaceChildren(); }
}
