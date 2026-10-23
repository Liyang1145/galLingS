import content, { locations } from "virtual:haifeng-content";
import { createGameSession } from "../../../packages/player/src/session.ts";
import type { GameSession, SessionView } from "../../../packages/player/src/session.ts";
import { WebPresentation } from "../../../packages/player/src/web/presentation.ts";
import { createResourceAccess } from "../../../packages/player/src/web/resources.ts";
import type { Clock } from "../../../packages/player/src/clock.ts";
import { SaveRepository } from "../../../packages/player/src/saves.ts";
import type { InspectedSave } from "../../../packages/player/src/saves.ts";
import { IndexedDbSaveStore } from "../../../packages/player/src/web/saves.ts";
import "./style.css";

function element<T extends HTMLElement>(id: string, kind: { new(...args: never[]): T }): T {
  const result = document.getElementById(id);
  if (!(result instanceof kind)) throw new Error(`页面缺少元素：${id}`);
  return result;
}

const stage = element("stage", HTMLElement);
const scene = element("scene", HTMLElement);
const title = element("title", HTMLElement);
const choices = element("choices", HTMLElement);
const menu = element("menu", HTMLElement);
const status = element("status", HTMLElement);
const debug = element("debug", HTMLElement);
const note = element("preview-note", HTMLElement);
const problem = element("problem", HTMLElement);
const problemMessage = element("problem-message", HTMLElement);
const next = element("next", HTMLButtonElement);
const auto = element("auto", HTMLButtonElement);
const skip = element("skip", HTMLButtonElement);
const pause = element("pause", HTMLButtonElement);
const audio = element("audio", HTMLButtonElement);
const save = element("save-checkpoint", HTMLButtonElement);
const saveMessage = element("save-message", HTMLElement);
const saveDetails = element("save-details", HTMLElement);
const resources = createResourceAccess(content, locations);
const clock: Clock = {
  now: () => performance.now(),
  schedule: (delay, callback) => {
    const timer = window.setTimeout(callback, delay);
    return () => window.clearTimeout(timer);
  },
};
const reads = { main: new Set<string>(), timed: new Set<string>() };
type Entry = "main" | "timed";
const sources = {
  main: content,
  timed: { ...content, entryNodeId: "pm8x8v2h", revision: `m3-preview:pm8x8v2h:${content.revision}` },
};
const store = new IndexedDbSaveStore();
const saves = {
  main: new SaveRepository(sources.main, { kind: "development", id: "normal-entry" }, store),
  timed: new SaveRepository(sources.timed, { kind: "preview", id: "timed-choice:pm8x8v2h" }, store),
};
const entryName = (entry: Entry): string => entry === "main" ? "第一话试播" : "限时选择样例";
let saving = false;
let storageMessageEpoch = 0;
let closed = false;
let session: GameSession | null = null;
let presentation: WebPresentation | null = null;
let generation = 0;
let mode: Entry = "main";
let choiceKey = "";
let progress: HTMLProgressElement | null = null;

const resize = new ResizeObserver(() => scene.style.setProperty("--stage-scale", String(stage.clientWidth / 1280)));
resize.observe(stage);

function show(view: SessionView): void {
  const { story, token } = view;
  const blocked = view.paused.length > 0 || view.disposed;
  next.disabled = blocked || story.phase === "choosing" || story.phase === "ended";
  auto.disabled = skip.disabled = story.phase === "ended";
  pause.disabled = audio.disabled = false;
  save.disabled = saving || !view.canCheckpoint;
  auto.setAttribute("aria-pressed", String(view.auto));
  skip.setAttribute("aria-pressed", String(view.skipping));
  pause.textContent = view.paused.includes("menu") ? "关闭菜单" : "菜单 / 暂停";
  menu.hidden = !view.paused.includes("menu");
  const phases = { presenting: "呈现中", ready: "可继续", choosing: "等待选择", ended: "本段结束" };
  status.textContent = `${story.nodeId} · ${phases[story.phase]}${view.paused.length ? ` · 已暂停：${view.paused.join(" / ")}` : ""}`
    + (story.terminal?.kind === "ending" ? ` · ${story.terminal.endingId}` : "");
  problem.hidden = !view.problem;
  problemMessage.textContent = view.problem ? `${view.problem.blocking ? "已暂停" : "媒体提示"}：${view.problem.message}` : "";
  debug.textContent = JSON.stringify({ nodeId: story.nodeId, token, variables: story.variables,
    player: story.player, phase: story.phase, choiceRemainingMs: view.choiceRemainingMs }, null, 2);
  const key = `${token.session}:${token.epoch}:${token.step}`;
  if (key !== choiceKey) {
    choiceKey = key;
    choices.replaceChildren();
    progress = null;
    for (const choice of story.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.text;
      button.addEventListener("click", event => {
        event.stopPropagation();
        presentation?.unlockAudio();
        session?.send({ type: "choose", token, choiceId: choice.id });
      });
      choices.append(button);
    }
    if (story.timeout) {
      progress = document.createElement("progress");
      progress.max = story.timeout.durationMs;
      progress.setAttribute("aria-label", "选择剩余有效时间");
      choices.append(progress);
    }
  }
  for (const button of choices.querySelectorAll("button")) button.disabled = blocked;
  if (progress) progress.value = view.choiceRemainingMs ?? 0;
}

