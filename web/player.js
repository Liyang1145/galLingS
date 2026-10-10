// galLingS 播放器：哑渲染器（PLAN §14）。不持有任何规则，状态以服务器推送为准。
"use strict";
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let ws = null;
let hello = null;
let queue = [];          // 待渲染的 op
let showingSay = false;  // 当前屏幕上有一句台词，等玩家点击
let typing = null;       // 打字机计时器
let pendingChoice = null;
let busy = false;
let ended = false;
let live = { scene: null, bgm: null, sprite: null, say: null, choice: null, state: null, tail: null };
let viewingReplay = false;
const cheat = $("cheat");
cheat.checked = localStorage.getItem("gl.cheat") === "1";

// ---------------------------------------------------------------- 连接
async function start() {
  const st = await (await fetch("/api/status")).json();
  $("chapterTitle").textContent = `· 第一话 ${st.chapter.title}`;
  const cards = await (await fetch("/api/cards")).json();
  const sel = $("cardSel");
  sel.innerHTML = cards.map((c) => `<option value="${c.id}">${c.name}${c.builtin ? "" : "（自建）"}</option>`).join("");
  sel.value = params.get("card") || st.default_card;
  setMode(params.get("mode") || st.default_mode, false);
  $("modeSeg").querySelector('[data-mode="ai"]').disabled = !st.llm;
  if (!st.llm) setStatus("未配置模型 key：只能纯选项（设置 GALLINGS_LLM_API_KEY 后重启）");
  connect();
}

