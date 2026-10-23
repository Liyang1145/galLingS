import { loadContent } from "virtual:haifeng-content";
import { whaleSkin } from "virtual:haifeng-appearance";
import { createGameSession } from "../../../packages/player/src/session.ts";
import type { GameSession, RestoreVoice, RollbackRequest, RollbackResult, SessionView } from "../../../packages/player/src/session.ts";
import { WebPresentation } from "../../../packages/player/src/web/presentation.ts";
import { createResourceAccess } from "../../../packages/player/src/web/resources.ts";
import type { Clock } from "../../../packages/player/src/clock.ts";
import { SaveRepository } from "../../../packages/player/src/saves.ts";
import type { InspectedSave } from "../../../packages/player/src/saves.ts";
import { IndexedDbSaveStore } from "../../../packages/player/src/web/saves.ts";
import { PlayerRepository, PlayerRecordWriter, playerProjection } from "../../../packages/player/src/records.ts";
import { prepareGameRestore } from "../../../packages/player/src/checkpoint.ts";
import type { GameCheckpoint } from "../../../packages/player/src/checkpoint.ts";
import { renderGallery } from "./gallery.ts";
import { DialoguePanel } from "./dialogue.ts";
import { connectHost } from "./platform/host.ts";
import { PendingWrites } from "../../../packages/player/src/writes.ts";
import type { AftergamePanel } from "./aftergame.ts";
import { AUDIO_CHANNELS, AudioPreferenceRepository, authorAudioVolumes, readAudioVolumes } from "../../../packages/player/src/preferences.ts";
import {
  READING_KEYS, READING_LIMITS, ReadingPreferenceRepository, authorReadingPreferences, readReadingPreferences,
} from "../../../packages/player/src/reading-preferences.ts";
import {
  ButtonPreferenceRepository, authorButtonPreferences, readButtonPreferences,
} from "../../../packages/player/src/button-preferences.ts";
import { connectButtonSounds } from "../../../packages/player/src/web/button-sounds.ts";
import { PreferencesPanel } from "./preferences.ts";
import { applyAuthorAppearance, connectTitleCover } from "../../../packages/player/src/web/appearance.ts";
import { ChoicePanel } from "../../../packages/player/src/web/choices.ts";
import { connectStageLayout } from "../../../packages/player/src/web/stage-layout.ts";
import { PlayerInput } from "../../../packages/player/src/web/input.ts";
import { PlayerFullscreen } from "../../../packages/player/src/web/fullscreen.ts";
import { nativeFullscreenDriver } from "./platform/fullscreen.ts";
import { SaveSlots } from "./slots.ts";
import type { SaveEntry as Entry } from "./slots.ts";
import "./style.css";

const startup = new AbortController();
const cancelStartup = (): void => startup.abort();
window.addEventListener("pagehide", cancelStartup, { once: true });
import.meta.hot?.dispose(() => {
  cancelStartup();
  window.removeEventListener("pagehide", cancelStartup);
});

