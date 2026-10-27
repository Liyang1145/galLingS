import type { AuthorTextPatch } from "../../../packages/story-model/src/author.ts";

/** Local browser download only; no server request and no author-file write. */
export function downloadDraft(patch: AuthorTextPatch, prefix = "剧情草稿"): void {
  downloadJson(patch, `${prefix}-${patch.sourceSha256.slice(0, 12)}.json`);
}

export function downloadJson(value: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
