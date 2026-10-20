// gallings.llm.router 设置面板：作品页「设置 → 在线聊天与连接设置 → 模型」。
// 主模型下拉 · 模型分配规则 · 模型列表（⋯ 菜单）· 添加 / 编辑模型弹窗。所有改动立即保存到插件（POST /api/plugin/<id>/<action>），不用点设置底部的“保存”。
// 宿主约定（plugin-format §10）：window.GLPanels[<插件 id>] = { mount(el, ctx) }；ctx.api(action, body) 调插件 api()，ctx.changed() 让宿主刷新状态。
"use strict";
(() => {
  const PID = "gallings.llm.router";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // lucide 线条图标（ISC），和 galLingS icons.js 同一套风格
  const P = {
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    server: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    caret: '<path d="M7 10l5 5 5-5z" fill="currentColor" stroke="none"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    sort: '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    rules: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6"/><path d="M6 9v6a3 3 0 0 0 3 3h6"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    link: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  };
  const ic = (n, cls = "") => `<svg class="gi lr-i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
  const local = (m) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(m.base_url || "");

  function mount(el, ctx) {
    let S = null;               // 插件状态（public()）
    let view = "main";
    const dlgHost = () => el.closest("dialog") || document.body;

    // ------------------------------------------------------------ 通用：弹出菜单（贴着按钮，挂在当前 dialog 的顶层里，不被滚动区裁掉）
    let pop = null;
    function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener("pointerdown", outside, true); } }
    function outside(e) { if (pop && !pop.contains(e.target) && !e.target.closest("[data-lr-popper]")) closePop(); }
    function openPop(anchor, items, { match = false, align = "left" } = {}) {
      closePop();
      pop = document.createElement("div");
      pop.className = "lr-pop"; pop.setAttribute("role", "menu");
      pop.innerHTML = items.map((it, i) => it.sep ? `<hr>` :
        `<button type="button" role="menuitem" data-i="${i}" class="${it.on ? "on" : ""} ${it.danger ? "danger" : ""}" ${it.disabled ? "disabled" : ""}>
          ${it.icon ? ic(it.icon) : ""}<span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</button>`).join("");
      (anchor.closest("dialog") || document.body).appendChild(pop);
      const r = anchor.getBoundingClientRect();
      const w = match ? r.width : Math.max(180, pop.offsetWidth);
      pop.style.width = w + "px";
      const left = align === "right" ? r.right - w : r.left;
      pop.style.left = Math.max(8, Math.min(left, innerWidth - w - 8)) + "px";
      const below = innerHeight - r.bottom - 8;
      const h = Math.min(pop.scrollHeight, 360);
      pop.style.maxHeight = "360px";
      pop.style.top = (below >= h || below > r.top ? r.bottom + 4 : Math.max(8, r.top - h - 4)) + "px";
      pop.querySelectorAll("button[data-i]").forEach((b) => b.onclick = () => { const it = items[+b.dataset.i]; closePop(); it.run?.(); });
      setTimeout(() => document.addEventListener("pointerdown", outside, true));
      pop.querySelector("button.on, button:not([disabled])")?.focus();
      pop.addEventListener("keydown", (e) => {
        const bs = [...pop.querySelectorAll("button:not([disabled])")], i = bs.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length]?.focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePop(); anchor.focus(); }
      });
    }

    async function call(action, body) {
      const r = await ctx.api(action, body || {});
      if (r && r.models) { S = r; render(); ctx.changed?.(); }
      return r || {};
    }
    const byId = (id) => S.models.find((m) => m.id === id);
    const say = (msg, bad) => { const o = el.querySelector(".lr-msg"); if (!o) return; o.textContent = msg || ""; o.classList.toggle("bad", !!bad); };

    // ------------------------------------------------------------ 主视图 / 规则视图
    function render() {
      closePop();
      if (!S) { el.innerHTML = `<div class="lr"><p class="muted">读取中……</p></div>`; return; }
      el.innerHTML = `<div class="lr">${view === "rules" ? rulesView() : mainView()}<p class="lr-msg muted" aria-live="polite"></p></div>`;
      bind();
    }
    function mainView() {
      const main = byId(S.main);
      const custom = Object.values(S.rules).filter(Boolean).length;
      const rows = S.models.map((m) => {
        const tags = [];
        if (!m.usable) tags.push(`<em class="warn">${m.key_set || m.no_key ? "未填完整" : "未填密钥"}</em>`);
        if (m.no_key && m.usable) tags.push(`<em>本机</em>`);
        const uses = S.purposes.filter((p) => S.rules[p.id] === m.id).map((p) => p.name);
        if (uses.length) tags.push(`<em class="use">${esc(uses.join("、"))}</em>`);
        return `<li class="${m.id === S.main ? "main" : ""}" data-id="${esc(m.id)}">
          <button type="button" class="lr-av" data-act="edit" title="编辑">${ic(local(m) ? "server" : "cloud")}</button>
          <button type="button" class="lr-txt" data-act="edit" title="编辑"><b>${esc(m.name)}</b><small>${esc(m.model)}</small></button>
          <span class="lr-tags">${tags.join("")}</span>
          <button type="button" class="lr-more" data-act="more" data-lr-popper title="更多" aria-label="${esc(m.name)} 的更多操作">${ic("more")}</button></li>`;
      }).join("");
      return `<div class="lr-view">
        <div class="lr-cap">LLM API</div>
        <div class="lr-field"><span class="lr-legend">主模型</span>
          <button type="button" class="lr-select" id="lrMain" data-lr-popper ${S.models.length ? "" : "disabled"} aria-haspopup="menu">
            <span>${main ? esc(main.name) : S.models.length ? "（没有可用的模型）" : "还没有模型"}</span>${ic("caret", "lr-caret")}</button></div>
        <button type="button" class="lr-row" id="lrRules">${ic("rules", "lr-ri")}<span>模型分配规则</span>
          <small>${custom ? `${custom} 项单独分配` : "全部跟随主模型"}</small>${ic("right")}</button>
        <div class="lr-head"><b>模型列表</b><button type="button" class="lr-ib" id="lrSort" data-lr-popper title="排序" ${S.models.length > 1 ? "" : "disabled"}>${ic("sort")}</button></div>
        ${rows ? `<ul class="lr-list">${rows}</ul>` : `<p class="lr-empty muted">还没有模型。点“添加模型”，选一个服务商、填上密钥就能用；不配也能玩剧情，悄悄话用离线回复。</p>`}
        <button type="button" class="lr-add" id="lrAdd">${ic("plus")}<span>添加模型</span></button>
      </div>`;
    }
    function rulesView() {
      const name = (id) => id ? (byId(id)?.name || "（已删除）") : "跟随主模型";
      const main = byId(S.main);
      return `<div class="lr-view">
        <div class="lr-sub"><button type="button" class="lr-ib" id="lrBack" title="返回">${ic("back")}</button><b>模型分配规则</b></div>
        <p class="muted lr-hint">不同用途可以用不同模型，例如剧情即兴用快的、结局后聊天用聪明的。没单独分配的跟随主模型${main ? `（现在是 ${esc(main.name)}）` : ""}。</p>
        ${S.purposes.map((p) => `<div class="lr-rule"><div class="lr-rt"><b>${esc(p.name)}</b><small class="muted">${esc(p.desc)}</small></div>
          <button type="button" class="lr-select sm" data-rule="${p.id}" data-lr-popper aria-haspopup="menu"><span>${esc(name(S.rules[p.id]))}</span>${ic("caret", "lr-caret")}</button></div>`).join("")}
        <div class="lr-rule"><div class="lr-rt"><b>失败时</b><small class="muted">分到的模型出错、超时或余额不足时</small></div>
          <div class="seg lr-seg" id="lrFb">${[["main", "换用主模型"], ["list", "按列表依次换"], ["none", "不换"]].map(([v, t]) =>
            `<button type="button" data-v="${v}" class="${S.fallback === v ? "on" : ""}">${t}</button>`).join("")}</div></div>
      </div>`;
    }
    function bind() {
      const q = (s) => el.querySelector(s);
      if (view === "rules") {
        q("#lrBack").onclick = () => { view = "main"; render(); q("#lrRules")?.focus(); };
        el.querySelectorAll("[data-rule]").forEach((b) => b.onclick = () => {
          const cur = S.rules[b.dataset.rule] || "";
          openPop(b, [{ label: "跟随主模型", on: !cur, run: () => call("rules", { rules: { [b.dataset.rule]: "" } }) }, { sep: true },
            ...S.models.map((m) => ({ label: m.name, sub: m.usable ? m.model : "未填密钥", on: cur === m.id, disabled: !m.usable,
              run: () => call("rules", { rules: { [b.dataset.rule]: m.id } }) }))], { match: true });
        });
        el.querySelectorAll("#lrFb button").forEach((b) => b.onclick = () => call("rules", { fallback: b.dataset.v }));
        return;
      }
      q("#lrMain").onclick = (e) => openPop(e.currentTarget, S.models.map((m) => ({
        label: m.name, sub: m.usable ? "" : "未填密钥", on: m.id === S.main, run: async () => {
          await call("main", { id: m.id });
          if (!m.usable) say(`${m.name} 还没填密钥，暂时用列表里第一个可用的模型。`, true);
        } })), { match: true });
      q("#lrRules").onclick = () => { view = "rules"; render(); };
      q("#lrAdd").onclick = () => editModel(null);
      q("#lrSort").onclick = (e) => {
        const ids = (arr) => call("order", { ids: arr.map((m) => m.id) });
        const ms = [...S.models];
        openPop(e.currentTarget, [
          { label: "主模型置顶", run: () => ids([...ms.filter((m) => m.id === S.main), ...ms.filter((m) => m.id !== S.main)]) },
          { label: "按名称", run: () => ids(ms.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) },
          { label: "按服务商", run: () => ids(ms.sort((a, b) => (a.base_url + a.name).localeCompare(b.base_url + b.name))) },
          { sep: true },
          { label: "可用的排前面", run: () => ids([...ms.filter((m) => m.usable), ...ms.filter((m) => !m.usable)]) },
        ], { align: "right" });
      };
      el.querySelectorAll(".lr-list li").forEach((li) => {
        const m = byId(li.dataset.id);
        li.querySelectorAll('[data-act="edit"]').forEach((b) => b.onclick = () => editModel(m));
        li.querySelector('[data-act="more"]').onclick = (e) => {
          const i = S.models.indexOf(m);
          const move = (d) => { const arr = [...S.models]; arr.splice(i, 1); arr.splice(i + d, 0, m); call("order", { ids: arr.map((x) => x.id) }); };
          openPop(e.currentTarget, [
            { label: "设为主模型", icon: "check", disabled: m.id === S.main, run: () => call("main", { id: m.id }) },
            { label: "编辑", run: () => editModel(m) },
            { label: "测试连接", icon: "refresh", run: async () => { say(`正在测试 ${m.name}……`); const r = await ctx.api("test", { id: m.id }); say(`${m.name}：${r.message || (r.ok ? "通了" : "失败")}`, !r.ok); } },
            { label: "复制一份", run: () => call("duplicate", { id: m.id }) },
            { sep: true },
            { label: "上移", disabled: i === 0, run: () => move(-1) },
            { label: "下移", disabled: i === S.models.length - 1, run: () => move(1) },
            { sep: true },
            { label: "删除", danger: true, run: () => { if (confirm(`删除模型“${m.name}”？它的密钥也会一起删掉。`)) call("delete", { id: m.id }); } },
          ], { align: "right" });
        };
      });
    }

    // ------------------------------------------------------------ 添加 / 编辑模型弹窗
    function editModel(m) {
      const isNew = !m;
      const d = document.createElement("dialog");
      d.className = "lr-dlg";
      let preset = m ? m.preset : "deepseek";
      const pre = () => S.presets.find((p) => p.id === preset) || S.presets[S.presets.length - 1];
      const fld = (id, label, attrs = "", extra = "") => `<label class="lr-in ${extra ? "has-tail" : ""}"><input id="${id}" placeholder=" " spellcheck="false" autocomplete="off" ${attrs}><span>${label}</span>${extra}</label>`;
      d.innerHTML = `<form method="dialog" class="lr-form">
        <h3>${isNew ? "添加模型" : "编辑模型"}</h3>
        <div class="lr-fbody">
          <div class="lr-field"><span class="lr-legend">预设模型</span>
            <button type="button" class="lr-select" id="fPreset" data-lr-popper aria-haspopup="menu"><span></span>${ic("caret", "lr-caret")}</button></div>
          ${fld("fName", "模型显示名", 'maxlength="40"')}
          ${fld("fBase", "Base URL", 'inputmode="url"')}
          ${fld("fKey", "API Key", 'type="password"', `<button type="button" class="lr-tail" id="fEye" title="显示 / 隐藏">${ic("eye")}</button>`)}
          <small class="lr-note muted" id="fKeyNote"></small>
          ${fld("fModel", "Model Name", 'list="fModels"', `<button type="button" class="lr-tail" id="fFetch" title="从服务商拉取模型列表">${ic("refresh")}</button>`)}
          <datalist id="fModels"></datalist>
          <button type="button" class="lr-adv-t" id="fAdvT" aria-expanded="false"><span>高级参数</span>${ic("down")}</button>
          <div class="lr-adv" id="fAdv" hidden>
            ${fld("fTemp", "温度（0～2，留空 = 默认）", 'inputmode="decimal"')}
            ${fld("fTopP", "Top P（0～1，留空 = 默认）", 'inputmode="decimal"')}
            ${fld("fMax", "最大输出 tokens（留空 = 不限）", 'inputmode="numeric"')}
            ${fld("fTimeout", "超时秒数（默认 60）", 'inputmode="numeric"')}
            <div class="lr-think"><span>思考模式</span><div class="seg lr-seg" id="fThink">
              <button type="button" data-v="auto">自动</button><button type="button" data-v="disabled">关</button><button type="button" data-v="enabled">开</button></div></div>
            <small class="lr-note muted">自动：DeepSeek 关掉思考（短回复不会被思考吃光），其它服务不发这个参数。</small>
          </div>
        </div>
        <div class="lr-foot"><small class="lr-out muted" aria-live="polite"></small>
          <button type="button" class="lr-btn" id="fTest">测试</button>
          <button type="button" class="lr-btn text" id="fCancel">取消</button>
          <button type="submit" class="lr-btn primary" id="fSave">保存</button></div>
      </form>`;
      dlgHost().appendChild(d);
      const $ = (id) => d.querySelector("#" + id);
      const out = (msg, bad) => { const o = d.querySelector(".lr-out"); o.textContent = msg || ""; o.classList.toggle("bad", !!bad); o.classList.toggle("ok", bad === false); };
      let think = m?.thinking || "auto";
      const syncThink = () => d.querySelectorAll("#fThink button").forEach((b) => b.classList.toggle("on", b.dataset.v === think));
      d.querySelectorAll("#fThink button").forEach((b) => b.onclick = () => { think = b.dataset.v; syncThink(); });
      const syncModels = (list) => { $("fModels").innerHTML = (list || pre().models).map((x) => `<option value="${esc(x)}">`).join(""); };
      function applyPreset(fill) {
        const p = pre();
        $("fPreset").querySelector("span").textContent = p.name;
        syncModels();
        if (fill) {
          if (p.id !== "custom") { $("fBase").value = p.base_url; $("fModel").value = p.models[0] || ""; if (!$("fName").dataset.touched) $("fName").value = p.name; }
          else { $("fBase").value = ""; $("fModel").value = ""; if (!$("fName").dataset.touched) $("fName").value = ""; }
        }
        keyNote();
      }
      function keyNote() {
        const p = pre();
        const parts = [];
        if (m?.key_set) parts.push(`已保存密钥（末 4 位 ${m.key_tail || "****"}），留空 = 不改`);
        else if (p.no_key || local({ base_url: $("fBase").value })) parts.push("本机服务一般不需要密钥");
        else parts.push("只保存在本机 galLingS 数据文件夹里，网页拿不到原文");
        $("fKeyNote").innerHTML = esc(parts.join("；")) + (p.key_url ? ` · <a href="${esc(p.key_url)}" target="_blank" rel="noopener">获取密钥 ${ic("link")}</a>` : "");
      }
      $("fName").oninput = () => { $("fName").dataset.touched = "1"; };
      $("fBase").oninput = keyNote;
      if (m) {
        $("fName").value = m.name; $("fName").dataset.touched = "1"; $("fBase").value = m.base_url; $("fModel").value = m.model;
        $("fTemp").value = m.temperature ?? ""; $("fTopP").value = m.top_p ?? ""; $("fMax").value = m.max_tokens ?? ""; $("fTimeout").value = m.timeout_s ?? "";
        if (m.temperature != null || m.top_p != null || m.max_tokens != null || m.timeout_s != null || (m.thinking && m.thinking !== "auto")) { $("fAdv").hidden = false; $("fAdvT").setAttribute("aria-expanded", "true"); }
      }
      applyPreset(isNew); syncThink();
      $("fPreset").onclick = (e) => openPop(e.currentTarget, S.presets.map((p) => ({ label: p.name, sub: p.base_url ? p.base_url.replace(/^https?:\/\//, "") : "任意 OpenAI 兼容接口", on: p.id === preset,
        run: () => { preset = p.id; applyPreset(true); $(p.id === "custom" ? "fBase" : "fKey").focus(); } })), { match: true });
      $("fEye").onclick = () => { const k = $("fKey"); k.type = k.type === "password" ? "text" : "password"; $("fEye").innerHTML = ic(k.type === "password" ? "eye" : "eyeoff"); k.focus(); };
      $("fAdvT").onclick = () => { const open = $("fAdv").hidden; $("fAdv").hidden = !open; $("fAdvT").setAttribute("aria-expanded", String(open)); };
      const draft = () => ({ id: m?.id || "", preset, name: $("fName").value.trim(), base_url: $("fBase").value.trim(), model: $("fModel").value.trim(),
        temperature: $("fTemp").value.trim(), top_p: $("fTopP").value.trim(), max_tokens: $("fMax").value.trim(), timeout_s: $("fTimeout").value.trim(), thinking: think });
      const keyVal = () => $("fKey").value.trim();
      $("fFetch").onclick = async () => {
        out("正在拉取模型列表……");
        const r = await ctx.api("models", { model: draft(), api_key: keyVal() || undefined });
        if (r.ok) { syncModels(r.models); out(`拿到 ${r.models.length} 个模型，点 Model Name 输入框选择。`, false); $("fModel").focus(); }
        else out(r.message || "拉取失败", true);
      };
      $("fTest").onclick = async () => {
        $("fTest").disabled = true; out("测试中……");
        try { const r = await ctx.api("test", { model: draft(), api_key: keyVal() || undefined }); out(r.message || (r.ok ? "通了" : "失败"), !r.ok); }
        catch (e) { out("测试失败：" + e.message, true); }
        $("fTest").disabled = false;
      };
      const close = () => { closePop(); d.close(); d.remove(); };
      $("fCancel").onclick = close;
      d.addEventListener("cancel", (e) => { if (pop) { e.preventDefault(); closePop(); return; } e.preventDefault(); close(); });
      d.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const body = { model: draft() };
        if (!body.model.base_url || !body.model.model) { out("Base URL 和 Model Name 都要填", true); (body.model.base_url ? $("fModel") : $("fBase")).focus(); return; }
        if (keyVal()) body.api_key = keyVal();
        $("fSave").disabled = true;
        try {
          const r = await call("save", body);
          if (!r.ok) { out(r.message || "保存失败", true); $("fSave").disabled = false; return; }
          close();
          const saved = byId(r.id);
          say(saved && !saved.usable ? `已保存 ${saved.name}，还差 API Key 才能用。` : `已保存 ${saved?.name || ""}。`, saved && !saved.usable);
        } catch (err) { out("保存失败：" + err.message, true); $("fSave").disabled = false; }
      };
      d.showModal();
      (isNew ? $("fKey") : $("fName")).focus();
    }

    render();
    ctx.api("state").then((r) => { S = r; render(); }).catch((e) => { el.innerHTML = `<p class="muted bad">读不到模型设置：${esc(e.message)}</p>`; });
    return { refresh: () => ctx.api("state").then((r) => { S = r; render(); }), destroy: closePop };
  }

  (window.GLPanels = window.GLPanels || {})[PID] = { mount };
})();
