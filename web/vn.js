// galLingS 作品页：把 VN Studio 导出的游戏嵌进 galLingS 的外框里玩。
// 窗口模式：游戏在中间 16:9，右侧栏 = 游戏的手账（游戏自己画，停靠到这里，所以和游戏里看到的完全一样）。
// 全屏模式：整块画面全屏，手账回到游戏里的书签。两种模式用的是同一局游戏、同一份手账数据。
// 游戏那边的接口是 window.VNHost（同源，直接调用），见 VN Studio TECH.md §7.6。
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const game = $("game");
// 纯游戏模式（?play=1，桌面完整版是 ?play=desktop）：不要外框，窗口里只有游戏本体；galLingS 照常在后台，游戏仍按 host=gallings 连它
const PLAY = new URLSearchParams(location.search).get("play");
if (PLAY) document.body.classList.add("pure");
let H = null;              // 游戏的 VNHost
let docked = false;

// ---------------------------------------------------------------- 作品列表
async function loadGames() {
  const r = await (await fetch("/api/vn/games")).json();
  const sel = $("gameSel");
  sel.innerHTML = r.games.map((g) => `<option value="${encodeURIComponent(g.id)}">${esc(g.title)}</option>`).join("");
  const want = new URLSearchParams(location.search).get("game") || localStorage.getItem("gl.vn.game");
  if (want && r.games.some((g) => g.id === want)) sel.value = encodeURIComponent(want);
  if (!r.games.length) {
    $("empty").hidden = false; game.hidden = true;
    $("empty").innerHTML = `<b>还没有作品</b><p>把 VN Studio 导出的游戏文件夹（里面有 index.html）放进<br><code>${esc(r.dir)}</code><br>的一个子文件夹里，例如 <code>海风与布丁/</code>，然后刷新。也可以在 ⚙ 设置里换作品文件夹。</p>`;
    return;
  }
  openGame();
}
function openGame() {
  const id = decodeURIComponent($("gameSel").value);
  localStorage.setItem("gl.vn.game", id);
  H = null; docked = false; $("soulDock").innerHTML = "";
  $("empty").hidden = true; game.hidden = false;
  game.src = `/vn/${encodeURIComponent(id)}/index.html?host=gallings`;
}
$("gameSel").onchange = openGame;
game.addEventListener("load", () => {
  // 等游戏把 VNHost 挂好
  let n = 0;
  const t = setInterval(() => {
    const w = game.contentWindow;
    if (w && w.VNHost) { clearInterval(t); hookPureKeys(w); H = w.VNHost; $("plugBtn").hidden = !H.openPlugins; $("soulCss").textContent = H.css(); applyDock(); tick(); }
    else if (++n > 100) clearInterval(t);
  }, 100);
});

// ---------------------------------------------------------------- 手账停靠：窗口模式 + 右侧栏打开 = 停靠；否则回到游戏里
const journalOpen = () => !$("journal").hidden;
function applyDock() {
  if (!H) return;
  const want = !document.fullscreenElement && journalOpen();
  if (want !== docked) { docked = want; H.dock(want ? $("soulDock") : null); }
}
function setJournal(open) {
  $("journal").hidden = !open; $("journalBtn").setAttribute("aria-expanded", String(open)); localStorage.setItem("gl.vn.journal", open ? "1" : "0"); applyDock(); tick();
}
$("journalBtn").onclick = () => setJournal(!journalOpen());
$("jClose").onclick = () => setJournal(false);
setJournal(!PLAY && localStorage.getItem("gl.vn.journal") === "1");

// ---------------------------------------------------------------- 窗口 / 全屏
document.querySelectorAll("#viewSeg button").forEach((b) => b.onclick = async () => {
  if (b.dataset.view === "full" && !document.fullscreenElement) { try { await $("screen").requestFullscreen(); } catch (e) { /* 浏览器不让：留在窗口模式 */ } }
  if (b.dataset.view === "win" && document.fullscreenElement) await document.exitFullscreen();
});
document.addEventListener("fullscreenchange", () => {
  const full = !!document.fullscreenElement;
  document.querySelectorAll("#viewSeg button").forEach((b) => b.classList.toggle("on", (b.dataset.view === "full") === full));
  applyDock(); game.focus();
});

// ---------------------------------------------------------------- 顶栏按钮 → 游戏
$("saveBtn").onclick = () => { H?.save(); game.focus(); };
$("loadBtn").onclick = () => { H?.load(); game.focus(); };
$("plugBtn").onclick = () => { H?.openPlugins?.(); game.focus(); };
$("audioBtn").onclick = () => { H?.audioLibrary?.(); game.focus(); };
$("titleBtn").onclick = () => { if (H?.state().playing && !confirm("回到标题画面？没存档的进度会丢。")) return; H?.title(); game.focus(); };

