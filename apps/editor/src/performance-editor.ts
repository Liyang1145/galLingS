import { PRESENTATION_OPTIONS } from "../../../packages/player/src/web/presentation.ts";
import type { AuthorWorkspaceModel } from "../../../packages/story-model/src/author-workspace.ts";
import type { JsonObject } from "../../../packages/story-model/src/model.ts";

interface Options {
  root: HTMLElement;
  read(): { model: AuthorWorkspaceModel; nodeId: string } | null;
  change(label: string, update: (model: AuthorWorkspaceModel) => void): void;
  preview(): void;
  notice(message: string): void;
}
const LABELS: Readonly<Record<string, string>> = {
  "": "默认", none: "无", fade: "淡入淡出", black: "黑场", flash: "闪白", cut: "直接切换",
  left: "向左", right: "向右", up: "向上", down: "向下", pop: "弹入",
  dizzy: "眩晕", flicker: "闪烁", strobe: "频闪", blur: "模糊", sway: "摇晃", gray: "灰度",
  dark: "暗化", danger: "危险", underwater: "水下", slowmo: "慢镜", shake: "震动", quake: "强震",
  redflash: "红色闪光", blink: "眨眼", zoom: "推近", whip: "甩镜", soft: "柔和换姿",
  shadow: "剪影", mystery: "神秘", sepia: "怀旧", night: "夜色", red: "泛红", ghost: "半透明", glow: "发光",
};
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag); value.textContent = text; return value;
}

/** Visual author controls use the renderer's supported values and the existing raw author fields. */
export class AuthorPerformanceEditor {
  readonly #options: Options;
  #events = new AbortController();
  readonly #fields = element("fieldset");
  readonly #body = element("div");
  #available = false;
  #snapshot: ReturnType<Options["read"]> = null;
  #sprite = "";