function connect() {
  if (ws) ws.close();
  resetStage();
  const q = new URLSearchParams({ card: $("cardSel").value, mode: currentMode() });
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?${q}`);
  ws.onmessage = (e) => onMsg(JSON.parse(e.data));
  ws.onclose = () => setStatus("连接已断开（重新开始可重连）");
}

function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

function onMsg(m) {
  switch (m.type) {
    case "hello":
      hello = m;
      setStatus(`会话 ${m.session} · ${m.card.name} · 种子 ${m.seed}${m.llm ? " · 模型已连接" : " · 离线"}${m.memory ? " · 记忆开" : ""}`);
      break;
    case "ops": queue.push(...m.ops); if (!showingSay && !viewingReplay) pump(); break;
    case "timeline": addRow(m.row); break;
    case "busy": busy = m.on; $("thinking").hidden = !m.on; if (m.on) hideChoices(); else if (!showingSay) pump(); break;
    case "error": notice(m.message, true); break;
    case "notice": notice(m.message); break;
    case "saved": notice(`已存档（槽位 ${m.slot}）`); break;
    case "screen": onScreen(m); break;
    case "diary": showDiary(m.entries); break;
  }
}

// ---------------------------------------------------------------- 渲染
function pump() {
  while (queue.length) {
    const op = queue.shift();
    apply(op, true);
    if (op.op === "SAY") { showingSay = true; return; }
  }
  showingSay = false;
  if (pendingChoice && !busy) showChoices(pendingChoice);
}

function apply(op, animate) {
  switch (op.op) {
    case "SCENE": live.scene = op; drawScene(op); break;
    case "BGM": live.bgm = op; $("bgmTag").textContent = `♪ ${op.id}`; break;
    case "SPRITE": live.sprite = op; drawSprite(op); break;
    case "SAY": live.say = op; drawSay(op, animate); break;
    case "CHOICE": live.choice = op; pendingChoice = op; break;
    case "TAIL": live.tail = op; drawTail(op); break;
    case "AFFECT": if (cheat.checked && op.surface) flash(`好感 ${op.surface > 0 ? "+" : ""}${op.surface}`); break;
    case "CG": flash(`CG 解锁：${op.id}`, 2200); break;
    case "SAVEPOINT": flash(`存档点「${op.name}」`, 2200); break;
    case "END": ended = true; flash(`第一话完`, 4000); $("hint").textContent = "— 完 —"; break;
    case "STATE": live.state = op; drawState(op); if (op.wait && op.wait !== "choice") { pendingChoice = null; live.choice = null; } break;
    case "RESTORE": break;
  }
}

function drawScene(op) {
  const t = op.time || "";
  const cls = op.event ? "t-event" : t.includes("黄昏前") ? "t-dusk1" : t.includes("黄昏") ? "t-dusk" : t.includes("午后") ? "t-afternoon" : "t-noon";
  $("bg").className = "bg " + cls;
  $("sceneTag").textContent = op.event ? `【事件】${op.event}` : op.id;
}

function drawSprite(op) {
  const s = $("sprite");
  if (!op || !op.expr) { s.hidden = true; return; }
  s.hidden = false;
  $("expr").textContent = `${hello ? hello.card.name : ""} · ${op.expr}${op.kind === "live2d" ? "（Live2D）" : ""}`;
}

function drawTail(op) {
  const chip = $("tailChip");
  chip.textContent = (op.desc || op.signal_id) + (op.noticed ? " ……（她慌忙压住）" : "");
  chip.hidden = false;
  const s = $("sprite");
  const meaning = op.meaning || op.signal_id;
  s.classList.remove("tail-heart", "tail-angry", "tail-panic");
  void s.offsetWidth;
  if (["heart", "angry", "panic"].includes(meaning)) s.classList.add("tail-" + meaning);
  clearTimeout(drawTail.t);
  drawTail.t = setTimeout(() => (chip.hidden = true), 3500);
}

function drawSay(op, animate) {
  const name = op.speaker === "heroine" ? (hello ? hello.card.name : "她") : op.speaker === "player" ? "我" : "";
  $("speaker").textContent = name;
  const el = $("text");
  el.className = "text " + (op.layer === "action" ? "action" : op.speaker === "narrator" ? "narration" : op.speaker === "player" ? "player" : "");
  const full = op.speaker === "narrator" || op.layer === "action" ? op.text : `「${op.text}」`;
  clearInterval(typing);
  if (!animate) { el.textContent = full; typing = null; return; }
  let i = 0;
  el.textContent = "";
  typing = setInterval(() => {
    i += 1;
    el.textContent = full.slice(0, i);
    if (i >= full.length) { clearInterval(typing); typing = null; }
  }, 28);
  el.dataset.full = full;
}

function drawState(op) {
  $("tails").textContent = op.tails;
  $("aff").textContent = op.affection;
  $("hudAff").hidden = !cheat.checked;
  $("hudLineage").textContent = `时间线 ${op.lineage} · 回合 ${op.turn}`;
  const ai = op.mode === "ai";
  segOn(op.mode);
  $("freeForm").hidden = !(ai && op.input_open);
}

function showChoices(op) {
  $("options").innerHTML = "";
  for (const o of op.options) {
    const b = document.createElement("button");
    b.textContent = o.label;
    b.onclick = (e) => { e.stopPropagation(); hideChoices(); pendingChoice = null; send({ type: "choose", option_id: o.id }); };
    $("options").appendChild(b);
  }
  $("choices").hidden = false;
  if (!$("freeForm").hidden) $("freeInput").focus();
}
function hideChoices() { $("choices").hidden = true; }

$("freeForm").onsubmit = (e) => {
  e.preventDefault();
  const t = $("freeInput").value.trim();
  if (!t || busy) return;
  $("freeInput").value = "";
  hideChoices();
  queue.push({ op: "SAY", speaker: "player", text: t, layer: "line" });
  pump();
  send({ type: "input", text: t });
};

$("dialog").onclick = () => {
  if (viewingReplay) return;
  if (typing) { clearInterval(typing); typing = null; $("text").textContent = $("text").dataset.full || $("text").textContent; return; }
  if (queue.length) { pump(); return; }
  if (pendingChoice || busy || ended) { if (pendingChoice && !busy) showChoices(pendingChoice); return; }
  showingSay = false;
  send({ type: "advance" });
};
document.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "Enter") && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("dialog").click(); }
});

// ---------------------------------------------------------------- 存读档、回放画面
function onScreen(m) {
  const sc = m.screen;
  if (m.live) {           // 读档：画面换成存档那一刻，继续玩
    viewingReplay = false;
    $("replayBar").hidden = true;
    queue = []; showingSay = false; ended = false;
    live = { ...sc };
    drawScreen(sc);
    if (m.state) drawState(m.state);
    pendingChoice = sc.choice;
    if (pendingChoice) showChoices(pendingChoice); else hideChoices();
    notice("已读档：开了一条新时间线，她不会记得被放弃那条线上的事。");
    return;
  }
  viewingReplay = true;   // 调试回放：只看
  hideChoices();
  drawScreen(sc);
  $("replayText").textContent = `回放视图：事件 #${m.seq}（从头回放${m.replay_ok ? "，state_hash 逐条一致" : "，发现不一致！"}）`;
  $("replayBar").hidden = false;
}
function drawScreen(sc) {
  if (sc.scene) drawScene(sc.scene);
  $("bgmTag").textContent = sc.bgm ? `♪ ${sc.bgm.id}` : "";
  drawSprite(sc.sprite);
  if (sc.say) drawSay(sc.say, false); else { $("speaker").textContent = ""; $("text").textContent = ""; }
  if (sc.state) drawState(sc.state);
}
$("backLive").onclick = () => {
  viewingReplay = false;
  $("replayBar").hidden = true;
  document.querySelectorAll("#tl li.sel").forEach((x) => x.classList.remove("sel"));
  drawScreen(live);
  if (queue.length) pump(); else if (pendingChoice && !busy) showChoices(pendingChoice);
};
$("saveBtn").onclick = () => send({ type: "save", slot: "1" });
$("loadBtn").onclick = () => send({ type: "load", slot: "1" });
$("diaryBtn").onclick = () => send({ type: "diary" });
function showDiary(entries) {
  $("diaryBody").innerHTML = entries.length
    ? entries.map((e) => `<div class="entry">${esc(e.text)}</div>`).join("")
    : '<p class="muted">还没有日记。AI 模式下打完一话，她会写一篇。</p>';
  $("diaryDlg").showModal();
}