// ---------------------------------------------------------------- 状态：章节、好感、信号、灵枢连接
function tick() {
  if (!H) return;
  const s = H.state();
  $("gameBrand").textContent = s.title || "海风与布丁";
  $("chapterTitle").textContent = s.chapter ? "· " + s.chapter : "";
  // Character statistics and infrastructure state belong in settings, outside the story view.
  const statusText = RPS.on ? `重播中 ${RPS.at}/${RPS.steps}${RPS.paused ? " · 暂停" : ""}${RPS.diverged ? " · 已停在分歧处" : ""}` : s.unread > 0 && !docked ? '手账有新记录' : '';
  $("replayBtn").classList.toggle("on", RPS.on);
  if ($("status").textContent !== statusText) $("status").textContent = statusText;
  $("status").hidden = !statusText;
  $("gameSel").closest('.game-select-group').hidden = $("gameSel").options.length < 2;
  $("journalNew").hidden = !(s.unread > 0 && !docked);
  $("saveBtn").disabled = !s.playing;
  $("audioBtn").hidden = !H.capabilities?.audioLibrary;
}
setInterval(tick, 600);

// ---------------------------------------------------------------- 时间轴同款：右侧栏左边缘拖宽
(() => {
  const root = document.body, bar = $("tlResizer");
  const clampW = (w) => Math.round(Math.max(300, Math.min(w, innerWidth * 0.5, innerWidth - 560)));
  const savedW = +localStorage.getItem("gl.vn.jw");
  if (savedW) root.style.setProperty("--tlw", clampW(savedW) + "px");
  bar.addEventListener("pointerdown", (e) => {
    e.preventDefault(); bar.setPointerCapture(e.pointerId); root.classList.add("tl-dragging");
    const right = $("journal").getBoundingClientRect().right;
    const move = (ev) => root.style.setProperty("--tlw", clampW(right - ev.clientX) + "px");
    const up = () => {
      bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up);
      root.classList.remove("tl-dragging");
      localStorage.setItem("gl.vn.jw", parseInt(getComputedStyle(root).getPropertyValue("--tlw")) || "");
    };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
  });
  bar.addEventListener("dblclick", () => { root.style.removeProperty("--tlw"); localStorage.removeItem("gl.vn.jw"); });
})();

// ---------------------------------------------------------------- 设置：这里只放游戏部分（手账 / 声音 / 文字）。
// 在线聊天与连接设置（模型 / 记忆 / 作品文件夹 / 插件设置面板）已挪进游戏自己的「设置」，在“灵枢 → 连接”下面（作品 index.html 的 glOnline）。
const formatGamePref = (p, value) => /^(vbgm|vse|vamb|vvo|readerScale)$/.test(p.k) ? Math.round(+value * 100) + "%" : (+value).toFixed(p.step < 1 ? 1 : 0);
function renderGamePrefs() {
  const list = H ? H.prefs() : [];
  const row = (p) => {
    if (p.type === "range") return `<label class="set-row"><span>${p.label}</span><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}" data-gp="${p.k}"><small class="muted rv">${formatGamePref(p, p.value)}</small></label>`;
    if (p.type === "bool") return `<div class="set-row"><span>${p.label}</span><div class="seg"><button type="button" data-gp="${p.k}" data-v="1" class="${p.value ? "on" : ""}">开</button><button type="button" data-gp="${p.k}" data-v="0" class="${p.value ? "" : "on"}">关</button></div></div>`;
    return `<div class="set-row"><span>${p.label}</span><div class="seg">${p.options.map(([v, t]) => `<button type="button" data-gp="${p.k}" data-v="${v}" class="${p.value === v ? "on" : ""}">${t}</button>`).join("")}</div></div>`;
  };
  $("gSoul").innerHTML = list.filter((p) => p.group === "soul").map(row).join("");
  $("gPrefs").innerHTML = list.filter((p) => p.group !== "soul").map(row).join("") || `<small class="muted">游戏还没加载。</small>`;
  $("soulSec").hidden = !list.some((p) => p.group === "soul");
  const st = H?.state();
  $("memCount").textContent = st?.playing ? `${st.mem} 条（只清这一局手账，剧情进度不变）` : "开始游戏后记录";
  $("sForget").disabled = !st?.playing;
  document.querySelectorAll("#setDlg [data-gp]").forEach((el) => {
    const sc = list.find((p) => p.k === el.dataset.gp);
    if (el.type === "range") el.oninput = () => { H.setPref(sc.k, +el.value); el.nextElementSibling.textContent = formatGamePref(sc, el.value); };
    else el.onclick = () => {
      H.setPref(sc.k, sc.type === "bool" ? el.dataset.v === "1" : el.dataset.v);
      el.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el));
    };
  });
}
$("setBtn").onclick = async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  renderGamePrefs(); $("setDlg").showModal();
};
$("sClose").onclick = () => { $("setDlg").close(); game.focus(); };
$("sForget").onclick = () => { if (confirm("让她忘掉这一局记下的所有事？（剧情进度不变）")) { H?.forget(); renderGamePrefs(); } };

