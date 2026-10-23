import { ContentError } from "./model.ts";
import type { JsonObject, JsonValue, SourceLocation } from "./model.ts";

export function at(source: SourceLocation, field: string): SourceLocation {
  return { ...source, field: source.field ? `${source.field}.${field}` : field };
}

export function reject(code: string, message: string, source: SourceLocation): never {
  throw new ContentError(code, message, source);
}

export function object(value: unknown, source: SourceLocation): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return reject("SHAPE", "需要对象", source);
  }
  return value as Record<string, unknown>;
}

export function array(value: unknown, source: SourceLocation): unknown[] {
  if (!Array.isArray(value)) return reject("SHAPE", "需要数组", source);
  return value;
}

export function string(value: unknown, source: SourceLocation): string {
  if (typeof value !== "string") return reject("SHAPE", "需要字符串", source);
  return value;
}

export function optionalString(value: unknown, source: SourceLocation): string {
  return value === undefined || value === null ? "" : string(value, source);
}

export function numeric(value: unknown, source: SourceLocation, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) return reject("SHAPE", "需要有限数值", source);
  return value;
}

export function boolean(value: unknown, source: SourceLocation, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") return reject("SHAPE", "需要布尔值", source);
  return value;
}

export function json(value: unknown, source: SourceLocation): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item, i) => json(item, at(source, String(i))));
  const record = object(value, source);
  const entries = Object.entries(record).map(([key, item]) => [key, json(item, at(source, key))] as const);
  return Object.fromEntries(entries);
}

export function jsonObject(value: unknown, source: SourceLocation): JsonObject {
  object(value, source);
  return json(value, source) as JsonObject;
}

/** Every author field must be handled or explicitly preserved. */
export function knownFields(record: Record<string, unknown>, fields: readonly string[], source: SourceLocation): void {
  for (const key of Object.keys(record)) {
    if (!fields.includes(key)) reject("UNSUPPORTED_FIELD", `未支持字段「${key}」，需先明确迁移语义`, at(source, key));
  }
}
