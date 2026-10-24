import type { PendingWriteView } from "../../../packages/player/src/writes.ts";

export type ExitProgress =
  | { kind: "writes"; retry: boolean }
  | { kind: "records" }
  | { kind: "ready" }
  | { kind: "failed"; stage: "writes" | "records"; message: string };

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

/** Only renders existing operations; it cannot save, retry, cancel or approve a native exit. */
export function renderExitStatus(root: HTMLElement, progress: ExitProgress,
  writes: readonly Readonly<PendingWriteView>[], records: { pending: number; issue: string | null }): void {
  const list = element("ol");
  list.className = "exit-steps";
  const step = (title: string, state: string, note: string): HTMLLIElement => {
    const row = element("li");
    row.dataset.state = state;
    row.append(element("h3", title), element("p", note));
    list.append(row);
    return row;
  };
  const writeIssue = writes.some(item => item.state === "failed");
  const writesDone = progress.kind === "records" || progress.kind === "ready"
    || (progress.kind === "failed" && progress.stage === "records");
  const writeStep = step("已经发起的保存", writesDone ? "done" : writeIssue ? "failed" : "pending",
    writesDone ? "本次等待的手动存档和偏好写入已处理。"
      : progress.kind === "writes" && progress.retry ? "正在重试原操作，仍使用原槽位、检查点或偏好修改。"
      : "等待已有手动存档和偏好保存；不会另外保存当前剧情位置。");
  if (writes.length) {
    const operations = element("ul");
    for (const write of writes) {
      const row = element("li");
      row.dataset.state = write.state;
      row.append(element("strong", write.label), element("span", write.state === "pending" ? "正在处理" : "未完成"));
      if (write.issue) row.append(element("p", write.issue));
      operations.append(row);
    }
    writeStep.append(operations);
  } else if (!writesDone) writeStep.append(element("p", "当前没有待处理的手动存档或偏好写入。"));
  const recordFailure = progress.kind === "failed" && progress.stage === "records" ? progress.message : records.issue;
  step("全局玩家成果", progress.kind === "ready" ? "done"
    : progress.kind === "records" ? "pending" : recordFailure ? "failed" : "waiting",
  progress.kind === "ready" ? "本页已有周目、结局、CG 和已读事实已完成提交。"
    : progress.kind === "records" ? `正在确认全局成果；当前尚有 ${records.pending} 批待提交。`
    : recordFailure ? `全局成果仍待处理：${recordFailure}`
    : `将在已有保存处理后确认；当前尚有 ${records.pending} 批待提交。`);
  step("关闭窗口", progress.kind === "ready" ? "ready" : "waiting",
    progress.kind === "ready" ? "页面已完成退出准备，等待宿主确认关闭；当前游玩继续保持暂停。"
      : "页面尚未确认可以关闭。等待或失败时，可以取消这次退出请求。");
  root.replaceChildren(list);
}
