import { development, loadContent } from "virtual:haifeng-content";
import { whaleSkin } from "virtual:haifeng-appearance";
import { collectionSkin } from "virtual:haifeng-collection-appearance";
import { createGameSession } from "../../../packages/player/src/session.ts";
import type { GameSession, RestoreVoice, RollbackRequest, RollbackResult, SessionView } from "../../../packages/player/src/session.ts";
import { WebPresentation } from "../../../packages/player/src/web/presentation.ts";
import { createResourceAccess } from "../../../packages/player/src/web/resources.ts";
import type { Clock } from "../../../packages/player/src/clock.ts";
import { SaveRepository } from "../../../packages/player/src/saves.ts";
import type { InspectedSave, RecordScope } from "../../../packages/player/src/saves.ts";
import { PlayerRepository, PlayerRecordWriter, galleryCatalog, playerProjection } from "../../../packages/player/src/records.ts";
import { prepareGameRestore } from "../../../packages/player/src/checkpoint.ts";
import type { GameCheckpoint } from "../../../packages/player/src/checkpoint.ts";
import { GalleryPanel } from "./gallery.ts";
import { SoundLibraryPanel } from "./sounds.ts";
import { ChapterPanel } from "./chapters.ts";
import { prepareChapterTrial } from "../../../packages/player/src/chapters.ts";
import type { ChapterEntry, ChapterTrial } from "../../../packages/player/src/chapters.ts";
import { DialoguePanel } from "./dialogue.ts";
import { connectHost } from "./platform/host.ts";
import { connectGameStorage } from "./platform/storage.ts";
import { PendingWrites } from "../../../packages/player/src/writes.ts";
import type { TrackedWrite } from "../../../packages/player/src/writes.ts";
import type { AftergamePanel } from "./aftergame.ts";
import { AUDIO_CHANNELS, AudioPreferenceRepository, authorAudioVolumes, readAudioVolumes } from "../../../packages/player/src/preferences.ts";
import {
  READING_KEYS, READING_LIMITS, ReadingPreferenceRepository, authorReadingPreferences, readReadingPreferences,
} from "../../../packages/player/src/reading-preferences.ts";
import {
  ButtonPreferenceRepository, authorButtonPreferences, readButtonPreferences,
} from "../../../packages/player/src/button-preferences.ts";
import {
  ReadoutPreferenceRepository, authorReadoutPreferences, readReadoutPreferences,
} from "../../../packages/player/src/readout-preferences.ts";
import { StoryReadout } from "../../../packages/player/src/readout.ts";
import { connectButtonSounds } from "../../../packages/player/src/web/button-sounds.ts";
import { PreferencesPanel } from "./preferences.ts";
import { SaveOverwritePrompt } from "./save-overwrite.ts";
import { applyAuthorAppearance, connectTitleCover } from "../../../packages/player/src/web/appearance.ts";
import { ChoicePanel } from "../../../packages/player/src/web/choices.ts";
import { connectStageLayout } from "../../../packages/player/src/web/stage-layout.ts";
import { PlayerInput } from "../../../packages/player/src/web/input.ts";
import { PlayerFullscreen } from "../../../packages/player/src/web/fullscreen.ts";
import { nativeFullscreenDriver } from "./platform/fullscreen.ts";
import { SaveSlots } from "./slots.ts";
import type { SaveEntry as Entry } from "./slots.ts";
import { EndingPanel } from "../../../packages/player/src/web/ending.ts";
import type { EndingRecordState } from "../../../packages/player/src/web/ending.ts";
import { StageFade } from "../../../packages/player/src/web/stage-fade.ts";
import { GamePanels } from "./panels.ts";
import { DialogFade } from "./dialog-fade.ts";
import { decoratePlayControls } from "./control-artwork.ts";
import { setButtonLabel } from "../../../packages/player/src/web/button-label.ts";
import { renderSaveDetails } from "./save-details.ts";
import { renderExitStatus } from "./exit-status.ts";
import type { ExitProgress } from "./exit-status.ts";
import { RollbackLocations } from "./rollback-locations.ts";
import { connectOrientationHint } from "./orientation-hint.ts";
import { MenuFocus } from "./menu-focus.ts";
import { PendingSavesPanel } from "./pending-saves.ts";
import type { GamePanel } from "./panels.ts";
import "./style.css";
import "./shell.css";

