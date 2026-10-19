/* 《海风与布丁》对白账本：每句台词可写批注，自动存本机，可导出/导入 */
(() => {
  const G = window.VN_GAME; if (!G || !G.lines) return;
  const KEY = 'hfbd-ledger:' + (G.id || 'game');
  let notes = {}; try { notes = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) { alert('本机存储已满，请先导出账本'); } updCount(); };
  const charName = id => { const c = (G.chars || []).find?.(x => x.id === id) || (G.chars && G.chars[id]); return (c && (c.name || c.n)) || id || ''; };
  // 预处理所有台词
  let chap = '';
  const rows = G.lines.map((l, i) => {
    if (l.chapter) chap = l.chapter;
    const ch = (l.choices || []).map(c => '［选项］' + c.text).join('　');
    const text = (l.text || '') + (ch ? (l.text ? '　' : '') + ch : '');
    return { i, id: l.id || ('idx' + i), chap, sp: l.speaker ? charName(l.speaker) : '', text, has: !!(text.trim()) };
  });
  const dlg = rows.filter(r => r.has);
  const chapters = [...new Set(dlg.map(r => r.chap))];

  const css = `
#lgBtn{position:fixed;top:10px;right:10px;z-index:2147483000;background:#0b2a3acc;color:#e8f4ff;border:1px solid #8cc8ff80;border-radius:18px;padding:6px 14px;font:14px system-ui,"Microsoft YaHei";cursor:pointer;backdrop-filter:blur(4px)}
#lgBtn:hover{background:#12405acc}
#lgBar{position:fixed;left:50%;transform:translateX(-50%);top:52px;z-index:2147483000;width:min(760px,92vw);background:#0b1d28ee;color:#e8f4ff;border:1px solid #8cc8ff60;border-radius:10px;padding:8px 10px;font:13px system-ui,"Microsoft YaHei";display:none;box-shadow:0 6px 24px #0008}
#lgBar.show{display:block}
#lgBar .meta{color:#9cc3dd;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#lgBar textarea,#lgPanel textarea{width:100%;box-sizing:border-box;background:#06121a;color:#fff;border:1px solid #2f5670;border-radius:6px;padding:6px 8px;font:14px system-ui,"Microsoft YaHei";resize:vertical;min-height:34px}
#lgBar textarea:focus,#lgPanel textarea:focus{outline:none;border-color:#7cc4ff}
#lgPanel{position:fixed;inset:0;z-index:2147483001;background:#07131bf5;color:#e6f0f7;display:none;flex-direction:column;font:14px system-ui,"Microsoft YaHei"}
#lgPanel.show{display:flex}
#lgPanel .hd{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid #22404f;background:#0b1f2b}
#lgPanel .hd b{font-size:16px;margin-right:6px}
#lgPanel .hd input,#lgPanel .hd select{background:#06121a;color:#fff;border:1px solid #2f5670;border-radius:6px;padding:5px 8px;font:13px system-ui}
#lgPanel .hd button,#lgPanel .row button{background:#164360;color:#fff;border:1px solid #2f6a8f;border-radius:6px;padding:5px 10px;cursor:pointer;font:13px system-ui}
#lgPanel .hd button:hover,#lgPanel .row button:hover{background:#1d5a80}
#lgPanel .list{flex:1;overflow:auto;padding:6px 14px 40px}
#lgPanel .cap{position:sticky;top:0;background:#07131b;color:#ffd28a;padding:10px 0 4px;font-weight:600;z-index:1}
#lgPanel .row{display:grid;grid-template-columns:56px minmax(0,1fr) minmax(0,1fr) 60px;gap:10px;align-items:start;padding:6px 0;border-bottom:1px solid #15303d}
#lgPanel .row.noted{background:#10283522}
#lgPanel .n{color:#6f93a8;font-size:12px;padding-top:6px}
#lgPanel .t{line-height:1.55;padding-top:4px;user-select:text}
#lgPanel .t i{color:#8fd0ff;font-style:normal;margin-right:6px}
#lgPanel .cnt{color:#9cc3dd;margin-left:auto}
@media (max-width:760px){#lgPanel .row{grid-template-columns:44px minmax(0,1fr)}#lgPanel .row textarea{grid-column:1/3}#lgPanel .row button{grid-column:1/3;justify-self:start}}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stopKeys = n => ['keydown', 'keyup', 'keypress'].forEach(k => n.addEventListener(k, e => { if (e.key === 'Escape' && k === 'keydown' && n === panel) { closePanel(); } e.stopPropagation(); }));
  const stopClicks = n => ['click', 'mousedown', 'pointerdown', 'wheel', 'touchstart'].forEach(k => n.addEventListener(k, e => e.stopPropagation()));

  const btn = el(`<button id="lgBtn" title="对白账本（每句台词写批注）">📒 账本 <span id="lgCnt"></span></button>`);
  const bar = el(`<div id="lgBar"><div class="meta"></div><textarea rows="2" placeholder="给这句写批注（自动保存）……"></textarea></div>`);
  const panel = el(`<div id="lgPanel"><div class="hd"><b>📒 对白账本</b>
    <input id="lgQ" placeholder="搜台词 / 角色 / 批注" style="width:200px">
    <select id="lgC"><option value="">全部章节</option>${chapters.map(c => `<option>${esc(c || '（开头）')}</option>`).join('')}</select>
    <label><input type="checkbox" id="lgOnly"> 只看有批注</label>
    <label><input type="checkbox" id="lgBarOn"> 游玩时显示当前句批注框</label>
    <button id="lgCsv">导出 Excel(CSV)</button><button id="lgJson">导出 JSON</button><button id="lgMd">导出 Markdown</button><button id="lgImp">导入</button>
    <span class="cnt" id="lgCnt2"></span><button id="lgX">关闭 ✕</button></div><div class="list"></div></div>`);
  document.body.append(btn, bar, panel);
  [btn, bar, panel].forEach(n => { stopKeys(n); stopClicks(n); });
  const list = panel.querySelector('.list');

  function setNote(r, v) {
    v = v.replace(/\s+$/, '');
    if (v) notes[r.id] = { note: v, idx: r.i, chap: r.chap, speaker: r.sp, text: r.text, t: new Date().toISOString() };
    else delete notes[r.id];
    save();
  }
  function updCount() {
    const n = Object.keys(notes).length;
    btn.querySelector('#lgCnt').textContent = n ? `(${n})` : '';
    panel.querySelector('#lgCnt2').textContent = `共 ${dlg.length} 句 · 已批注 ${n} 句`;
  }

  // 当前句批注框
  let barOn = localStorage.getItem(KEY + ':bar') !== '0', cur = -1;
  panel.querySelector('#lgBarOn').checked = barOn;
  panel.querySelector('#lgBarOn').onchange = e => { barOn = e.target.checked; localStorage.setItem(KEY + ':bar', barOn ? '1' : '0'); tick(true); };
  const bta = bar.querySelector('textarea');
  bta.addEventListener('input', () => { const r = rows[cur]; if (r) setNote(r, bta.value); });
  function tick(force) {
    let idx = -1, playing = document.body.classList.contains('playing');
    try { idx = RT.idx; } catch (e) {}
    const show = barOn && playing && rows[idx] && rows[idx].has;
    bar.classList.toggle('show', !!show);
    if (!show) return;
    if (idx !== cur || force) {
      if (document.activeElement === bta && idx !== cur) bta.blur();
      cur = idx; const r = rows[idx];
      bar.querySelector('.meta').textContent = `#${r.i + 1}  ${r.chap ? r.chap + '  ' : ''}${r.sp ? r.sp + '：' : ''}${r.text}`;
      bta.value = notes[r.id]?.note || '';
    }
  }
  setInterval(tick, 250);

  // 列表
  let built = false, rowEls = [];
  function build() {
    if (built) return; built = true;
    let last = null; const frag = document.createDocumentFragment();
    for (const r of dlg) {
      if (r.chap !== last) { last = r.chap; const c = el(`<div class="cap">${esc(r.chap || '（开头）')}</div>`); c._chap = r.chap; frag.appendChild(c); rowEls.push({ cap: c, chap: r.chap }); }
      const d = el(`<div class="row"><div class="n">#${r.i + 1}</div><div class="t">${r.sp ? `<i>${esc(r.sp)}</i>` : ''}${esc(r.text)}</div><textarea rows="1" placeholder="批注……"></textarea><button title="从这句开始玩">跳到</button></div>`);
      const ta = d.querySelector('textarea'); ta.value = notes[r.id]?.note || '';
      d.classList.toggle('noted', !!ta.value);
      ta.addEventListener('input', () => { setNote(r, ta.value); d.classList.toggle('noted', !!ta.value.trim()); });
      d.querySelector('button').onclick = () => { closePanel(); try { if (document.body.classList.contains('playing')) stopPlay(); } catch (e) {} setTimeout(() => startPlay(r.i), 50); };
      frag.appendChild(d); rowEls.push({ row: d, r, ta });
    }
    list.appendChild(frag);
  }
  function filter() {
    const q = panel.querySelector('#lgQ').value.trim().toLowerCase(), c = panel.querySelector('#lgC').value, only = panel.querySelector('#lgOnly').checked;
    const capVis = {};
    for (const x of rowEls) if (x.row) {
      const n = notes[x.r.id]?.note || '';
      const ok = (!c || (x.r.chap || '（开头）') === c) && (!only || n) && (!q || (x.r.text + x.r.sp + n).toLowerCase().includes(q));
      x.row.style.display = ok ? '' : 'none'; if (ok) capVis[x.r.chap] = 1;
    }
    for (const x of rowEls) if (x.cap) x.cap.style.display = capVis[x.chap] ? '' : 'none';
  }
  ['#lgQ', '#lgC', '#lgOnly'].forEach(s => panel.querySelector(s).addEventListener('input', filter));
  function openPanel() {
    build();
    for (const x of rowEls) if (x.row) { x.ta.value = notes[x.r.id]?.note || ''; x.row.classList.toggle('noted', !!x.ta.value); }
    filter(); panel.classList.add('show'); updCount();
    if (rows[cur]) { const t = rowEls.find(x => x.r && x.r.i === cur); t && t.row.scrollIntoView({ block: 'center' }); }
  }
  function closePanel() { panel.classList.remove('show'); tick(true); }
  btn.onclick = () => panel.classList.contains('show') ? closePanel() : openPanel();
  panel.querySelector('#lgX').onclick = closePanel;

  // 导出 / 导入
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  const noted = () => dlg.filter(r => notes[r.id]).map(r => ({ 序号: r.i + 1, 台词ID: r.id, 章节: r.chap, 角色: r.sp, 台词: r.text, 批注: notes[r.id].note }));
  panel.querySelector('#lgJson').onclick = () => dl(`海风与布丁_账本_${stamp()}.json`, JSON.stringify({ game: G.id, title: G.title, exported: new Date().toISOString(), notes }, null, 1), 'application/json');
  panel.querySelector('#lgCsv').onclick = () => {
    const all = confirm('导出全部台词（含没写批注的）？\n确定＝全部台词　取消＝只导出有批注的');
    const src = all ? dlg.map(r => ({ 序号: r.i + 1, 台词ID: r.id, 章节: r.chap, 角色: r.sp, 台词: r.text, 批注: notes[r.id]?.note || '' })) : noted();
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const head = ['序号', '台词ID', '章节', '角色', '台词', '批注'];
    dl(`海风与布丁_账本_${stamp()}.csv`, '\ufeff' + [head.map(q).join(','), ...src.map(o => head.map(h => q(o[h])).join(','))].join('\r\n'), 'text/csv;charset=utf-8');
  };
  panel.querySelector('#lgMd').onclick = () => {
    let s = `# 《海风与布丁》对白账本\n\n导出时间：${new Date().toLocaleString()}\n`, lc = null;
    for (const o of noted()) { if (o.章节 !== lc) { lc = o.章节; s += `\n## ${lc || '（开头）'}\n\n`; } s += `- **#${o.序号}** ${o.角色 ? o.角色 + '：' : ''}${o.台词}\n  - 批注：${o.批注.replace(/\n/g, '\n    ')}\n`; }
    dl(`海风与布丁_账本_${stamp()}.md`, s, 'text/markdown');
  };
  panel.querySelector('#lgImp').onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async () => {
      try {
        const j = JSON.parse(await inp.files[0].text()); const src = j.notes || j; let n = 0;
        for (const [id, v] of Object.entries(src)) { if (v && v.note) { const r = rows.find(x => x.id === id); notes[id] = { ...v, ...(r ? { idx: r.i, text: r.text } : {}) }; n++; } }
        save(); openPanel(); alert(`已导入 ${n} 条批注（同一句以导入的为准）`);
      } catch (e) { alert('导入失败：' + e.message); }
    };
    inp.click();
  };
  updCount();
})();