async function main(): Promise<void> {
  const { content, locations } = await loadContent(startup.signal);
  if (startup.signal.aborted) return;

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
  const hide = element("hide-ui", HTMLButtonElement);
  const playControls = element("play-controls", HTMLElement);
  const fullscreenButton = element("fullscreen", HTMLButtonElement);
  const save = element("save-checkpoint", HTMLButtonElement);
  const saveMessage = element("save-message", HTMLElement);
  const saveDetails = element("save-details", HTMLElement);
  const recordMessage = element("record-message", HTMLElement);
  const retryRecords = element("retry-records", HTMLButtonElement);
  const gallery = element("gallery", HTMLDialogElement);
  const galleryBody = element("gallery-body", HTMLElement);
  const dialogue = element("dialogue-history", HTMLDialogElement);
  const dialogueBody = element("dialogue-history-body", HTMLElement);
  const aftergame = element("aftergame", HTMLDialogElement);
  const aftergameBody = element("aftergame-body", HTMLElement);
  const dialogueOpen = element("dialogue-history-open", HTMLButtonElement);
  const voiceChoice = element("restore-voice", HTMLSelectElement);
  const rollbackTarget = element("rollback-target", HTMLSelectElement);
  const rollbackBoundary = element("rollback-boundary", HTMLSelectElement);
  const rollbackButton = element("rollback", HTMLButtonElement);
  const rollbackMessage = element("rollback-message", HTMLElement);
  const rollbackWarning = element("rollback-warning", HTMLElement);
  const page = document.querySelector("main");
  if (!(page instanceof HTMLElement)) throw new Error("页面缺少主区域");
  const exitDialog = element("exit-dialog", HTMLDialogElement);
  const exitMessage = element("exit-message", HTMLElement);
  const exitRetry = element("exit-retry", HTMLButtonElement);
  const exitCancel = element("exit-cancel", HTMLButtonElement);
  const writes = new PendingWrites();
  const resources = createResourceAccess(content, locations);
  const appearance = applyAuthorAppearance(stage, content, resources, whaleSkin.artwork);
  element("work-title", HTMLElement).textContent = content.title;
  const titleMenu = title.querySelector(".title-menu");
  if (!(titleMenu instanceof HTMLElement)) throw new Error("页面缺少标题菜单");
  const cover = connectTitleCover({
    root: title, title: element("title-copy", HTMLElement), menu: titleMenu,
    status: element("cover-status", HTMLElement), retry: element("retry-cover", HTMLButtonElement),
    cover: appearance.cover, resources,
  });
  startup.signal.addEventListener("abort", cover.dispose, { once: true });
  const clock: Clock = {
    now: () => performance.now(),
    schedule: (delay, callback) => {
      const timer = window.setTimeout(callback, delay);
      return () => window.clearTimeout(timer);
    },
  };
  const reads = { main: new Set<string>(), timed: new Set<string>() };
  const sources = {
    main: content,
    timed: { ...content, entryNodeId: "pm8x8v2h", revision: `m3-preview:pm8x8v2h:${content.revision}` },
  };
  const store = new IndexedDbSaveStore();
  const saves = {
    main: new SaveRepository(sources.main, { kind: "development", id: "normal-entry" }, store),
    timed: new SaveRepository(sources.timed, { kind: "preview", id: "timed-choice:pm8x8v2h" }, store),
  };
  const playerRecords = new PlayerRepository(content, { kind: "development", id: "normal-entry" }, store);
  const endingFeedbackOwners = new Map<string, { generation: number; presentation: WebPresentation }>();
  const recordWriter = new PlayerRecordWriter(playerRecords, (records, receipt) => {
    const owner = endingFeedbackOwners.get(receipt.batchId);
    endingFeedbackOwners.delete(receipt.batchId);
    for (const nodeId of records.readNodeIds) reads.main.add(nodeId);
    if (closed) return;
    const player = playerProjection(records);
    recordMessage.textContent = `全局记录已保存：周目 ${player["周目"]} · 已解锁结局 ${player["结局数"]} · CG ${records.cgIds.length}`;
    retryRecords.hidden = true;
    if (owner && !exiting && owner.generation === generation && owner.presentation === presentation
      && mode === "main" && session) {
      try {
        const view = session.view();
        if (view.story.phase === "ended" && view.story.terminal?.kind === "ending"
          && receipt.newEndingIds.includes(view.story.terminal.endingId)) {
          session.send({ type: "ending-unlocked", token: view.token, endingId: view.story.terminal.endingId });
        }
      } catch (error: unknown) {
        // A feedback observer cannot turn a committed unlock into a failed write.
        recordMessage.textContent += `；结局声音反馈未完成：${error instanceof Error ? error.message : "声音不可用"}`;
      }
    }
  }, error => {
    if (closed) return;
    recordMessage.textContent = `全局记录尚未保存：${error instanceof Error ? error.message : "存储失败"}。请重试；待保存记录暂留本页内存。`;
    retryRecords.hidden = false;
  });
  const entryName = (entry: Entry): string => entry === "main" ? "第一话试播" : "限时选择样例";
  let saving = false;
  let storageMessageEpoch = 0;
  let closed = false;
  let session: GameSession | null = null;
  let dialogueOwner: GameSession | null = null;
  let presentation: WebPresentation | null = null;
  let input: PlayerInput | null = null;
  let fullscreen: PlayerFullscreen | null = null;
  let generation = 0;
  let mode: Entry = "main";
  let entryRequest = 0;
  let entryPreparation: number | null = null;
  let rollbackKey = "";
  let rollingBack = false;
  let exiting = false;
  let aftergamePanel: AftergamePanel | null = null;
  let dialoguePanel: DialoguePanel | null = null;
  const slots = new SaveSlots({
    root: element("save-slots", HTMLElement), repositories: saves, label: entryName,
    blocked: () => closed || exiting || entryPreparation === entryRequest,
    changed: () => { resetSaveMessage(); refreshSaveControls(); },
  });
  const audioRepository = new AudioPreferenceRepository(content.workId, { kind: "development", id: "normal-entry" },
    authorAudioVolumes(content.source.settings), store);
  const audioLabels = { music: "配乐", ambience: "环境声", voice: "语音", effects: "音效" };
  const audioPreferences = new PreferencesPanel({
    root: element("audio-preferences", HTMLElement),
    noun: "音量",
    note: "调整立即用于本次播放；保存音量可在下次游玩时沿用。音量与剧情进度分开，读档和回退不会恢复旧音量。",
    fields: AUDIO_CHANNELS.map(key => ({
      key, label: audioLabels[key], min: 0, max: 1, step: 0.05,
      format: (value: number) => `${Math.round(value * 100)}%`,
    })),
    defaults: authorAudioVolumes(content.source.settings),
    readValues: readAudioVolumes,
    repository: {
      read: async () => ({ values: (await audioRepository.read()).volumes }),
      update: async changes => ({ values: (await audioRepository.update(changes)).volumes }),
    },
    blocked: () => closed || exiting,
    trackWrite: operation => writes.run("audio-preferences", operation),
    valuesChanged: volumes => {
      presentation?.setAudioVolumes(volumes);
      dialoguePanel?.setVolumes(volumes);
    },
  });
  const readingLabels = {
    textSpeedMs: "逐字间隔", autoWaitMultiplier: "自动等待", textScale: "文字大小", dialogueOpacity: "对话框不透明度",
  };
  const readingPreferences = new PreferencesPanel({
    root: element("reading-preferences", HTMLElement),
    noun: "阅读",
    note: "文字大小与对话框透明度立即生效。逐字间隔越小越快，从下一句采用；自动等待倍率用于下一轮等待。调整不会重置当前选择或停留时间，保存后下次沿用。",
    fields: READING_KEYS.map(key => ({
      key, label: readingLabels[key], ...READING_LIMITS[key],
      format: (value: number) => key === "textSpeedMs" ? `${Math.round(value)} ms`
        : key === "autoWaitMultiplier" ? `${value.toFixed(1)}×` : `${Math.round(value * 100)}%`,
    })),
    defaults: authorReadingPreferences(content.source.settings),
    readValues: readReadingPreferences,
    repository: new ReadingPreferenceRepository(content.workId, { kind: "development", id: "normal-entry" },
      authorReadingPreferences(content.source.settings), store),
    blocked: () => closed || exiting,
    trackWrite: operation => writes.run("reading-preferences", operation),
    valuesChanged: values => {
      presentation?.setReadingPreferences(values);
      session?.send({ type: "auto-wait", multiplier: values.autoWaitMultiplier });
    },
  });
  const buttonPreferences = new PreferencesPanel<"enabled", boolean>({
    root: element("button-preferences", HTMLElement),
    noun: "按钮声音",
    note: "控制游玩操作按钮的点击与鼠标悬停声音，使用音效音量。调整立即生效，保存后下次沿用；选择、存档和剧情提示由各自事件控制。",
    fields: [{ kind: "checkbox", key: "enabled", label: "播放按钮声音" }],
    defaults: authorButtonPreferences(content.source.settings),
    readValues: readButtonPreferences,
    repository: new ButtonPreferenceRepository(content.workId, { kind: "development", id: "normal-entry" },
      authorButtonPreferences(content.source.settings), store),
    blocked: () => closed || exiting,
    trackWrite: operation => writes.run("button-preferences", operation),
    valuesChanged: () => {},
  });
  const buttonEvents = new AbortController();
  connectButtonSounds({
    buttons: [next, auto, skip, pause, dialogueOpen, audio, hide, fullscreenButton],
    signal: buttonEvents.signal,
    enabled: () => {
      if (closed || exiting || document.hidden || !session || !buttonPreferences.values(mode).enabled) return false;
      const view = session.view();
      return !view.disposed && !view.skipping && view.story.phase !== "ended" && view.paused.length === 0;
    },
    play: cue => presentation?.interaction({ type: "cue", cue }),
  });
  const hostStatus = document.createElement("p");
  note.insertAdjacentElement("afterend", hostStatus);
  const host = connectHost(state => {
    const platform = state.issue ? `宿主状态异常，已暂停：${state.issue}`
      : state.platform === "windows-trial" ? "Windows 集成试用 · 记录与旧版隔离"
      : state.platform === "android-trial" ? "Android 集成试用 · 记录与旧版隔离" : "浏览器试播";
    hostStatus.textContent = `${platform}${state.audioIssue ? ` · ${state.audioIssue}` : ""}`;
    presentation?.setAudioAllowed(state.audioAllowed);
    session?.send({ type: "pause", reason: "host", paused: state.paused });
    dialoguePanel?.refresh(state.audioAllowed);
  }, () => {
    if (exiting) { host.cancelExit(); return true; }
    if (dialogue.open) { closeDialogue(); return true; }
    if (gallery.open) { gallery.close(); return true; }
    if (aftergame.open) { closeAftergame(); return true; }
    if (input?.reveal()) return true;
    if (session) { toggleMenu(); return true; }
    return false;
  }, prepareExit);

  dialoguePanel = new DialoguePanel({
    root: dialogueBody, resources, settings: content.source.settings,
    volumes: audioPreferences.values(mode), audioAllowed: host.state().audioAllowed,
    available: () => {
      if (closed || exiting || document.hidden || !dialogue.open || !dialogueOwner || dialogueOwner !== session) return false;
      const view = dialogueOwner.view();
      const state = host.state();
      return !view.disposed && !state.paused && state.audioAllowed
        && view.paused.includes("history") && view.paused.every(reason => reason === "history");
    },
    requestAudio: () => {
      host.requestAudio();
      dialoguePanel?.refresh(host.state().audioAllowed);
    },
    canRollback: () => !closed && !exiting && !rollingBack && entryPreparation !== entryRequest
      && !document.hidden && !host.state().paused && dialogue.open && dialogueOwner === session
      && !!dialogueOwner?.view().canCheckpoint,
    rollback: async (request, signal) => {
      const owner = dialogueOwner;
      if (!owner || owner !== session || !dialogue.open || signal.aborted) {
        return { accepted: false, code: "ROLLBACK_CANCELLED", message: "原回看已关闭或所属会话已改变" };
      }
      const result = await rollbackTo(owner, request, signal);
      if (result.accepted && !signal.aborted && owner === session && dialogueOwner === owner) closeDialogue();
      return result;
    },
  });

  async function prepareExit(signal: AbortSignal): Promise<void> {
    if (closed || signal.aborted) throw new Error("页面已离开或退出已取消");
    if (exiting) throw new Error("已有退出请求");
    exiting = true;
    fullscreen?.refresh();
    audioPreferences.refresh();
    readingPreferences.refresh();
    buttonPreferences.refresh();
    slots.refreshControls();
    entryRequest++;
    const owner = session;
    owner?.send({ type: "pause", reason: "exit", paused: true });
    owner?.send({ type: "pause", reason: "operation", paused: false });
    closeDialogue();
    gallery.close();
    closeAftergame();
    const wasInert = page.inert;
    page.inert = true;
    exitRetry.hidden = true;
    exitCancel.disabled = false;
    let released = false;
    const cleanup = (): void => {
      if (released) return;
      released = true;
      exiting = false;
      fullscreen?.refresh();
      audioPreferences.refresh();
      readingPreferences.refresh();
      buttonPreferences.refresh();
      refreshSaveControls();
      page.inert = wasInert;
      exitDialog.close();
      exitRetry.onclick = exitCancel.onclick = null;
      owner?.send({ type: "pause", reason: "exit", paused: false });
      if (!closed) saveMessage.textContent = "退出已取消。已发起的写入如仍在进行会继续完成；当前未保存进度没有自动新建存档。";
    };
    signal.addEventListener("abort", cleanup, { once: true });
    try {
      exitDialog.showModal();
      await new Promise<void>((resolve, reject) => {
        let running = false;
        const aborted = (): void => reject(new Error("退出已取消，原写入如已发起仍会继续"));
        signal.addEventListener("abort", aborted, { once: true });
        const attempt = async (retry: boolean): Promise<void> => {
          if (running || signal.aborted || closed) return;
          running = true;
          exitRetry.hidden = true;
          exitMessage.textContent = "正在等待已发起的保存，并提交全局成果……";
          try {
            if (retry) await writes.retryFailed();
            else await writes.settle();
            if (signal.aborted || closed) return;
            await recordWriter.flush();
            if (signal.aborted || closed) return;
            if (recordWriter.pending()) throw new Error("仍有未提交的全局记录");
            signal.removeEventListener("abort", aborted);
            exitMessage.textContent = "写入已完成，正在退出。未手动保存的剧情位置不会自动保存。";
            exitCancel.disabled = true;
            resolve();
          } catch (error: unknown) {
            if (!signal.aborted && !closed) {
              exitMessage.textContent = `退出尚未获准：${error instanceof Error ? error.message : "写入失败"}。可以重试原写入，或取消退出后继续处理。`;
              exitRetry.hidden = false;
            }
          } finally { running = false; }
        };
        exitRetry.onclick = () => { void attempt(true); };
        exitCancel.onclick = () => host.cancelExit();
        void attempt(false);
      });
      // Remain paused and inert until the native window closes or cancels its ticket.
    } catch (error: unknown) {
      cleanup();
      throw error;
    }
  }

  const choicePanel = new ChoicePanel(choices, (token, choiceId) => {
    if (closed || exiting) return;
    unlockAudio();
    session?.send({ type: "choose", token, choiceId });
  });
  const layout = connectStageLayout(stage);
  input = new PlayerInput({
    stage, scene, choices, controls: playControls, hide, keyboardScopes: [document],
    session: () => session,
    enabled: () => !closed && !exiting && !dialogue.open && !gallery.open && !aftergame.open && !host.state().paused,
    unlockAudio, menu: toggleMenu, history: openDialogue,
  });
  const displayDriver = nativeFullscreenDriver();
  fullscreen = new PlayerFullscreen({
    root: document.documentElement, surface: element("player-surface", HTMLElement),
    button: fullscreenButton, status: element("fullscreen-status", HTMLElement),
    keyboardScopes: [document], enabled: () => !closed && !exiting,
    changed: () => input?.reset(),
    ...(displayDriver ? { driver: displayDriver } : {}),
  });

  function show(view: SessionView): void {
    input?.refresh();
    fullscreen?.refresh();
    dialoguePanel?.refresh(host.state().audioAllowed);
    const { story, token } = view;
    const blocked = view.paused.length > 0 || view.disposed;
    next.disabled = blocked || story.phase === "choosing" || story.phase === "ended";
    auto.disabled = skip.disabled = story.phase === "ended";
    pause.disabled = audio.disabled = false;
    refreshSaveControls(view);
    dialogueOpen.disabled = view.disposed || view.dialogueCount === 0;
    auto.setAttribute("aria-pressed", String(view.auto));
    skip.setAttribute("aria-pressed", String(view.skipping));
    pause.textContent = view.paused.includes("menu") ? "关闭菜单" : "菜单 / 暂停";
    menu.hidden = !view.paused.includes("menu");
    const phases = { presenting: "呈现中", ready: "可继续", choosing: "等待选择", ended: "本段结束" };
    status.textContent = `${story.nodeId} · ${phases[story.phase]}${view.paused.length ? ` · 已暂停：${view.paused.join(" / ")}` : ""}`
      + (story.terminal?.kind === "ending" ? ` · ${story.terminal.endingId}` : "")
      + (view.newEnding ? " · 新结局已保存，可从主页鉴赏" : "");
    problem.hidden = !view.problem;
    problemMessage.textContent = view.problem ? `${view.problem.blocking ? "已暂停" : "媒体提示"}：${view.problem.message}` : "";
    debug.textContent = JSON.stringify({ nodeId: story.nodeId, token, variables: story.variables,
      player: story.player, phase: story.phase, choiceRemainingMs: view.choiceRemainingMs }, null, 2);
    choicePanel.render(view);
    showRollback(view);
  }

  function refreshSaveControls(view?: SessionView): void {
    const blocked = closed || exiting || entryPreparation === entryRequest;
    save.disabled = blocked || saving || !(view ?? session?.view())?.canCheckpoint;
    save.textContent = `保存${entryName(mode)}到 ${JSON.stringify(slots.slot(mode))}`;
    for (const entry of ["main", "timed"] as const) {
      const suffix = entry === "main" ? "main" : "timed";
      const inspect = element(`inspect-${suffix}`, HTMLButtonElement);
      const load = element(`load-${suffix}`, HTMLButtonElement);
      inspect.disabled = blocked;
      load.disabled = blocked || !["silent", "replay", "resume"].includes(voiceChoice.value);
      inspect.textContent = `查看${entryName(entry)} ${JSON.stringify(slots.slot(entry))}`;
      load.textContent = `读取${entryName(entry)} ${JSON.stringify(slots.slot(entry))}`;
    }
    slots.refreshControls();
  }

  function showRollback(view: SessionView): void {
    const key = `${view.token.session}:${view.token.epoch}:${view.token.step}:${view.rollbackCount}`;
    if (key !== rollbackKey) {
      rollbackKey = key;
      const selected = rollbackTarget.value;
      rollbackTarget.replaceChildren(new Option("请选择本次回退位置", ""));
      for (const target of session?.rollbackTargets() ?? []) {
        const text = target.text.replace(/\s+/gu, " ").slice(0, 65) || "演出节点";
        const label = `${target.crossesChoice ? "跨选择 · " : ""}${target.speaker ? `${target.speaker}：` : ""}${text} [${target.nodeId}]`;
        rollbackTarget.add(new Option(label, String(target.id)));
      }
      rollbackTarget.value = selected;
      if (rollbackTarget.selectedIndex < 0) rollbackTarget.selectedIndex = 0;
    }
    rollbackTarget.disabled = rollingBack || view.rollbackCount === 0;
    rollbackButton.disabled = rollingBack || !view.canCheckpoint || !rollbackTarget.value
      || !["silent", "replay", "resume"].includes(voiceChoice.value)
      || !["within", "across"].includes(rollbackBoundary.value);
    rollbackWarning.hidden = !view.rollbackIssue;
    rollbackWarning.textContent = view.rollbackIssue ?? "";
  }

  async function start(selected: Entry, restore?: { voice: RestoreVoice; slotId: string }): Promise<void> {
    if (exiting || closed) return;
    const request = ++entryRequest;
    entryPreparation = request;
    const restoreVoice = restore?.voice;
    const owner = session;
    owner?.send({ type: "pause", reason: "operation", paused: true });
    refreshSaveControls();
    let adopted = false;
    try {
      if (selected === "main") await recordWriter.flush();
      const records = selected === "main" ? await playerRecords.read() : null;
      const player = records ? playerProjection(records) : { "周目": 1, "结局数": 0 };
      const source = sources[selected];
      let checkpoint: GameCheckpoint | null = null;
      if (restore) {
        const saved = await saves[selected].read(restore.slotId);
        if (!saved) throw new Error(`这个入口的 ${JSON.stringify(restore.slotId)} 槽位尚未保存进度`);
        checkpoint = prepareGameRestore(source, saved.checkpoint, player).checkpoint;
      }
      const delivery = crypto.randomUUID();
      if (closed || request !== entryRequest) return;
      // All content, slot and global data are prepared before leaving live play.
      closeDialogue();
      input?.reset();
      owner?.dispose();
      session = null;
      adopted = true;
      mode = selected;
      audioPreferences.setMode(selected);
      readingPreferences.setMode(selected);
      buttonPreferences.setMode(selected);
      rollbackKey = "";
      menu.hidden = title.hidden = problem.hidden = true;
      choicePanel.clear();
      gallery.close();
      closeAftergame();
      resetSaveMessage();
      resetRollback();
      if (records) {
        reads.main.clear();
        for (const nodeId of records.readNodeIds) reads.main.add(nodeId);
      }
      note.textContent = selected === "timed"
        ? "限时选择样例：声明初值 0、周目 1、结局数 0；不是第五话真实路线，不写全局成果。"
        : "第一话试播：进度与全局成果分别保存，重新开始和读档保留已解锁的结局与 CG。";
      let sequence = 0;
      const reading = readingPreferences.values(selected);
      const newPresentation = new WebPresentation(scene, source, resources, host.state().audioAllowed,
        audioPreferences.values(selected), reading, whaleSkin.artwork);
      presentation = newPresentation;
      const sessionGeneration = ++generation;
      session = createGameSession({
        content: source, player, generation: sessionGeneration,
        clock, presentation, seen: reads[selected], onChange: show,
        rollback: { capacity: 500 },
        autoWaitMultiplier: reading.autoWaitMultiplier,
        initialPauses: [
          ...(document.hidden ? ["background" as const] : []),
          ...(host.state().paused ? ["host" as const] : []),
        ],
        ...(checkpoint && restoreVoice ? { resume: { checkpoint, voice: restoreVoice } } : {}),
        onFacts: facts => {
          if (selected === "main" && facts.length) {
            const id = `${delivery}:${++sequence}`;
            if (facts.some(fact => fact.type === "ending")) {
              endingFeedbackOwners.set(id, { generation: sessionGeneration, presentation: newPresentation });
            }
            recordWriter.enqueue({ id, occurredAt: Date.now(), facts });
          }
        },
      });
      show(session.view());
      unlockAudio();
      if (checkpoint && restore) saveMessage.textContent = `已从${entryName(selected)} ${JSON.stringify(restore.slotId)} 恢复剧情位置和剩余有效时间；全局记录沿用当前已保存成果。`;
    } catch (error: unknown) {
      if (closed || request !== entryRequest) return;
      if (adopted) {
        presentation?.dispose();
        choicePanel.clear();
        session = null;
        presentation = null;
        host.releaseAudio();
        audioPreferences.setMode("main");
        readingPreferences.setMode("main");
        buttonPreferences.setMode("main");
        title.hidden = false;
        next.disabled = auto.disabled = skip.disabled = pause.disabled = audio.disabled = save.disabled = dialogueOpen.disabled = rollbackButton.disabled = true;
        input?.refresh();
        resetRollback();
      }
      saveMessage.textContent = `未能${restoreVoice ? "读档" : "开局"}：${error instanceof Error ? error.message : "未知错误"}。全局成果与原槽位保持原值。`;
    } finally {
      if (entryPreparation === request) entryPreparation = null;
      if (!closed && request === entryRequest && session === owner) owner?.send({ type: "pause", reason: "operation", paused: false });
      if (!closed) refreshSaveControls();
    }
  }

  function unlockAudio(): void {
    if (!presentation) return;
    host.requestAudio();
    presentation.unlockAudio();
  }

  function toggleMenu(): void {
    if (exiting || closed) return;
    const view = session?.view();
    if (view) session?.send({ type: "pause", reason: "menu", paused: !view.paused.includes("menu") });
  }

  function home(): void {
    if (exiting || closed) return;
    entryRequest++;
    input?.reset();
    closeDialogue();
    closeAftergame();
    session?.dispose();
    session = null;
    presentation = null;
    audioPreferences.setMode("main");
    readingPreferences.setMode("main");
    buttonPreferences.setMode("main");
    host.releaseAudio();
    scene.replaceChildren();
    scene.classList.remove("paused");
    choicePanel.clear();
    title.hidden = false;
    menu.hidden = problem.hidden = true;
    next.disabled = auto.disabled = skip.disabled = pause.disabled = audio.disabled = save.disabled = dialogueOpen.disabled = true;
    resetRollback();
    resetSaveMessage();
    status.textContent = "已返回试播标题；旧会话的任务已取消";
    input?.refresh();
    refreshSaveControls();
  }

  function resetRollback(): void {
    rollbackKey = "";
    rollbackTarget.replaceChildren(new Option("请选择本次回退位置", ""));
    rollbackTarget.disabled = rollbackButton.disabled = true;
    rollbackMessage.textContent = "本次游玩达到稳定检查点后会记录回退位置；回退保留全局成果。";
    rollbackWarning.hidden = true;
    rollbackWarning.textContent = "";
  }

  function resetSaveMessage(): void {
    storageMessageEpoch++;
    saveMessage.textContent = "场面就绪并完整显示文字后，可保存到当前入口选中的命名槽位。两个入口分别保留，选择名称本身不写入。";
    saveDetails.hidden = true;
    saveDetails.textContent = "";
  }

  function describeSave(entry: Entry, inspected: InspectedSave): void {
    const { record, checkpoint, view } = inspected;
    saveMessage.textContent = `${entryName(entry)} · 槽位 ${JSON.stringify(record.slotId)} · ${new Date(record.savedAt).toLocaleString()} · ${view.nodeId}。已读取并校验检查点；当前游玩位置未改变。`;
    saveDetails.textContent = JSON.stringify({
      entry: entryName(entry), scope: record.scope, slotId: record.slotId, contentRevision: record.checkpoint.story.contentRevision,
      nodeId: view.nodeId, chapter: view.chapter, text: view.presentation.text,
      variables: view.variables, player: view.player, phase: view.phase, choices: view.choices,
      timing: checkpoint.timing, playback: checkpoint.presentation.playback, controls: checkpoint.controls,
    }, null, 2);
    saveDetails.hidden = false;
  }

  async function saveCheckpoint(): Promise<void> {
    const owner = session;
    if (exiting || closed || entryPreparation === entryRequest || !owner || saving || !owner.view().canCheckpoint) return;
    const entry = mode;
    const slotId = slots.slot(entry);
    const savedPresentation = presentation;
    const request = ++storageMessageEpoch;
    saving = true;
    save.disabled = true;
    saveDetails.hidden = true;
    saveMessage.textContent = `正在保存${entryName(entry)}到 ${JSON.stringify(slotId)}……`;
    try {
      const capture = owner.captureCheckpoint(owner.view().token);
      let payload: { checkpoint: GameCheckpoint; savedAt: number } | null = null;
      await writes.run(JSON.stringify(["progress", entry, slotId]), async () => {
        if (!payload) {
          const result = await capture;
          if (!result.accepted) throw new Error(`${result.code}：${result.message}`);
          payload = { checkpoint: result.checkpoint, savedAt: Date.now() };
        }
        if (entry === "main") await recordWriter.flush();
        const inspected = await saves[entry].save(slotId, payload.checkpoint, payload.savedAt);
        if (!closed) slots.saved(entry);
        if (!closed && request === storageMessageEpoch) {
          describeSave(entry, inspected);
          saveMessage.textContent = `${entryName(entry)}进度已保存到 ${JSON.stringify(slotId)}；可刷新页面后查看或读取。周目与鉴赏成果单独保留。`;
          if (!exiting && owner === session && savedPresentation === presentation && !owner.view().skipping) {
            // The storage transaction is already committed. Audio cannot turn it into a failed save.
            try { savedPresentation?.interaction({ type: "cue", cue: "save" }); }
            catch { /* Optional feedback has no effect on the committed checkpoint. */ }
          }
        }
      });
    } catch (error: unknown) {
      if (!closed && request === storageMessageEpoch) {
        saveMessage.textContent = `保存失败：${error instanceof Error ? error.message : "未知存储错误"}。可重新保存，未先删除原槽位。`;
      }
    } finally {
      saving = false;
      if (!closed) refreshSaveControls();
    }
  }

  async function inspectSaved(entry: Entry): Promise<void> {
    if (exiting || closed || entryPreparation === entryRequest) return;
    const slotId = slots.slot(entry);
    const request = ++storageMessageEpoch;
    saveDetails.hidden = true;
    saveMessage.textContent = `正在查看${entryName(entry)} ${JSON.stringify(slotId)} 检查点……`;
    try {
      const inspected = await saves[entry].read(slotId);
      if (closed || request !== storageMessageEpoch) return;
      if (inspected) describeSave(entry, inspected);
      else saveMessage.textContent = `${entryName(entry)}的 ${JSON.stringify(slotId)} 槽位尚未保存检查点。`;
    } catch (error: unknown) {
      if (!closed && request === storageMessageEpoch) {
        saveMessage.textContent = `读取失败：${error instanceof Error ? error.message : "未知存储错误"}。当前会话保持原状，已有数据未被删除。`;
      }
    }
  }

  function load(entry: Entry): void {
    if (exiting || closed || entryPreparation === entryRequest) return;
    const voice = voiceChoice.value;
    if (voice !== "silent" && voice !== "replay" && voice !== "resume") {
      saveMessage.textContent = "先选择本次读档的语音方式；这个试播选择不会改写正式默认体验。";
      return;
    }
    void start(entry, { voice, slotId: slots.slot(entry) });
  }

  async function rollback(): Promise<void> {
    const owner = session;
    const voice = voiceChoice.value;
    const boundary = rollbackBoundary.value;
    const targetId = Number(rollbackTarget.value);
    if (!owner || (boundary !== "within" && boundary !== "across")
      || (voice !== "silent" && voice !== "replay" && voice !== "resume")) return;
    await rollbackTo(owner, { targetId, voice, crossChoices: boundary === "across" });
  }

  async function rollbackTo(
    owner: GameSession,
    selection: Pick<RollbackRequest, "targetId" | "voice" | "crossChoices">,
    signal?: AbortSignal,
  ): Promise<RollbackResult> {
    const cancelled = (): RollbackResult => ({ accepted: false, code: "ROLLBACK_CANCELLED", message: "回退准备已取消或所属会话已改变" });
    if (closed || exiting || owner !== session || signal?.aborted || entryPreparation === entryRequest) return cancelled();
    if (rollingBack) return { accepted: false, code: "ROLLBACK_PENDING", message: "已有回退正在准备，请等待本次结果" };
    if (!Number.isSafeInteger(selection.targetId) || selection.targetId < 1) {
      return { accepted: false, code: "ROLLBACK_TARGET", message: "请选择本次回退位置" };
    }
    const token = owner.view().token;
    const selected = mode;
    const request = ++entryRequest;
    const active = (): boolean => !closed && !exiting && request === entryRequest && owner === session && !signal?.aborted;
    let adopted = false;
    rollingBack = true;
    owner.send({ type: "pause", reason: "operation", paused: true });
    rollbackMessage.textContent = "正在准备回退位置和当前全局记录……";
    const cancelPreparation = (): void => {
      if (!closed && request === entryRequest && owner === session && !adopted) {
        rollbackMessage.textContent = "回看已关闭，本次尚未采用的回退已取消。已发起的全局记录提交仍可完成。";
        owner.send({ type: "pause", reason: "operation", paused: false });
      }
    };
    signal?.addEventListener("abort", cancelPreparation, { once: true });
    try {
      if (selected === "main") await recordWriter.flush();
      if (!active()) return cancelled();
      const records = selected === "main" ? await playerRecords.read() : null;
      if (!active()) return cancelled();
      const result = await owner.rollback({
        token, ...selection,
        currentPlayer: records ? playerProjection(records) : { "周目": 1, "结局数": 0 },
      });
      adopted = result.accepted;
      // Once accepted, cancellation can hide feedback but cannot undo the adoption.
      if (!active()) return result;
      if (!result.accepted) {
        rollbackMessage.textContent = `回退未采用：${result.code}：${result.message}。当前进度和历史保持原值。`;
        return result;
      }
      resetSaveMessage();
      rollbackMessage.textContent = `已恢复到 ${result.nodeId} 的检查点，后续路线历史已截断；全局成果保留。媒体问题请在同一位置重试。`;
      try { unlockAudio(); }
      catch (error: unknown) { rollbackMessage.textContent += ` 声音启用未完成：${error instanceof Error ? error.message : "声音不可用"}`; }
      return result;
    } catch (error: unknown) {
      const result: RollbackResult = { accepted: false, code: "ROLLBACK_PREPARE", message: error instanceof Error ? error.message : "回退准备失败" };
      if (active()) rollbackMessage.textContent = `回退未采用：${result.message}。当前进度和历史保持原值。`;
      return result;
    } finally {
      signal?.removeEventListener("abort", cancelPreparation);
      rollingBack = false;
      if (!closed && request === entryRequest && owner === session) {
        if (signal?.aborted && adopted) rollbackMessage.textContent = "回退已采用；关闭回看不会撤销已经恢复的进度。";
        owner.send({ type: "pause", reason: "operation", paused: false });
      }
      if (!closed && session) showRollback(session.view());
      dialoguePanel?.refresh(host.state().audioAllowed);
    }
  }

  async function openGallery(): Promise<void> {
    if (exiting || closed) return;
    const request = ++entryRequest;
    try {
      await recordWriter.flush();
      const records = await playerRecords.read();
      if (closed || request !== entryRequest || session) return;
      renderGallery(galleryBody, content, resources, records);
      gallery.showModal();
    } catch (error: unknown) {
      if (!closed && request === entryRequest) recordMessage.textContent = `鉴赏记录无法读取：${error instanceof Error ? error.message : "存储失败"}`;
    }
  }

  function closeAftergame(): void {
    aftergamePanel?.close();
    aftergame.close();
    aftergameBody.replaceChildren();
  }

  async function openAftergame(): Promise<void> {
    if (exiting || closed || session || aftergame.open) return;
    const request = ++entryRequest;
    const active = (): boolean => !closed && !exiting && !session && aftergame.open && request === entryRequest;
    try {
      aftergameBody.textContent = "正在提交已有全局事实并准备通关记录……";
      aftergame.showModal();
      await recordWriter.flush();
      if (!active()) return;
      // No chat module, backend or provider is required for mainline startup.
      const { createAftergamePanel } = await import("./aftergame.ts");
      if (!active()) return;
      aftergamePanel ??= createAftergamePanel(aftergameBody, content, {
        kind: "development", id: "normal-entry",
      }, { read: () => playerRecords.readCompletions() });
      await aftergamePanel.open();
    } catch (error: unknown) {
      if (active()) {
        aftergameBody.replaceChildren();
        const text = document.createElement("p");
        text.textContent = `通关后入口未能准备：${error instanceof Error ? error.message : "本地模块或记录读取失败"}。主线可继续，已有成果未被修改。`;
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "重新准备入口";
        retry.onclick = () => { closeAftergame(); void openAftergame(); };
        aftergameBody.append(text, retry);
      }
    }
  }

  function openDialogue(): void {
    if (exiting || closed) return;
    const owner = session;
    if (!owner || owner.view().disposed || dialogue.open) return;
    dialogueOwner = owner;
    owner.send({ type: "pause", reason: "history", paused: true });
    try {
      dialoguePanel?.open(owner.dialogueHistory(), owner.rollbackTargets());
      dialogue.showModal();
      dialoguePanel?.refresh(host.state().audioAllowed);
      dialogueBody.lastElementChild?.lastElementChild?.scrollIntoView({ block: "nearest" });
    } catch (error: unknown) {
      closeDialogue();
      throw error;
    }
  }

  function closeDialogue(): void {
    const owner = dialogueOwner;
    dialogueOwner = null;
    dialoguePanel?.close();
    dialogue.close();
    owner?.send({ type: "pause", reason: "history", paused: false });
  }

  element("start", HTMLButtonElement).onclick = () => { void start("main"); };
  element("timed", HTMLButtonElement).onclick = () => { void start("timed"); };
  element("restart", HTMLButtonElement).onclick = () => { void start(mode); };
  element("home", HTMLButtonElement).onclick = home;
  element("close-menu", HTMLButtonElement).onclick = toggleMenu;
  element("retry", HTMLButtonElement).onclick = () => session?.send({ type: "retry" });
  next.onclick = () => input?.next();
  pause.onclick = () => input?.menu();
  auto.onclick = () => input?.toggleAuto();
  skip.onclick = () => input?.toggleSkip();
  audio.onclick = unlockAudio;
  save.onclick = () => { void saveCheckpoint(); };
  element("inspect-main", HTMLButtonElement).onclick = () => { void inspectSaved("main"); };
  element("inspect-timed", HTMLButtonElement).onclick = () => { void inspectSaved("timed"); };
  element("load-main", HTMLButtonElement).onclick = () => load("main");
  element("load-timed", HTMLButtonElement).onclick = () => load("timed");
  element("gallery-open", HTMLButtonElement).onclick = () => { void openGallery(); };
  element("gallery-close", HTMLButtonElement).onclick = () => gallery.close();
  element("aftergame-open", HTMLButtonElement).onclick = () => { void openAftergame(); };
  element("aftergame-close", HTMLButtonElement).onclick = closeAftergame;
  aftergame.addEventListener("cancel", event => { event.preventDefault(); closeAftergame(); });
  aftergame.addEventListener("close", () => { if (!aftergame.open) aftergamePanel?.close(); });
  dialogueOpen.onclick = openDialogue;
  element("dialogue-history-close", HTMLButtonElement).onclick = closeDialogue;
  dialogue.addEventListener("cancel", event => { event.preventDefault(); closeDialogue(); });
  dialogue.addEventListener("close", () => { if (!dialogue.open) closeDialogue(); });
  exitDialog.addEventListener("cancel", event => { event.preventDefault(); host.cancelExit(); });
  voiceChoice.onchange = () => {
    refreshSaveControls();
    if (session) showRollback(session.view());
  };
  rollbackTarget.onchange = rollbackBoundary.onchange = () => { if (session) showRollback(session.view()); };
  rollbackButton.onclick = () => { void rollback(); };
  retryRecords.onclick = () => { void recordWriter.flush().catch(() => {}); };
  const visibility = (): void => {
    session?.send({ type: "pause", reason: "background", paused: document.hidden });
    dialoguePanel?.refresh(host.state().audioAllowed);
  };
  document.addEventListener("visibilitychange", visibility);
  const dispose = (): void => {
    closed = true;
    entryRequest++;
    storageMessageEpoch++;
    endingFeedbackOwners.clear();
    closeDialogue();
    closeAftergame();
    aftergamePanel?.dispose();
    dialoguePanel?.dispose();
    audioPreferences.dispose();
    readingPreferences.dispose();
    buttonPreferences.dispose();
    slots.dispose();
    buttonEvents.abort();
    input?.dispose();
    fullscreen?.dispose();
    cover.dispose();
    session?.dispose();
    host.releaseAudio();
    host.dispose();
    choicePanel.dispose();
    layout.dispose();
    document.removeEventListener("visibilitychange", visibility);
  };
  window.addEventListener("pagehide", dispose, { once: true });
  import.meta.hot?.dispose(dispose);
  await Promise.all([audioPreferences.load(), readingPreferences.load(), buttonPreferences.load()]);
  if (closed || startup.signal.aborted) return;
  note.textContent = "本地内容已载入。可以从第一话开始，或选择明确标注的限时样例。";
  for (const id of ["start", "timed", "gallery-open", "aftergame-open"]) element(id, HTMLButtonElement).disabled = false;
  refreshSaveControls();
  slots.refresh();
}

void main().catch((error: unknown) => {
  if (startup.signal.aborted) return;
  for (const button of document.querySelectorAll("button")) button.disabled = true;
  const message = document.getElementById("problem-message");
  const panel = document.getElementById("problem");
  const status = document.getElementById("status");
  const retry = document.getElementById("retry");
  if (message) message.textContent = `内容未载入：${error instanceof Error ? error.message : "未知错误"}。请使用完整的同一份游戏包重试。`;
  if (panel) panel.hidden = false;
  if (status) status.textContent = "内容加载失败，尚未开始游玩";
  if (retry instanceof HTMLButtonElement) {
    retry.disabled = false;
    retry.textContent = "重新读取内容";
    retry.onclick = () => window.location.reload();
  }
});
