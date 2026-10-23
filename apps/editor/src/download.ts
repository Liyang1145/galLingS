import type { AuthorTextPatch } from "../../../packages/story-model/src/author.ts";

/** Local browser download only; no server request and no author-file write. */
export function downloadDraft(patch: AuthorTextPatch, prefix = "对白草稿"): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(patch, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${prefix}-${patch.sourceSha256.slice(0, 12)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