// ---------------------------------------------------------------- 重播（录制回放演示模式）：外框只管选局和遥控，画面由作品里的 galcore 桥按服务器下发的 ops 渲染
const RPS = { on: false, at: 0, steps: 0, speed: 1, paused: false, diverged: null, pick: "", pending: null };
const SPEEDS = [["0.5", "0.5×"], ["1", "1×"], ["2", "2×"], ["4", "4×"]];
const postGame = (m) => game.contentWindow?.postMessage(m, location.origin);
const rpCtl = (msg) => postGame({ gallings: "galcore-replay-ctl", msg });
{
  const q = new URLSearchParams(location.search);
  if (q.get("replay")) RPS.pending = { log: q.get("replay"), speed: q.get("speed") || "1" };   // python -m server.replay … --serve 给的链接
}
function speedSeg(box, cur, on) {
  box.innerHTML = SPEEDS.map(([v, t]) => `<button type="button" data-v="${v}" class="${+v === +cur ? "on" : ""}">${t}</button>`).join("");
  box.querySelectorAll("button").forEach((b) => b.onclick = () => { box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); on(b.dataset.v); });
}
let rpSpeedPick = localStorage.getItem("gl.vn.rpspeed") || "1";
async function openReplay() {
  if (document.fullscreenElement) await document.exitFullscreen();
  renderReplayCtl();
  speedSeg($("rpSpeed"), rpSpeedPick, (v) => { rpSpeedPick = v; localStorage.setItem("gl.vn.rpspeed", v); });
  $("rpOut").textContent = ""; $("rpList").innerHTML = `<li class="off"><small>读取中……</small></li>`;
  $("replayDlg").showModal();
  try {
    const r = await (await fetch("/api/replays")).json();
    const logs = r.logs || [];
    if (!RPS.pick || !logs.some((x) => x.id === RPS.pick)) RPS.pick = (logs.find((x) => x.current_chapter) || {}).id || "";
    $("rpList").innerHTML = logs.length ? logs.map((x) => {
      const t = x.started_ms ? new Date(x.started_ms).toLocaleString() : "";
      const dur = Math.round((x.duration_ms || 0) / 1000);
      return `<li data-id="${esc(x.id)}" class="${x.current_chapter ? "" : "off"} ${x.id === RPS.pick ? "on" : ""}" title="${x.current_chapter ? "" : "录的不是现在这部作品 / 剧本已改"}">
        <b>${esc(t)}</b><small>${esc(x.card_name || x.card_id || "")} · ${x.events} 步 · 选项 ${x.choices} · AI 回合 ${x.ai_turns} · ${Math.floor(dur / 60)}分${dur % 60}秒${x.recorded_screen ? "" : " · 旧日志"}</small></li>`;
    }).join("") : `<li class="off"><small>还没有录下的局：先玩一局，每局都会自动录下。</small></li>`;
    $("rpList").querySelectorAll("li[data-id]:not(.off)").forEach((li) => li.onclick = () => {
      RPS.pick = li.dataset.id; $("rpList").querySelectorAll("li").forEach((x) => x.classList.toggle("on", x === li));
    });
  } catch (e) { $("rpList").innerHTML = `<li class="off"><small>读不到录像列表：本地服务没开？</small></li>`; }
}
function renderReplayCtl() {
  $("rpCtlSec").hidden = !RPS.on;
  if (!RPS.on) return;
  $("rpProg").textContent = `第 ${RPS.at} / ${RPS.steps} 步`;
  $("rpPause").innerHTML = RPS.paused ? gi("play") + " 继续" : gi("pause") + " 暂停";
  $("rpStep").innerHTML = gi("step-forward") + " 单步"; $("rpStop").innerHTML = gi("square") + " 停止";
  $("rpJump").max = String(RPS.steps);
  $("rpNote").textContent = RPS.diverged ? `第一处分歧：第 ${RPS.diverged.step} 步（seq=${RPS.diverged.seq}，${RPS.diverged.kind}）` : "重播时点击、选项和输入都不生效；时间轴点某一行也会跳过去。";
  speedSeg($("rpSpeedNow"), RPS.speed, (v) => rpCtl({ type: "speed", speed: +v }));
}
function startReplay(log, speed) {
  if (!log) { $("rpOut").textContent = "先选一局"; return; }
  postGame({ gallings: "galcore-replay", log, speed });
  $("replayDlg").close(); game.focus();
}
$("replayBtn").onclick = openReplay;
$("rpClose").onclick = () => { $("replayDlg").close(); game.focus(); };
$("rpGo").onclick = () => startReplay(RPS.pick, rpSpeedPick);
$("rpPause").onclick = () => rpCtl({ type: RPS.paused ? "resume" : "pause" });
$("rpStep").onclick = () => rpCtl({ type: "step" });
$("rpStop").onclick = () => { postGame({ gallings: "galcore-replay-stop" }); };
$("rpJumpGo").onclick = () => { const n = parseInt($("rpJump").value, 10); if (n >= 0) rpCtl({ type: "jump", step: n }); };
window.addEventListener("message", (ev) => {
  if (ev.origin !== location.origin || ev.data?.gallings !== "galcore") return;
  const m = ev.data;
  if (m.ev === "replay-ready" && RPS.pending) { const p = RPS.pending; RPS.pending = null; postGame({ gallings: "galcore-replay", log: p.log, speed: p.speed }); }
  if (m.ev !== "replay") return;
  if (m.event === "start") Object.assign(RPS, { on: true, at: m.at || 0, steps: m.steps, speed: m.speed, paused: !!m.paused, diverged: null });
  else if (m.event === "step") Object.assign(RPS, { at: m.at, steps: m.steps });
  else if (m.event === "control") Object.assign(RPS, { at: m.at, speed: m.speed, paused: m.paused });
  else if (m.event === "jumped") Object.assign(RPS, { at: m.at, diverged: null });
  else if (m.event === "diverged") RPS.diverged = m;
  else if (m.event === "stopped" || m.event === "closed") RPS.on = false;
  if ($("replayDlg").open) renderReplayCtl();
  tick();
});

