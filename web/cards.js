// 建卡页（PLAN §7.3）：描述 → AI 填卡 → 逐字段修改 → 校验 → 保存。
"use strict";
const $ = (id) => document.getElementById(id);
const ORDER = [
  ["id", "卡 id（小写英文）"], ["identity", "身份（含成年锚点）"], ["appearance", "外貌"], ["personality", "性格 / 行为规律 / 价值底线"],
  ["speech", "说话方式"], ["honesty_signals", "诚实信号（≥3 条）"], ["address_system", "称呼体系"], ["slots", "槽位（第一话要用）"],
  ["taboo", "禁区 / 逆鳞"], ["red_lines", "红线（只能收紧）"], ["style_examples", "风格示例（≥10 句）"], ["assets", "立绘差分"],
];
let card = null;
let readOnly = false;

async function init() {
  const st = await (await fetch("/api/status")).json();
  if (!st.llm) { $("genBtn").disabled = true; $("genMsg").textContent = "未配置模型 key，AI 填卡不可用，可以打开已有卡手改"; }
  const cards = await (await fetch("/api/cards")).json();
  $("openSel").innerHTML += cards.map((c) => `<option value="${escHtml(c.id)}">${escHtml(c.name)}${c.builtin ? "（内置，只读）" : ""}</option>`).join("");
}

$("openSel").onchange = async () => {
  const id = $("openSel").value;
  if (!id) return;
  card = await (await fetch(`/api/cards/${id}`)).json();
  const cards = await (await fetch("/api/cards")).json();
  readOnly = !!(cards.find((c) => c.id === id) || {}).builtin;
  render([]);
  if (readOnly) $("status").textContent = "内置卡只读：改了 id 才能另存为新卡";
};

$("genBtn").onclick = async () => {
  const desc = $("desc").value.trim();
  if (desc.length < 10) { $("genMsg").textContent = "多写几句"; return; }
  $("genBtn").disabled = true;
  $("genMsg").textContent = "她正在成形……（约 20–60 秒）";
  const t0 = performance.now();
  try {
    const r = await (await fetch("/api/cards/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: desc }) })).json();
    if (!r.ok) { $("genMsg").textContent = r.error; return; }
    card = r.card; readOnly = false;
    render(r.findings);
    $("genMsg").textContent = `用时 ${((performance.now() - t0) / 1000).toFixed(1)} 秒`;
  } finally { $("genBtn").disabled = false; }
};

function render(findings) {
  const bad = new Set(findings.filter((f) => f.level === "error").map((f) => f.field.split(/[./]/)[0]));
  $("fields").innerHTML = "";
  for (const [k, label] of ORDER) {
    const v = card[k];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || JSON.stringify(v).match(/:""|\[""\]/);
    const div = document.createElement("div");
    div.className = "field" + (empty ? " missing" : "") + (bad.has(k) ? " err" : "");
    const text = typeof v === "string" ? v : JSON.stringify(v ?? null, null, 1);
    div.innerHTML = `<label>${label} <span class="muted">${k}</span></label><textarea rows="${Math.min(14, Math.max(2, text.split("\n").length))}" data-k="${k}"></textarea>`;
    div.querySelector("textarea").value = text;
    $("fields").appendChild(div);
  }
  showFindings(findings);
}

function collect() {
  const out = { ...card };
  for (const ta of document.querySelectorAll("#fields textarea")) {
    const k = ta.dataset.k;
    if (k === "id") { out.id = ta.value.trim(); continue; }
    try { out[k] = JSON.parse(ta.value); } catch { throw new Error(`字段 ${k} 不是合法 JSON`); }
  }
  out.schema_version = 1;
  out.locked_script = false;
  return out;
}

function showFindings(fs) {
  $("findings").innerHTML = fs.length
    ? fs.map((f) => `<div class="finding ${f.level}"><b>${f.level === "error" ? "错误" : "提示"}</b> ${f.field}：${f.message}</div>`).join("")
    : '<div class="finding">全部通过 ' + gi('check') + '</div>';
  $("useBtn").disabled = fs.some((f) => f.level === "error");
}

$("valBtn").onclick = async () => {
  if (!card) return;
  let c;
  try { c = collect(); } catch (e) { showFindings([{ level: "error", field: "JSON", message: e.message }]); return; }
  const r = await (await fetch("/api/cards/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })).json();
  card = c;
  render(r.findings);
};

$("useBtn").onclick = async () => {
  let c;
  try { c = collect(); } catch (e) { showFindings([{ level: "error", field: "JSON", message: e.message }]); return; }
  const r = await (await fetch("/api/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })).json();
  if (!r.ok) { showFindings(r.findings || [{ level: "error", field: "保存", message: r.error }]); return; }
  card = c;
  readOnly = false;
  $("status").textContent = `角色卡已保存：${r.id}`;
};

init();
// 卡名 / id 可能来自导入的卡：放进 innerHTML 前转义
function escHtml(v) { return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
