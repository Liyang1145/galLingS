type Entry = "main" | "timed" | "chapter";
type Values<Key extends string, Value> = Record<Key, Value>;
type Changes<Key extends string, Value> = Partial<Record<Key, Value | null>>;

type Field<Key extends string> = {
  kind?: "range";
  key: Key;
  label: string;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
} | { kind: "checkbox"; key: Key; label: string };

interface Options<Key extends string, Value extends number | boolean> {
  root: HTMLElement;
  noun: string;
  note: string;
  fields: readonly Field<Key>[];
  repository: {
    read(): Promise<{ values: Values<Key, Value> }>;
    update(changes: Changes<Key, Value>): Promise<{ values: Values<Key, Value> }>;
  };
  defaults: Values<Key, Value>;
  readValues(input: unknown): Values<Key, Value>;
  blocked(): boolean;
  trackWrite(operation: () => Promise<void>): Promise<void>;
  valuesChanged(values: Values<Key, Value>): void;
}

/** Explicit preference writes; live adjustment never captures or mutates progress. */
export class PreferencesPanel<Key extends string, Value extends number | boolean = number> {
  readonly #options: Options<Key, Value>;
  readonly #defaults: Values<Key, Value>;
  readonly #keys: readonly Key[];
  readonly #events = new AbortController();
  readonly #inputs = new Map<Key, { input: HTMLInputElement; output: HTMLOutputElement; field: Field<Key> }>();
  readonly #status: HTMLParagraphElement;
  readonly #save: HTMLButtonElement;
  readonly #reset: HTMLButtonElement;
  readonly #retry: HTMLButtonElement;
  #main: Values<Key, Value>;
  #timed: Values<Key, Value>;
  #chapter: Values<Key, Value>;
  #dirty: Changes<Key, Value> = {};
  #mode: Entry = "main";
  #saving = false;
  #reading = false;
  #disposed = false;
  #loadEpoch = 0;
  #message: string;
  #retryOperation: (() => Promise<void>) | null = null;

