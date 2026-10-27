import { WebPresentation } from "../../../packages/player/src/web/presentation.ts";
import { createResourceAccess } from "../../../packages/player/src/web/resources.ts";
import type { AuthorWorkspaceModel } from "../../../packages/story-model/src/author-workspace.ts";
import type { JsonObject } from "../../../packages/story-model/src/model.ts";
import type { AuthorDocument } from "./document.ts";
import { whaleSkin } from "virtual:haifeng-appearance";

interface Snapshot { document: AuthorDocument; model: AuthorWorkspaceModel; nodeId: string }
interface Options {
  root: HTMLElement;
  canvas: HTMLElement;
  status: HTMLElement;
  read(): Snapshot | null;
  change(label: string, update: (model: AuthorWorkspaceModel) => void): void;
  notice(message: string): void;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag); value.textContent = text; return value;
}
function rawNode(model: AuthorWorkspaceModel, nodeId: string): JsonObject {
  const node = model.chapters.flatMap(chapter => chapter.nodes).find(node => node.id === nodeId);
  if (!node) throw new Error("所选节点已不存在");
  return node;
}
const sprites = (node: JsonObject): JsonObject[] => node.sprites as JsonObject[];
interface Drag {
  snapshot: Snapshot; id: string; pointer: number; element: HTMLElement;
  x: number; y: number; height: number; clientX: number; clientY: number; resize: boolean;
}
const MOVES: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/** Static author scene through the shared renderer. No story actions, audio or player records. */
export class AuthorStageEditor {
  readonly #options: Options;
  readonly #events = new AbortController();
  #view = new AbortController();
  #render = new AbortController();
  #presentation: WebPresentation | null = null;
  #snapshot: Snapshot | null = null;
  #fields = element("fieldset");
  #body = element("div");
  #selected = "";
  #available = false;
  #visible = true;
  #drag: Drag | null = null;

