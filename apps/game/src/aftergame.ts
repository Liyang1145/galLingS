import type { StoryContent } from "../../../packages/story-model/src/model.ts";
import type { CompletionScope } from "../../../packages/story-model/src/completion.ts";
import { ClearedContextReader } from "../../../packages/chat/src/context.ts";
import type { CompletionSource, ContextCandidate } from "../../../packages/chat/src/context.ts";

export interface AftergamePanel {
  open(): Promise<void>;
  close(): void;
  dispose(): void;
}

/** Lazy local panel. There is deliberately no transport or writable game object. */
export function createAftergamePanel(
  root: HTMLElement, content: StoryContent, scope: CompletionScope, source: CompletionSource,
): AftergamePanel {
  const reader = new ClearedContextReader(content, scope, source);
  let visible = false;
  let disposed = false;
  let epoch = 0;
  let events = new AbortController();

  function close(): void {
    visible = false;
    ++epoch;
    events.abort();
    root.replaceChildren();
  }

  async function open(): Promise<void> {
    if (disposed) return;
    close();
    visible = true;
    events = new AbortController();
    const { signal } = events;
    const info = document.createElement("p");
    info.className = "help";
    info.textContent = "这里按每次已保存的通关记录准备只读上下文。查看不会重放结局、改变进度或增加周目。";
    const state = document.createElement("p");
    state.setAttribute("role", "status");
    state.setAttribute("aria-live", "polite");
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.textContent = "重新读取通关记录";
    const label = document.createElement("label");
    label.textContent = "选择一次已保存的通关";
    const selection = document.createElement("select");
    selection.setAttribute("aria-label", "选择一次已保存的通关");
    label.append(selection);
    const details = document.createElement("section");
    details.className = "aftergame-context";
    details.setAttribute("aria-label", "所选通关上下文");
    const limit = document.createElement("p");
    limit.className = "help";
    limit.textContent = "结局与角色的正式解锁规则、模型供应方式尚未配置，暂不开放发送。没有上传数据或创建聊天记录。";
    const send = document.createElement("button");
    send.type = "button";
    send.textContent = "聊天发送暂不可用";
    send.disabled = true;
    root.replaceChildren(info, refresh, state, label, details, limit, send);
    let candidates: readonly ContextCandidate[] = [];

    const current = (request: number): boolean => visible && !disposed && request === epoch && !signal.aborted;
    async function refreshRecords(): Promise<void> {
      const request = ++epoch;
      candidates = [];
      details.replaceChildren();
      selection.replaceChildren(new Option("请明确选择一条通关记录", ""));
      selection.disabled = true;
      refresh.disabled = true;
      state.textContent = "正在读取已提交的通关事实……";
      try {
        const result = await reader.list();
        if (!current(request)) return;
        candidates = result;
        // Keep the ledger order visible. Never infer a most recent route from first-unlock time.
        for (const candidate of result) {
          const option = new Option(
            `通关记录 ${candidate.ordinal} · ${candidate.completion.endingId}${candidate.inCurrentContent ? "" : "（当前内容无法定位）"}`,
            candidate.completion.factId,
          );
          option.disabled = !candidate.inCurrentContent;
          selection.add(option);
        }
        selection.disabled = !result.some(item => item.inCurrentContent);
        state.textContent = !result.length
          ? "尚无已保存的通关事实。请在正常游玩中达成结局并完成全局记录保存；限时样例和编辑预览不会解锁。"
          : `读取到 ${result.length} 条通关记录。请逐条选择；这里不自动挑选结局，也不把不同通关合并。`;
      } catch (error: unknown) {
        if (current(request)) state.textContent = `通关记录无法读取：${error instanceof Error ? error.message : "存储不可用"}。可重新读取，已有成果未被修改。`;
      } finally {
        if (current(request)) refresh.disabled = false;
      }
    }

    async function choose(): Promise<void> {
      const request = ++epoch;
      const factId = selection.value;
      const candidate = candidates.find(item => item.completion.factId === factId);
      details.replaceChildren();
      if (!candidate || !candidate.inCurrentContent) {
        state.textContent = "请选择一条当前内容可定位的已保存通关记录。";
        return;
      }
      state.textContent = `正在重新确认通关记录 ${candidate.ordinal}……`;
      try {
        const context = await reader.read(candidate.completion);
        if (!current(request)) return;
        const title = document.createElement("h3");
        title.textContent = `通关记录 ${candidate.ordinal} · ${context.completion.endingId}`;
        const coverage = document.createElement("p");
        coverage.textContent = "已准备结局事实级上下文。原通关记录未包含当次路线变量、历史内容修订或准确通关时间；当前内容仅用于引用定位。";
        const privacy = document.createElement("p");
        privacy.className = "help";
        privacy.textContent = `记录范围：${context.scope.kind}/${context.scope.id}。这份上下文不含完整存档、对白历史、CG 列表或本地凭据，当前仅在本页查看。`;
        const debug = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "查看只读上下文数据（试用）";
        const json = document.createElement("pre");
        json.textContent = JSON.stringify(context, null, 2);
        debug.append(summary, json);
        details.append(title, coverage, privacy, debug);
        state.textContent = "所选通关事实已重新读取确认。只读上下文准备完成，正式聊天解锁与联网发送尚未接入。";
      } catch (error: unknown) {
        if (current(request)) state.textContent = `上下文未采用：${error instanceof Error ? error.message : "读取失败"}。未发送聊天请求，也未修改主线。`;
      }
    }

    refresh.addEventListener("click", () => { void refreshRecords(); }, { signal });
    selection.addEventListener("change", () => { void choose(); }, { signal });
    await refreshRecords();
  }

  return {
    open, close,
    dispose(): void { disposed = true; close(); },
  };
}
