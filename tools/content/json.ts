import type { SourceLocation } from "../../packages/story-model/src/model.ts";
import { reject } from "../../packages/story-model/src/read.ts";

export interface StringToken { start: number; end: number; value: string }

/** Strict JSON plus duplicate-key rejection; spans are only for byte-preserving text edits. */
export function authorJson(bytes: Uint8Array, file: string): {
  value: unknown; text: string; strings: ReadonlyMap<string, StringToken>;
} {
  const source: SourceLocation = { file, field: "" };
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    parsed = JSON.parse(text.startsWith("\uFEFF") ? text.slice(1) : text) as unknown;
  } catch {
    return reject("AUTHOR_JSON", "作者文件必须是有效 UTF-8 纯 JSON", source);
  }
  const strings = new Map<string, StringToken>();
  let cursor = 0;
  let count = 0;
  const space = (): void => { while (cursor < text.length && /\s/u.test(text[cursor]!)) cursor++; };
  const quoted = (): StringToken => {
    const start = cursor++;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === "\\") cursor++;
      else if (char === "\"") return { start, end: cursor, value: JSON.parse(text.slice(start, cursor)) as string };
    }
    return reject("AUTHOR_JSON", "作者字符串未结束", source);
  };
  function value(path: (string | number)[], depth: number): void {
    if (depth > 128 || ++count > 1000000) reject("AUTHOR_LIMIT", "作者 JSON 嵌套或字段数量超出范围", source);
    space();
    if (text[cursor] === "\"") strings.set(JSON.stringify(path), quoted());
    else if (text[cursor] === "{") {
      cursor++;
      space();
      const keys = new Set<string>();
      while (text[cursor] !== "}") {
        const key = quoted().value;
        if (keys.has(key)) reject("AUTHOR_JSON", "作者文件包含重复对象键，拒绝有歧义的读取和写回", source);
        keys.add(key);
        space();
        cursor++; // JSON.parse has already checked punctuation and primitive syntax.
        value([...path, key], depth + 1);
        space();
        if (text[cursor] !== ",") break;
        cursor++;
        space();
      }
      cursor++;
    } else if (text[cursor] === "[") {
      cursor++;
      space();
      let index = 0;
      while (text[cursor] !== "]") {
        value([...path, index++], depth + 1);
        space();
        if (text[cursor] !== ",") break;
        cursor++;
      }
      cursor++;
    } else {
      while (cursor < text.length && !/[\s,\]}]/u.test(text[cursor]!)) cursor++;
    }
  }
  value([], 0);
  return { value: parsed, text, strings };
}
