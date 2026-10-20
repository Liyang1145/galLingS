// gallings.llm.router 设置面板：作品页「设置 → 在线聊天与连接设置 → 模型」。
// 写法跟设置里其它几节一样：一行一个模型，左边单选“当前使用”，右边 测试 / 编辑 / 删除；编辑在列表里就地展开（标签 + 输入框的 set-row），不弹窗。
// 所有改动立即保存到插件（POST /api/plugin/<id>/<action>），不用点设置底部的“保存”。
// 宿主约定（plugin-format §10）：window.GLPanels[<插件 id>] = { mount(el, ctx) }；ctx.api(action, body) 调插件 api()，ctx.changed() 让宿主刷新状态。
"use strict";
(() => {
  const PID = "gallings.llm.router";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // lucide 线条图标（ISC），和 galLingS icons.js 同一套
  const P = {
    test: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    del: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    link: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  };
  const ic = (n) => `<svg class="gi" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
  const THINK = { off: "关", mid: "中", high: "高" };
  const THINK_HINT = { off: "不思考，回得最快，日常陪聊够用", mid: "先想一想再回，慢一些", high: "想得最久，适合复杂的工具任务，最慢也最费额度" };

  function mount(el, ctx) {
    let S = null;            // 插件状态（public()）
    let editing = null;      // 正在编辑的模型 id；"new" = 新增
    const probe = {};        // 模型 id → {busy, ok, msg}：列表里的测试结果

    const presetOf = (m) => S.presets.find((p) => p.id === m.preset) || S.presets[S.presets.length - 1];
    async function call(action, body) {
      const r = await ctx.api(action, body || {});
      if (r && r.models) { S = r; ctx.changed?.(); }
      return r || {};
    }

    function render() {
      if (!S) { el.innerHTML = `<div class="lm"><small class="muted">读取中……</small></div>`; return; }
      const rows = S.models.map((m) => editing === m.id ? `<li class="lm-edit">${form(m)}</li>` : item(m)).join("");
      el.innerHTML = `<div class="lm">
        ${S.models.length ? `<small class="muted lm-lead">点一行切换正在用的模型。剧情即兴、手账悄悄话、结局后聊天、建卡都用它。</small>` : ""}
        <ul class="lm-list" role="radiogroup" aria-label="正在用的模型">${rows}${editing === "new" ? `<li class="lm-edit">${form(null)}</li>` : ""}</ul>
        ${!S.models.length && editing !== "new" ? `<p class="muted lm-empty">还没有模型。剧情照常能玩，手账悄悄话会用离线回复；想让她用 AI 回你，就加一个。</p>` : ""}
        ${editing === "new" ? "" : `<button type="button" class="lm-new" id="lmNew">${ic("plus")}<span>添加模型</span></button>`}
      </div>`;
      bind();
    }

    function item(m) {
      const cur = m.id === S.main;
      const pr = probe[m.id];
      let state;
      if (pr?.busy) state = `<i class="ldot wait"></i>测试中……`;
      else if (pr) state = `<i class="ldot ${pr.ok ? "ok" : "bad"}"></i>${esc(pr.msg)}`;
      else if (!m.usable) state = `<i class="ldot bad"></i>${m.key_set || m.no_key ? "没填完整" : "还没填密钥"}`;
      else state = `<i class="ldot ${cur ? "ok" : ""}"></i>${m.no_key ? "本机服务" : `密钥 ···${esc(m.key_tail || "已设置")}`}`;
      return `<li class="lm-item ${cur ? "on" : ""}" data-id="${esc(m.id)}">
        <button type="button" class="lm-pick" role="radio" aria-checked="${cur}" title="${cur ? "正在用" : "改用这个模型"}">
          <span class="lm-ring" aria-hidden="true"></span>
          <span class="lm-main">
            <span class="lm-l1"><b>${esc(m.name)}</b><span class="lm-prov">${esc(presetOf(m).name)}</span>${cur ? `<span class="lm-cur">正在用</span>` : ""}</span>
            <span class="lm-l2"><code>${esc(m.model)}</code><span class="lm-sep">·</span>思考 ${THINK[m.think] || "关"}<span class="lm-sep">·</span><span class="lm-state ${pr && !pr.ok ? "bad" : ""}">${state}</span></span>
          </span>
        </button>
        <span class="lm-acts">
          <button type="button" data-act="test" title="测试连接" aria-label="测试 ${esc(m.name)}" ${pr?.busy ? "disabled" : ""}>${ic("test")}</button>
          <button type="button" data-act="edit" title="编辑" aria-label="编辑 ${esc(m.name)}">${ic("edit")}</button>
          <button type="button" data-act="del" title="删除" aria-label="删除 ${esc(m.name)}">${ic("del")}</button>
        </span></li>`;
    }

    function form(m) {
      const preset = m ? m.preset : "deepseek";
      const p = S.presets.find((x) => x.id === preset) || S.presets[0];
      const think = m?.think || "off";
      return `<form class="lm-form" novalidate>
        <div class="lm-ftitle">${m ? `编辑 <b>${esc(m.name)}</b>` : "添加模型"}</div>
        <div class="set-row lm-provrow"><span>服务商</span><div class="lm-chips" role="radiogroup" aria-label="服务商">
          ${S.presets.map((x) => `<button type="button" role="radio" data-p="${x.id}" aria-checked="${x.id === preset}" class="${x.id === preset ? "on" : ""}">${esc(x.name)}</button>`).join("")}</div></div>
        <label class="set-row"><span>名称</span><input name="name" maxlength="40" spellcheck="false" autocomplete="off" placeholder="列表里显示的名字" value="${esc(m ? m.name : p.name)}"></label>
        <label class="set-row"><span>服务地址</span><input name="base_url" spellcheck="false" autocomplete="off" inputmode="url" placeholder="https://…/v1" value="${esc(m ? m.base_url : p.base_url)}"></label>
        <div class="set-row"><span>密钥</span><input name="api_key" type="password" spellcheck="false" autocomplete="off"><button type="button" class="lm-eye">显示</button></div>
        <div class="set-row lm-hintrow"><span></span><small class="muted lm-keynote"></small></div>
        <div class="set-row"><span>模型</span><input name="model" spellcheck="false" autocomplete="off" list="lmModels" placeholder="例如 deepseek-chat" value="${esc(m ? m.model : (p.models[0] || ""))}"><button type="button" class="lm-fetch" title="从服务商拉取可用模型">拉取列表</button></div>
        <datalist id="lmModels"></datalist>
        <div class="set-row"><span>思考等级</span><div class="seg lm-think">${Object.entries(THINK).map(([v, t]) => `<button type="button" data-v="${v}" class="${v === think ? "on" : ""}">${t}</button>`).join("")}</div></div>
        <div class="set-row lm-hintrow"><span></span><small class="muted lm-thinknote">${THINK_HINT[think]}</small></div>
        <div class="lm-fbar"><small class="muted lm-out" aria-live="polite"></small>
          <button type="button" class="lm-ftest">测试</button><button type="button" class="lm-cancel">取消</button><button type="submit" class="primary lm-save">保存</button></div>
      </form>`;
    }

    function bind() {
      const q = (s, r = el) => r.querySelector(s);
      q("#lmNew") && (q("#lmNew").onclick = () => { editing = "new"; render(); q(".lm-form input[name=api_key]")?.focus(); });
      el.querySelectorAll(".lm-item").forEach((li) => {
        const m = S.models.find((x) => x.id === li.dataset.id);
        q(".lm-pick", li).onclick = () => { if (m.id !== S.main) call("main", { id: m.id }).then(render); };
        q('[data-act="test"]', li).onclick = async () => {
          probe[m.id] = { busy: true }; render();
          const r = await ctx.api("test", { id: m.id }).catch((e) => ({ ok: false, message: e.message }));
          probe[m.id] = { ok: !!r.ok, msg: (r.message || (r.ok ? "通了" : "失败")).replace(/^通了：/, "通了 · ") }; render();
        };
        q('[data-act="edit"]', li).onclick = () => { editing = m.id; render(); q(".lm-form input[name=name]")?.focus(); };
        q('[data-act="del"]', li).onclick = async () => {
          if (!confirm(`删除“${m.name}”？它的密钥也会一起删掉。`)) return;
          delete probe[m.id]; await call("delete", { id: m.id }); render();
        };
      });
      const f = q(".lm-form");
      if (f) bindForm(f, editing === "new" ? null : S.models.find((x) => x.id === editing));
    }

    function bindForm(f, m) {
      const F = (n) => f.elements[n];
      let preset = m ? m.preset : "deepseek";
      let think = m?.think || "off";
      let nameTouched = !!m;
      const pre = () => S.presets.find((x) => x.id === preset) || S.presets[S.presets.length - 1];
      const out = (msg, bad) => { const o = f.querySelector(".lm-out"); o.textContent = msg || ""; o.classList.toggle("bad", bad === true); o.classList.toggle("ok", bad === false); };
      const local = () => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(F("base_url").value.trim());
      const models = (list) => { f.querySelector("#lmModels").innerHTML = (list || pre().models).map((x) => `<option value="${esc(x)}">`).join(""); };
      function keyNote() {
        const p = pre();
        const t = m?.key_set ? `已保存（末 4 位 ${m.key_tail || "****"}），留空 = 不改` : p.no_key || local() ? "本机服务一般不用填" : "只存在本机 galLingS 数据文件夹里，网页读不到原文";
        f.querySelector(".lm-keynote").innerHTML = esc(t) + (p.key_url ? ` · <a href="${esc(p.key_url)}" target="_blank" rel="noopener">去 ${esc(p.name)} 申请 ${ic("link")}</a>` : "");
        F("api_key").placeholder = m?.key_set ? "留空 = 不改" : p.no_key ? "可不填" : "sk-…";
      }
      F("name").oninput = () => { nameTouched = true; };
      F("base_url").oninput = keyNote;
      f.querySelectorAll(".lm-chips button").forEach((b) => b.onclick = () => {
        preset = b.dataset.p;
        f.querySelectorAll(".lm-chips button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); });
        const p = pre();
        F("base_url").value = p.base_url; F("model").value = p.models[0] || "";
        if (!nameTouched) F("name").value = p.id === "custom" ? "" : p.name;
        models(); keyNote(); out("");
        (p.id === "custom" ? F("base_url") : p.no_key ? F("model") : F("api_key")).focus();
      });
      f.querySelector(".lm-eye").onclick = (e) => { const k = F("api_key"); k.type = k.type === "password" ? "text" : "password"; e.currentTarget.textContent = k.type === "password" ? "显示" : "隐藏"; };
      f.querySelectorAll(".lm-think button").forEach((b) => b.onclick = () => {
        think = b.dataset.v;
        f.querySelectorAll(".lm-think button").forEach((x) => x.classList.toggle("on", x === b));
        f.querySelector(".lm-thinknote").textContent = THINK_HINT[think];
      });
      const draft = () => ({ id: m?.id || "", preset, name: F("name").value.trim(), base_url: F("base_url").value.trim(), model: F("model").value.trim(), think });
      const key = () => F("api_key").value.trim() || undefined;
      f.querySelector(".lm-fetch").onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; out("正在拉取……");
        const r = await ctx.api("models", { model: draft(), api_key: key() }).catch((err) => ({ ok: false, message: err.message }));
        b.disabled = false;
        if (r.ok) { models(r.models); out(`拿到 ${r.models.length} 个，点“模型”输入框选`, false); F("model").focus(); } else out(r.message || "拉取失败", true);
      };
      f.querySelector(".lm-ftest").onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; out("测试中……");
        const r = await ctx.api("test", { model: draft(), api_key: key() }).catch((err) => ({ ok: false, message: err.message }));
        b.disabled = false; out(r.message || (r.ok ? "通了" : "失败"), !r.ok);
      };
      const close = () => { editing = null; render(); };
      f.querySelector(".lm-cancel").onclick = close;
      f.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
      f.onsubmit = async (e) => {
        e.preventDefault();
        const body = { model: draft() };
        if (!body.model.base_url || !body.model.model) { out("服务地址和模型都要填", true); (body.model.base_url ? F("model") : F("base_url")).focus(); return; }
        if (key()) body.api_key = key();
        const b = f.querySelector(".lm-save"); b.disabled = true;
        const r = await call("save", body).catch((err) => ({ ok: false, message: err.message }));
        if (!r.ok) { b.disabled = false; out(r.message || "保存失败", true); return; }
        delete probe[r.id];
        editing = null; render();
      };
      models(); keyNote();
    }

    render();
    ctx.api("state").then((r) => { S = r; render(); }).catch((e) => { el.innerHTML = `<small class="muted bad">读不到模型设置：${esc(e.message)}</small>`; });
    return { refresh: () => ctx.api("state").then((r) => { S = r; if (!editing) render(); }), destroy: () => {} };
  }

  (window.GLPanels = window.GLPanels || {})[PID] = { mount };
})();