  constructor(options: Options) {
    this.#options = options; options.root.classList.add("performance-editor");
    this.#fields.append(element("legend", "演出配置"), this.#body); options.root.append(this.#fields); this.refresh();
  }
  setEnabled(enabled: boolean): void { this.#available = enabled; this.#fields.disabled = !enabled; }
  private run(action: () => void): void {
    if (!this.#available) return;
    try { action(); } catch (error: unknown) { this.#options.notice(error instanceof Error ? error.message : "演出修改未采用"); }
  }
  private change(label: string, update: (node: JsonObject) => void): void {
    const snapshot = this.#options.read();
    if (!snapshot) throw new Error("请先选择节点");
    this.#options.change(label, model => {
      const node = model.chapters.flatMap(chapter => chapter.nodes).find(node => node.id === snapshot.nodeId);
      if (!node) throw new Error("节点已不存在");
      update(node);
    });
  }
  private label(title: string, input: HTMLElement): HTMLLabelElement {
    const label = element("label", title); label.append(input); return label;
  }
  private select(title: string, values: readonly string[], value: string, changed: (value: string) => void): HTMLElement {
    const input = element("select"); input.setAttribute("aria-label", title);
    for (const id of values) input.add(new Option(LABELS[id] ?? id, id));
    if (!values.includes(value)) input.add(new Option(`原值（未支持）：${value}`, value));
    input.value = value;
    input.addEventListener("change", () => this.run(() => changed(input.value)), { signal: this.#events.signal });
    return this.label(title, input);
  }
  private number(title: string, value: number, changed: (value: number) => void, minimum = 0, disabled = false, maximum?: number): HTMLElement {
    const input = element("input"); input.type = "number"; input.step = "any"; input.min = String(minimum); input.value = String(value);
    input.disabled = disabled; input.setAttribute("aria-label", title);
    if (maximum !== undefined) input.max = String(maximum);
    input.addEventListener("change", () => this.run(() => {
      const value = input.valueAsNumber;
      if (!Number.isFinite(value) || value < minimum || (maximum !== undefined && value > maximum)) throw new Error(`${title}数值无效`);
      changed(value);
    }), { signal: this.#events.signal });
    return this.label(title, input);
  }
  private button(title: string, action: () => void): HTMLButtonElement {
    const input = element("button", title); input.type = "button";
    input.addEventListener("click", () => this.run(action), { signal: this.#events.signal }); return input;
  }
  refresh(force = false): void {
    const snapshot = this.#options.read();
    if (!force && snapshot?.model === this.#snapshot?.model && snapshot?.nodeId === this.#snapshot?.nodeId) return;
    this.#snapshot = snapshot;
    this.#events.abort(); this.#events = new AbortController(); this.#body.replaceChildren();
    if (!snapshot) { this.#body.append(element("p", "选择节点后可配置演出。")); return; }
    const node = snapshot.model.chapters.flatMap(chapter => chapter.nodes).find(node => node.id === snapshot.nodeId)!;
    this.#body.append(
      this.button("从当前节点试播演出", () => this.#options.preview()),
      this.select("场面转场", PRESENTATION_OPTIONS.transitions, String(node.trans ?? ""), value => this.change("配置转场", node => { node.trans = value; })),
      this.select("镜头效果", PRESENTATION_OPTIONS.effects, String(node.fx ?? ""), value => this.change("配置镜头效果", node => { node.fx = value; })),
      this.select("场面氛围", PRESENTATION_OPTIONS.moods, String(node.mood ?? ""), value => this.change("配置场面氛围", node => { node.mood = value; })),
      element("h3", "时长与阅读"),
      this.number("演出等待（秒）", Number(node.wait ?? 0), value => this.change("调整演出等待", node => { node.wait = value; })),
      this.number("逐字速度倍率", Number(node.typeMul ?? 1), value => this.change("调整逐字速度", node => { node.typeMul = value; }), 0.01),
      this.number("话后停留（毫秒）", Number(node.holdMs ?? 0), value => this.change("调整话后停留", node => { node.holdMs = value; })),
      this.number("音乐淡出（毫秒）", Number(node._musicFadeOutMs ?? 600), value => this.change("调整音乐淡出", node => { node._musicFadeOutMs = value; })),
      element("h3", "限时选择"),
    );
    const choices = node.choices as JsonObject[];
    this.#body.append(this.number("选择倒计时（秒）", Number(node.ctime ?? 0), value => this.change("调整选择倒计时", node => {
      node.ctime = value; if (value === 0) node.cdef = "";
    }), 0, choices.length === 0));
    const choice = element("select"); choice.setAttribute("aria-label", "倒计时默认选项");
    choice.add(new Option("请选择默认选项", ""));
    for (const value of choices) choice.add(new Option(`${value.text} · ${value.id}`, String(value.id)));
    choice.value = String(node.cdef ?? ""); choice.disabled = Number(node.ctime ?? 0) <= 0 || !choices.length;
    choice.addEventListener("change", () => this.run(() => this.change("指定超时默认选项", node => { node.cdef = choice.value; })), { signal: this.#events.signal });
    this.#body.append(this.label("倒计时默认选项", choice),
      element("p", choices.length ? "0 秒表示不限时。启用倒计时后须指定默认项；重新排序不会改变默认项身份。" : "先在结构页新增选项，再配置倒计时。"),
      element("h3", "立绘演出"));
    const placement = node.sprites as JsonObject[];
    if (!placement.some(sprite => sprite.uid === this.#sprite)) this.#sprite = String(placement[0]?.uid ?? "");
    const spriteSelect = element("select"); spriteSelect.setAttribute("aria-label", "配置演出的立绘实例");
    for (const sprite of placement) spriteSelect.add(new Option(`${sprite.asset} · ${sprite.uid}`, String(sprite.uid)));
    spriteSelect.value = this.#sprite;
    spriteSelect.addEventListener("change", () => { this.#sprite = spriteSelect.value; this.refresh(true); }, { signal: this.#events.signal });
    this.#body.append(this.label("立绘实例", spriteSelect));
    const sprite = placement.find(sprite => sprite.uid === this.#sprite);
    const edit = (field: string, value: string | null) => this.change("配置立绘演出", node => {
      (node.sprites as JsonObject[]).find(sprite => sprite.uid === this.#sprite)![field] = value;
    });
    if (sprite) this.#body.append(
      this.select("立绘进场", PRESENTATION_OPTIONS.entries, String(sprite.in ?? ""), value => edit("in", value)),
      this.select("立绘退场", PRESENTATION_OPTIONS.exits, String(sprite.out ?? ""), value => edit("out", value)),
      this.select("立绘外观", PRESENTATION_OPTIONS.looks, String(sprite.look ?? ""), value => edit("look", value)),
      this.select("切换姿态", ["", "soft"], String(sprite.poseSwitch ?? ""), value => edit("poseSwitch", value || null)),
    );
    const acts = (node.acts ?? {}) as JsonObject;
    this.#body.append(element("h3", "进入节点时的角色动作"));
    for (const [target, action] of Object.entries(acts)) {
      const section = element("section");
      section.append(this.select(`动作 ${target}`, PRESENTATION_OPTIONS.actions, String(action), value => this.change("修改角色动作", node => {
        node.acts = { ...(node.acts as JsonObject), [target]: value };
      })), this.button(`移除动作 ${target}`, () => this.change("移除角色动作", node => {
        node.acts = Object.fromEntries(Object.entries((node.acts ?? {}) as JsonObject).filter(([key]) => key !== target));
      })));
      this.#body.append(section);
    }
    if (sprite) this.#body.append(this.select("所选立绘进入动作", ["", ...PRESENTATION_OPTIONS.actions], String(acts[this.#sprite] ?? ""), value => {
      this.change("配置立绘实例动作", node => {
        const acts = { ...(node.acts ?? {}) as JsonObject };
        if (value) node.acts = { ...acts, [this.#sprite]: value };
        else node.acts = Object.fromEntries(Object.entries(acts).filter(([key]) => key !== this.#sprite));
      });
    }), element("p", "实例动作优先于旧角色名规则；选择默认会移除该实例覆盖。上方保留旧规则，可明确修改或移除。"));
    const sounds = (node.seEvents ?? []) as JsonObject[];
    if (sounds.length) this.#body.append(element("h3", "一次音效时序"));
    for (const [index, sound] of sounds.entries()) {
      this.#body.append(this.number(`音效延迟 ${index + 1}（毫秒）`, Number(sound.delayMs ?? 0), value => this.change("调整音效延迟", node => {
        (node.seEvents as JsonObject[])[index]!.delayMs = value;
      }), 0, false, 10000));
    }
    this.#fields.disabled = !this.#available;
  }
  dispose(): void { this.#events.abort(); this.#options.root.replaceChildren(); }
}