function start(selected: Entry): void {
  session?.dispose();
  session = null;
  mode = selected;
  choiceKey = "";
  menu.hidden = true;
  title.hidden = true;
  problem.hidden = true;
  choices.replaceChildren();
  resetSaveMessage();
  const preview = selected === "timed";
  const source = sources[selected];
  note.textContent = preview
    ? "限时选择样例：从 pm8x8v2h 和五个声明初值开始（好感/尾鳍等均为 0），周目 1、结局数 0；不是第五话真实路线状态。"
    : "正常开局使用作者指定的首个章节节点；此入口只有内存已读，不读写正式玩家记录。";
  presentation = new WebPresentation(scene, source, resources);
  try {
    session = createGameSession({
      content: source, player: { "周目": 1, "结局数": 0 }, generation: ++generation,
      clock, presentation, seen: reads[selected], onChange: show,
    });
    if (document.hidden) session.send({ type: "pause", reason: "background", paused: true });
    presentation.unlockAudio();
  } catch (error: unknown) {
    presentation.dispose();
    session = null;
    presentation = null;
    title.hidden = false;
    next.disabled = auto.disabled = skip.disabled = pause.disabled = audio.disabled = save.disabled = true;
    problem.hidden = false;
    problemMessage.textContent = `新会话未能启动：${error instanceof Error ? error.message : "未知错误"}。没有切换到旧播放器。`;
  }
}

function advance(): void {
  presentation?.unlockAudio();
  const view = session?.view();
  if (view) session?.send({ type: "next", token: view.token });
}

function toggleMenu(): void {
  const view = session?.view();
  if (view) session?.send({ type: "pause", reason: "menu", paused: !view.paused.includes("menu") });
}

function home(): void {
  session?.dispose();
  session = null;
  presentation = null;
  scene.replaceChildren();
  scene.classList.remove("paused");
  choices.replaceChildren();
  title.hidden = false;
  menu.hidden = problem.hidden = true;
  next.disabled = auto.disabled = skip.disabled = pause.disabled = audio.disabled = save.disabled = true;
  resetSaveMessage();
  status.textContent = "已返回试播标题；旧会话的任务已取消";
}

function resetSaveMessage(): void {
  storageMessageEpoch++;
  saveMessage.textContent = "场面就绪并完整显示文字后，可保存当前入口的检查点。两个入口的槽位分别保留。";
  saveDetails.hidden = true;
  saveDetails.textContent = "";
}

function describeSave(entry: Entry, inspected: InspectedSave): void {
  const { record, checkpoint, view } = inspected;
  saveMessage.textContent = `${entryName(entry)} · ${new Date(record.savedAt).toLocaleString()} · ${view.nodeId}。已读取并校验检查点；当前游玩位置未改变。`;
  saveDetails.textContent = JSON.stringify({
    entry: entryName(entry), scope: record.scope, contentRevision: record.checkpoint.story.contentRevision,
    nodeId: view.nodeId, chapter: view.chapter, text: view.presentation.text,
    variables: view.variables, player: view.player, phase: view.phase, choices: view.choices,
    timing: checkpoint.timing, playback: checkpoint.presentation.playback, controls: checkpoint.controls,
  }, null, 2);
  saveDetails.hidden = false;
}

