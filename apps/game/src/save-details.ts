import type { StoryContent, Value } from "../../../packages/story-model/src/model.ts";
import type { InspectedSave } from "../../../packages/player/src/saves.ts";
import type { TrackCheckpoint, VoiceCheckpoint } from "../../../packages/player/src/checkpoint.ts";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
function group(title: string, rows: readonly (readonly [string, string])[]): HTMLElement {
  const section = element("section", "", "save-detail-group");
  const list = element("dl");
  for (const [name, value] of rows) {
    const row = element("div");
    row.append(element("dt", name), element("dd", value));
    list.append(row);
  }
  section.append(element("h4", title), list);
  return section;
}
const valueText = (value: Value): string => typeof value === "string" ? JSON.stringify(value) : String(value);
const duration = (milliseconds: number): string => milliseconds < 1000
  ? `${milliseconds} 毫秒` : `${(milliseconds / 1000).toFixed(2)} 秒`;
const PHASES = { presenting: "呈现中", ready: "可继续", choosing: "等待选择", ended: "本段结束" } as const;
const VOICE_STATES: Readonly<Record<VoiceCheckpoint["state"], string>> = {
  active: "活动", finished: "已结束", skipped: "已跳过", unavailable: "不可用",
};

/** Display a freshly inspected record only; no runtime, storage, media URL or current-player capability. */
export function renderSaveDetails(root: HTMLElement, entry: string, inspected: InspectedSave, content: StoryContent): void {
  const { record, checkpoint, view } = inspected;
  const { timing, controls } = checkpoint;
  const playback = checkpoint.presentation.playback;
  const resourceName = (id: string): string => {
    const resource = content.resources.find(item => item.id === id);
    const name = resource?.metadata.name;
    return typeof name === "string" && name ? name : id;
  };
  const track = (item: TrackCheckpoint): string => `${resourceName(item.assetId)} · `
    + (item.positionMs === null ? "播放位置未能取得" : `位置 ${duration(item.positionMs)}`);
  const fragment = document.createDocumentFragment();
  fragment.append(element("h3", "存档详情"),
    element("p", "这里只显示这份存档保存时的数据；查看不会恢复进度，读取仍需上方的明确操作。", "save-detail-note"));
  const identity = group("保存位置", [["所属入口", entry], ["槽位", JSON.stringify(record.slotId)],
    ["章节", view.chapter || "未标注章节"], ["状态", PHASES[view.phase]]]);
  const savedTime = element("p", "保存时间：");
  const time = element("time", new Date(record.savedAt).toLocaleString());
  time.dateTime = new Date(record.savedAt).toISOString();
  savedTime.append(time);
  identity.append(savedTime);
  fragment.append(identity);
  const dialogue = element("section", "", "save-detail-group");
  dialogue.append(element("h4", "保存时的对白"), element("p", view.presentation.speaker || "旁白", "save-detail-speaker"),
    element("blockquote", view.presentation.text || "此处为无对白的演出节点。"));
  if (view.choices.length) {
    const list = element("ol");
    list.setAttribute("aria-label", "保存时可见的选择，只读");
    for (const choice of view.choices) list.append(element("li", choice.text));
    dialogue.append(element("p", "保存时可见的选择（只读）："), list);
  }
  fragment.append(dialogue);
  const variables = Object.entries(view.variables).map(([name, value]) => [name, valueText(value)] as const);
  const variableGroup = group("保存时的当局变量", variables);
  if (!variables.length) variableGroup.append(element("p", "这份存档没有当局变量。"));
  fragment.append(variableGroup);
  const player = group("保存时的玩家投影", Object.entries(view.player).map(([name, value]) => [name, String(value)] as const));
  player.append(element("p", "这是保存时的上下文。实际读档使用当前已提交的全局成果；这份旧投影不会覆盖周目、结局或 CG 收藏。", "save-detail-note"));
  fragment.append(player);
  const waiting = group("保存时的有效等待", [
    ["选择剩余时间", timing.choiceRemainingMs === null ? "没有限时选择" : duration(timing.choiceRemainingMs)],
    ["已安排的推进等待", timing.advance === null ? "没有已安排的等待" : duration(timing.advance.remainingMs)],
    ["推进等待是否还要求语音", timing.advance === null ? "未安排推进等待" : timing.advance.waitVoice ? "是" : "否"],
    ["是否正等待语音条件", timing.waitingForVoice ? "是" : "否"],
    ["语音等待条件", timing.voiceDone ? "已满足" : "尚未满足"],
    ["自动播放（保存时）", controls.auto ? "开启" : "关闭"],
    ["快进（保存时）", controls.skipping ? "开启" : "关闭"],
  ]);
  waiting.append(element("p", "显示的是保存下来的有效时间，并非持续倒计时。读档会关闭自动与快进，剩余演出/选择等待仍按原恢复规则处理。", "save-detail-note"));
  fragment.append(waiting);
  const audio = group("保存时的声音状态", [
    ["配乐", playback.music === null ? "停奏" : track(playback.music)],
    ["环境声", playback.ambience.length ? playback.ambience.map(track).join("\n") : "无环境声"],
    ["当前句语音", playback.voice === null ? "该句无语音"
      : `${track(playback.voice)} · ${VOICE_STATES[playback.voice.state]}`],
  ]);
  audio.append(element("p", "这里不播放或预加载声音。“位置未能取得”不会按 0 处理；本次读档的语音方式仍需显式选择。", "save-detail-note"));
  fragment.append(audio);
  const diagnostic = element("details", "", "save-detail-diagnostic");
  diagnostic.append(element("summary", "技术诊断（只读）"),
    element("pre", JSON.stringify({ entry, record, view }, null, 2)));
  fragment.append(diagnostic);
  root.replaceChildren(fragment);
}