  constructor(options: Options<Key, Value>) {
    this.#options = options;
    this.#keys = options.fields.map(field => field.key);
    this.#defaults = options.readValues(options.defaults);
    this.#main = { ...this.#defaults };
    this.#timed = { ...this.#defaults };
    this.#chapter = { ...this.#defaults };
    this.#message = `${options.noun}偏好尚未读取，当前使用作者默认。`;
    options.root.classList.add("preferences-panel");
    const heading = document.createElement("h3");
    heading.id = `${options.root.id}-heading`;
    heading.textContent = `${options.noun}设置`;
    options.root.setAttribute("aria-labelledby", heading.id);
    const note = document.createElement("p");
    note.className = "preferences-note";
    note.textContent = options.note;
    const controls = document.createElement("div");
    controls.className = "preferences-grid";
    const { signal } = this.#events;
    for (const field of options.fields) {
      const { key } = field;
      const label = document.createElement("label");
      label.className = "preference-row";
      label.dataset.kind = field.kind ?? "range";
      const text = document.createElement("span");
      text.className = "preference-label";
      text.textContent = field.label;
      const input = document.createElement("input");
      input.type = field.kind === "checkbox" ? "checkbox" : "range";
      if (field.kind !== "checkbox") {
        input.min = String(field.min);
        input.max = String(field.max);
        input.step = String(field.step);
      }
      input.setAttribute("aria-label", field.label);
      const output = document.createElement("output");
      const control = document.createElement("span");
      control.className = "preference-control";
      this.#inputs.set(key, { input, output, field });
      input.addEventListener("input", () => {
        if (this.#saving || this.#reading || this.#disposed || options.blocked()) return;
        const values = options.readValues({
          ...this.values(this.#mode), [key]: field.kind === "checkbox" ? input.checked : input.valueAsNumber,
        });
        if (this.#mode === "main") {
          this.#main = values;
          this.#dirty[key] = values[key];
          this.#message = `${options.noun}已用于本次游玩，尚未保存。`;
        } else if (this.#mode === "timed") this.#timed = values;
        else this.#chapter = values;
        options.valuesChanged(values);
        this.render();
      }, { signal });
      control.append(input, output);
      label.append(text, control);
      controls.append(label);
    }
    this.#save = document.createElement("button");
    this.#save.type = "button";
    this.#save.textContent = `保存${options.noun}偏好`;
    this.#save.addEventListener("click", () => this.save(), { signal });
    this.#reset = document.createElement("button");
    this.#reset.type = "button";
    this.#reset.textContent = "使用作者默认设置";
    this.#reset.addEventListener("click", () => {
      if (this.#saving || this.#reading || this.#disposed || options.blocked()) return;
      if (this.#mode === "main") {
        this.#main = { ...this.#defaults };
        this.#dirty = {};
        for (const key of this.#keys) this.#dirty[key] = null;
        this.#message = `本次游玩已使用作者默认${options.noun}设置；点击保存后，下次也会跟随作者默认。`;
      } else if (this.#mode === "timed") this.#timed = { ...this.#defaults };
      else this.#chapter = { ...this.#defaults };
      options.valuesChanged(this.values(this.#mode));
      this.render();
    }, { signal });
    this.#retry = document.createElement("button");
    this.#retry.type = "button";
    this.#retry.textContent = `重试上次${options.noun}保存`;
    this.#retry.addEventListener("click", () => {
      if (this.#retryOperation) void this.run(this.#retryOperation);
    }, { signal });
    const actions = document.createElement("div");
    actions.className = "controls preferences-actions";
    actions.append(this.#save, this.#reset, this.#retry);
    this.#status = document.createElement("p");
    this.#status.className = "preferences-status";
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    options.root.replaceChildren(heading, note, controls, actions, this.#status);
    this.render();
  }

  values(entry: Entry): Values<Key, Value> {
    return { ...(entry === "main" ? this.#main : entry === "timed" ? this.#timed : this.#chapter) };
  }

  setMode(entry: Entry): void {
    this.#mode = entry;
    this.#options.valuesChanged(this.values(entry));
    this.render();
  }

  refresh(): void { this.render(); }

  setFieldVisible(key: Key, visible: boolean): void {
    const input = this.#inputs.get(key)?.input;
    if (input?.parentElement?.parentElement) input.parentElement.parentElement.hidden = !visible;
  }

  async load(): Promise<void> {
    const epoch = ++this.#loadEpoch;
    this.#reading = true;
    this.#message = `正在读取已保存的${this.#options.noun}偏好……`;
    this.render();
    let timer = 0;
    let aborted: () => void = () => {};
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = window.setTimeout(() => reject(new Error(`${this.#options.noun}偏好读取超过 5 秒，本次先使用作者默认；原记录未重置`)), 5000);
      aborted = () => reject(new Error(`页面已离开，取消采用${this.#options.noun}偏好`));
      this.#events.signal.addEventListener("abort", aborted, { once: true });
    });
    try {
      const state = await Promise.race([this.#options.repository.read(), deadline]);
      if (this.#disposed || epoch !== this.#loadEpoch) return;
      this.#main = this.#options.readValues(state.values);
      this.#message = `已读取${this.#options.noun}偏好；调整后需点击保存，才会用于下次游玩。`;
      this.#options.valuesChanged(this.values(this.#mode));
    } catch (error: unknown) {
      if (!this.#disposed && epoch === this.#loadEpoch) {
        this.#message = `${this.#options.noun}偏好未采用：${error instanceof Error ? error.message : "存储不可用"}。本次可继续调整，已有记录未被替换。`;
      }
    } finally {
      window.clearTimeout(timer);
      this.#events.signal.removeEventListener("abort", aborted);
      if (!this.#disposed && epoch === this.#loadEpoch) { this.#reading = false; this.render(); }
    }
  }

  private save(): void {
    if (this.#mode !== "main" || this.#saving || this.#reading || this.#disposed
      || this.#options.blocked() || !Object.keys(this.#dirty).length) return;
    const changes = { ...this.#dirty };
    const operation = async (): Promise<void> => {
      this.#saving = true;
      this.#message = `正在保存本次选定的${this.#options.noun}……`;
      this.render();
      try {
        const saved = await this.#options.repository.update(changes);
        if (!this.#disposed) {
          for (const key of this.#keys) {
            if (Object.hasOwn(changes, key) && this.#dirty[key] === changes[key]) {
              delete this.#dirty[key];
            }
          }
          const values = this.#options.readValues(saved.values);
          for (const key of this.#keys) {
            const remaining = this.#dirty[key];
            if (remaining !== undefined) values[key] = remaining === null ? this.#defaults[key] : remaining;
          }
          this.#main = values;
          this.#retryOperation = null;
          this.#message = Object.keys(this.#dirty).length
            ? `上次选定的${this.#options.noun}已保存；后续调整仍用于本次游玩，尚未保存。`
            : `${this.#options.noun}偏好已保存；剧情进度与全局成果未改变。`;
          this.#options.valuesChanged(this.values(this.#mode));
        }
      } catch (error: unknown) {
        if (!this.#disposed) {
          this.#retryOperation = operation;
          this.#message = `${this.#options.noun}尚未保存：${error instanceof Error ? error.message : "存储失败"}。可重试原调整；当前设置仅用于本次游玩。`;
        }
        throw error;
      } finally { this.#saving = false; this.render(); }
    };
    void this.run(operation);
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    if (this.#saving || this.#reading || this.#disposed || this.#options.blocked()) return;
    this.#saving = true;
    this.render();
    try { await this.#options.trackWrite(operation); }
    catch { /* The captured operation reports its own failure; the write tracker retains it. */ }
    finally { this.#saving = false; this.render(); }
  }

  private render(): void {
    if (this.#disposed) return;
    const disabled = this.#saving || this.#reading || this.#options.blocked();
    const values = this.values(this.#mode);
    for (const [key, item] of this.#inputs) {
      const value = values[key];
      if (item.field.kind === "checkbox") {
        if (typeof value !== "boolean") throw new Error(`布尔偏好控件需要布尔值：${key}`);
        item.input.checked = value;
        item.output.value = value ? "开启" : "关闭";
      } else {
        if (typeof value !== "number") throw new Error(`数值偏好控件需要数值：${key}`);
        item.input.value = String(value);
        item.output.value = item.field.format(value);
        const percentage = Math.max(0, Math.min(100, (value - item.field.min) / (item.field.max - item.field.min) * 100));
        item.input.style.setProperty("--slider-pct", `${percentage}%`);
      }
      item.input.disabled = disabled;
    }
    this.#save.disabled = disabled || this.#mode !== "main" || !Object.keys(this.#dirty).length;
    this.#reset.disabled = disabled;
    this.#retry.hidden = !this.#retryOperation || this.#mode !== "main";
    this.#retry.disabled = disabled;
    this.#status.textContent = this.#mode !== "main"
      ? `${this.#mode === "timed" ? "限时样例" : "章节试阅"}的${this.#options.noun}只留在本页独立内存，不读取或改写正常游玩的对应偏好。`
      : this.#message;
  }

  dispose(): void {
    this.#disposed = true;
    ++this.#loadEpoch;
    this.#events.abort();
  }
}