async function saveCheckpoint(): Promise<void> {
  const owner = session;
  if (!owner || saving || !owner.view().canCheckpoint) return;
  const entry = mode;
  const request = ++storageMessageEpoch;
  saving = true;
  save.disabled = true;
  saveDetails.hidden = true;
  saveMessage.textContent = `正在保存${entryName(entry)}检查点……`;
  try {
    const result = await owner.captureCheckpoint(owner.view().token);
    if (!result.accepted) throw new Error(`${result.code}：${result.message}`);
    const inspected = await saves[entry].save("manual", result.checkpoint, Date.now());
    if (!closed && request === storageMessageEpoch) {
      describeSave(entry, inspected);
      saveMessage.textContent = `${entryName(entry)}检查点已提交到本机浏览器存储；可刷新页面后查看。实际恢复游玩尚未开放。`;
    }
  } catch (error: unknown) {
    if (!closed && request === storageMessageEpoch) {
      saveMessage.textContent = `保存失败：${error instanceof Error ? error.message : "未知存储错误"}。可重新保存，未先删除原槽位。`;
    }
  } finally {
    saving = false;
    if (!closed) save.disabled = !session?.view().canCheckpoint;
  }
}

async function inspectSaved(entry: Entry): Promise<void> {
  const request = ++storageMessageEpoch;
  saveDetails.hidden = true;
  saveMessage.textContent = `正在读取${entryName(entry)}检查点……`;
  try {
    const inspected = await saves[entry].read("manual");
    if (closed || request !== storageMessageEpoch) return;
    if (inspected) describeSave(entry, inspected);
    else saveMessage.textContent = `${entryName(entry)}尚未保存检查点。`;
  } catch (error: unknown) {
    if (!closed && request === storageMessageEpoch) {
      saveMessage.textContent = `读取失败：${error instanceof Error ? error.message : "未知存储错误"}。当前会话保持原状，已有数据未被删除。`;
    }
  }
}

element("start", HTMLButtonElement).onclick = () => start("main");
element("timed", HTMLButtonElement).onclick = () => start("timed");
element("restart", HTMLButtonElement).onclick = () => start(mode);
element("home", HTMLButtonElement).onclick = home;
element("close-menu", HTMLButtonElement).onclick = toggleMenu;
element("retry", HTMLButtonElement).onclick = () => session?.send({ type: "retry" });
next.onclick = advance;
pause.onclick = toggleMenu;
auto.onclick = () => { if (session) session.send({ type: "auto", enabled: !session.view().auto }); };
skip.onclick = () => { if (session) session.send({ type: "skip", enabled: !session.view().skipping }); };
audio.onclick = () => presentation?.unlockAudio();
save.onclick = () => { void saveCheckpoint(); };
element("inspect-main", HTMLButtonElement).onclick = () => { void inspectSaved("main"); };
element("inspect-timed", HTMLButtonElement).onclick = () => { void inspectSaved("timed"); };
stage.addEventListener("click", event => {
  if (!(event.target instanceof Element) || event.target.closest("button, .choices, .menu-overlay, .title-screen")) return;
  advance();
});
const visibility = (): void => session?.send({ type: "pause", reason: "background", paused: document.hidden });
const keyboard = (event: KeyboardEvent): void => {
  if (!session || event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
  if (event.target instanceof Element && event.target.closest("button, input, textarea, select, summary")) return;
  if ([" ", "Enter", "ArrowRight"].includes(event.key)) { event.preventDefault(); advance(); }
  else if (event.key === "Escape") { event.preventDefault(); toggleMenu(); }
  else if (event.key.toLowerCase() === "a") session.send({ type: "auto", enabled: !session.view().auto });
};
document.addEventListener("visibilitychange", visibility);
document.addEventListener("keydown", keyboard);
const dispose = (): void => {
  closed = true;
  storageMessageEpoch++;
  session?.dispose();
  resize.disconnect();
  document.removeEventListener("visibilitychange", visibility);
  document.removeEventListener("keydown", keyboard);
};
window.addEventListener("pagehide", dispose, { once: true });
import.meta.hot?.dispose(dispose);
note.textContent = "本地内容已载入。可以从第一话开始，或选择明确标注的限时样例。";