// ---------------------------------------------------------------- 调试时间轴
const KIND = {
  advance: "推进", choice: "选项", player_input: "玩家输入", intent: "意图", turn_begin: "AI 回合开始", turn_commit: "AI 回合提交",
  turn_abort: "AI 回合中止", model_tool_call: "模型提议", text_verdict: "文本守卫", memory_recall: "记忆召回", memory_write: "记忆写入",
  fallback: "降级", mode_switch: "切换模式", save: "存档", load: "读档", perform: "演绎层", director: "导演", diary_view: "翻日记",
};
function addRow(r) {
  if (r.kind === "advance" && !(r.verdicts || []).length) return; // 普通推进不刷屏
  const li = document.createElement("li");
  li.className = `k-${r.kind}`;
  const v = (r.verdicts || [])[0];
  let badge = "";
  if (v) {
    const cls = v.result === "applied" ? "ok" : v.result === "clamped" ? "clamp" : "rej";
    const word = v.result === "applied" ? "通过" : v.result === "clamped" ? "裁剪" : "驳回";
    badge = `<span class="badge ${cls}">${word}${v.rule ? " · " + v.rule : ""}</span>`;
    if (cls === "rej") li.classList.add("rej");
  }
  if (r.kind === "fallback") badge = `<span class="badge fb">L${r.payload.level} · ${esc(r.payload.reason || "")}</span>`;
  if (r.kind === "text_verdict") {
    const ok = r.payload.allow;
    badge = `<span class="badge ${ok ? "ok" : "rej"}">${ok ? "放行" : "拦下 · " + esc(r.payload.rule)}</span>`;
    if (!ok) li.classList.add("bad");
  }
  li.innerHTML = `<span class="seq">#${r.seq}</span><span class="kind">${KIND[r.kind] || r.kind}</span><span class="src">${r.source}</span>${badge}<div class="detail">${detail(r)}</div>`;
  li.onclick = () => {
    document.querySelectorAll("#tl li.sel").forEach((x) => x.classList.remove("sel"));
    li.classList.add("sel");
    send({ type: "seek", seq: r.seq });
  };
  $("tl").appendChild(li);
  $("tl").scrollTop = $("tl").scrollHeight;
}
function detail(r) {
  const p = r.payload || {};
  const v = (r.verdicts || [])[0];
  switch (r.kind) {
    case "choice": return esc(p.option_id);
    case "player_input": return esc(p.text);
    case "intent": return esc(`${p.intent}${p.matched_option ? " → 命中 " + p.matched_option : ""}（置信 ${(p.confidence_milli || 0) / 1000}，${p.by || ""}）`);
    case "model_tool_call": {
      const a = p.args || {};
      let s = `${p.tool}(${esc(JSON.stringify(a))})`;
      if (v && v.applied) s += `\n→ 引擎落账 ${esc(JSON.stringify(v.applied))}`;
      if (v && v.reason) s += `\n${esc(v.reason)}`;
      return s;
    }
    case "text_verdict": return esc(`${p.stage === "input" ? "玩家输入" : "台词"}：${p.text || ""}${p.reason ? "\n" + p.reason : ""}`);
    case "memory_recall": {
      const hits = (p.hits || []).map((h) => `<div class="mem">· [${esc(h.source)}] ${esc(h.content)}</div>`).join("");
      const agm = (p.agm || []).map((h) => `<div class="mem agm">· [AGM 补位] ${esc(h.content)}<br>&nbsp;&nbsp;联想路径：${esc((h.path || []).join(" → "))}</div>`).join("");
      return `查询：${esc(p.query)}${hits || agm ? hits + agm : '<div class="mem">（无）</div>'}`;
    }
    case "memory_write": return esc(`写入 ${(p.ids || []).length} 条，共现 ${(p.cooccur || []).length} 条进 AGM 图${p.diary ? "（日记）" : ""}`);
    case "fallback": return esc(p.line ? `用默认台词：「${p.line}」` : "");
    case "mode_switch": return esc(p.mode === "ai" ? "AI 模式" : "纯选项");
    case "load": return esc(`槽位 ${p.slot} → 新时间线 ${p.new_lineage}`);
    case "perform": return esc(`${p.origin === "performed" ? "换卡演绎" : "槽位替换"}：${p.text}`);
    case "save": return esc(`槽位 ${p.slot}`);
    case "turn_commit": return v ? esc(v.reason || v.rule) : "";
    default: return "";
  }
}

