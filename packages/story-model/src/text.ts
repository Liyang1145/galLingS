import type { Value } from "./model.ts";

export interface DialoguePlaceholder {
  readonly name: string;
  /** UTF-16 offsets in the dialogue string, including the braces. */
  readonly start: number;
  readonly end: number;
}

function pattern(): RegExp { return /\{([^{}\s]{1,16})\}/gu; }

/** Shared syntax only: unknown names remain literal, as in the story runtime. */
export function dialoguePlaceholders(text: string): readonly DialoguePlaceholder[] {
  return Object.freeze([...text.matchAll(pattern())].map(match => Object.freeze({
    name: match[1]!, start: match.index, end: match.index + match[0].length,
  })));
}

export function fillDialogue(text: string, values: Readonly<Record<string, Value>>): string {
  return text.replace(pattern(), (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match);
}
