import type { DialogueEntry } from "../../../packages/player/src/session.ts";

/** Display detached text only. Entries never carry live playback or rollback callbacks. */
export function renderDialogue(root: HTMLElement, entries: readonly DialogueEntry[]): void {
  root.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.textContent = "这里会留下本次游玩中已经出现的对白和选择。";
    root.append(empty);
    return;
  }
  const list = document.createElement("ol");
  list.className = "dialogue-history";
  for (const entry of entries) {
    const item = document.createElement("li");
    const label = document.createElement("b");
    label.textContent = entry.kind === "choice"
      ? entry.timedOut ? "超时选择" : "选择" : entry.speaker || "旁白";
    const text = document.createElement("p");
    text.textContent = entry.text;
    item.append(label, text);
    list.append(item);
  }
  root.append(list);
}
