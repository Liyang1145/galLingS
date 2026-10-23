import type { SourceLocation, StoryContent, Value } from "../../story-model/src/model.ts";
import { at, object, reject, string } from "../../story-model/src/read.ts";
import type { RuntimeView } from "../../story-runtime/src/index.ts";

export interface ReadoutBinding {
  readonly name: string;
  readonly source: SourceLocation;
  readonly derived: boolean;
}

/** The original opt-in save-point readout; not a new story command or a variable evaluator. */
export function readReadoutVariables(content: StoryContent): { favor: ReadoutBinding | null; tail: ReadoutBinding | null } {
  const source = { file: content.source.file, field: "settings" };
  const input = content.source.settings.uiSe;
  const ui = input === undefined || input === null ? {} : object(input, at(source, "uiSe"));
  let soul: Record<string, unknown> | null = null;
  const oldSoul = content.source.settings.soul;
  if ((ui.favorVar === undefined || ui.tailVar === undefined) && oldSoul !== undefined && oldSoul !== null) {
    const candidate = object(oldSoul, at(source, "soul"));
    if (candidate.char !== undefined && candidate.char !== null && string(candidate.char, at(source, "soul.char"))) soul = candidate;
  }
  const binding = (key: "favorVar" | "tailVar", oldKey: "aff" | "signal", fallback: string): ReadoutBinding | null => {
    let name = fallback;
    let where = at(source, `uiSe.${key}`);
    let derived = true;
    if (ui[key] !== undefined) {
      name = string(ui[key], where);
      if (!name.trim()) reject("READOUT_VARIABLE", "数值显示变量名不能为空", where);
      derived = false;
    } else if (soul?.[oldKey] !== undefined) {
      const oldWhere = at(source, `soul.${oldKey}`);
      const value = string(soul[oldKey], oldWhere);
      if (value) { name = value; where = oldWhere; derived = false; }
    }
    if (content.variables.some(variable => variable.name === name)) return Object.freeze({ name, source: where, derived });
    if (!derived) reject("READOUT_VARIABLE", `数值显示需要已声明的剧情变量：${name}`, where);
    return null;
  };
  return { favor: binding("favorVar", "aff", "好感"), tail: binding("tailVar", "signal", "尾鳍") };
}

export class StoryReadout {
  readonly #favor: ReadoutBinding | null;
  readonly #tail: ReadoutBinding | null;
  readonly #savePoints: ReadonlySet<string>;

  constructor(content: StoryContent) {
    const bindings = readReadoutVariables(content);
    this.#favor = bindings.favor;
    this.#tail = bindings.tail;
    // Match author text before interpolation, exactly where the old player appended stats.
    this.#savePoints = new Set(content.nodes.filter(node => /^【[^】]*完[^】]*】\s*存档点/u.test(node.presentation.text))
      .map(node => node.id));
  }

  summary(variables: Readonly<Record<string, Value>>): string {
    const part = (binding: ReadoutBinding | null, suffix: string): string => {
      if (!binding) return "";
      if (!Object.hasOwn(variables, binding.name)) {
        reject("READOUT_VALUE", `当前核心视图缺少已声明的剧情变量：${binding.name}`, binding.source);
      }
      return `${binding.name}${suffix} ${String(variables[binding.name])}`;
    };
    const parts = [part(this.#favor, ""), part(this.#tail, "信号")].filter(Boolean);
    return parts.length ? `〔${parts.join(" · ")}〕` : "";
  }

  text(view: RuntimeView, enabled: boolean): string {
    if (!enabled || !this.#savePoints.has(view.nodeId)) return view.presentation.text;
    const summary = this.summary(view.variables);
    return summary ? `${view.presentation.text}　${summary}` : view.presentation.text;
  }
}