// ---------------------------------------------------------------- 杂项
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function setStatus(t) { $("status").textContent = t; }
function notice(t, err) {
  const n = $("notice");
  n.textContent = t;
  n.style.background = err ? "rgba(185,48,44,.9)" : "";
  n.hidden = false;
  clearTimeout(notice.t);
  notice.t = setTimeout(() => (n.hidden = true), 3500);
}
function flash(t, ms = 1400) {
  const b = $("banner");
  b.textContent = t;
  b.hidden = false;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => (b.hidden = true), ms);
}
function currentMode() { return $("modeSeg").dataset.mode || "choice"; }
function segOn(mode) {
  $("modeSeg").dataset.mode = mode;
  $("modeSeg").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
}
function setMode(mode, notify) { segOn(mode); if (notify) send({ type: "mode", mode }); }
$("modeSeg").querySelectorAll("button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode, true)));
$("restartBtn").onclick = connect;
$("cardSel").onchange = connect;
cheat.onchange = () => { localStorage.setItem("gl.cheat", cheat.checked ? "1" : "0"); $("hudAff").hidden = !cheat.checked; };
$("tlToggle").onchange = () => ($("timeline").hidden = !$("tlToggle").checked);
function resetStage() {
  queue = []; showingSay = false; pendingChoice = null; busy = false; ended = false; viewingReplay = false;
  live = { scene: null, bgm: null, sprite: null, say: null, choice: null, state: null, tail: null };
  $("tl").innerHTML = ""; hideChoices(); $("replayBar").hidden = true; $("sprite").hidden = true;
  $("speaker").textContent = ""; $("text").textContent = ""; $("hint").textContent = "点击继续 ▸";
}
start();
