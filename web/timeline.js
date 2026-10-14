// galLingS 引擎调试时间轴（PLAN §14）：作品页右侧栏。
// 数据来自作品页里的 galcore 桥（web/galcore.vnplugin.js）转过来的引擎消息：每一行 = 事件日志的一条，
// 显示事件、来源（引擎 / 玩家 / 模型）、引擎裁决（放行 / 限幅 / 驳回 / 降级）与这一步之后的状态。
// 点一行 = 让服务器从头回放到那一条，显示那一刻的画面（只看，不改当前进度）。
"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const KIND = {
    start: "开局", advance: "推进", choice: "选择", load: "读档 · 新时间线", save: "存档", mode_switch: "切换模式",
    turn_begin: "回合开始", turn_commit: "回合提交", turn_abort: "回合作废", player_input: "玩家输入", intent: "意图判定",
    say: "模型台词", propose_affection: "模型提议好感", propose_mood: "模型提议心情", propose_branch: "模型提议分支",
    request_ending: "模型请求结局", model_tool_call: "模型调用工具", fallback: "降级", perform: "演绎", director: "导演",
    memory_write: "写入记忆", honesty_signal: "诚实信号", taboo_event: "禁区事件", steer_back: "拉回主线", set_sprite: "换立绘",
  };
  const SRC = { engine: "引擎", player: "玩家", model: "模型", director: "导演", guard: "守卫" };
  const VERDICT = { applied: "放行", clamped: "限幅", rejected: "驳回" };
  const WAIT = { say: "等待推进", choice: "停在选项", input: "等待输入", end: "已到结局", none: "运行中" };
  let rows = [], live = null, seeking = null, sess = null;

  const open = () => !$("engineTl").hidden;
  function setOpen(v) {
    $("engineTl").hidden = !v; $("tlBtn").setAttribute("aria-expanded", String(v));
    $("tlBtn").classList.toggle("on", v); localStorage.setItem("gl.vn.etl", v ? "1" : "0");
  }
  $("tlBtn").onclick = () => setOpen(!open());
  $("etlClose").onclick = () => setOpen(false);
  setOpen(localStorage.getItem("gl.vn.etl") !== "0");   // 演示默认常开（PLAN §14），收起后记住

  function stateHtml(s, label) {
    if (!s) return "";
    const vars = Object.entries(s.vars || {}).filter(([k]) => k !== "好感" && k !== "尾鳍").map(([k, v]) => `${esc(k)} ${esc(v)}`).join(" · ");
    return `<div class="etl-kv"><span>${label}</span>
      <b title="好感">♡ ${esc(s.affection)}</b><b title="尾鳍">尾鳍 ${esc(s.tails)}</b>
      <b title="时间线">${esc(s.lineage)}</b><b title="回合">回合 ${esc(s.turn)}</b>
      <i>${esc(WAIT[s.wait] || s.wait || "")}</i>${s.mode ? `<i>${s.mode === "ai" ? "AI 模式" : "纯选项"}</i>` : ""}
      ${vars ? `<small>${vars}</small>` : ""}</div>`;
  }
  function renderState() { $("etlState").innerHTML = stateHtml(live, "现在"); }

  const who = (s) => s === "heroine" ? (sess?.card?.name || "她") : s === "player" ? "我" : s;
  function summary(r) {
    const p = r.payload || {}, bits = [];
    if (r.kind === "start") bits.push(`从 ${esc(r.chapter || p.src || "")} 开始`);
    if (r.kind === "choice") { const t = String(r.option_text || p.option_id || ""); bits.push(`<span class="pick">${esc(/^[「『“]/.test(t) ? t : "「" + t + "」")}</span>`); }
    if (r.kind === "load") bits.push(`→ ${esc(p.new_lineage)}`);
    if (r.kind === "fallback") bits.push(`L${esc(p.level)} ${esc(p.reason || "")}`);
    if (r.kind === "player_input") bits.push(`「${esc(String(p.text || "").slice(0, 40))}」`);
    for (const o of r.out || []) {
      if (o.op === "SAY") bits.push(`<q class="${o.origin && o.origin !== "locked" ? "imp" : ""}" title="${esc((o.src || "") + (o.origin ? " · " + o.origin : ""))}">${o.speaker && o.speaker !== "narrator" ? `<em>${esc(who(o.speaker))}</em>` : ""}${esc(o.text)}</q>`);
      else if (o.op === "CHOICE") bits.push(`<span class="op">选项 ×${esc(o.n)}</span>`);
      else if (o.op === "END") bits.push(`<span class="op end">结局 ${esc(o.ending || "")}</span>`);
      else if (o.op === "SCENE") bits.push(`<span class="op">换场</span>`);
      else if (o.op === "BGM") bits.push(`<span class="op">音乐</span>`);
      else if (o.op === "INPUT") bits.push(`<span class="op">开放输入</span>`);
    }
    return bits.join(" ");
  }
  function verdicts(r) {
    const v = (r.verdicts || []).map((x) => `<span class="vd ${esc(x.result)}" title="${esc(x.reason || x.rule || "")}">${esc(VERDICT[x.result] || x.result)}${x.rule ? " · " + esc(x.rule) : ""}</span>`);
    if (r.kind === "fallback") v.push(`<span class="vd rejected">降级</span>`);
    return v.join("");
  }
  function rowHtml(r, previous) {
    const s = r.state, prev = previous?.state;
    const delta = s && prev ? [["♡", s.affection - prev.affection], ["尾鳍", s.tails - prev.tails]].filter(([, d]) => d).map(([k, d]) => `<span class="dl ${d > 0 ? "up" : "down"}">${k} ${d > 0 ? "+" : ""}${d}</span>`).join("") : "";
    const cls = ["etl-row", "src-" + (r.source || "engine"), (r.verdicts || []).some((x) => x.result !== "applied") || r.kind === "fallback" ? "flag" : "", seeking === r.seq ? "sel" : ""].join(" ");
    return `<li class="${cls}" data-seq="${r.seq}" tabindex="0" title="点一下：回放到这一步">
      <div class="etl-l1"><span class="seq">#${r.seq}</span><b>${esc(KIND[r.kind] || r.kind)}</b><span class="src">${esc(SRC[r.source] || r.source)}</span>${delta}${verdicts(r)}<code title="state_hash">${esc(String(r.state_hash || "").slice(0, 8))}</code></div>
      <div class="etl-l2">${summary(r)}</div></li>`;
  }
  function renderRows() {
    const box = $("etlRows"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = rows.map((r, i) => rowHtml(r, rows[i - 1])).join("");
    if (atBottom || seeking == null) box.scrollTop = box.scrollHeight;
    $("etlFoot").textContent = rows.length ? `${rows.length} 条事件 · 每条都写进事件日志，可逐条回放校验 state_hash` : $("etlFoot").textContent;
  }
  function appendRow(r) {
    const box = $("etlRows"), previous = rows[rows.length - 1];
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    rows.push(r);
    box.insertAdjacentHTML("beforeend", rowHtml(r, previous));
    if (atBottom || seeking == null) box.scrollTop = box.scrollHeight;
    $("etlFoot").textContent = `${rows.length} 条事件 · 每条都写进事件日志，可逐条回放校验 state_hash`;
  }
  $("etlRows").addEventListener("click", (e) => {
    const li = e.target.closest(".etl-row"); if (!li) return;
    seeking = Number(li.dataset.seq); renderRows();
    $("game").contentWindow?.postMessage({ gallings: "galcore-seek", seq: seeking }, location.origin);
  });
  function renderSeek(m) {
    const box = $("etlSeek"); box.hidden = false;
    const L = m.line, st = m.screen?.state;
    box.innerHTML = `<div class="etl-seek-head"><b>回放到 #${esc(m.seq)}</b>
        <span class="vd ${m.replay_ok ? "applied" : "rejected"}">${m.replay_ok ? "回放一致" : "回放不一致"}</span>
        <button type="button" id="etlNow">回到现在</button></div>
      <div class="etl-shot"${L?.bg ? ` style="background-image:url('${esc(L.bg)}')"` : ""}>
        ${L ? `<div class="etl-say">${L.chapter ? `<small>${esc(L.chapter)}</small>` : ""}${L.who ? `<em>${esc(L.who)}</em>` : ""}${esc(L.text)}</div>` : `<div class="etl-say muted">这一步之前还没有台词上屏</div>`}
      </div>
      ${stateHtml(st ? { affection: st.affection, tails: st.tails, lineage: st.lineage, turn: st.turn, wait: st.wait, mode: st.mode } : null, "那时")}`;
    $("etlNow").onclick = () => { seeking = null; box.hidden = true; renderRows(); };
  }

  window.addEventListener("message", (ev) => {
    if (ev.origin !== location.origin || ev.data?.gallings !== "galcore") return;
    const m = ev.data;
    if (m.ev === "session") {
      rows = []; seeking = null; sess = m; $("etlSeek").hidden = true;
      $("etlSess").textContent = `会话 ${m.session}${m.restore ? " · 读档" : ""}`;
      renderRows();
    } else if (m.ev === "row") {
      appendRow(m.row); if (m.row.state) live = m.row.state; renderState();
    } else if (m.ev === "state") {
      const s = m.state; live = { ...(live || {}), affection: s.affection, tails: s.tails, lineage: s.lineage, turn: s.turn, wait: s.wait, mode: s.mode }; renderState();
    } else if (m.ev === "seek") renderSeek(m);
    else if (m.ev === "detach") {
      $("etlSess").textContent = sess ? `会话 ${sess.session} · 已结束` : "";
      $("etlFoot").textContent = `引擎不再接管：${m.why}`;
    }
  });
})();
