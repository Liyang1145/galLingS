import type { Resource, StoryContent } from "../../../packages/story-model/src/model.ts";

export interface SceneSnapshot {
  readonly content: StoryContent;
  readonly sourceSha256: string;
  readonly revision: number;
  readonly nodeId: string;
}
interface Options {
  root: HTMLElement;
  capture(): SceneSnapshot | null;
  current(snapshot: SceneSnapshot): boolean;
}
const PAGE_SIZE = 20;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, value = ""): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.textContent = value;
  return result;
}
function button(value: string): HTMLButtonElement {
  const result = element("button", value);
  result.type = "button";
  return result;
}
const literal = (value: unknown): string => {
  const json = JSON.stringify(value, null, 2);
  if (json === undefined) throw new Error("场面摘要遇到非 JSON 字段");
  return json;
};

/** Normalized authored structure only. No media access, renderer, expression evaluation or write API. */
export class AuthorScene {
  readonly #options: Options;
  readonly #events = new AbortController();
  #viewEvents = new AbortController();
  readonly #refresh = button("按当前节点刷新场面");
  readonly #status = element("p", "读取作者源并选择节点后可查看场面。");
  readonly #views = element("fieldset");
  #snapshot: SceneSnapshot | null = null;
  #resources = new Map<string, Resource>();
  #available = false;
  #closed = false;
  #version = 0;