  constructor(options: Options) {
    this.#options = options;
    options.root.classList.add("stage-properties");
    this.#fields.append(element("legend", "舞台与声音"), this.#body); options.root.append(this.#fields);
    const { canvas } = options;
    const { signal } = this.#events;
    canvas.addEventListener("dragover", event => {
      if (this.#available && this.#visible && event.dataTransfer?.types.includes("application/x-haifeng-asset")) {
        event.preventDefault(); event.dataTransfer.dropEffect = "copy";
      }
    }, { signal });
    canvas.addEventListener("drop", event => {
      const id = event.dataTransfer?.getData("application/x-haifeng-asset");
      if (!id || !this.#available || !this.#visible) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect(), scale = rect.width / 1280;
      this.perform(() => this.useAsset(id, undefined, { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }));
    }, { signal });
    canvas.addEventListener("pointerdown", event => this.pointerDown(event), { signal });
    canvas.addEventListener("pointermove", event => this.pointerMove(event), { signal });
    canvas.addEventListener("pointerup", event => this.pointerUp(event), { signal });
    canvas.addEventListener("pointercancel", () => this.cancelDrag(), { signal });
    canvas.addEventListener("keydown", event => {
      if (!this.#available || !this.#visible || !(event.target instanceof Element)
        || !event.target.closest(".actor")) return;
      const distance = event.shiftKey ? 10 : 1;
      const delta = MOVES[event.key];
      if (!delta) return;
      event.preventDefault(); event.stopPropagation();
      this.perform(() => this.editSprite("键盘移动立绘", sprite => {
        sprite.x = Number(sprite.x) + delta[0] * distance; sprite.y = Number(sprite.y) + delta[1] * distance;
      }));
    }, { signal });
    this.refresh();
  }
  setState(available: boolean, playing: boolean): void {
    this.#available = available; this.#fields.disabled = !available;
    this.#options.status.hidden = playing;
    const visible = !playing;
    if (visible !== this.#visible) {
      this.#visible = visible; this.#options.canvas.hidden = !visible;
      if (!visible) { this.cancelDrag(); this.#render.abort(); this.#presentation?.dispose(); this.#presentation = null; }
      else this.refresh(true);
    }
  }
  private perform(action: () => void): void {
    if (!this.#available) return;
    try { action(); } catch (error: unknown) { this.#options.notice(error instanceof Error ? error.message : "舞台修改未采用"); }
  }
  private change(label: string, update: (node: JsonObject) => void): void {
    const snapshot = this.#options.read();
    if (!snapshot) throw new Error("请先选择节点");
    this.#options.change(label, model => update(rawNode(model, snapshot.nodeId)));
  }
  useAsset(id: string, kind?: string, position?: { x: number; y: number }): void {
    const snapshot = this.#options.read();
    const asset = snapshot?.model.assets.find(asset => asset.key === id);
    if (!asset || !this.#available) throw new Error("所选素材不可用");
    const type = String(asset.record.type);
    if (kind && kind !== type) throw new Error("素材类别已改变，请重新选择");
    if (type === "ch") this.#selected = `sprite-${crypto.randomUUID()}`;
    this.change("应用舞台素材", node => {
      if (type === "bg") node.bg = id;
      else if (type === "bgm") node.bgm = id;
      else if (type === "vo") node.voice = id;
      else if (type === "se") {
        const events = (node.seEvents ?? []) as JsonObject[];
        events.push({ id, gain: 1, delayMs: 0 }); node.seEvents = events;
      } else if (type === "ch") sprites(node).push({
        uid: this.#selected, asset: id, x: Math.round(position?.x ?? 640), y: Math.round(position?.y ?? 720),
        h: 700, flip: false, in: "", out: "", look: "", poseSwitch: null,
      });
    });
  }
  private editSprite(label: string, update: (sprite: JsonObject) => void): void {
    const id = this.#selected;
    this.change(label, node => {
      const sprite = sprites(node).find(sprite => sprite.uid === id);
      if (!sprite) throw new Error("请先选择立绘实例");
      update(sprite);
    });
  }
  private button(text: string, action: () => void, disabled = false): HTMLButtonElement {
    const button = element("button", text); button.type = "button"; button.disabled = disabled;
    button.addEventListener("click", () => this.perform(action), { signal: this.#view.signal }); return button;
  }
  private label(text: string, input: HTMLElement): HTMLLabelElement {
    const label = element("label", text); label.append(input); return label;
  }
  private select(snapshot: Snapshot, title: string, kind: string, selected: string, changed: (id: string) => void, empty?: string): HTMLElement {
    const input = element("select"); input.setAttribute("aria-label", title);
    if (empty) input.add(new Option(empty, ""));
    for (const asset of snapshot.model.assets.filter(asset => asset.record.type === kind)) {
      input.add(new Option(`${asset.record.name || asset.key}`, asset.key));
    }
    input.value = selected;
    input.addEventListener("change", () => this.perform(() => changed(input.value)), { signal: this.#view.signal });
    return this.label(title, input);
  }
  private number(title: string, value: number, changed: (value: number) => void, minimum?: number): HTMLElement {
    const input = element("input"); input.type = "number"; input.step = "any"; input.value = String(value);
    input.setAttribute("aria-label", title);
    if (minimum !== undefined) input.min = String(minimum);
    input.addEventListener("change", () => this.perform(() => {
      const value = input.valueAsNumber;
      if (!Number.isFinite(value) || (minimum !== undefined && value < minimum)) throw new Error(`${title}数值无效`);
      changed(value);
    }), { signal: this.#view.signal });
    return this.label(title, input);
  }
  refresh(force = false): void {
    const snapshot = this.#options.read();
    const previous = this.#snapshot;
    const changed = force || previous?.model !== snapshot?.model || previous?.nodeId !== snapshot?.nodeId
      || previous?.document.locations !== snapshot?.document.locations;
    if (!changed) return;
    this.#snapshot = snapshot;
    this.cancelDrag();
    this.#view.abort(); this.#view = new AbortController(); this.#body.replaceChildren();
    if (!snapshot) { this.#body.append(element("p", "选择节点后可编辑舞台。")); return; }
    const node = rawNode(snapshot.model, snapshot.nodeId);
    const placement = sprites(node);
    if (!placement.some(sprite => sprite.uid === this.#selected)) this.#selected = String(placement[0]?.uid ?? "");
    this.#body.append(
      this.select(snapshot, "背景", "bg", String(node.bg ?? ""), value => this.change("更换背景", node => { node.bg = value; }), "无背景"),
      this.select(snapshot, "配乐", "bgm", String(node.bgm ?? ""), value => this.change("选择配乐", node => { node.bgm = value; }), "停奏"),
      this.select(snapshot, "语音", "vo", String(node.voice ?? ""), value => this.change("选择语音", node => { node.voice = value; }), "无语音"),
      element("h3", "立绘"),
    );
    const list = element("select"); list.size = Math.min(6, Math.max(2, placement.length));
    list.setAttribute("aria-label", "选择舞台立绘实例");
    for (const sprite of placement) list.add(new Option(`${sprite.asset} · ${sprite.uid}`, String(sprite.uid)));
    list.value = this.#selected;
    list.addEventListener("change", () => { this.#selected = list.value; this.refresh(true); }, { signal: this.#view.signal });
    this.#body.append(list);
    const sprite = placement.find(sprite => sprite.uid === this.#selected);
    if (sprite) {
      this.#body.append(
        this.select(snapshot, "立绘素材", "ch", String(sprite.asset), value => this.editSprite("替换立绘素材", sprite => { sprite.asset = value; })),
        this.number("立绘 X", Number(sprite.x), value => this.editSprite("调整立绘位置", sprite => { sprite.x = value; })),
        this.number("立绘 Y", Number(sprite.y), value => this.editSprite("调整立绘位置", sprite => { sprite.y = value; })),
        this.number("立绘高度", Number(sprite.h), value => this.editSprite("调整立绘大小", sprite => { sprite.h = value; }), 1),
      );
      const flip = element("input"); flip.type = "checkbox"; flip.checked = !!sprite.flip; flip.setAttribute("aria-label", "水平翻转立绘");
      flip.addEventListener("change", () => this.perform(() => this.editSprite("翻转立绘", sprite => { sprite.flip = flip.checked; })), { signal: this.#view.signal });
      const order = (direction: -1 | 1) => this.change("调整立绘层级", node => {
        const values = sprites(node), index = values.findIndex(sprite => sprite.uid === this.#selected), other = index + direction;
        if (index < 0 || other < 0 || other >= values.length) return;
        [values[index], values[other]] = [values[other]!, values[index]!];
      });
      const controls = element("div"); controls.className = "controls";
      controls.append(this.button("后移一层", () => order(-1)), this.button("前移一层", () => order(1)),
        this.button("移除这张立绘", () => this.change("移除立绘实例", node => { node.sprites = sprites(node).filter(sprite => sprite.uid !== this.#selected); })));
      this.#body.append(this.label("水平翻转", flip), controls);
    }
    this.tracks(snapshot, node, false); this.tracks(snapshot, node, true);
    this.#body.append(element("p", "编辑画面使用静态场面，不执行进入动作或播放声音。拖动立绘调整位置，拖动角标调整大小；方向键微调，Shift 加快。"));
    this.#fields.disabled = !this.#available;
    if (this.#visible) this.renderScene(snapshot);
  }
  private tracks(snapshot: Snapshot, node: JsonObject, ambience: boolean): void {
    this.#body.append(element("h3", ambience ? "环境声" : "一次音效"));
    const field = ambience ? "ambience" : "seEvents";
    const tracks = (node[field] ?? []) as JsonObject[];
    const rows = tracks.map((track, index) => ({ track, index }));
    if (!ambience && node.se) rows.unshift({ track: { id: node.se, gain: node._seGain ?? 1, delayMs: 0 }, index: -1 });
    for (const [ordinal, { track, index }] of rows.entries()) {
      const change = (update: (track: JsonObject) => void) => this.change(ambience ? "调整环境声" : "调整音效", node => {
        if (index === -1) {
          const temporary: JsonObject = { id: node.se ?? "", gain: node._seGain ?? 1, delayMs: 0 };
          update(temporary); node.se = temporary.id!; node._seGain = temporary.gain!;
        } else update((node[field] as JsonObject[])[index]!);
      });
      const section = element("section"); section.className = "sound-row";
      section.append(this.select(snapshot, `${ambience ? "环境声" : "音效"}素材 ${ordinal + 1}`, "se", String(track.id),
        value => change(track => { track.id = value; })),
      this.number(`${ambience ? "环境声" : "音效"}增益 ${ordinal + 1}`, Number(track.gain ?? 1), value => change(track => { track.gain = value; }), 0),
      this.button("移除声音", () => this.change("移除节点声音", node => {
        if (index === -1) node.se = "";
        else (node[field] as JsonObject[]).splice(index, 1);
      })));
      this.#body.append(section);
    }
    const asset = snapshot.model.assets.find(asset => asset.record.type === "se");
    this.#body.append(this.button(ambience ? "添加环境声" : "添加一次音效", () => this.change("添加节点声音", node => {
      const values = (node[field] ?? []) as JsonObject[];
      const existing = new Set(values.map(track => track.id));
      const selected = ambience ? snapshot.model.assets.find(asset => asset.record.type === "se" && !existing.has(asset.key)) : asset;
      if (!selected) throw new Error("没有可添加的声音素材");
      values.push(ambience ? { id: selected.key, gain: 1 } : { id: selected.key, gain: 1, delayMs: 0 }); node[field] = values;
    }), !asset));
  }
  private renderScene(snapshot: Snapshot): void {
    this.#render.abort(); this.#render = new AbortController(); this.#presentation?.dispose(); this.#presentation = null;
    const node = snapshot.document.content.nodes.find(node => node.id === snapshot.nodeId);
    if (!node) return;
    const { canvas, status } = this.#options;
    const { signal } = this.#render;
    try {
      const resources = createResourceAccess(snapshot.document.content, snapshot.document.locations);
      const presentation = new WebPresentation(canvas, snapshot.document.content, resources, false, undefined, undefined, whaleSkin.artwork);
      this.#presentation = presentation;
      status.textContent = "静态编辑场面 · 拖动立绘可调整位置";
      presentation.present({
        nodeId: node.id, step: 0, phase: "ready", chapter: node.chapter, variables: {},
        player: { "周目": 1, "结局数": 0 }, choices: [], timeout: null, terminal: null,
        presentation: { ...node.presentation, scene: { ...node.presentation.scene, music: { kind: "stop", fadeMs: 0 }, ambience: [] },
          performance: { ...node.presentation.performance, voiceId: null, sounds: [] } },
      }, {
        signal, mode: "restore", restore: null, paused: true, skipping: true,
        clock: { now: () => performance.now(), schedule(delay, action) { const timer = window.setTimeout(action, delay); return () => window.clearTimeout(timer); } },
        textReady() {}, voiceEnded() {},
        sceneReady: () => {
          if (signal.aborted || snapshot !== this.#snapshot) return;
          for (const actor of canvas.querySelectorAll<HTMLElement>(".actor[data-instance]")) {
            actor.tabIndex = 0; actor.classList.toggle("author-selected", actor.dataset.instance === this.#selected);
            actor.setAttribute("aria-label", `舞台立绘 ${actor.dataset.instance}`);
            const handle = element("button"); handle.type = "button"; handle.className = "author-resize";
            handle.setAttribute("aria-label", `调整立绘 ${actor.dataset.instance} 大小`);
            actor.append(handle);
          }
        },
        problem: problem => { if (!signal.aborted) status.textContent = `编辑场面：${problem.message}；草稿保留。`; },
      });
    } catch (error: unknown) { status.textContent = `场面未显示：${error instanceof Error ? error.message : "显示错误"}。`; }
  }
  private pointerDown(event: PointerEvent): void {
    if (!this.#available || !this.#visible || event.button !== 0 || !(event.target instanceof Element)) return;
    const actor = event.target.closest<HTMLElement>(".actor[data-instance]"), snapshot = this.#options.read();
    if (!actor || !snapshot) return;
    const sprite = sprites(rawNode(snapshot.model, snapshot.nodeId)).find(sprite => sprite.uid === actor.dataset.instance);
    if (!sprite) return;
    event.preventDefault(); event.stopPropagation(); this.#selected = String(sprite.uid);
    this.#drag = { snapshot, id: this.#selected, pointer: event.pointerId, element: actor,
      x: Number(sprite.x), y: Number(sprite.y), height: Number(sprite.h), clientX: event.clientX, clientY: event.clientY,
      resize: !!event.target.closest(".author-resize") };
    for (const value of this.#options.canvas.querySelectorAll<HTMLElement>(".actor")) value.classList.toggle("author-selected", value === actor);
    this.#options.canvas.setPointerCapture(event.pointerId);
  }
  private pointerMove(event: PointerEvent): void {
    const drag = this.#drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    const scale = this.#options.canvas.getBoundingClientRect().width / 1280;
    const dx = (event.clientX - drag.clientX) / scale, dy = (event.clientY - drag.clientY) / scale;
    if (drag.resize) drag.element.style.height = `${Math.max(1, drag.height - dy)}px`;
    else { drag.element.style.left = `${drag.x + dx}px`; drag.element.style.top = `${drag.y + dy}px`; }
  }
  private pointerUp(event: PointerEvent): void {
    const drag = this.#drag;
    if (!drag || drag.pointer !== event.pointerId) return;
    const current = this.#options.read(), x = Number.parseFloat(drag.element.style.left), y = Number.parseFloat(drag.element.style.top);
    const height = Number.parseFloat(drag.element.style.height);
    this.cancelDrag();
    if (!this.#available || current?.model !== drag.snapshot.model || current.nodeId !== drag.snapshot.nodeId) return;
    this.perform(() => this.editSprite(drag.resize ? "拖动调整立绘大小" : "拖动调整立绘位置", sprite => {
      if (drag.resize) sprite.h = Math.round(height);
      else { sprite.x = Math.round(x); sprite.y = Math.round(y); }
    }));
    this.refresh(true);
  }
  private cancelDrag(): void {
    const drag = this.#drag; this.#drag = null;
    if (drag && this.#options.canvas.hasPointerCapture(drag.pointer)) this.#options.canvas.releasePointerCapture(drag.pointer);
  }
  dispose(): void {
    this.cancelDrag(); this.#render.abort(); this.#presentation?.dispose(); this.#view.abort(); this.#events.abort();
    this.#options.root.replaceChildren(); this.#options.canvas.replaceChildren();
  }
}