loadGames().catch(() => { $("empty").hidden = false; $("empty").textContent = "作品暂时无法加载，请检查本地服务后刷新。"; });

// ---------------------------------------------------------------- 画面尺寸对齐整像素
// 16:9 画面用 CSS 自适应会算出 911×512.44、上边 198.78 这种小数像素；游戏再整体缩放一次，浏览器每帧都得重新栅格化，
// 拖完右侧栏后就全局卡顿（打字变慢、悬停高光延迟）。这里用 JS 把宽高取成 16 的倍数（物理像素），左上角也对齐到物理像素。
function layoutScreen() {
  const scr = $("screen"), st = $("stage");
  if (document.fullscreenElement) { scr.style.cssText = ""; return; }
  const r = st.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  const wd = Math.max(16, Math.floor(Math.min(r.width, r.height * 16 / 9) * dpr / 16 + 0.01) * 16), hd = wd * 9 / 16;
  const left = (Math.round(r.left * dpr + (r.width * dpr - wd) / 2) - r.left * dpr) / dpr;
  const top = (Math.round(r.top * dpr + (r.height * dpr - hd) / 2) - r.top * dpr) / dpr;
  scr.style.cssText = `position:absolute;aspect-ratio:auto;width:${wd / dpr}px;height:${hd / dpr}px;left:${left}px;top:${top}px`;
}
new ResizeObserver(layoutScreen).observe($("stage"));
addEventListener("resize", layoutScreen);
document.addEventListener("fullscreenchange", () => requestAnimationFrame(layoutScreen));
layoutScreen();

// ---------------------------------------------------------------- 纯游戏模式的快捷键：F11 / Alt+Enter 全屏，F10 临时显示调试外框
// 焦点通常在游戏 iframe 里，所以游戏页（同源）和外层都要挂
function pureKey(e) {
  if (!PLAY) return;
  if (e.key === "F11" || (e.key === "Enter" && e.altKey)) {
    e.preventDefault();
    if (PLAY === "desktop") location.href = "/__gl/fullscreen";        // 桌面外壳拦下这个地址，切换整个窗口的全屏
    else if (document.fullscreenElement) document.exitFullscreen();
    else $("screen").requestFullscreen().catch(() => {});
  } else if (e.key === "F10") {
    e.preventDefault(); document.body.classList.toggle("pure-debug"); requestAnimationFrame(layoutScreen);
  }
}
function hookPureKeys(w) { if (!PLAY) return; try { w.addEventListener("keydown", pureKey, true); } catch (e) {} }
addEventListener("keydown", pureKey, true);
