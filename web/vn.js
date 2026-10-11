// galLingS 作品页：把 VN Studio 导出的游戏嵌进 galLingS 的外框里玩。
// 窗口模式：游戏在中间 16:9，右侧栏 = 游戏的手账（游戏自己画，停靠到这里，所以和游戏里看到的完全一样）。
// 全屏模式：整块画面全屏，手账回到游戏里的书签。两种模式用的是同一局游戏、同一份手账数据。
// 游戏那边的接口是 window.VNHost（同源，直接调用），见 VN Studio TECH.md §7.6。
"use strict";
const $ = (id) => document.getElementById(id);
const game = $("game");
let H = null;              // 游戏的 VNHost
let srv = null;            // /api/settings 的结果
let docked = false;

// ---------------------------------------------------------------- 作品列表
async function loadGames() {
  const r = await (await fetch("/api/vn/games")).json();
  const sel = $("gameSel");
  sel.innerHTML = r.games.map((g) => `<option value="${encodeURIComponent(g.id)}">${g.title.replace(/</g, "&lt;")}</option>`).join("");
  const want = new URLSearchParams(location.search).get("game") || localStorage.getItem("gl.vn.game");
  if (want && r.games.some((g) => g.id === want)) sel.value = encodeURIComponent(want);
  if (!r.games.length) {
    $("empty").hidden = false; game.hidden = true;
    $("empty").innerHTML = `<b>还没有作品</b><p>把 VN Studio 导出的游戏文件夹（里面有 index.html）放进<br><code>${r.dir.replace(/</g, "&lt;")}</code><br>的一个子文件夹里，例如 <code>海风与布丁/</code>，然后刷新。也可以在 ⚙ 设置里换作品文件夹。</p>`;
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
    if (w && w.VNHost) { clearInterval(t); H = w.VNHost; $("soulCss").textContent = H.css(); applyDock(); tick(); }
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
  $("journal").hidden = !open; localStorage.setItem("gl.vn.journal", open ? "1" : "0"); applyDock(); tick();
}
$("journalBtn").onclick = () => setJournal(!journalOpen());
$("jClose").onclick = () => setJournal(false);
setJournal(localStorage.getItem("gl.vn.journal") !== "0");

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
$("titleBtn").onclick = () => { if (H?.state().playing && !confirm("回到标题画面？没存档的进度会丢。")) return; H?.title(); game.focus(); };

// ---------------------------------------------------------------- 状态：章节、好感、信号、灵枢连接
function tick() {
  if (!H) return;
  const s = H.state();
  $("chapterTitle").textContent = "· " + (s.chapter || s.title || "");
  const bits = [];
  if (s.playing && s.affName && s.aff != null) bits.push(`${s.affName} ${s.aff}`);
  if (s.playing && s.signalName && s.signal != null) bits.push(`${s.signalName} ${s.signal}`);
  const link = { ok: "灵枢在线", wait: "灵枢连接中", bad: "灵枢未连上（离线回复）", off: "灵枢待命" }[s.link] || "";
  if (s.soulOn) bits.push(`<i class="ldot ${s.link}"></i>${link}`);
  if (srv) bits.push(srv.llm_ready ? `模型 ${srv.llm.model}` : "模型未配置");
  $("status").innerHTML = bits.join(" · ");
  $("journalNew").hidden = !(s.unread > 0 && !docked);
  $("saveBtn").disabled = !s.playing;
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

// ---------------------------------------------------------------- 设置：服务器部分（模型 / 记忆 / 作品文件夹）+ 游戏部分（手账 / 声音 / 文字）
let memUse = "local";
async function loadSettings() { srv = await (await fetch("/api/settings")).json(); tick(); return srv; }
function renderGamePrefs() {
  const list = H ? H.prefs() : [];
  const row = (p) => {
    if (p.type === "range") return `<label class="set-row"><span>${p.label}</span><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}" data-gp="${p.k}"><small class="muted rv">${(+p.value).toFixed(p.step < 1 ? 2 : 0)}</small></label>`;
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
    if (el.type === "range") el.oninput = () => { H.setPref(sc.k, +el.value); el.nextElementSibling.textContent = (+el.value).toFixed(sc.step < 1 ? 2 : 0); };
    else el.onclick = () => {
      H.setPref(sc.k, sc.type === "bool" ? el.dataset.v === "1" : el.dataset.v);
      el.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el));
    };
  });
}
function renderServer() {
  const s = srv;
  $("sBase").value = s.llm.base_url; $("sModel").value = s.llm.model; $("sKey").value = "";
  $("sKey").placeholder = s.llm.key_set ? `已设置（末 4 位 ${s.llm.key_tail || "****"}），留空 = 不改` : "未设置";
  $("keyHint").textContent = s.llm.key_from_env ? "系统环境变量 GALLINGS_LLM_API_KEY 已设置，它优先；这里填的不生效。" : "只保存在本机 galLingS 数据文件夹里，网页拿不到原文。";
  $("llmState").innerHTML = `<i class="ldot ${s.llm_ready ? "ok" : "bad"}"></i>${s.llm_ready ? "可用" : "未启用"}`; $("llmState").className = s.llm_ready ? "ok" : "bad";
  $("memState").innerHTML = `<i class="ldot ${s.memory_ready ? "ok" : "bad"}"></i>${s.memory_ready ? "可用" : "未启用"}`; $("memState").className = s.memory_ready ? "ok" : "bad";
  memUse = s.memory.use; $("sDsh").value = s.memory.dsh_memory_path || ""; $("sGames").value = s.vn.games_dir || "";
  syncMem();
  const fail = Object.entries(s.failed || {}).map(([k, v]) => `${k}：${v}`).join("；");
  $("saveOut").textContent = fail ? "有插件没启动：" + fail : "";
}
function syncMem() { document.querySelectorAll("#sMem button").forEach((b) => b.classList.toggle("on", b.dataset.v === memUse)); $("sDshRow").hidden = memUse !== "lingshu"; }
document.querySelectorAll("#sMem button").forEach((b) => b.onclick = () => { memUse = b.dataset.v; syncMem(); });
$("setBtn").onclick = async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  $("saveOut").textContent = ""; $("sTestOut").textContent = "";
  renderGamePrefs(); $("setDlg").showModal();
  renderServer(await loadSettings());
};
$("sClose").onclick = () => { $("setDlg").close(); game.focus(); };
$("sForget").onclick = () => { if (confirm("让她忘掉这一局记下的所有事？（剧情进度不变）")) { H?.forget(); renderGamePrefs(); } };
$("sSave").onclick = async () => {
  const body = { llm: { base_url: $("sBase").value.trim(), model: $("sModel").value.trim() },
                 memory: { use: memUse, dsh_memory_path: $("sDsh").value.trim() }, vn: { games_dir: $("sGames").value.trim() } };
  if ($("sKey").value.trim()) body.llm.api_key = $("sKey").value.trim();
  $("sSave").disabled = true; $("saveOut").textContent = "保存中，正在重启模型和记忆……";
  try {
    srv = await (await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    renderServer(srv); if (!$("saveOut").textContent) $("saveOut").textContent = "已保存。";
    H?.connect().catch(() => {});
  } catch (e) { $("saveOut").textContent = "保存失败：" + e.message; }
  $("sSave").disabled = false; tick();
};
$("sTest").onclick = async () => {
  $("sTestOut").textContent = "测试中……";
  const r = await (await fetch("/api/settings/test", { method: "POST" })).json();
  $("sTestOut").innerHTML = (r.ok ? gi("check") + " 通了：" : gi("x") + " ") + r.message.replace(/</g, "&lt;");
};

loadSettings();
loadGames();