type PlayEntry = Entry | "chapter";

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
  const status = development ? element("status", HTMLElement) : null;
  const debug = development ? element("debug", HTMLElement) : null;
  const note = element("preview-note", HTMLElement);
  if (development) {
    element("tools-panel", HTMLDialogElement).append(note);
    note.hidden = false;
  }
  const problem = element("problem", HTMLElement);
  const problemMessage = element("problem-message", HTMLElement);
  const next = element("next", HTMLButtonElement);
  const auto = element("auto", HTMLButtonElement);
  const skip = element("skip", HTMLButtonElement);
  const pause = element("pause", HTMLButtonElement);
  const audio = element("audio", HTMLButtonElement);
  const hide = element("hide-ui", HTMLButtonElement);
  const playControls = element("play-controls", HTMLElement);
  decoratePlayControls(playControls, collectionSkin.artwork.controlIcons);
  const entryBanner = element("entry-banner", HTMLElement);
  const shellMessage = element("shell-message", HTMLElement);
  const noticeStack = element("shell-status-stack", HTMLElement);
  const noticesHome = element("notices-home", HTMLElement);
  const menuNoticesHome = element("menu-notices-home", HTMLElement);
  const recordStatusElement = element("record-message", HTMLElement).parentElement;
  if (!(recordStatusElement instanceof HTMLElement)) throw new Error("页面缺少全局记录提示区域");
  const recordStatus = recordStatusElement;
  const fullscreenButton = element("fullscreen", HTMLButtonElement);
  const save = element("save-checkpoint", HTMLButtonElement);
  const saveMessage = element("save-message", HTMLElement);
  const saveDetails = element("save-details", HTMLElement);
  const recordMessage = element("record-message", HTMLElement);
  const retryRecords = element("retry-records", HTMLButtonElement);
  const gallery = element("gallery", HTMLDialogElement);
  const galleryBody = element("gallery-body", HTMLElement);
  const sounds = element("sounds", HTMLDialogElement);
  const soundsBody = element("sounds-body", HTMLElement);
  const chapters = element("chapters", HTMLDialogElement);
  const chaptersBody = element("chapters-body", HTMLElement);
  const dialogue = element("dialogue-history", HTMLDialogElement);
  const dialogueBody = element("dialogue-history-body", HTMLElement);
  const aftergame = development ? element("aftergame", HTMLDialogElement) : null;
  const aftergameBody = development ? element("aftergame-body", HTMLElement) : null;
  const dialogueOpen = element("dialogue-history-open", HTMLButtonElement);
  const voiceChoice = element("restore-voice", HTMLSelectElement);
  const rollbackVoice = element("rollback-voice", HTMLSelectElement);
  const rollbackTarget = element("rollback-target", HTMLSelectElement);
  const rollbackBoundary = element("rollback-boundary", HTMLSelectElement);
  const rollbackButton = element("rollback", HTMLButtonElement);
  const rollbackMessage = element("rollback-message", HTMLElement);
  const rollbackWarning = element("rollback-warning", HTMLElement);
  const rollbackLocations = new RollbackLocations(
    rollbackTarget, element("rollback-location-details", HTMLElement), element("rollback-location-count", HTMLElement),
  );
  const pageElement = document.querySelector("main");
  if (!(pageElement instanceof HTMLElement)) throw new Error("页面缺少主区域");
  const page = pageElement;
  const exitDialog = element("exit-dialog", HTMLDialogElement);
  const exitMessage = element("exit-message", HTMLElement);
  const exitOperations = element("exit-operations", HTMLElement);
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
  const orientationHint = connectOrientationHint({
    root: element("orientation-hint", HTMLElement),
    accept: element("accept-portrait", HTMLButtonElement),
    focusTarget: () => menu.hidden ? stage : element("close-menu", HTMLButtonElement),
  });
  startup.signal.addEventListener("abort", orientationHint.dispose, { once: true });
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
  const storage = connectGameStorage(content.workId, element("storage-notice", HTMLElement), development);
  const store = storage.store;
  startup.signal.addEventListener("abort", storage.dispose, { once: true });
  const recordScope: Readonly<RecordScope> = Object.freeze({
    kind: development ? "development" : "game", id: development ? "normal-entry" : "main",
  });
  const saveEntries: readonly Entry[] = development ? ["main", "timed"] : ["main"];
  const saves = {
    main: new SaveRepository(sources.main, recordScope, store),
    timed: new SaveRepository(sources.timed, { kind: "preview", id: "timed-choice:pm8x8v2h" }, store),
  };
  const playerRecords = new PlayerRepository(content, recordScope, store);
  type EndingOwner = { generation: number; presentation: WebPresentation; endingId: string; state: EndingRecordState };
  const endingFeedbackOwners = new Map<string, EndingOwner>();
  const endingIds = galleryCatalog(content).endings;
  let terminalRecord: EndingOwner | null = null;
  let recordFailure: string | null = null;
  let refreshExitStatus: (() => void) | null = null;
  let disposeExitStatus: (() => void) | null = null;
  const recordWriter = new PlayerRecordWriter(playerRecords, (records, receipt) => {
    const owner = endingFeedbackOwners.get(receipt.batchId);
    endingFeedbackOwners.delete(receipt.batchId);
    for (const nodeId of records.readNodeIds) reads.main.add(nodeId);
    if (closed) return;
    recordFailure = null;
    if (owner) owner.state = {
      kind: "committed", unlocked: endingIds.filter(id => records.endings.some(ending => ending.id === id)).length,
      total: endingIds.length,
    };
    const player = playerProjection(records);
    recordMessage.textContent = `全局记录已保存：周目 ${player["周目"]} · 已解锁结局 ${player["结局数"]} · CG ${records.cgIds.length}`;
    retryRecords.hidden = true;
    recordStatus.hidden = true;
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
        recordStatus.hidden = false;
      }
    }
    refreshEnding();
    refreshExitStatus?.();
  }, error => {
    if (closed) return;
    recordFailure = error instanceof Error ? error.message : "存储失败";
    recordMessage.textContent = `全局记录未取得保存确认：${recordFailure}。请重试；原事实暂留本页内存。`;
    retryRecords.hidden = false;
    recordStatus.hidden = false;
    if (terminalRecord && terminalRecord.state.kind !== "committed") terminalRecord.state = { kind: "failed", message: recordFailure };
    refreshEnding();
    refreshExitStatus?.();
  });
  const entryName = (entry: Entry): string => entry === "main" ? "正常游玩" : "限时选择样例";
  let saving = false;
  let savePreparation: AbortController | null = null;
  let storageMessageEpoch = 0;
  let closed = false;
  let ready = false;
  let session: GameSession | null = null;
  let dialogueOwner: GameSession | null = null;
  let presentation: WebPresentation | null = null;
  let input: PlayerInput | null = null;
  let fullscreen: PlayerFullscreen | null = null;
  let stageFade: StageFade | null = null;
  let dialogFade: DialogFade | null = null;
  let panels: GamePanels | null = null;
  let menuFocus: MenuFocus | null = null;
  let panelRollback: AbortController | null = null;
  let endingVisualKey = "";
  let generation = 0;
  let mode: PlayEntry = "main";
  let activeChapter: ChapterTrial | null = null;
  let entryRequest = 0;
  let entryPreparation: number | null = null;
  let rollbackKey = "";
  let rollingBack = false;
  let exiting = false;
  let aftergamePanel: AftergamePanel | null = null;
  let galleryPanel: GalleryPanel | null = null;
  let galleryRequest = 0;
  let soundPanel: SoundLibraryPanel | null = null;
  let chapterPanel: ChapterPanel | null = null;
  let dialoguePanel: DialoguePanel | null = null;
  const overwritePrompt = new SaveOverwritePrompt(
    element("save-overwrite", HTMLElement), element("checkpoint-heading", HTMLElement),
  );
  const pendingSaves = new PendingSavesPanel({
    root: element("pending-saves", HTMLElement), fallback: element("checkpoint-heading", HTMLElement),
    blocked: () => closed || exiting || saving || entryPreparation === entryRequest,
  });
  const unsubscribePendingSaves = writes.subscribe(refreshPendingSaves);
  const endingPanel = new EndingPanel(stage, {
    leaveLabel: "返回标题",
    leave: token => { if (currentTerminal(token)) home(); },
    retry: token => { if (currentTerminal(token) && !exiting) void flushRecords().catch(() => {}); },
  });
  const slots = new SaveSlots({
    root: element("save-slots", HTMLElement), repositories: saves, entries: saveEntries, label: entryName,
    scope: () => panels?.signalFor("saves") ?? null,
    blocked: () => closed || exiting || savePreparation !== null || entryPreparation === entryRequest || !panels?.signalFor("saves"),
    changed: () => { resetSaveMessage(); refreshSaveControls(); },
  });
  const audioRepository = new AudioPreferenceRepository(content.workId, recordScope,
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
    trackWrite: operation => writes.run("audio-preferences", operation, "音量偏好"),
    valuesChanged: volumes => {
      presentation?.setAudioVolumes(volumes);
      dialoguePanel?.setVolumes(volumes);
      soundPanel?.setVolumes(volumes);
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
    repository: new ReadingPreferenceRepository(content.workId, recordScope,
      authorReadingPreferences(content.source.settings), store),
    blocked: () => closed || exiting,
    trackWrite: operation => writes.run("reading-preferences", operation, "阅读偏好"),
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
    repository: new ButtonPreferenceRepository(content.workId, recordScope,
      authorButtonPreferences(content.source.settings), store),
    blocked: () => closed || exiting,
    trackWrite: operation => writes.run("button-preferences", operation, "按钮声音偏好"),
    valuesChanged: () => {},
  });
  const readout = new StoryReadout(content);
  const readoutRoot = element("readout-preferences", HTMLElement);
  const readoutSummary = document.createElement("p");
  readoutSummary.setAttribute("role", "status");
  readoutSummary.setAttribute("aria-live", "polite");
  const readoutPreferences = new PreferencesPanel<"enabled", boolean>({
    root: readoutRoot,
    noun: "话末数值",
    note: "开启后，在后续话末“存档点”对白后显示当前好感与尾鳍数值（剧透向）。不会改动当前已开始的文字或倒计时，读档和回退沿用当前开关。",
    fields: [{ kind: "checkbox", key: "enabled", label: "显示好感数值（剧透向）" }],
    defaults: authorReadoutPreferences(content.source.settings),
    readValues: readReadoutPreferences,
    repository: new ReadoutPreferenceRepository(content.workId, recordScope,
      authorReadoutPreferences(content.source.settings), store),
    blocked: () => closed || exiting,
    trackWrite: operation => writes.run("readout-preferences", operation, "话末数值偏好"),
    valuesChanged: values => {
      session?.send({ type: "readout", enabled: values.enabled });
      refreshReadout();
    },
  });
  readoutRoot.append(readoutSummary);
  const buttonEvents = new AbortController();
  connectButtonSounds({
    buttons: [next, auto, skip, pause, dialogueOpen, audio, hide, fullscreenButton,
      element("toolbar-saves", HTMLButtonElement), element("toolbar-settings", HTMLButtonElement)],
    signal: buttonEvents.signal,
    enabled: () => {
      if (closed || exiting || document.hidden || !session || !buttonPreferences.values(mode).enabled) return false;
      const view = session.view();
      return !view.disposed && !view.skipping && view.story.phase !== "ended" && view.paused.length === 0;
    },
    play: cue => presentation?.interaction({ type: "cue", cue }),
  });
  const hostStatus = development ? document.createElement("p") : null;
  const hostNotice = element("host-notice", HTMLElement);
  if (hostStatus) note.insertAdjacentElement("afterend", hostStatus);
  const host = connectHost(state => {
    const platform = state.issue ? `宿主状态异常，已暂停：${state.issue}`
      : state.platform === "windows-trial" ? "Windows 集成试用 · 记录与旧版隔离"
      : state.platform === "android-trial" ? "Android 集成试用 · 记录与旧版隔离" : "浏览器试播";
    if (hostStatus) hostStatus.textContent = `${platform}${state.audioIssue ? ` · ${state.audioIssue}` : ""}`;
    const issue = [state.issue ? `宿主状态异常，已暂停：${state.issue}` : "", state.audioIssue ?? ""].filter(Boolean).join(" · ");
    if (hostNotice.textContent !== issue) hostNotice.textContent = issue;
    presentation?.setAudioAllowed(state.audioAllowed);
    if (state.paused) { stageFade?.cancel(); dialogFade?.cancel(); }
    session?.send({ type: "pause", reason: "host", paused: state.paused });
    dialoguePanel?.refresh(state.audioAllowed);
    soundPanel?.refresh(state.audioAllowed);
    menuFocus?.refresh();
  }, () => {
    if (exiting) { host.cancelExit(); return true; }
    if (dialogue.open) { closeDialogue(true); return true; }
    if (chapters.open) { closeChapters(true); return true; }
    if (sounds.open) { closeSounds(true); return true; }
    if (gallery.open) { closeGallery(true); return true; }
    if (aftergame?.open) { closeAftergame(true); return true; }
    if (panels?.close()) return true;
    if (input?.reveal()) return true;
    if (session) { toggleMenu(); return true; }
    return false;
  }, prepareExit);

  stageFade = new StageFade({
    stage,
    layers: () => [scene, title, choices, menu, ...stage.querySelectorAll<HTMLElement>(":scope > .ending-panel")],
    enabled: () => !closed && !exiting && !document.hidden && !host.state().paused && !session?.view().skipping,
    issue: message => { if (!closed) notify(`界面过渡未能完成：${message}`); },
  });
  const shellDialogs = {
    saves: element("saves-panel", HTMLDialogElement),
    settings: element("settings-panel", HTMLDialogElement),
    rollback: element("rollback-panel", HTMLDialogElement),
    ...(development ? { tools: element("tools-panel", HTMLDialogElement) } : {}),
  };
  const dialogDisplay = new DialogFade({
    surface: element("player-surface", HTMLElement),
    dialogs: [...Object.values(shellDialogs).filter((dialog): dialog is HTMLDialogElement => dialog !== undefined),
      dialogue, gallery, sounds, chapters, ...(aftergame ? [aftergame] : [])],
    enabled: () => !closed && !exiting && !host.state().paused && !session?.view().skipping,
    issue: message => notify(`界面过渡未能完成：${message}。当前操作仍按原流程处理。`),
  });
  dialogFade = dialogDisplay;

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
    savePreparation?.abort();
    stageFade?.cancel();
    dialogFade?.cancel();
    fullscreen?.refresh();
    audioPreferences.refresh();
    readingPreferences.refresh();
    buttonPreferences.refresh();
    readoutPreferences.refresh();
    slots.refreshControls();
    entryRequest++;
    refreshEnding();
    const owner = session;
    owner?.send({ type: "pause", reason: "exit", paused: true });
    owner?.send({ type: "pause", reason: "operation", paused: false });
    closeDialogue();
    closeChapters();
    closeSounds();
    closeGallery();
    closeAftergame();
    panels?.close("leave");
    const wasInert = page.inert;
    page.inert = true;
    exitRetry.hidden = true;
    exitCancel.disabled = false;
    let released = false;
    let progress: ExitProgress = { kind: "writes", retry: false };
    const render = (): void => {
      if (released || closed || signal.aborted || refreshExitStatus !== render) return;
      try { renderExitStatus(exitOperations, progress, writes.view(), { pending: recordWriter.pending(), issue: recordFailure }); }
      catch (error: unknown) {
        exitOperations.textContent = `写入状态暂未显示：${error instanceof Error ? error.message : "显示错误"}。本次退出仍按原写入确认结果处理。`;
      }
    };
    refreshExitStatus = render;
    const unsubscribe = writes.subscribe(render);
    const stopStatus = (): void => {
      unsubscribe();
      if (refreshExitStatus === render) {
        refreshExitStatus = null;
        exitOperations.replaceChildren();
      }
      if (disposeExitStatus === stopStatus) disposeExitStatus = null;
    };
    disposeExitStatus = stopStatus;
    const cleanup = (): void => {
      if (released) return;
      released = true;
      stopStatus();
      exiting = false;
      fullscreen?.refresh();
      audioPreferences.refresh();
      readingPreferences.refresh();
      buttonPreferences.refresh();
      readoutPreferences.refresh();
      refreshSaveControls();
      refreshEnding();
      page.inert = wasInert;
      exitDialog.close();
      exitRetry.onclick = exitCancel.onclick = null;
      owner?.send({ type: "pause", reason: "exit", paused: false });
      if (!closed) saveMessage.textContent = "退出已取消。已发起的写入如仍在进行会继续完成；当前未保存进度没有自动新建存档。";
    };
    signal.addEventListener("abort", cleanup, { once: true });
    try {
      exitDialog.showModal();
      render();
      await new Promise<void>((resolve, reject) => {
        let running = false;
        const aborted = (): void => reject(new Error("退出已取消，原写入如已发起仍会继续"));
        signal.addEventListener("abort", aborted, { once: true });
        const attempt = async (retry: boolean): Promise<void> => {
          if (running || signal.aborted || closed) return;
          running = true;
          progress = { kind: "writes", retry };
          exitRetry.hidden = true;
          exitMessage.textContent = "正在等待已发起的保存，并提交全局成果……";
          render();
          let stage: "writes" | "records" = "writes";
          try {
            if (retry) await writes.retryFailed();
            else await writes.settle();
            if (signal.aborted || closed) return;
            stage = "records";
            progress = { kind: "records" };
            render();
            await flushRecords();
            if (signal.aborted || closed) return;
            if (recordWriter.pending()) throw new Error("仍有未提交的全局记录");
            progress = { kind: "ready" };
            render();
            signal.removeEventListener("abort", aborted);
            exitMessage.textContent = "写入已完成，正在退出。未手动保存的剧情位置不会自动保存。";
            exitCancel.disabled = true;
            resolve();
          } catch (error: unknown) {
            if (!signal.aborted && !closed) {
              progress = { kind: "failed", stage, message: error instanceof Error ? error.message : "写入失败" };
              render();
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
  const layout = connectStageLayout(stage, { controls: playControls });
  input = new PlayerInput({
    stage, scene, choices, controls: playControls, hide, keyboardScopes: [document],
    session: () => session,
    enabled: () => !closed && !exiting && !panels?.active
      && !dialogue.open && !gallery.open && !chapters.open && !sounds.open && !aftergame?.open && !host.state().paused,
    unlockAudio, menu: toggleMenu, history: openDialogue,
  });
  const displayDriver = nativeFullscreenDriver();
  fullscreen = new PlayerFullscreen({
    root: document.documentElement, surface: element("player-surface", HTMLElement),
    button: fullscreenButton, status: element("fullscreen-status", HTMLElement),
    additionalControls: [{
      button: element("settings-fullscreen", HTMLButtonElement),
      status: element("settings-fullscreen-status", HTMLElement),
      state: element("settings-display-mode", HTMLOutputElement),
    }],
    keyboardScopes: [document], enabled: () => !closed && !exiting,
    changed: () => { input?.reset(); stageFade?.cancel(); dialogFade?.cancel(); },
    ...(displayDriver ? { driver: displayDriver } : {}),
  });
  menuFocus = new MenuFocus({
    surface: element("player-surface", HTMLElement), menu,
    initial: element("close-menu", HTMLButtonElement), fallback: stage,
    background: [scene, title, choices, playControls],
    owner: () => session,
    enabled: () => !closed && !exiting && !document.hidden && !host.state().paused && !panels?.active,
  });

  panels = new GamePanels({
    dialogs: shellDialogs,
    display: dialogDisplay,
    enabled: () => ready && !closed && !exiting && entryPreparation !== entryRequest
      && !dialogue.open && !gallery.open && !chapters.open && !sounds.open && !aftergame?.open,
    acquirePause: () => {
      const owner = session;
      const acquired = !!owner && !owner.view().paused.includes("menu");
      if (owner && acquired) owner.send({ type: "pause", reason: "menu", paused: true });
      return () => {
        if (owner && acquired && !closed && owner === session && !owner.view().disposed) {
          owner.send({ type: "pause", reason: "menu", paused: false });
        }
      };
    },
    changed: () => {
      if (panels?.active !== "rollback") panelRollback?.abort();
      input?.reset();
      input?.refresh();
      refreshSaveControls();
    },
    dismissed: () => {
      // Closing a panel cancels only an entry which has not yet been adopted.
      if (entryPreparation !== null && entryPreparation === entryRequest) {
        entryRequest++;
        entryPreparation = null;
        session?.send({ type: "pause", reason: "operation", paused: false });
        notify("已取消尚未采用的开局或读档准备，当前进度保持原状。");
        refreshSaveControls();
        refreshEnding();
      }
    },
  });

  function notify(message: string): void {
    shellMessage.textContent = message;
    shellMessage.hidden = !message;
  }

  function dockNotices(inMenu: boolean): void {
    const destination = inMenu ? menuNoticesHome : noticesHome;
    if (noticeStack.parentElement === destination) return;
    const focused = document.activeElement;
    const keepFocus = focused instanceof HTMLElement && noticeStack.contains(focused);
    // Move the same status nodes/buttons; their sources and original retry handlers stay attached.
    destination.append(noticeStack);
    if (keepFocus && focused instanceof HTMLElement && focused.getClientRects().length) {
      focused.focus({ preventScroll: true });
    }
  }

  function refreshShell(view = session?.view()): void {
    const active = !!view && !view.disposed;
    const blocked = !ready || closed || exiting || entryPreparation === entryRequest;
    document.body.dataset.playing = String(active);
    playControls.hidden = !active || view?.story.phase === "ended";
    entryBanner.hidden = !active || mode === "main";
    if (!entryBanner.hidden && entryBanner.textContent !== note.textContent) entryBanner.textContent = note.textContent;
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-panel-open]")) {
      button.disabled = blocked || (button.dataset.panelOpen === "rollback" && !active)
        || (button.closest(".play-controls") !== null && !active);
    }
    if (development) {
      element("aftergame-open", HTMLButtonElement).disabled = blocked || active;
      element("timed", HTMLButtonElement).disabled = blocked;
    }
    menuFocus?.refresh();
  }

  function openPanel(name: GamePanel): void {
    if (name === "tools" && !development) return;
    if (name === "rollback" && !session) return;
    try {
      stageFade?.cancel();
      if (!panels?.open(name)) return;
      if (name === "saves") {
        slots.browse(mode === "timed" ? "timed" : "main");
        refreshSaveControls();
      }
      if (name === "rollback" && session) showRollback(session.view());
    } catch (error: unknown) {
      panels?.close("leave");
      notify(`面板未能打开：${error instanceof Error ? error.message : "界面不可用"}。当前进度保持原状。`);
    }
  }

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
    setButtonLabel(pause, view.paused.includes("menu") ? "继续游戏" : "菜单");
    const menuHidden = !view.paused.includes("menu");
    if (menu.hidden !== menuHidden) stageFade?.begin();
    menu.hidden = menuHidden;
    dockNotices(!menuHidden);
    const phases = { presenting: "呈现中", ready: "可继续", choosing: "等待选择", ended: "本段结束" };
    if (status) status.textContent = `${story.nodeId} · ${phases[story.phase]}${view.paused.length ? ` · 已暂停：${view.paused.join(" / ")}` : ""}`
      + (story.terminal?.kind === "ending" ? ` · ${story.terminal.endingId}` : "")
      + (view.newEnding ? " · 新结局已保存，可从主页鉴赏" : "");
    problem.hidden = !view.problem;
    problemMessage.textContent = view.problem ? `${view.problem.blocking ? "已暂停" : "媒体提示"}：${view.problem.message}` : "";
    if (debug) debug.textContent = JSON.stringify({ nodeId: story.nodeId, token, variables: story.variables,
      player: story.player, phase: story.phase, choiceRemainingMs: view.choiceRemainingMs }, null, 2);
    refreshReadout(view);
    choicePanel.render(view);
    refreshEnding(view);
    if (view.disposed || view.skipping || view.problem?.blocking
      || view.paused.some(reason => reason === "background" || reason === "host" || reason === "exit")) {
      stageFade?.cancel();
      dialogFade?.cancel();
    }
    showRollback(view);
    refreshShell(view);
  }

  function currentTerminal(token: SessionView["token"]): boolean {
    if (closed || !session) return false;
    const view = session.view();
    return !view.disposed && view.story.phase === "ended"
      && view.token.session === token.session && view.token.epoch === token.epoch && view.token.step === token.step;
  }

  function refreshReadout(view = session?.view()): void {
    const enabled = readoutPreferences.values(mode).enabled;
    readoutSummary.hidden = !enabled;
    const text = !enabled ? "" : view && !view.disposed
      ? `当前：${readout.summary(view.story.variables) || "本作品没有可显示的好感或尾鳍变量。"}`
      : "开始游戏后，数值会显示在每话结尾的存档点。";
    if (readoutSummary.textContent !== text) readoutSummary.textContent = text;
  }

  function refreshEnding(view = session?.view()): void {
    if (!view) { endingVisualKey = ""; endingPanel.clear(); return; }
    const terminal = view.story.terminal;
    const visualKey = !view.disposed && view.story.phase === "ended" && terminal
      ? JSON.stringify([view.token.session, terminal]) : "";
    if (visualKey && visualKey !== endingVisualKey) stageFade?.begin();
    endingVisualKey = visualKey;
    const record: EndingRecordState = mode !== "main"
      ? { kind: "preview", message: `${mode === "chapter" ? "章节试阅" : "限时样例"}已到达此结局；本次游玩不写全局解锁或通关次数，不代表真实路线验收。` }
      : terminalRecord?.generation === generation && terminalRecord.presentation === presentation
        && terminal?.kind === "ending" && terminalRecord.endingId === terminal.endingId
      ? terminalRecord.state : { kind: "unknown" };
    endingPanel.render(view, record, closed || exiting || entryPreparation === entryRequest);
  }

  async function flushRecords(): Promise<void> {
    recordFailure = null;
    if (terminalRecord?.state.kind === "failed") terminalRecord.state = { kind: "pending" };
    refreshEnding();
    await recordWriter.flush();
  }

  function refreshSaveControls(view?: SessionView): void {
    const blocked = closed || exiting || savePreparation !== null || entryPreparation === entryRequest;
    save.disabled = blocked || saving || mode === "chapter" || !(view ?? session?.view())?.canCheckpoint;
    save.textContent = mode === "chapter" ? "章节试阅不写入存档槽位"
      : `保存${entryName(mode)}到 ${JSON.stringify(slots.slot(mode))}`;
    for (const entry of saveEntries) {
      const suffix = entry === "main" ? "main" : "timed";
      const inspect = element(`inspect-${suffix}`, HTMLButtonElement);
      const load = element(`load-${suffix}`, HTMLButtonElement);
      inspect.disabled = blocked;
      load.disabled = blocked || !["silent", "replay", "resume"].includes(voiceChoice.value);
      inspect.textContent = `查看${entryName(entry)} ${JSON.stringify(slots.slot(entry))}`;
      load.textContent = `读取${entryName(entry)} ${JSON.stringify(slots.slot(entry))}`;
    }
    slots.refreshControls();
    refreshPendingSaves();
    refreshShell(view);
  }

  function refreshPendingSaves(): void {
    if (closed) return;
    try { pendingSaves.refresh(); }
    catch (error: unknown) {
      saveMessage.textContent = `手动存档状态暂未显示：${error instanceof Error ? error.message : "界面不可用"}。实际写入仍按原操作处理，可重新打开面板查看。`;
    }
  }

  function showRollback(view: SessionView): void {
    const key = `${view.token.session}:${view.token.epoch}:${view.token.step}:${view.rollbackCount}`;
    if (key !== rollbackKey) {
      rollbackKey = key;
      rollbackLocations.setTargets(session?.rollbackTargets() ?? []);
    }
    const selected = rollbackLocations.refresh(rollbackBoundary.value);
    rollbackTarget.disabled = rollingBack || view.rollbackCount === 0;
    rollbackBoundary.disabled = rollbackVoice.disabled = rollingBack;
    rollbackButton.disabled = rollingBack || !view.canCheckpoint || !selected
      || !["silent", "replay", "resume"].includes(rollbackVoice.value)
      || !["within", "across"].includes(rollbackBoundary.value);
    rollbackWarning.hidden = !view.rollbackIssue;
    rollbackWarning.textContent = view.rollbackIssue ?? "";
  }

  async function start(selected: Entry | ChapterEntry, restore?: { voice: RestoreVoice; slotId: string }): Promise<void> {
    if (exiting || closed || (!development && selected === "timed")) return;
    savePreparation?.abort();
    const entry: PlayEntry = typeof selected === "string" ? selected : "chapter";
    const request = ++entryRequest;
    entryPreparation = request;
    const restoreVoice = restore?.voice;
    const owner = session;
    owner?.send({ type: "pause", reason: "operation", paused: true });
    refreshSaveControls();
    refreshEnding();
    let adopted = false;
    try {
      let source: typeof content;
      let trial: ChapterTrial | null = null;
      if (typeof selected === "string") source = sources[selected];
      else { trial = prepareChapterTrial(content, selected.nodeId); source = trial.content; }
      if (entry === "main") await flushRecords();
      const records = entry === "main" ? await playerRecords.read() : null;
      const player = records ? playerProjection(records) : trial?.player ?? { "周目": 1, "结局数": 0 };
      let checkpoint: GameCheckpoint | null = null;
      if (restore) {
        if (typeof selected !== "string") throw new Error("章节试阅只从声明初值开始，不读取游戏槽位");
        const saved = await saves[selected].read(restore.slotId);
        if (!saved) throw new Error(`这个入口的 ${JSON.stringify(restore.slotId)} 槽位尚未保存进度`);
        checkpoint = prepareGameRestore(source, saved.checkpoint, player).checkpoint;
      }
      const delivery = crypto.randomUUID();
      if (closed || request !== entryRequest) return;
      // All content, slot and global data are prepared before leaving live play.
      dialogFade?.cancel();
      stageFade?.begin();
      closeDialogue();
      closeChapters();
      closeSounds();
      input?.reset();
      owner?.dispose();
      panels?.close("leave");
      session = null;
      terminalRecord = null;
      endingVisualKey = "";
      endingPanel.clear();
      adopted = true;
      mode = entry;
      activeChapter = trial;
      audioPreferences.setMode(entry);
      readingPreferences.setMode(entry);
      buttonPreferences.setMode(entry);
      readoutPreferences.setMode(entry);
      rollbackKey = "";
      menu.hidden = title.hidden = problem.hidden = true;
      dockNotices(false);
      menuFocus?.refresh();
      choicePanel.clear();
      closeGallery();
      closeAftergame();
      resetSaveMessage();
      resetRollback();
      if (records) {
        reads.main.clear();
        for (const nodeId of records.readNodeIds) reads.main.add(nodeId);
      }
      note.textContent = trial
        ? `章节试阅：${trial.entry.title}（${trial.entry.nodeId}）。声明初值 ${JSON.stringify(trial.initialVariables)}，周目 1、结局数 0；不是此前真实路线进度，不写玩家存档、全局成果或正常偏好。`
        : entry === "timed"
        ? "限时选择样例：声明初值 0、周目 1、结局数 0；不是第五话真实路线，不写全局成果。"
        : "正常游玩：进度与全局成果分别保存，重新开始和读档保留已解锁的结局与 CG。";
      notify("");
      let sequence = 0;
      const reading = readingPreferences.values(entry);
      const newPresentation = new WebPresentation(scene, source, resources, host.state().audioAllowed,
        audioPreferences.values(entry), reading, whaleSkin.artwork, { stage, choices });
      presentation = newPresentation;
      const sessionGeneration = ++generation;
      session = createGameSession({
        content: source, player, generation: sessionGeneration,
        clock, presentation, seen: entry === "chapter" ? new Set<string>() : reads[entry], onChange: show,
        rollback: { capacity: 500 },
        autoWaitMultiplier: reading.autoWaitMultiplier,
        readoutEnabled: readoutPreferences.values(entry).enabled,
        initialPauses: [
          ...(document.hidden ? ["background" as const] : []),
          ...(host.state().paused ? ["host" as const] : []),
        ],
        ...(checkpoint && restoreVoice ? { resume: { checkpoint, voice: restoreVoice } } : {}),
        onFacts: facts => {
          if (entry === "main" && facts.length) {
            const id = `${delivery}:${++sequence}`;
            const ending = facts.find(fact => fact.type === "ending");
            if (ending?.type === "ending") {
              terminalRecord = {
                generation: sessionGeneration, presentation: newPresentation, endingId: ending.endingId,
                state: recordFailure === null ? { kind: "pending" } : { kind: "failed", message: recordFailure },
              };
              endingFeedbackOwners.set(id, terminalRecord);
            }
            recordWriter.enqueue({ id, occurredAt: Date.now(), facts });
          }
        },
      });
      show(session.view());
      unlockAudio();
      if (checkpoint && restore && entry !== "chapter") saveMessage.textContent = `已从${entryName(entry)} ${JSON.stringify(restore.slotId)} 恢复剧情位置和剩余有效时间；全局记录沿用当前已保存成果。`;
    } catch (error: unknown) {
      if (closed || request !== entryRequest) return;
      if (adopted) {
        stageFade?.cancel();
        session?.dispose();
        presentation?.dispose();
        choicePanel.clear();
        session = null;
        activeChapter = null;
        mode = "main";
        terminalRecord = null;
        endingVisualKey = "";
        endingPanel.clear();
        presentation = null;
        host.releaseAudio();
        audioPreferences.setMode("main");
        readingPreferences.setMode("main");
        buttonPreferences.setMode("main");
        readoutPreferences.setMode("main");
        title.hidden = false;
        next.disabled = auto.disabled = skip.disabled = pause.disabled = audio.disabled = save.disabled = dialogueOpen.disabled = rollbackButton.disabled = true;
        input?.refresh();
        resetRollback();
      }
      saveMessage.textContent = `未能${restoreVoice ? "读档" : "开局"}：${error instanceof Error ? error.message : "未知错误"}。全局成果与原槽位保持原值。`;
      notify(saveMessage.textContent);
    } finally {
      if (entryPreparation === request) entryPreparation = null;
      if (!closed && request === entryRequest && session === owner) owner?.send({ type: "pause", reason: "operation", paused: false });
      if (!closed) refreshSaveControls();
      if (!closed) refreshEnding();
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
    savePreparation?.abort();
    dialogFade?.cancel();
    stageFade?.begin();
    entryRequest++;
    input?.reset();
    closeDialogue();
    closeChapters();
    closeSounds();
    closeAftergame();
    session?.dispose();
    session = null;
    panels?.close("leave");
    activeChapter = null;
    mode = "main";
    terminalRecord = null;
    endingVisualKey = "";
    endingPanel.clear();
    presentation = null;
    audioPreferences.setMode("main");
    readingPreferences.setMode("main");
    buttonPreferences.setMode("main");
    readoutPreferences.setMode("main");
    host.releaseAudio();
    scene.replaceChildren();
    scene.classList.remove("paused");
    choicePanel.clear();
    title.hidden = false;
    menu.hidden = problem.hidden = true;
    dockNotices(false);
    menuFocus?.refresh();
    next.disabled = auto.disabled = skip.disabled = pause.disabled = audio.disabled = save.disabled = dialogueOpen.disabled = true;
    resetRollback();
    resetSaveMessage();
    if (status) status.textContent = "已返回标题；旧会话的任务已取消";
    notify("");
    input?.refresh();
    refreshSaveControls();
  }

  function resetRollback(): void {
    rollbackKey = "";
    rollbackLocations.setTargets([]);
    rollbackLocations.refresh(rollbackBoundary.value);
    rollbackBoundary.disabled = rollbackVoice.disabled = false;
    rollbackTarget.disabled = rollbackButton.disabled = true;
    rollbackMessage.textContent = "本次游玩达到稳定检查点后会记录回退位置；回退保留全局成果。";
    rollbackWarning.hidden = true;
    rollbackWarning.textContent = "";
  }

  function resetSaveMessage(): void {
    storageMessageEpoch++;
    saveMessage.textContent = mode === "chapter"
      ? "章节试阅仅在本次会话中运行，不保存到玩家槽位；如需继续已有路线，请明确读取第一话进度。"
      : "场面就绪并完整显示文字后，可保存到当前入口选中的命名槽位。两个入口分别保留，选择名称本身不写入。";
    saveDetails.hidden = true;
    saveDetails.textContent = "";
  }

  function describeSave(entry: Entry, inspected: InspectedSave): void {
    const { record, view } = inspected;
    saveMessage.textContent = `${entryName(entry)} · 槽位 ${JSON.stringify(record.slotId)} · ${new Date(record.savedAt).toLocaleString()} · ${view.nodeId}。已读取并校验检查点；当前游玩位置未改变。`;
    try { renderSaveDetails(saveDetails, entryName(entry), inspected, content); }
    catch (error: unknown) {
      // A display failure must not turn an already committed progress write into a storage failure.
      saveDetails.textContent = `存档详情暂未显示：${error instanceof Error ? error.message : "显示错误"}。可再次查看；当前进度及已经完成的存档操作未因显示错误改变。`;
    }
    saveDetails.hidden = false;
  }

  function currentSaveFeedback(request: number, scope: AbortSignal): boolean {
    return !closed && !exiting && !scope.aborted && panels?.signalFor("saves") === scope
      && request === storageMessageEpoch;
  }

  async function saveCheckpoint(): Promise<void> {
    const owner = session;
    const entry = mode;
    const scope = panels?.signalFor("saves");
    if (!scope || scope.aborted || entry === "chapter" || exiting || closed
      || entryPreparation === entryRequest || !owner || saving || !owner.view().canCheckpoint) return;
    const slotId = slots.slot(entry);
    const savedPresentation = presentation;
    const request = ++storageMessageEpoch;
    const preparation = new AbortController();
    savePreparation = preparation;
    scope.addEventListener("abort", () => preparation.abort(), { once: true, signal: preparation.signal });
    let cancelWait: () => void = () => {};
    const cancelled = new Promise<never>((_resolve, reject) => {
      cancelWait = () => reject(new Error("原保存准备已取消，尚未发起进度写入"));
      preparation.signal.addEventListener("abort", cancelWait, { once: true });
    });
    const currentPreparation = (): boolean => savePreparation === preparation && !preparation.signal.aborted
      && owner === session && mode === entry && !owner.view().disposed
      && entryPreparation !== entryRequest && currentSaveFeedback(request, scope);
    let feedbackRequest = request;
    let feedbackScope = scope;
    let writeStarted = false;
    saving = true;
    saveDetails.hidden = true;
    saveMessage.textContent = `正在准备${entryName(entry)} ${JSON.stringify(slotId)} 的本次检查点，尚未写入进度……`;
    refreshSaveControls();
    try {
      const captured = await Promise.race([owner.captureCheckpoint(owner.view().token), cancelled]);
      if (!currentPreparation()) return;
      if (!captured.accepted) throw new Error(`${captured.code}：${captured.message}`);
      const payload = { checkpoint: captured.checkpoint, savedAt: Date.now() };
      saveMessage.textContent = `正在重新检查${entryName(entry)} ${JSON.stringify(slotId)} 是否已有记录，尚未写入进度……`;
      const target = await Promise.race([saves[entry].target(slotId), cancelled]);
      if (!currentPreparation()) return;
      if (target.kind === "occupied") {
        saveMessage.textContent = `原槽位 ${JSON.stringify(slotId)} 已有记录，请确认是否用本次捕获的进度覆盖。`;
        const accepted = await overwritePrompt.ask({
          entryLabel: entryName(entry), target, nodeId: payload.checkpoint.story.nodeId, savedAt: payload.savedAt,
        }, preparation.signal);
        if (!currentPreparation()) return;
        if (!accepted) {
          saveMessage.textContent = `已取消这次保存；未发起对${entryName(entry)} ${JSON.stringify(slotId)} 的进度写入。`;
          return;
        }
      }
      if (!currentPreparation()) return;
      // Acceptance belongs to this captured target/payload. Subsequent selection or close cannot retarget it.
      savePreparation = null;
      saveMessage.textContent = `正在保存${entryName(entry)}到原槽位 ${JSON.stringify(slotId)}……`;
      refreshSaveControls();
      const key = JSON.stringify(["progress", entry, slotId]);
      const tracked = writes.track(key, async () => {
        if (entry === "main") await flushRecords();
        const inspected = await saves[entry].save(slotId, payload.checkpoint, payload.savedAt);
        // Catalogue, display and optional audio observers cannot reject a committed write.
        try {
          if (!closed && !feedbackScope.aborted && panels?.signalFor("saves") === feedbackScope) slots.saved(entry);
          if (currentSaveFeedback(feedbackRequest, feedbackScope)) {
            describeSave(entry, inspected);
            saveMessage.textContent = `${entryName(entry)}进度已保存到 ${JSON.stringify(slotId)}；可刷新页面后查看或读取。周目与鉴赏成果单独保留。`;
          }
          if (!closed && !exiting && feedbackRequest === storageMessageEpoch && owner === session
            && savedPresentation === presentation && !owner.view().skipping) {
            try { savedPresentation?.interaction({ type: "cue", cue: "save" }); }
            catch { /* Optional feedback has no effect on the committed checkpoint. */ }
          }
        } catch (error: unknown) {
          if (currentSaveFeedback(feedbackRequest, feedbackScope)) saveMessage.textContent =
            `${entryName(entry)}进度已保存到 ${JSON.stringify(slotId)}；界面刷新未完成：${error instanceof Error ? error.message : "显示错误"}。可再次查看原槽位。`;
        }
      }, `${entryName(entry)} · 槽位 ${JSON.stringify(slotId)}`);
      writeStarted = true;
      try {
        pendingSaves.register(key, {
          view: () => tracked.view(),
          location: () => ({ nodeId: payload.checkpoint.story.nodeId, savedAt: payload.savedAt }),
          retry: () => {
            void retryProgressSave(tracked, (epoch, scope) => { feedbackRequest = epoch; feedbackScope = scope; });
          },
        });
      } catch (error: unknown) {
        saveMessage.textContent = `原保存已发起，重试状态暂未显示：${error instanceof Error ? error.message : "界面不可用"}。实际写入仍按原操作处理。`;
      }
      await tracked.result;
    } catch (error: unknown) {
      if (currentSaveFeedback(feedbackRequest, feedbackScope)) {
        saveMessage.textContent = writeStarted
          ? `保存未取得完成确认：${error instanceof Error ? error.message : "未知存储错误"}。可在“尚未完成的手动存档”中重试原操作或查看原槽位；原槽位未先删除。`
          : preparation.signal.aborted ? "已取消尚未采用的保存准备；这次没有发起进度写入。"
            : `保存准备未完成：${error instanceof Error ? error.message : "检查失败"}。这次没有发起进度写入，请在稳定位置重新点击保存。`;
      }
    } finally {
      if (savePreparation === preparation) savePreparation = null;
      preparation.signal.removeEventListener("abort", cancelWait);
      preparation.abort();
      saving = false;
      if (!closed) refreshSaveControls();
    }
  }

  async function retryProgressSave(tracked: TrackedWrite, report: (epoch: number, scope: AbortSignal) => void): Promise<void> {
    const scope = panels?.signalFor("saves");
    if (!scope || scope.aborted || closed || exiting || saving || entryPreparation === entryRequest
      || tracked.view().state !== "failed") return;
    const request = ++storageMessageEpoch;
    report(request, scope);
    saving = true;
    saveDetails.hidden = true;
    saveMessage.textContent = `正在重试原存档：${tracked.view().label}；检查点和时间保持原值……`;
    refreshSaveControls();
    try { await tracked.retry(); }
    catch (error: unknown) {
      if (currentSaveFeedback(request, scope)) {
        const state = tracked.view();
        saveMessage.textContent = state.state === "superseded"
          ? `原存档操作已被后来的显式保存替代：${state.label}。本次旧重试未执行。`
          : `原存档尚未取得完成确认：${state.label}。${error instanceof Error ? error.message : "存储错误"}。原目标和检查点继续保留，可查看原槽位或再次重试。`;
      }
    } finally {
      saving = false;
      if (!closed) refreshSaveControls();
    }
  }

  async function inspectSaved(entry: Entry): Promise<void> {
    if (!saveEntries.includes(entry)) return;
    const scope = panels?.signalFor("saves");
    if (!scope || scope.aborted || savePreparation || exiting || closed || entryPreparation === entryRequest) return;
    const slotId = slots.slot(entry);
    const request = ++storageMessageEpoch;
    saveDetails.hidden = true;
    saveMessage.textContent = `正在查看${entryName(entry)} ${JSON.stringify(slotId)} 检查点……`;
    try {
      const inspected = await saves[entry].read(slotId);
      if (!currentSaveFeedback(request, scope)) return;
      if (inspected) describeSave(entry, inspected);
      else saveMessage.textContent = `${entryName(entry)}的 ${JSON.stringify(slotId)} 槽位尚未保存检查点。`;
    } catch (error: unknown) {
      if (currentSaveFeedback(request, scope)) {
        saveMessage.textContent = `读取失败：${error instanceof Error ? error.message : "未知存储错误"}。当前会话保持原状，已有数据未被删除。`;
      }
    }
  }

  function load(entry: Entry): void {
    if (exiting || closed || entryPreparation === entryRequest || !saveEntries.includes(entry)) return;
    const voice = voiceChoice.value;
    if (voice !== "silent" && voice !== "replay" && voice !== "resume") {
      saveMessage.textContent = "请先选择本次读档的语音方式。";
      return;
    }
    void start(entry, { voice, slotId: slots.slot(entry) });
  }

  async function rollback(): Promise<void> {
    const owner = session;
    const voice = rollbackVoice.value;
    const boundary = rollbackBoundary.value;
    const targetId = Number(rollbackTarget.value);
    if (!owner || (boundary !== "within" && boundary !== "across")
      || (voice !== "silent" && voice !== "replay" && voice !== "resume")) return;
    if (panels?.active !== "rollback" || panelRollback) return;
    const controller = new AbortController();
    panelRollback = controller;
    try {
      const result = await rollbackTo(owner, { targetId, voice, crossChoices: boundary === "across" }, controller.signal);
      if (result.accepted && !controller.signal.aborted && owner === session) panels?.close("leave");
    } finally { if (panelRollback === controller) panelRollback = null; }
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
        rollbackMessage.textContent = "回退界面已关闭，本次尚未采用的回退已取消。已发起的全局记录提交仍可完成。";
        owner.send({ type: "pause", reason: "operation", paused: false });
      }
    };
    signal?.addEventListener("abort", cancelPreparation, { once: true });
    try {
      if (selected === "main") await flushRecords();
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
        if (signal?.aborted && adopted) rollbackMessage.textContent = "回退已采用；关闭界面不会撤销已经恢复的进度。";
        owner.send({ type: "pause", reason: "operation", paused: false });
      }
      if (!closed && session) showRollback(session.view());
      dialoguePanel?.refresh(host.state().audioAllowed);
    }
  }

  async function openGallery(): Promise<void> {
    if (exiting || closed || session || gallery.open) return;
    const request = ++entryRequest;
    const mediaRequest = ++galleryRequest;
    try {
      await flushRecords();
      const records = await playerRecords.read();
      if (closed || exiting || request !== entryRequest || mediaRequest !== galleryRequest || session) return;
      stageFade?.cancel();
      galleryPanel ??= new GalleryPanel(galleryBody, content, resources,
        change => dialogDisplay.change(gallery, change));
      galleryPanel.open(records);
      dialogDisplay.open(gallery);
    } catch (error: unknown) {
      if (!closed && request === entryRequest && mediaRequest === galleryRequest) {
        closeGallery();
        recordMessage.textContent = `鉴赏未能打开：${error instanceof Error ? error.message : "记录或本地图片读取失败"}。已有全局成果保留。`;
        recordStatus.hidden = false;
      }
    }
  }

  function closeGallery(animate = false): void {
    galleryRequest++;
    dialogDisplay.close(gallery, animate);
    galleryPanel?.close();
  }

  function openSounds(): void {
    if (closed || exiting || session || sounds.open) return;
    entryRequest++;
    stageFade?.cancel();
    closeChapters();
    closeGallery();
    closeAftergame();
    try {
      soundPanel ??= new SoundLibraryPanel({
        root: soundsBody, content, resources, artwork: collectionSkin.artwork, volumes: audioPreferences.values("main"),
        audioAllowed: host.state().audioAllowed,
        available: () => !closed && !exiting && !session && sounds.open && !document.hidden,
        paused: () => closed || exiting || !!session || !sounds.open || document.hidden || host.state().paused,
        requestAudio: () => {
          host.requestAudio();
          soundPanel?.refresh(host.state().audioAllowed);
        },
        transition: change => dialogDisplay.change(sounds, change),
      });
      soundPanel.setVolumes(audioPreferences.values("main"));
      soundPanel.open();
      dialogDisplay.open(sounds);
      soundPanel.refresh(host.state().audioAllowed);
    } catch (error: unknown) {
      closeSounds();
      notify(`声音收藏未能打开：${error instanceof Error ? error.message : "本地目录读取失败"}。主线仍可开始，已有成果保留。`);
    }
  }

  function closeSounds(animate = false): void {
    const wasOpen = sounds.open || soundPanel?.isOpen;
    dialogDisplay.close(sounds, animate);
    soundPanel?.close();
    if (wasOpen && !session) host.releaseAudio();
  }

  function openChapters(): void {
    if (closed || exiting || session || chapters.open) return;
    entryRequest++;
    stageFade?.cancel();
    closeSounds();
    closeGallery();
    closeAftergame();
    try {
      chapterPanel ??= new ChapterPanel(chaptersBody, content, entry => {
        if (!closed && !exiting && !session && chapters.open) void start(entry);
      });
      chapterPanel.open();
      dialogDisplay.open(chapters);
    } catch (error: unknown) {
      closeChapters();
      notify(`章节目录未能打开：${error instanceof Error ? error.message : "本地章节读取失败"}。仍可从第一话开始。`);
    }
  }

  function closeChapters(animate = false): void {
    dialogDisplay.close(chapters, animate);
    chapterPanel?.close();
  }

  function closeAftergame(animate = false): void {
    if (!aftergame || !aftergameBody) return;
    dialogDisplay.close(aftergame, animate);
    aftergamePanel?.close();
    aftergameBody.replaceChildren();
  }

  async function openAftergame(): Promise<void> {
    if (!development || !aftergame || !aftergameBody || exiting || closed || session || aftergame.open) return;
    const request = ++entryRequest;
    const active = (): boolean => !closed && !exiting && !session && aftergame.open && request === entryRequest;
    try {
      stageFade?.cancel();
      aftergameBody.textContent = "正在提交已有全局事实并准备通关记录……";
      dialogDisplay.open(aftergame);
      await flushRecords();
      if (!active()) return;
      // No chat module, backend or provider is required for mainline startup.
      const { createAftergamePanel } = await import("./aftergame.ts");
      if (!active()) return;
      aftergamePanel ??= createAftergamePanel(aftergameBody, content, recordScope,
        { read: () => playerRecords.readCompletions() });
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
    stageFade?.cancel();
    dialogueOwner = owner;
    owner.send({ type: "pause", reason: "history", paused: true });
    try {
      dialoguePanel?.open(owner.dialogueHistory(), owner.rollbackTargets());
      dialogDisplay.open(dialogue);
      dialoguePanel?.refresh(host.state().audioAllowed);
      dialogueBody.scrollTop = dialogueBody.scrollHeight;
    } catch (error: unknown) {
      closeDialogue();
      throw error;
    }
  }

  function closeDialogue(animate = false): void {
    const owner = dialogueOwner;
    dialogDisplay.close(dialogue, animate);
    dialogueOwner = null;
    dialoguePanel?.close();
    owner?.send({ type: "pause", reason: "history", paused: false });
  }

  element("start", HTMLButtonElement).onclick = () => { void start("main"); };
  if (development) element("timed", HTMLButtonElement).onclick = () => { void start("timed"); };
  element("restart", HTMLButtonElement).onclick = () => {
    if (mode === "chapter") { if (activeChapter) void start(activeChapter.entry); }
    else void start(mode);
  };
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
  if (development) element("inspect-timed", HTMLButtonElement).onclick = () => { void inspectSaved("timed"); };
  element("load-main", HTMLButtonElement).onclick = () => load("main");
  if (development) element("load-timed", HTMLButtonElement).onclick = () => load("timed");
  element("gallery-open", HTMLButtonElement).onclick = () => { void openGallery(); };
  element("gallery-close", HTMLButtonElement).onclick = () => closeGallery(true);
  gallery.addEventListener("cancel", event => { event.preventDefault(); closeGallery(true); });
  gallery.addEventListener("close", () => { if (!gallery.open) galleryPanel?.close(); });
  element("sounds-open", HTMLButtonElement).onclick = openSounds;
  element("sounds-close", HTMLButtonElement).onclick = () => closeSounds(true);
  sounds.addEventListener("cancel", event => { event.preventDefault(); closeSounds(true); });
  sounds.addEventListener("close", () => {
    if (!sounds.open && soundPanel?.isOpen) closeSounds();
  });
  element("chapters-open", HTMLButtonElement).onclick = openChapters;
  element("chapters-close", HTMLButtonElement).onclick = () => closeChapters(true);
  chapters.addEventListener("cancel", event => { event.preventDefault(); closeChapters(true); });
  chapters.addEventListener("close", () => { if (!chapters.open) chapterPanel?.close(); });
  if (development && aftergame) {
    element("aftergame-open", HTMLButtonElement).onclick = () => {
      panels?.close("leave");
      void openAftergame();
    };
    element("aftergame-close", HTMLButtonElement).onclick = () => closeAftergame(true);
    aftergame.addEventListener("cancel", event => { event.preventDefault(); closeAftergame(true); });
    aftergame.addEventListener("close", () => { if (!aftergame.open) aftergamePanel?.close(); });
  }
  dialogueOpen.onclick = openDialogue;
  element("dialogue-history-close", HTMLButtonElement).onclick = () => closeDialogue(true);
  dialogue.addEventListener("cancel", event => { event.preventDefault(); closeDialogue(true); });
  dialogue.addEventListener("close", () => { if (!dialogue.open) closeDialogue(); });
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-panel-open]")) {
    button.addEventListener("click", () => {
      const name = button.dataset.panelOpen;
      if (name === "saves" || name === "settings" || name === "rollback" || name === "tools") openPanel(name);
    }, { signal: buttonEvents.signal });
  }
  exitDialog.addEventListener("cancel", event => { event.preventDefault(); host.cancelExit(); });
  voiceChoice.onchange = () => refreshSaveControls();
  rollbackTarget.onchange = rollbackBoundary.onchange = rollbackVoice.onchange = () => { if (session) showRollback(session.view()); };
  rollbackButton.onclick = () => { void rollback(); };
  retryRecords.onclick = () => { void flushRecords().catch(() => {}); };
  const visibility = (): void => {
    if (document.hidden) { stageFade?.cancel(); dialogFade?.cancel(); }
    session?.send({ type: "pause", reason: "background", paused: document.hidden });
    dialoguePanel?.refresh(host.state().audioAllowed);
    soundPanel?.refresh(host.state().audioAllowed);
    menuFocus?.refresh();
  };
  document.addEventListener("visibilitychange", visibility);
  const dispose = (): void => {
    closed = true;
    savePreparation?.abort();
    overwritePrompt.dispose();
    unsubscribePendingSaves();
    pendingSaves.dispose();
    menuFocus?.dispose();
    disposeExitStatus?.();
    dialogFade?.dispose();
    panels?.dispose();
    stageFade?.dispose();
    entryRequest++;
    storageMessageEpoch++;
    endingFeedbackOwners.clear();
    terminalRecord = null;
    endingPanel.dispose();
    closeDialogue();
    closeChapters();
    closeSounds();
    closeGallery();
    closeAftergame();
    aftergamePanel?.dispose();
    galleryPanel?.dispose();
    soundPanel?.dispose();
    dialoguePanel?.dispose();
    audioPreferences.dispose();
    readingPreferences.dispose();
    buttonPreferences.dispose();
    readoutPreferences.dispose();
    slots.dispose();
    buttonEvents.abort();
    input?.dispose();
    fullscreen?.dispose();
    cover.dispose();
    orientationHint.dispose();
    session?.dispose();
    host.releaseAudio();
    host.dispose();
    storage.dispose();
    choicePanel.dispose();
    layout.dispose();
    delete document.body.dataset.playing;
    document.removeEventListener("visibilitychange", visibility);
  };
  window.addEventListener("pagehide", dispose, { once: true });
  import.meta.hot?.dispose(dispose);
  await Promise.all([audioPreferences.load(), readingPreferences.load(), buttonPreferences.load(), readoutPreferences.load()]);
  if (closed || startup.signal.aborted) return;
  ready = true;
  element("loading-screen", HTMLElement).hidden = true;
  note.textContent = development
    ? "本地内容已载入。可以从第一话开始，或选择明确标注初始条件的章节试阅与限时样例。"
    : "本地内容已载入，可以开始游戏。";
  for (const id of ["start", "gallery-open", "sounds-open", "chapters-open",
    ...(development ? ["timed", "aftergame-open"] : [])]) element(id, HTMLButtonElement).disabled = false;
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
  const loading = document.getElementById("loading-screen");
  if (loading) loading.hidden = true;
  if (status) status.textContent = "内容加载失败，尚未开始游玩";
  if (retry instanceof HTMLButtonElement) {
    retry.disabled = false;
    retry.textContent = "重新读取内容";
    retry.onclick = () => window.location.reload();
  }
});