  constructor(options: Options) {
    this.#options = options;
    const heading = element("div");
    heading.className = "controls";
    heading.append(element("h3", "所选节点 · 场面与演出"), this.#refresh);
    this.#status.className = "help";
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    options.root.classList.add("author-scene");
    options.root.append(heading, element("p",
      "只读已读取作者源的规范化场面，不加载图片或声音、不演出。元数据展示原值；实际参数限制、镜头连续、音量与恢复行为由共享播放器处理。",
    ), this.#status, this.#views);
    this.#refresh.addEventListener("click", () => this.refresh(), { signal: this.#events.signal });
    this.enabled();
  }

  setAvailable(available: boolean): void {
    this.#available = available;
    this.enabled();
  }
  private enabled(): void {
    this.#refresh.disabled = this.#closed || !this.#available;
    this.#views.disabled = this.#closed || !this.#available || !this.#snapshot;
    this.#views.inert = this.#views.disabled;
  }
  private clear(): void {
    this.#version++;
    this.#viewEvents.abort();
    this.#viewEvents = new AbortController();
    const ownedFocus = this.#views.contains(document.activeElement);
    this.#views.replaceChildren();
    if (ownedFocus && !this.#refresh.disabled && this.#refresh.getClientRects().length
      && !this.#refresh.closest("[inert]")) this.#refresh.focus({ preventScroll: true });
  }
  invalidate(): void {
    if (this.#closed) return;
    this.#snapshot = null;
    this.#resources.clear();
    this.clear();
    const message = "来源、草稿或所选节点已变化，请按当前节点刷新；场面查看不修改草稿或预览。";
    if (this.#status.textContent !== message) this.#status.textContent = message;
    this.enabled();
  }
  private valid(): boolean {
    if (this.#closed || !this.#available || !this.#snapshot) return false;
    if (!this.#options.current(this.#snapshot)) { this.invalidate(); return false; }
    return true;
  }

  refresh(): void {
    if (this.#closed || !this.#available) return;
    try {
      const snapshot = this.#options.capture();
      if (!snapshot || !this.#options.current(snapshot)) { this.invalidate(); return; }
      this.render(snapshot);
    } catch (error: unknown) {
      // A read-only display error cannot make a confirmed author save look uncommitted.
      this.invalidate();
      this.#status.textContent = `场面摘要未显示：${error instanceof Error ? error.message : "显示错误"}。可再次刷新，未因此改写作者源、草稿或预览。`;
    }
  }

  private render(snapshot: SceneSnapshot): void {
    const node = snapshot.content.nodes.find(value => value.id === snapshot.nodeId);
    if (!node) { this.invalidate(); return; }
    this.clear();
    this.#snapshot = snapshot;
    this.#resources = new Map(snapshot.content.resources.map(resource => [resource.id, resource]));
    const { scene, performance } = node.presentation;
    this.#status.textContent = `节点 ${node.id} · ${node.chapter || "未标章节"}；源 ${snapshot.sourceSha256}；`
      + `草稿代次 ${snapshot.revision}。规范化内容修订 ${snapshot.content.revision} 为已读取源，不是正在播放的预览修订。`;
    this.#views.append(element("legend", "只读规范化场面"));
    const origin = element("section");
    origin.append(element("h4", "身份与来源"), this.rows([
      ["节点 ID", node.id], ["作者标签原值", literal(node.label)], ["章节原值", literal(node.chapter)],
      ["作者来源", `${node.source.file} · ${node.source.field}`],
      ["作者节点索引", node.source.index === undefined ? "未提供" : String(node.source.index)],
    ]), element("p", "以下字段名属于规范化模型；作者来源定位不等同于每个字段在原文件中的 token 行列。"));
    const background = element("section");
    background.append(element("h4", "背景与场面"), this.rows([
      ["氛围原值 scene.mood", literal(scene.mood)],
      ["转场原值 performance.transition", literal(performance.transition)],
      ["瞬时效果原值 performance.screenEffect", literal(performance.screenEffect)],
    ]), scene.background === null ? element("p", "未指定背景（null），不是未读取的资源。")
      : this.resource(scene.background, "背景"));
    const music = element("section");
    music.append(element("h4", "音乐意图"));
    if (scene.music.kind === "stop") {
      music.append(this.rows([["scene.music.kind", "stop · 停奏"], ["淡出参数 fadeMs", `${scene.music.fadeMs} ms`]]));
    } else {
      music.append(this.rows([
        ["scene.music.kind", "play"], ["连续性 continuity", scene.music.continuity],
        ["淡变参数 fadeMs", `${scene.music.fadeMs} ms`],
      ]), this.resource(scene.music.assetId, "配乐"),
      element("p", "continue 保留共享播放器的同曲连续语义；只读本节点不能推断此前曲目、当前位置或当前音量。"));
    }
    const voice = element("section");
    voice.append(element("h4", "语音与阅读时长"), performance.voiceId === null ? element("p", "本节点没有语音（null）。")
      : this.resource(performance.voiceId, "语音"), this.rows([
        ["演出等待 waitMs", `${performance.waitMs} ms`], ["逐字倍率 typeMultiplier", String(performance.typeMultiplier)],
        ["话后停留 holdMs", `${performance.holdMs} ms`],
      ]), element("p", "以上是作者参数，不是当前有效倒计时；不计算自动等待、玩家偏好或检查点剩余时间。"));
    this.#views.append(origin, background,
      this.list("立绘（保留原数组及显示层顺序）", scene.sprites, (sprite, signal) => {
        const card = element("div");
        card.append(this.rows([
          ["实例 ID", sprite.id], ["作者坐标 x / y", `${sprite.x} / ${sprite.y}`],
          ["高度 height", String(sprite.height)], ["水平翻转 flipped", String(sprite.flipped)],
          ["进场 enter 原值", literal(sprite.enter)], ["退场 exit 原值", literal(sprite.exit)],
          ["外观 look 原值", literal(sprite.look)], ["切姿态 poseSwitch 原值", literal(sprite.poseSwitch)],
        ]), this.resource(sprite.assetId, "立绘", signal));
        return card;
      }), music,
      this.list("环境声（原数组顺序）", scene.ambience, (track, signal) => {
        const card = element("div");
        card.append(this.rows([["节点增益 gain", String(track.gain)]]), this.resource(track.assetId, "环境声", signal));
        return card;
      }), voice,
      this.list("一次性音效（原数组顺序）", performance.sounds, (sound, signal) => {
        const card = element("div");
        card.append(this.rows([["节点增益 gain", String(sound.gain)], ["延迟 delayMs", `${sound.delayMs} ms`]]),
          this.resource(sound.assetId, "音效", signal));
        return card;
      }),
      this.list("角色动作映射（只显示，不执行）", Object.entries(performance.actorActions), ([actor, action]) =>
        this.rows([["原映射键", literal(actor)], ["动作原值", literal(action)]])),
      element("p", "角色动作映射键与立绘实例 ID 分别显示，不按名字或数组位置推断匹配。恢复/快进时是否执行演出仍由共享播放器决定。"),
      this.json("保留的 performance.sourceHints（原 JSON）", performance.sourceHints),
      element("p", "条件、进入动作及流转另见节点流转定位；这里只读场面，不求值或模拟路线。"));
    this.enabled();
  }

  private rows(values: readonly (readonly [string, string])[]): HTMLDListElement {
    const list = element("dl");
    for (const [name, value] of values) list.append(element("dt", name), element("dd", value));
    return list;
  }

  private resource(id: string, role: string, signal = this.#viewEvents.signal): HTMLElement {
    const card = element("div");
    card.className = "scene-resource";
    const resource = this.#resources.get(id);
    card.append(element("h5", `${role} · ${id}`));
    if (!resource) {
      card.append(element("p", "资源未登记，未使用其他资源替代或尝试加载。"));
      return card;
    }
    card.append(this.rows([["资源种类", resource.kind], ["作者资源路径（文字）", resource.path]]),
      this.json(`资源 ${id} 元数据原值`, resource.metadata, signal));
    return card;
  }

  private json(title: string, value: unknown, signal = this.#viewEvents.signal): HTMLDetailsElement {
    const details = element("details");
    details.append(element("summary", title));
    const body = element("div");
    details.append(body);
    const version = this.#version;
    details.addEventListener("toggle", () => {
      if (version !== this.#version || !this.valid()) return;
      if (!details.open) { body.replaceChildren(); return; }
      if (!body.childElementCount) body.append(element("pre", literal(value)));
    }, { signal });
    return details;
  }

  private list<T>(title: string, items: readonly T[], render: (item: T, signal: AbortSignal) => HTMLElement): HTMLElement {
    const section = element("section");
    section.append(element("h4", `${title} · ${items.length} 项`));
    if (!items.length) { section.append(element("p", "本节点此列表为空。")); return section; }
    const previous = button("上一页");
    const next = button("下一页");
    const count = element("span");
    const pager = element("div");
    pager.className = "controls scene-pager";
    pager.setAttribute("aria-label", `${title}分页`);
    pager.append(previous, count, next);
    const rows = element("ol");
    let page = 0;
    let rowEvents = new AbortController();
    const version = this.#version;
    const outerSignal = this.#viewEvents.signal;
    outerSignal.addEventListener("abort", () => rowEvents.abort(), { once: true });
    // The subtree changes only on explicit paging. Metadata listeners share this page's lifetime.
    const fill = (): void => {
      rowEvents.abort();
      rowEvents = new AbortController();
      const total = Math.ceil(items.length / PAGE_SIZE);
      previous.disabled = page === 0;
      next.disabled = page + 1 >= total;
      count.textContent = `第 ${page + 1} / ${total} 页`;
      rows.start = page * PAGE_SIZE + 1;
      rows.replaceChildren(...items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(item => {
        const row = element("li");
        row.append(render(item, rowEvents.signal));
        return row;
      }));
      rows.scrollTop = 0;
    };
    const turn = (direction: -1 | 1): void => {
      if (version !== this.#version || !this.valid()) return;
      const candidate = page + direction;
      if (candidate < 0 || candidate >= Math.ceil(items.length / PAGE_SIZE)) return;
      page = candidate;
      fill();
    };
    previous.addEventListener("click", () => turn(-1), { signal: outerSignal });
    next.addEventListener("click", () => turn(1), { signal: outerSignal });
    section.append(pager, rows);
    fill();
    return section;
  }

  dispose(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#snapshot = null;
    this.#resources.clear();
    this.#events.abort();
    this.#viewEvents.abort();
    this.#options.root.replaceChildren();
  }
}
