type Entry = "main" | "timed";
type Values<Key extends string> = Record<Key, number>;
type Changes<Key extends string> = Partial<Record<Key, number | null>>;

interface Field<Key extends string> {
  key: Key;
  label: string;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
}

interface Options<Key extends string> {
  root: HTMLElement;
  noun: string;
  note: string;
  fields: readonly Field<Key>[];
  repository: {
    read(): Promise<{ values: Values<Key> }>;
    update(changes: Changes<Key>): Promise<{ values: Values<Key> }>;
  };
  defaults: Values<Key>;
  readValues(input: unknown): Values<Key>;
  blocked(): boolean;
  trackWrite(operation: () => Promise<void>): Promise<void>;
  valuesChanged(values: Values<Key>): void;
}

/** Explicit preference writes; live adjustment never captures or mutates progress. */
export class NumericPreferencesPanel<Key extends string> {
  readonly #options: Options<Key>;
  readonly #defaults: Values<Key>;
  readonly #keys: readonly Key[];
  readonly #events = new AbortController();
  readonly #inputs = new Map<Key, { input: HTMLInputElement; output: HTMLOutputElement; format(value: number): string }>();
  readonly #status: HTMLParagraphElement;
  readonly #save: HTMLButtonElement;
  readonly #reset: HTMLButtonElement;
  readonly #retry: HTMLButtonElement;
  #main: Values<Key>;
  #timed: Values<Key>;
  #dirty: Changes<Key> = {};
  #mode: Entry = "main";
  #saving = false;
  #reading = false;
  #disposed = false;
  #loadEpoch = 0;
  #message: string;
  #retryOperation: (() => Promise<void>) | null = null;

  constructor(options: Options<Key>) {
    this.#options = options;
    this.#keys = options.fields.map(field => field.key);
    this.#defaults = options.readValues(options.defaults);
    this.#main = { ...this.#defaults };
    this.#timed = { ...this.#defaults };
    this.#message = `${options.noun}偏好尚未读取，当前使用作者默认。`;
    const heading = document.createElement("h2");
    heading.textContent = `${options.noun}设置`;
    const note = document.createElement("p");
    note.textContent = options.note;
    const controls = document.createElement("div");
    controls.className = "preferences-grid";
    const { signal } = this.#events;
    for (const field of options.fields) {
      const { key } = field;
      const label = document.createElement("label");
      const text = document.createElement("span");
      text.textContent = field.label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.setAttribute("aria-label", field.label);
      const output = document.createElement("output");
      this.#inputs.set(key, { input, output, format: field.format });
      input.addEventListener("input", () => {
        if (this.#saving || this.#reading || this.#disposed || options.blocked()) return;
        const values = options.readValues({ ...this.values(this.#mode), [key]: input.valueAsNumber });
        if (this.#mode === "main") {
          this.#main = values;
          this.#dirty[key] = values[key];
          this.#message = `${options.noun}已用于本次游玩，尚未保存。`;
        } else this.#timed = values;
        options.valuesChanged(values);
        this.render();
      }, { signal });
      label.append(text, input, output);
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
      } else this.#timed = { ...this.#defaults };
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
    actions.className = "controls";
    actions.append(this.#save, this.#reset, this.#retry);
    this.#status = document.createElement("p");
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    options.root.replaceChildren(heading, note, controls, actions, this.#status);
    this.render();
  }

  values(entry: Entry): Values<Key> { return { ...(entry === "main" ? this.#main : this.#timed) }; }

  setMode(entry: Entry): void {
    this.#mode = entry;
    this.#options.valuesChanged(this.values(entry));
    this.render();
  }

  refresh(): void { this.render(); }

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
      item.input.value = String(values[key]);
      item.input.disabled = disabled;
      item.output.value = item.format(values[key]);
    }
    this.#save.disabled = disabled || this.#mode !== "main" || !Object.keys(this.#dirty).length;
    this.#reset.disabled = disabled;
    this.#retry.hidden = !this.#retryOperation || this.#mode !== "main";
    this.#retry.disabled = disabled;
    this.#status.textContent = this.#mode === "timed"
      ? `限时样例的${this.#options.noun}只留在本页内存，不读取或改写正常游玩的对应偏好。` : this.#message;
  }

  dispose(): void {
    this.#disposed = true;
    ++this.#loadEpoch;
    this.#events.abort();
  }
}
