/* GalAgent · VN Studio 插件（vn-plugin/1）
 * 结局后聊天 + 带工具的角色扮演，对接 galLingS 插件 gallings.tool.galagent（galagent/1）。
 * 装法：VN Studio 顶栏“插件”→ 导入插件；或在导出游戏的开始界面“插件”里导入。在 galLingS 作品页里玩时会自动提供。
 *  - 剧情里的 @agent：编辑器设置里“机器人”选 GalAgent。
 *  - 剧本 @postchat 角色 [auto=on] [tools=off] goal=聊天方向：结局卡出现“和 X 聊聊”。没写时用插件设置里的角色，再没有就用 @soul 手账角色。
 *  - 名字牌旁的胶囊显示工作进度（默认折叠）；点开后工作流程面板平滑铺满画面，每一步可展开。
 *  - 后端地址留空 = 离线模拟；在 galLingS 作品页里自动连同源 /ws/post_ending。
 *  - 扩展：别的插件写 requires: ['gallings.galagent']，然后
 *      const ga = vn.require('gallings.galagent');
 *      ga.addClientTool({ name, description, parameters, effect, handler })      // 前端工具
 *      ga.GalAgent.registerToolRenderer(name, (step, box) => {})                 // 自定义工具结果显示
 *    后端工具照旧写 galLingS 插件（capabilities: [galagent]），见 galLingS docs/galagent.md。
 * 前端库与 galLingS plugins/builtin/galagent/web/galagent-ui.js 是同一份（构建时嵌入），勿手改这一段。 */
(() => {
  'use strict';
  function loadLib() {
    if (window.GalAgent && window.GalAgent.__vnplug) return window.GalAgent;
    /* ==== GALAGENT-UI BEGIN ==== */
/* GalAgent UI · galagent/1 前端（无依赖、单文件，VN Studio 与 galLingS 播放器共用）
 *
 *   GalAgent.Client        WebSocket 客户端（galagent/1）
 *   GalAgent.MockClient    离线模拟（不连后端也能调界面、调流程）
 *   GalAgent.WorkflowView  一轮对话的“工作流程”块：总折叠 + 分步折叠
 *   GalAgent.ChatView      聊天窗口（调试台用）
 *   GalAgent.WorkDock      galgame 画面里的工作进度胶囊（默认折叠）+ 点开后铺满画面的工作流程面板
 *   GalAgent.GalStage      完整 galgame 式结局后聊天画面（背景/立绘 + 名字牌 + 对话框 + 胶囊）
 *   GalAgent.registerToolRenderer(name, (step, el) => {})   自定义某个工具结果怎么显示（返回 false = 用默认显示）
 *   GalAgent.registerToolTitle(name, args => '一行摘要')      自定义工具步骤标题
 *
 * 折叠规则
 *   运行中：工作流程展开，当前步骤展开；步骤结束自动收起（玩家手动点过的步骤不再自动动）。
 *   一轮结束：整个工作流程收成一行“已完成，耗时 X 秒”（总折叠）。
 *   点总标题 → 展开/收起工作流程；点步骤标题 → 展开/收起该步骤；
 *   收起状态下标题里的步骤小标签可直接点 → 展开工作流程并定位、展开对应步骤。
 */
(function (root) {
  'use strict';
  const PROTOCOL = 'galagent/1';

  /* ---------------------------------------------------------------- 小工具 */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const fmtMs = ms => { const s = (ms || 0) / 1000; if (s < 60) return (s < 10 ? s.toFixed(1) : Math.round(s)) + ' 秒'; const m = Math.floor(s / 60); return m + ' 分 ' + String(Math.round(s % 60)).padStart(2, '0') + ' 秒'; };
  const tpl = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  const short = (s, n = 60) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
  const now = () => (root.performance ? performance.now() : Date.now());
  function mdLite(s) {
    return esc(s).replace(/```([\s\S]*?)```/g, (_, c) => '<pre class="ga-pre">' + c.replace(/^\w*\n/, '') + '</pre>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }

  const SVG = {
    caret: '<path d="m9 18 6-6-6-6"/>',
    think: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/><path d="M19 17l.7 2.1L22 20l-2.3.9L19 23l-.7-2.1L16 20l2.3-.9z"/>',
    terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    spin: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    flow: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8M13 12h8M13 18h8"/>',
    plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z"/>'
  };
  const ic = (n, cls = '') => `<svg class="ga-ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG[n] || SVG.wrench}</svg>`;
  const TOOL_ICON = { powershell: 'terminal', read_file: 'file', write_file: 'pencil', list_dir: 'folder', fetch_url: 'globe', get_time: 'clock' };

  const LABELS = {
    working: '工作中', done: '已完成，耗时 {t}', thought: '已思考，耗时 {t}', stopped: '已中止，耗时 {t}', failed: '出错了，耗时 {t}',
    thinking: '思考中…', thinkDone: '思考', tool: '{name}', waiting: '等你确认', allow: '允许', deny: '拒绝', always: '本次聊天都允许',
    allowed: '已允许', denied: '已拒绝', askTitle: '{who}想执行这个操作', args: '参数', result: '结果', send: '发送', stop: '停止',
    placeholder: '聊聊天，或者让{who}帮你做点事…', connecting: '连接中…', online: '在线', offline: '未连接',
    reset: '清空记忆', close: '关闭'
  };

  /* ---------------------------------------------------------------- 扩展点 */
  const renderers = {}, titles = {};
  function registerToolRenderer(name, fn) { renderers[name] = fn; }
  function registerToolTitle(name, fn) { titles[name] = fn; }
  registerToolTitle('powershell', a => a.command);
  registerToolTitle('read_file', a => a.path);
  registerToolTitle('write_file', a => a.path + (a.append ? '（追加）' : ''));
  registerToolTitle('list_dir', a => a.path || '.');
  registerToolTitle('fetch_url', a => a.url);
  registerToolTitle('get_time', () => '');
  registerToolRenderer('powershell', (st, box) => {
    const r = st.result || {};
    const meta = el('div', 'ga-meta', `${esc(r.shell || '')} · 退出码 ${esc(r.exit_code ?? '?')}${r.elapsed_ms != null ? ' · ' + fmtMs(r.elapsed_ms) : ''}${r.truncated ? ' · 已截断' : ''}`);
    box.appendChild(meta);
    if (r.stdout) box.appendChild(el('pre', 'ga-pre', esc(r.stdout)));
    if (r.stderr) box.appendChild(el('pre', 'ga-pre ga-err', esc(r.stderr)));
    if (!r.stdout && !r.stderr) box.appendChild(el('div', 'ga-meta', '（没有输出）'));
  });
  registerToolRenderer('read_file', (st, box) => { const r = st.result || {}; box.appendChild(el('div', 'ga-meta', esc(r.path) + ` · ${r.chars} 字`)); box.appendChild(el('pre', 'ga-pre', esc(r.text))); });
  registerToolRenderer('list_dir', (st, box) => { const r = st.result || {}; box.appendChild(el('div', 'ga-meta', esc(r.path) + ` · ${r.count} 项`)); box.appendChild(el('pre', 'ga-pre', esc((r.entries || []).join('\n')))); });
  registerToolRenderer('fetch_url', (st, box) => { const r = st.result || {}; box.appendChild(el('div', 'ga-meta', `HTTP ${esc(r.status)} · ${esc(r.url)}`)); box.appendChild(el('pre', 'ga-pre', esc(r.text))); });

  /* ---------------------------------------------------------------- 样式（首次挂载时注入） */
  const CSS = `
.ga-chat{--ga-acc:var(--acc,#8fd3ff);--ga-bg:#0d1220e6;--ga-panel:#ffffff0d;--ga-line:#ffffff1f;--ga-fg:#eef3ff;--ga-dim:#9aa6c2;--ga-ok:#7ee0a1;--ga-bad:#ff8a8a;--ga-warn:#ffd27a;
  display:flex;flex-direction:column;height:100%;min-height:0;background:var(--ga-bg);color:var(--ga-fg);border:1px solid var(--ga-line);border-radius:14px;overflow:hidden;
  font:15px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;backdrop-filter:blur(10px)}
.ga-chat *{box-sizing:border-box}
.ga-ic{width:1em;height:1em;flex:none;vertical-align:-.125em}
.ga-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--ga-line)}
.ga-ava{width:34px;height:34px;border-radius:50%;background:var(--ga-acc);color:#0b1020;display:grid;place-items:center;font-weight:700;overflow:hidden;flex:none}
.ga-ava img{width:100%;height:100%;object-fit:cover;object-position:top}
.ga-who{flex:1;min-width:0}.ga-who b{display:block;font-size:16px}.ga-st{font-size:12px;color:var(--ga-dim)}
.ga-st i{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ga-dim);margin-right:5px;vertical-align:1px}
.ga-st.on i{background:var(--ga-ok)}.ga-st.bad i{background:var(--ga-bad)}
.ga-hbtn{background:none;border:0;color:var(--ga-dim);font-size:18px;padding:6px;border-radius:8px;cursor:pointer;display:grid;place-items:center}
.ga-hbtn:hover{background:var(--ga-panel);color:var(--ga-fg)}
.ga-log{flex:1;min-height:0;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth}
.ga-msg{display:flex;gap:10px;max-width:100%}
.ga-msg.user{justify-content:flex-end}
.ga-msg .ga-ava{width:30px;height:30px;font-size:13px}
.ga-col{display:flex;flex-direction:column;gap:6px;min-width:0;max-width:min(680px,88%)}
.ga-bubble{padding:9px 13px;border-radius:14px;background:var(--ga-panel);border:1px solid var(--ga-line);word-break:break-word;white-space:normal}
.ga-msg.user .ga-bubble{background:color-mix(in srgb,var(--ga-acc) 22%,transparent);border-color:color-mix(in srgb,var(--ga-acc) 40%,transparent)}
.ga-bubble:empty{display:none}
.ga-bubble.typing::after{content:"▍";animation:ga-blink 1s steps(1) infinite;color:var(--ga-acc)}
.ga-bubble code{background:#ffffff14;padding:0 4px;border-radius:4px}
.ga-sys{align-self:center;font-size:12px;color:var(--ga-dim);background:var(--ga-panel);padding:3px 10px;border-radius:99px}
.ga-sys.bad{color:var(--ga-bad)}
/* 工作流程（总折叠） */
.ga-work{border:1px solid var(--ga-line);border-radius:12px;background:#ffffff08;overflow:hidden;font-size:13.5px}
.ga-work-head{display:flex;align-items:center;gap:8px;padding:7px 11px;cursor:pointer;user-select:none;color:var(--ga-dim)}
.ga-work-head:hover{color:var(--ga-fg);background:#ffffff08}
.ga-caret{transition:transform .18s;opacity:.8}
.ga-work.open>.ga-work-head .ga-caret,.ga-step.open>.ga-step-head .ga-caret{transform:rotate(90deg)}
.ga-work-title{white-space:nowrap}
.ga-work.running .ga-work-title{color:var(--ga-acc)}
.ga-work.err .ga-work-title{color:var(--ga-bad)}
.ga-chips{display:flex;gap:4px;flex-wrap:nowrap;overflow:hidden;min-width:0;margin-left:auto}
.ga-work.open .ga-chips{display:none}
.ga-chip{display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:99px;background:var(--ga-panel);border:1px solid var(--ga-line);font-size:11.5px;white-space:nowrap;cursor:pointer;color:var(--ga-dim)}
.ga-chip:hover{color:var(--ga-fg);border-color:var(--ga-acc)}
.ga-chip.bad{color:var(--ga-bad)}
.ga-work-body{display:none;padding:2px 8px 8px 8px;flex-direction:column;gap:4px;border-top:1px solid var(--ga-line)}
.ga-work.open>.ga-work-body{display:flex}
/* 步骤（分步折叠） */
.ga-step{border-radius:9px;transition:background .3s}
.ga-step.flash{background:color-mix(in srgb,var(--ga-acc) 18%,transparent)}
.ga-step-head{display:flex;align-items:center;gap:7px;padding:5px 6px;cursor:pointer;user-select:none;border-radius:8px;min-width:0}
.ga-step-head:hover{background:#ffffff0a}
.ga-step-name{white-space:nowrap;font-weight:600}
.ga-step-sum{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ga-dim);font-family:ui-monospace,Consolas,monospace;font-size:12px}
.ga-step-st{display:flex;align-items:center;gap:5px;color:var(--ga-dim);font-size:12px;white-space:nowrap;margin-left:auto}
.ga-step.ok .ga-step-st .ga-ic{color:var(--ga-ok)}.ga-step.bad .ga-step-st .ga-ic,.ga-step.bad .ga-step-name{color:var(--ga-bad)}
.ga-step.wait .ga-step-st{color:var(--ga-warn)}
.ga-step-body{display:none;padding:2px 6px 8px 26px}
.ga-step.open>.ga-step-body{display:block}
.ga-think-text{color:var(--ga-dim);white-space:pre-wrap;font-size:13px;border-left:2px solid var(--ga-line);padding-left:10px}
.ga-narr{color:var(--ga-fg);opacity:.85;font-style:italic;padding:2px 6px 2px 26px;font-size:13px}
.ga-lbl{font-size:11px;color:var(--ga-dim);margin:6px 0 2px;letter-spacing:.06em}
.ga-pre{margin:0;padding:8px 10px;background:#00000040;border:1px solid var(--ga-line);border-radius:8px;white-space:pre-wrap;word-break:break-all;max-height:260px;overflow:auto;font:12px/1.5 ui-monospace,Consolas,monospace;color:#dfe7ff}
.ga-pre.ga-err{color:var(--ga-bad)}
.ga-meta{font-size:12px;color:var(--ga-dim);margin:4px 0}
.ga-errline{color:var(--ga-bad);font-size:12.5px;margin-top:4px}
.ga-ask{margin-top:8px;padding:10px;border:1px solid color-mix(in srgb,var(--ga-warn) 55%,transparent);background:color-mix(in srgb,var(--ga-warn) 9%,transparent);border-radius:10px}
.ga-ask-t{display:flex;align-items:center;gap:6px;color:var(--ga-warn);font-weight:600;margin-bottom:6px}
.ga-ask-btns{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.ga-btn{border:1px solid var(--ga-line);background:var(--ga-panel);color:var(--ga-fg);border-radius:8px;padding:5px 14px;cursor:pointer;font:inherit;font-size:13px}
.ga-btn:hover{border-color:var(--ga-acc)}
.ga-btn.pri{background:var(--ga-acc);color:#0b1020;border-color:transparent;font-weight:600}
.ga-btn.ghost{background:none}
.ga-ask-res{margin-top:6px;font-size:12.5px}
.spin{animation:ga-spin 1s linear infinite}
@keyframes ga-spin{to{transform:rotate(360deg)}}@keyframes ga-blink{50%{opacity:0}}
/* 输入 */
.ga-input{display:flex;gap:8px;align-items:flex-end;padding:10px 12px;border-top:1px solid var(--ga-line)}
.ga-input textarea{flex:1;resize:none;min-height:42px;max-height:140px;background:#00000033;border:1px solid var(--ga-line);border-radius:10px;color:var(--ga-fg);font:inherit;padding:9px 12px;outline:none}
.ga-input textarea:focus{border-color:var(--ga-acc)}
.ga-send{width:42px;height:42px;border-radius:10px;border:0;background:var(--ga-acc);color:#0b1020;display:grid;place-items:center;cursor:pointer;font-size:18px}
.ga-send.stop{background:var(--ga-bad)}
.ga-send:disabled{opacity:.4;cursor:default}
/* 独立工作流程浮层（剧情内 @agent 用） */
.ga-float{--ga-acc:var(--acc,#8fd3ff);--ga-line:#ffffff1f;--ga-fg:#eef3ff;--ga-dim:#9aa6c2;--ga-ok:#7ee0a1;--ga-bad:#ff8a8a;--ga-warn:#ffd27a;--ga-panel:#ffffff0d;
  color:var(--ga-fg);font:14px/1.55 system-ui,"PingFang SC","Microsoft YaHei",sans-serif}
.ga-float .ga-work{background:#0d1220e0;backdrop-filter:blur(8px)}
.ga-float *{box-sizing:border-box}
/* galgame 画面里的工作进度胶囊 + 铺满画面的工作流程面板（坐标按 1280×720 画面设计） */
.ga-pill{position:absolute;top:-20px;left:200px;z-index:6;display:none;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;background:#0c0f1ae8;border:1px solid #ffffff38;color:#dfe8ff;font:600 17px/1 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 4px 18px #0007;transition:border-color .3s,background .3s,color .3s}
.ga-pill.show{display:inline-flex}
.ga-pill:hover{background:#1b2338f0}
.ga-pill .ga-ic{width:18px;height:18px}
.ga-pill .t{opacity:.65;font-weight:500;font-variant-numeric:tabular-nums}
.ga-pill.run{border-color:var(--acc,#8fd3ff);color:#eaf6ff}.ga-pill.run .ga-ic{color:var(--acc,#8fd3ff)}
.ga-pill.wait{border-color:#ffd27a;color:#ffd27a;animation:ga-pulse 1.3s ease-in-out infinite}
.ga-pill.done{color:#b9c4dd}.ga-pill.done .ga-ic{color:#7ee0a1}.ga-pill.bad .ga-ic{color:#ff8a8a}
@keyframes ga-pulse{50%{box-shadow:0 0 0 6px #ffd27a33}}
.ga-panel{--ga-acc:var(--acc,#8fd3ff);--ga-line:#ffffff1f;--ga-fg:#eef3ff;--ga-dim:#9aa6c2;--ga-ok:#7ee0a1;--ga-bad:#ff8a8a;--ga-warn:#ffd27a;--ga-panel:#ffffff0d;
  --t:600px;--l:200px;--r:900px;--b:80px;
  position:absolute;inset:0;z-index:25;color:var(--ga-fg);background:#080c18ee;backdrop-filter:blur(8px);
  clip-path:inset(var(--t) var(--r) var(--b) var(--l) round 20px);opacity:0;pointer-events:none;
  transition:clip-path .5s cubic-bezier(.22,.8,.24,1),opacity .35s ease;font:15px/1.55 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.ga-panel.open{clip-path:inset(0px 0px 0px 0px round 0px);opacity:1;pointer-events:auto}
.ga-panel *{box-sizing:border-box}
.ga-panel-in{zoom:var(--ga-zoom,1.3);height:100%;display:flex;flex-direction:column;opacity:0;transform:translateY(12px);transition:opacity .3s ease .12s,transform .4s ease .12s}
.ga-panel.open .ga-panel-in{opacity:1;transform:none}
.ga-panel-head{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--ga-line);font-size:16px}
.ga-panel-head .ga-ic{color:var(--ga-acc)}
.ga-panel-st{color:var(--ga-dim);font-size:13px;flex:1}
.ga-panel-body{flex:1;min-height:0;overflow-y:auto;padding:14px 20px 20px;display:flex;flex-direction:column;gap:10px}
.ga-panel-body>.ga-work{max-width:860px;width:100%;margin:0 auto;flex:none}
.ga-turn-in{color:var(--ga-fg);opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}
.ga-panel .ga-work-head .ga-chips{display:none}
/* GalStage：完整 galgame 画面 */
.gs-wrap{position:relative;width:100%;height:100%;overflow:hidden;background:#000}
.gs-stage{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0;overflow:hidden;background:#111;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#fff}
.gs-stage *{box-sizing:border-box}
.gs-bg{position:absolute;inset:0;background:linear-gradient(#2a3a6a,#141a33) center/cover no-repeat}
.gs-bg[style]{background-size:cover;background-position:center}
.gs-layer{position:absolute;inset:0;pointer-events:none}
.gs-spr{position:absolute;left:50%;bottom:0;transform:translateX(-50%);height:640px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 6px 24px #0008)}
.gs-spr img{height:100%;object-fit:contain}
.gs-spr.sil .h{width:170px;height:170px;border-radius:50%;background:linear-gradient(#c9d6ff,#8fa5e6);margin-top:40px}
.gs-spr.sil .b{width:250px;height:440px;border-radius:125px 125px 0 0;background:linear-gradient(#a9bbf0,#6f86cc);margin-top:-10px}
.gs-spr.sil span{position:absolute;top:400px;font-size:30px;color:#fff;opacity:.85;text-shadow:0 2px 8px #0006}
.gs-spr.pop{animation:gs-pop .45s ease}
@keyframes gs-pop{40%{transform:translateX(-50%) translateY(-14px)}}
.gs-dlg{position:absolute;left:60px;right:60px;bottom:28px;height:190px;border-radius:14px;background:linear-gradient(#0c0f1ad0,#0c0f1af0);border:1px solid #ffffff22;padding:46px 36px 20px;z-index:4}
.gs-name{position:absolute;top:-20px;left:28px;min-width:140px;height:40px;padding:0 18px;border-radius:10px;background:#2b3655;border:1px solid #ffffff30;font-weight:600;font-size:22px;line-height:40px;text-align:center}
.gs-text{font-size:26px;line-height:1.6;white-space:pre-wrap;overflow-y:auto;height:100%}
.gs-ctl{position:absolute;right:16px;bottom:10px;display:flex;gap:6px}
.gs-btn{width:44px;height:44px;border-radius:10px;border:1px solid #ffffff40;background:#0c0f1ae0;color:#fff;display:grid;place-items:center;cursor:pointer;font-size:20px}
.gs-btn:hover{border-color:var(--acc,#8fd3ff)}
.gs-ctl .gs-btn{width:34px;height:34px;font-size:16px;border-color:transparent;background:none;opacity:.7}
.gs-ctl .gs-btn:hover{opacity:1}
.gs-in{position:absolute;left:60px;right:60px;bottom:232px;display:flex;gap:8px;z-index:6}
.gs-in input{flex:1;background:#0c0f1ae0;border:1px solid #ffffff50;border-radius:10px;color:#fff;font:inherit;font-size:22px;padding:10px 16px;outline:none}
.gs-in input:focus{border-color:var(--acc,#8fd3ff)}
.gs-in .gs-btn{width:52px;height:52px}
.gs-send.stop{background:#a8323ae0}
.gs-log{position:absolute;inset:0;z-index:30;background:#000d;display:none;overflow-y:auto;padding:50px 120px}
.gs-log.show{display:block}
.gs-log-row{display:flex;gap:18px;padding:10px 0;border-bottom:1px solid #ffffff14;font-size:22px}
.gs-log-row b{min-width:120px;color:var(--acc,#8fd3ff)}
`;
  let cssDone = false;
  function injectCss() {
    if (cssDone || typeof document === 'undefined') return; cssDone = true;
    const s = document.createElement('style'); s.id = 'galagent-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------- 事件发射 */
  class Emitter {
    constructor() { this._h = {}; }
    on(t, fn) { (this._h[t] = this._h[t] || []).push(fn); return () => this.off(t, fn); }
    off(t, fn) { this._h[t] = (this._h[t] || []).filter(f => f !== fn); }
    emit(t, e) { for (const f of [...(this._h[t] || []), ...(this._h['*'] || [])]) { try { f(e); } catch (err) { console.error('[galagent]', err); } } }
  }

  /* ---------------------------------------------------------------- WebSocket 客户端 */
  class Client extends Emitter {
    /** opts: { url, token, card, character:{name,persona,expressions}, context:{ending,story,vars,goal},
     *          clientTools:[{name,description,parameters,effect,handler(args)→result}], history:[{role,text}] } */
    constructor(opts = {}) { super(); this.o = opts; this.ws = null; this.ready = false; this.status = 'offline'; }
    connect() {
      return new Promise((resolve, reject) => {
        let settled = false;
        const fail = msg => { this._status('offline'); if (!settled) { settled = true; reject(new Error(msg)); } };
        let ws;
        try { ws = new WebSocket(this.o.url); } catch (e) { return fail(e.message); }
        this.ws = ws; this._status('connecting');
        const timer = setTimeout(() => { fail('连接超时'); try { ws.close(); } catch (e) { } }, 10000);
        ws.onopen = () => {
          const tools = (this.o.clientTools || []).map(t => ({ name: t.name, description: t.description, parameters: t.parameters, effect: t.effect }));
          ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL, token: this.o.token || undefined, card: this.o.card || undefined,
            character: this.o.character || {}, context: this.o.context || {}, client_tools: tools, history: this.o.history || [],
            server_tools: this.o.server_tools === false ? false : undefined }));
        };
        ws.onmessage = ev => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.type === 'ready') { this.ready = true; this.info = m; this._status('online'); clearTimeout(timer); if (!settled) { settled = true; resolve(m); } }
          if (m.type === 'error' && m.fatal) { clearTimeout(timer); fail(m.message); }
          if (m.type === 'client_call') this._clientCall(m);
          this.emit(m.type, m);
        };
        ws.onerror = () => { clearTimeout(timer); fail('连不上 ' + this.o.url); };
        ws.onclose = () => { clearTimeout(timer); this.ready = false; this._status('offline'); this.emit('close', {}); if (!settled) fail('连接被关闭'); };
      });
    }
    _status(s) { this.status = s; this.emit('status', { status: s }); }
    _raw(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
    async _clientCall(m) {
      const t = (this.o.clientTools || []).find(x => x.name === m.name);
      try {
        if (!t || !t.handler) throw new Error('前端没有这个工具');
        const result = await t.handler(m.args || {});
        this._raw({ type: 'client_result', call_id: m.call_id, ok: true, result });
      } catch (e) { this._raw({ type: 'client_result', call_id: m.call_id, ok: false, error: String(e.message || e) }); }
    }
    send(text) { this._raw({ type: 'user', text }); }
    approve(callId, allow, remember) { this._raw({ type: 'approve', call_id: callId, allow: !!allow, remember: !!remember }); }
    stop() { this._raw({ type: 'stop' }); }
    reset() { this._raw({ type: 'reset' }); }
    close() { try { this.ws && this.ws.close(); } catch (e) { } }
  }

  /* ---------------------------------------------------------------- 离线模拟（调界面用） */
  class MockClient extends Emitter {
    constructor(opts = {}) { super(); this.o = opts; this.turn = 0; this.timers = []; this.waiting = null; this.always = new Set(); }
    async connect() {
      const tools = [['powershell', 'perform', 'ask'], ['read_file', 'read', 'auto'], ['list_dir', 'read', 'auto'], ['get_time', 'read', 'auto']]
        .map(([name, effect, policy]) => ({ name, effect, policy, source: 'mock' }))
        .concat((this.o.clientTools || []).map(t => ({ name: t.name, effect: t.effect || 'perform', policy: 'auto', source: 'client' })));
      this.info = { type: 'ready', protocol: PROTOCOL, session: 'mock', character: this.o.character || {}, tools, llm: true };
      this.status = 'online'; setTimeout(() => { this.emit('status', { status: 'online' }); this.emit('ready', this.info); }, 0);
      return this.info;
    }
    _e(m) { this.emit(m.type, m); }
    _seq(list) {
      let t = 0;
      return new Promise(res => {
        const run = i => {
          if (i >= list.length) return res();
          const [delay, fn] = list[i];
          this.timers.push(setTimeout(async () => { const r = fn(); if (r && r.then) await r; run(i + 1); }, delay));
        };
        run(0);
      });
    }
    async _stream(turn, kind, text, step) {
      for (let i = 0; i < text.length; i += 3) {
        await new Promise(r => this.timers.push(setTimeout(r, 35)));
        if (this.dead) return;
        const piece = text.slice(i, i + 3);
        this._e(kind === 'think' ? { type: 'think_delta', turn, step, text: piece } : { type: 'say_delta', turn, round: step, text: piece });
      }
    }
    async send(text) {
      if (this.busy) return; this.busy = true; this.dead = false;
      const turn = ++this.turn, t0 = Date.now(); let steps = 0, calls = 0, reply = '';
      const name = (this.o.character || {}).name || '她';
      const task = /查|看|帮|整理|文件|时间|几点|运行|命令|电脑|目录/.test(text);
      this._e({ type: 'turn_start', turn, input: text });
      const think = async (s) => { const id = 's' + (++steps), ts = Date.now(); this._e({ type: 'step_start', turn, step: id, kind: 'think' }); await this._stream(turn, 'think', s, id); this._e({ type: 'step_end', turn, step: id, ok: true, ms: Date.now() - ts }); };
      const tool = async (nm, args, result, ask) => {
        const id = 's' + (++steps), ts = Date.now(), cid = 'mock_' + id; calls++;
        this._e({ type: 'tool_start', turn, step: id, call_id: cid, name: nm, args, source: 'mock', policy: ask ? 'ask' : 'auto' });
        let ok = true, error = null;
        if (ask && !this.always.has(nm)) {
          this._e({ type: 'approval_required', turn, step: id, call_id: cid, name: nm, args, effect: 'perform' });
          const [allow, remember] = await new Promise(r => { this.waiting = { cid, r }; });
          this._e({ type: 'approval_resolved', turn, step: id, call_id: cid, allow });
          if (remember) this.always.add(nm);
          if (!allow) { ok = false; error = '玩家没有同意这次操作'; }
        }
        if (ok) await new Promise(r => this.timers.push(setTimeout(r, 600)));
        this._e({ type: 'tool_end', turn, step: id, call_id: cid, name: nm, ok, result: ok ? result : null, error, ms: Date.now() - ts });
        return ok;
      };
      try {
        this._e({ type: 'round_start', turn, round: 1 });
        if (task) {
          await think('玩家想让我看看电脑上的东西。先列一下目录，再看看时间。');
          this._e({ type: 'emotion', turn, name: '笑' });
          const pre = '交给我吧，稍等一下～'; await this._stream(turn, 'say', pre, 1);
          this._e({ type: 'round_end', turn, round: 1, tool_calls: 2 });
          await tool('list_dir', { path: '.' }, { path: '~/workspace', count: 3, entries: ['照片/', '日记.txt  (812 B)', '待办.md  (233 B)'] });
          const ok = await tool('powershell', { command: 'Get-Date -Format "yyyy-MM-dd HH:mm"; (Get-ChildItem).Count' },
            { shell: 'pwsh', exit_code: 0, stdout: '2026-10-11 13:05\n3', stderr: '', elapsed_ms: 412 }, true);
          this._e({ type: 'round_start', turn, round: 2 });
          await think(ok ? '目录里有 3 项，时间是下午一点。整理成一句话告诉玩家。' : '玩家没让我执行命令，就只说目录结果。');
          reply = ok ? '看好啦：工作目录里有「照片」文件夹、「日记.txt」和「待办.md」三样东西，现在是 13:05。要我帮你把待办念一遍吗？'
            : '命令我就不跑啦。目录里有「照片」文件夹、「日记.txt」和「待办.md」，想看哪个？';
          await this._stream(turn, 'say', reply, 2);
          this._e({ type: 'round_end', turn, round: 2, tool_calls: 0 });
        } else {
          await think('只是想聊聊天。温柔一点回应。');
          reply = `嗯，我在听。结局之后还能这样和你说话，${name}其实挺开心的。`;
          await this._stream(turn, 'say', reply, 1);
          this._e({ type: 'round_end', turn, round: 1, tool_calls: 0 });
        }
        this._e({ type: 'turn_end', turn, ms: Date.now() - t0, rounds: task ? 2 : 1, steps, tool_calls: calls, reply, stopped: false, error: null });
      } finally { this.busy = false; }
    }
    approve(cid, allow, remember) { if (this.waiting && this.waiting.cid === cid) { const w = this.waiting; this.waiting = null; w.r([allow, remember]); } }
    stop() {
      this.dead = true; this.timers.forEach(clearTimeout); this.timers = []; this.busy = false;
      if (this.waiting) { this.waiting = null; }
      this._e({ type: 'turn_end', turn: this.turn, ms: 0, steps: 0, tool_calls: 0, reply: '', stopped: true, error: null });
    }
    reset() { this._e({ type: 'reset_done' }); }
    close() { this.stop(); }
  }

  /* ---------------------------------------------------------------- 一轮的工作流程 */
  class WorkflowView {
    /** opts: { labels, who, autoCollapse:true, onApprove(callId, allow, remember), onChange() } */
    constructor(opts = {}) {
      injectCss();
      this.o = Object.assign({ autoCollapse: true }, opts);
      this.L = Object.assign({}, LABELS, opts.labels || {});
      this.steps = {}; this.order = []; this.t0 = now(); this.state = 'running'; this.touched = false;
      this.el = el('div', 'ga-work running open');
      this.head = el('div', 'ga-work-head', `${ic('caret', 'ga-caret')}${ic('spin', 'spin')}<span class="ga-work-title"></span><span class="ga-chips"></span>`);
      this.body = el('div', 'ga-work-body');
      this.el.append(this.head, this.body);
      this.head.addEventListener('click', e => { if (e.target.closest('.ga-chip')) return; this.touched = true; this.toggle(); });
      this._tick = setInterval(() => this._title(), 200); this._title();
    }
    get empty() { return this.order.length === 0 && !this.body.querySelector('.ga-narr'); }
    toggle(open) { const o = open ?? !this.el.classList.contains('open'); this.el.classList.toggle('open', o); this._changed(); }
    _changed() { this.o.onChange && this.o.onChange(); }
    _title() {
      const ms = (this.endMs ?? (now() - this.t0));
      const t = fmtMs(ms), tit = this.head.querySelector('.ga-work-title');
      let s;
      if (this.state === 'running') s = this.L.working + ' · ' + t;
      else if (this.state === 'stopped') s = tpl(this.L.stopped, { t });
      else if (this.state === 'error') s = tpl(this.L.failed, { t });
      else s = tpl(this.order.some(id => this.steps[id].kind === 'tool') ? this.L.done : this.L.thought, { t });
      tit.textContent = s;
    }
    _mkStep(id, kind, name) {
      const st = { id, kind, name, el: el('div', 'ga-step open ' + kind), touched: false, t0: now() };
      st.head = el('div', 'ga-step-head');
      st.bodyEl = el('div', 'ga-step-body');
      st.el.append(st.head, st.bodyEl);
      st.head.addEventListener('click', () => { st.touched = true; this.toggleStep(id); });
      this.steps[id] = st; this.order.push(id); this.body.appendChild(st.el);
      const chip = el('span', 'ga-chip'); chip.dataset.step = id;
      chip.addEventListener('click', e => { e.stopPropagation(); this.reveal(id); });
      st.chip = chip; this.head.querySelector('.ga-chips').appendChild(chip);
      return st;
    }
    /** 展开工作流程并定位到某一步（收起状态下点步骤小标签时用） */
    reveal(id) {
      const st = this.steps[id]; if (!st) return;
      this.touched = true; this.toggle(true); st.touched = true; this.toggleStep(id, true);
      st.el.classList.add('flash'); setTimeout(() => st.el.classList.remove('flash'), 900);
      if (st.el.scrollIntoView) st.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    toggleStep(id, open) { const st = this.steps[id]; if (!st) return; const o = open ?? !st.el.classList.contains('open'); st.el.classList.toggle('open', o); this._changed(); }
    _autoClose(st) { if (!st.touched) st.el.classList.remove('open'); }
    _thinkHead(st, done, ms) {
      st.head.innerHTML = `${ic('caret', 'ga-caret')}${ic('think')}<span class="ga-step-name">${esc(done ? this.L.thinkDone : this.L.thinking)}</span><span class="ga-step-sum">${done ? esc(short(st.text, 80)) : ''}</span><span class="ga-step-st">${done ? fmtMs(ms) : ic('spin', 'spin')}</span>`;
      st.chip.innerHTML = `${ic('think')}${esc(this.L.thinkDone)}`;
    }
    _toolHead(st) {
      const tf = titles[st.name], sum = tf ? tf(st.args || {}) : short(JSON.stringify(st.args || {}), 80);
      let stat;
      if (st.status === 'run') stat = ic('spin', 'spin');
      else if (st.status === 'wait') stat = `${ic('shield')}${esc(this.L.waiting)}`;
      else stat = `${st.ms != null ? fmtMs(st.ms) : ''}${ic(st.status === 'ok' ? 'check' : 'x')}`;
      st.head.innerHTML = `${ic('caret', 'ga-caret')}${ic(TOOL_ICON[st.name] || (st.source === 'client' ? 'plug' : 'wrench'))}<span class="ga-step-name">${esc(tpl(this.L.tool, { name: st.name }))}</span><span class="ga-step-sum">${esc(short(sum, 90))}</span><span class="ga-step-st">${stat}</span>`;
      st.el.classList.toggle('ok', st.status === 'ok'); st.el.classList.toggle('bad', st.status === 'bad'); st.el.classList.toggle('wait', st.status === 'wait');
      st.chip.innerHTML = `${ic(TOOL_ICON[st.name] || 'wrench')}${esc(st.name)}`; st.chip.classList.toggle('bad', st.status === 'bad');
    }
    _toolBody(st) {
      const b = st.bodyEl; b.innerHTML = '';
      b.appendChild(el('div', 'ga-lbl', esc(this.L.args)));
      const a = st.args || {};
      b.appendChild(el('pre', 'ga-pre', esc(st.name === 'powershell' && a.command ? a.command : JSON.stringify(a, null, 2))));
      if (st.ask) b.appendChild(st.ask);
      if (st.status === 'ok' || st.status === 'bad') {
        if (st.result != null) {
          b.appendChild(el('div', 'ga-lbl', esc(this.L.result)));
          const box = el('div'); b.appendChild(box);
          const r = renderers[st.name];
          const dflt = () => box.appendChild(el('pre', 'ga-pre', esc(typeof st.result === 'string' ? st.result : JSON.stringify(st.result, null, 2))));
          if (r) { try { if (r(st, box) === false) dflt(); } catch (e) { box.innerHTML = ''; dflt(); } }   // 渲染器返回 false = 用默认显示
          else dflt();
        }
        if (st.error) b.appendChild(el('div', 'ga-errline', esc(st.error)));
      }
    }
    /** 喂一条 galagent/1 事件 */
    feed(m) {
      switch (m.type) {
        case 'step_start': { const st = this._mkStep(m.step, 'think'); st.text = ''; st.textEl = el('div', 'ga-think-text'); st.bodyEl.appendChild(st.textEl); this._thinkHead(st, false); break; }
        case 'think_delta': { const st = this.steps[m.step]; if (st) { st.text += m.text; st.textEl.textContent = st.text; } break; }
        case 'step_end': { const st = this.steps[m.step]; if (st) { this._thinkHead(st, true, m.ms); this._autoClose(st); } break; }
        case 'narration': { const n = el('div', 'ga-narr', mdLite(m.text)); this.body.appendChild(n); break; }
        case 'tool_start': { const st = this._mkStep(m.step, 'tool', m.name); Object.assign(st, { args: m.args, source: m.source, status: 'run', callId: m.call_id }); this._toolHead(st); this._toolBody(st); break; }
        case 'approval_required': {
          const st = this.steps[m.step]; if (!st) break;
          st.status = 'wait'; st.el.classList.add('open'); this.toggle(true);
          const ask = el('div', 'ga-ask');
          ask.innerHTML = `<div class="ga-ask-t">${ic('shield')}${esc(tpl(this.L.askTitle, { who: this.o.who || '她' }))}</div><div class="ga-ask-btns"><button class="ga-btn pri" data-a="1">${esc(this.L.allow)}</button><button class="ga-btn" data-a="0">${esc(this.L.deny)}</button><button class="ga-btn ghost" data-a="2">${esc(this.L.always)}</button></div>`;
          ask.querySelectorAll('button').forEach(btn => btn.addEventListener('click', e => {
            e.stopPropagation(); const a = btn.dataset.a;
            ask.querySelectorAll('button').forEach(x => x.disabled = true);
            this.o.onApprove && this.o.onApprove(m.call_id, a !== '0', a === '2');
          }));
          st.ask = ask; this._toolHead(st); this._toolBody(st); break;
        }
        case 'approval_resolved': {
          const st = this.steps[m.step]; if (!st || !st.ask) break;
          st.ask.querySelector('.ga-ask-btns').remove();
          st.ask.appendChild(el('div', 'ga-ask-res', esc(m.allow ? this.L.allowed : this.L.denied)));
          if (st.status === 'wait') st.status = 'run'; this._toolHead(st); break;
        }
        case 'tool_end': {
          const st = this.steps[m.step]; if (!st) break;
          Object.assign(st, { status: m.ok ? 'ok' : 'bad', result: m.result, error: m.error, ms: m.ms });
          this._toolHead(st); this._toolBody(st); this._autoClose(st); break;
        }
        case 'turn_end': this.finish(m); break;
      }
      this._changed();
    }
    finish(m = {}) {
      clearInterval(this._tick);
      this.state = m.stopped ? 'stopped' : (m.error ? 'error' : 'done');
      this.endMs = m.ms != null && m.ms > 0 ? m.ms : now() - this.t0;
      this.el.classList.remove('running'); this.el.classList.toggle('err', this.state === 'error');
      const sp = this.head.querySelector('.spin'); if (sp) sp.remove();
      // 没收尾的步骤（被中止）标成失败
      for (const id of this.order) { const st = this.steps[id]; if (st.kind === 'tool' && (st.status === 'run' || st.status === 'wait')) { st.status = 'bad'; st.error = st.error || '已中止'; this._toolHead(st); this._toolBody(st); } if (st.kind === 'think' && st.head.querySelector('.spin')) this._thinkHead(st, true, now() - st.t0); }
      if (this.o.autoCollapse && !(this.touched && this.el.classList.contains('open') && this.state !== 'done')) {
        this.el.classList.remove('open');
        for (const id of this.order) this._autoClose(this.steps[id]);
      }
      this._title(); this._changed();
    }
    destroy() { clearInterval(this._tick); this.el.remove(); }
  }

  /* ---------------------------------------------------------------- 聊天窗口 */
  class ChatView {
    /** opts: { client | url/token/card/mock, character:{name,persona,expressions,avatar}, context, clientTools, history,
     *          greeting, labels, autoCollapse, onEmotion(name), onClose(), onTurnEnd(e), showReset:true } */
    constructor(container, opts = {}) {
      injectCss();
      this.o = opts; this.L = Object.assign({}, LABELS, opts.labels || {});
      this.who = (opts.character && opts.character.name) || '她';
      this.client = opts.client || (opts.mock ? new MockClient(opts) : new Client(opts));
      this.el = el('div', 'ga-chat');
      const ava = this._ava();
      this.el.innerHTML = `<div class="ga-head">${ava}<div class="ga-who"><b>${esc(this.who)}</b><span class="ga-st"><i></i><span>${esc(this.L.connecting)}</span></span></div>
        ${opts.showReset === false ? '' : `<button class="ga-hbtn" data-h="reset" title="${esc(this.L.reset)}">${ic('reset')}</button>`}
        ${opts.onClose ? `<button class="ga-hbtn" data-h="close" title="${esc(this.L.close)}">${ic('x')}</button>` : ''}</div>
        <div class="ga-log"></div>
        <div class="ga-input"><textarea rows="1" placeholder="${esc(tpl(opts.placeholder || this.L.placeholder, { who: this.who }))}"></textarea><button class="ga-send" title="${esc(this.L.send)}">${ic('send')}</button></div>`;
      container.appendChild(this.el);
      this.log = this.el.querySelector('.ga-log'); this.ta = this.el.querySelector('textarea'); this.btn = this.el.querySelector('.ga-send');
      this.stEl = this.el.querySelector('.ga-st');
      this.busy = false; this.cur = null;
      this.ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.submit(); } e.stopPropagation(); });
      this.ta.addEventListener('input', () => { this.ta.style.height = 'auto'; this.ta.style.height = Math.min(140, this.ta.scrollHeight) + 'px'; });
      this.btn.addEventListener('click', e => { e.stopPropagation(); this.busy ? this.client.stop() : this.submit(); });
      this.el.addEventListener('click', e => e.stopPropagation());
      this.el.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        if (b.dataset.h === 'close') opts.onClose();
        else { this.client.reset(); this.log.innerHTML = ''; this._sys('记忆已清空'); }
      }));
      this._wire();
      if (opts.greeting) this._charMsg().bubble.innerHTML = mdLite(opts.greeting);
      this.client.connect().then(() => { this.ta.focus(); }).catch(e => this._sys('连接失败：' + e.message, true));
    }
    _ava() { const c = this.o.character || {}; return `<div class="ga-ava">${c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : esc((this.who || '?').slice(0, 1))}</div>`; }
    _status(s) { this.stEl.className = 'ga-st' + (s === 'online' ? ' on' : s === 'offline' ? ' bad' : ''); this.stEl.querySelector('span').textContent = this.L[s] || s; }
    _scroll() { const lg = this.log; const near = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 160; if (near || this.busy) lg.scrollTop = lg.scrollHeight; }
    _sys(t, bad) { this.log.appendChild(el('div', 'ga-sys' + (bad ? ' bad' : ''), esc(t))); this._scroll(); }
    _userMsg(t) { const m = el('div', 'ga-msg user'); const c = el('div', 'ga-col'); c.appendChild(el('div', 'ga-bubble', mdLite(t))); m.appendChild(c); this.log.appendChild(m); this._scroll(); }
    _charMsg() {
      const m = el('div', 'ga-msg char'); m.innerHTML = this._ava(); const c = el('div', 'ga-col'); m.appendChild(c);
      const bubble = el('div', 'ga-bubble'); c.appendChild(bubble); this.log.appendChild(m); this._scroll();
      return { m, c, bubble };
    }
    _setBusy(b) { this.busy = b; this.btn.classList.toggle('stop', b); this.btn.innerHTML = ic(b ? 'stop' : 'send'); this.btn.title = b ? this.L.stop : this.L.send; }
    submit() {
      const t = this.ta.value.trim(); if (!t || this.busy) return;
      this.ta.value = ''; this.ta.style.height = 'auto'; this._userMsg(t); this.client.send(t);
    }
    _wire() {
      const c = this.client;
      c.on('status', e => this._status(e.status));
      c.on('ready', m => { const n = m.character && m.character.name; if (n && n !== this.who) { this.who = n; this.el.querySelector('.ga-who b').textContent = n; this.el.querySelectorAll('.ga-head .ga-ava').forEach(a => { if (!a.querySelector('img')) a.textContent = n.slice(0, 1); }); this.ta.placeholder = tpl(this.o.placeholder || this.L.placeholder, { who: n }); } });
      c.on('turn_start', () => {
        this._setBusy(true);
        const msg = this._charMsg();
        const wf = new WorkflowView({ labels: this.o.labels, who: this.who, autoCollapse: this.o.autoCollapse !== false,
          onApprove: (id, a, r) => c.approve(id, a, r), onChange: () => this._scroll() });
        msg.c.insertBefore(wf.el, msg.bubble);
        this.cur = { ...msg, wf, roundText: '' };
        msg.bubble.classList.add('typing');
      });
      const fwd = m => { if (this.cur) this.cur.wf.feed(m); };
      ['step_start', 'think_delta', 'step_end', 'tool_start', 'approval_required', 'approval_resolved', 'tool_end'].forEach(t => c.on(t, fwd));
      c.on('round_start', () => { if (this.cur) { this.cur.roundText = ''; this.cur.bubble.innerHTML = ''; } });
      c.on('say_delta', m => { if (!this.cur) return; this.cur.roundText += m.text; this.cur.bubble.innerHTML = mdLite(this.cur.roundText); this._scroll(); });
      c.on('round_end', m => {
        if (!this.cur) return;
        if (m.tool_calls > 0 && this.cur.roundText.trim()) {   // 中途的台词收进工作流程（作为旁白）
          this.cur.wf.feed({ type: 'narration', text: this.cur.roundText.trim() });
          this.cur.roundText = ''; this.cur.bubble.innerHTML = '';
        }
      });
      c.on('emotion', m => { this.o.onEmotion && this.o.onEmotion(m.name); });
      c.on('turn_end', m => {
        this._setBusy(false);
        const cur = this.cur; this.cur = null; if (!cur) return;
        cur.wf.feed(m);
        cur.bubble.classList.remove('typing');
        const text = m.reply || cur.roundText;
        if (text) cur.bubble.innerHTML = mdLite(text);
        else if (m.stopped) cur.bubble.innerHTML = '<span style="opacity:.6">（被打断了）</span>';
        if (cur.wf.empty) cur.wf.destroy();
        this.o.onTurnEnd && this.o.onTurnEnd(m);
        this._scroll(); this.ta.focus();
      });
      c.on('error', m => { if (!m.fatal) this._sys(m.message, true); });
      c.on('reset_done', () => { });
      c.on('close', () => this._status('offline'));
    }
    destroy() { this.client.close(); this.el.remove(); }
  }

  /* ---------------------------------------------------------------- galgame 画面里的工作流程：胶囊 + 铺满画面的面板 */
  // 胶囊（默认折叠）只显示当前进度；点开后面板从胶囊位置平滑展开到整个画面，列出各轮工作流程，每一步可再展开。
  class WorkDock {
    /** stage: 画面容器（position:relative/absolute）
     *  opts: { pillParent, placePill(pillEl), labels, who, onApprove(id, allow, remember), autoOpenOnAsk:true, onSay(text) } */
    constructor(stage, opts = {}) {
      injectCss();
      this.stage = stage; this.o = Object.assign({ autoOpenOnAsk: true }, opts);
      this.L = Object.assign({}, LABELS, opts.labels || {});
      this.pill = el('button', 'ga-pill'); this.pill.type = 'button';
      (opts.pillParent || stage).appendChild(this.pill);
      this.panel = el('div', 'ga-panel', `<div class="ga-panel-in"><div class="ga-panel-head">${ic('flow')}<b>工作流程</b><span class="ga-panel-st"></span><button class="ga-hbtn ga-panel-x" title="收起">${ic('x')}</button></div><div class="ga-panel-body"></div></div>`);
      stage.appendChild(this.panel);
      this.body = this.panel.querySelector('.ga-panel-body');
      this.pill.addEventListener('click', e => { e.stopPropagation(); this.open(); });
      this.panel.addEventListener('click', e => e.stopPropagation());
      this.panel.addEventListener('pointerdown', e => e.stopPropagation());
      this.panel.querySelector('.ga-panel-x').addEventListener('click', () => this.close());
      this._key = e => { if (e.key === 'Escape' && this.isOpen) { e.stopPropagation(); this.close(); } };
      document.addEventListener('keydown', this._key, true);
      this.turnN = 0; this.cur = null; this.last = null;
      this._tick = setInterval(() => { if (this.cur) this._pill(); }, 250);
    }
    get isOpen() { return this.panel.classList.contains('open'); }
    _rect() {
      const s = this.stage.getBoundingClientRect(), k = (s.width / this.stage.offsetWidth) || 1;
      let p = this.pill.getBoundingClientRect();
      if (!p.width) p = { top: s.bottom - 40 * k, bottom: s.bottom - 20 * k, left: s.left + 40 * k, right: s.left + 200 * k };
      const W = this.stage.offsetWidth, H = this.stage.offsetHeight;
      const v = { t: (p.top - s.top) / k, l: (p.left - s.left) / k, r: W - (p.right - s.left) / k, b: H - (p.bottom - s.top) / k };
      for (const [n, x] of Object.entries(v)) this.panel.style.setProperty('--' + n, Math.max(0, x) + 'px');
    }
    open() {
      this._rect(); void this.panel.offsetWidth;
      this.panel.classList.add('open');
      setTimeout(() => { this.body.scrollTop = this.body.scrollHeight; }, 60);
    }
    close() { this._rect(); this.panel.classList.remove('open'); }
    _pill() {
      const c = this.cur, p = this.pill;
      if (c) {
        const t = fmtMs(now() - c.t0);
        p.className = 'ga-pill show ' + (c.wait ? 'wait' : 'run');
        p.innerHTML = `${c.wait ? ic('shield') : ic('spin', 'spin')}<span>${esc(c.label)}</span><span class="t">${t}</span>`;
        this.panel.querySelector('.ga-panel-st').textContent = c.label + ' · ' + t;
      } else if (this.last) {
        const l = this.last;
        p.className = 'ga-pill show done' + (l.state === 'error' ? ' bad' : '');
        p.innerHTML = `${ic(l.state === 'done' ? 'check' : 'x')}<span>${esc(l.title)}</span>`;
        this.panel.querySelector('.ga-panel-st').textContent = l.title;
      } else p.className = 'ga-pill';
      if (this.o.placePill) this.o.placePill(p);
    }
    feed(m) {
      const c = this.cur;
      switch (m.type) {
        case 'turn_start': {
          if (this.last && this.last.wf) this.last.wf.toggle(false);
          const wf = new WorkflowView({ labels: this.o.labels, who: this.o.who, autoCollapse: false, onApprove: this.o.onApprove });
          const inp = el('span', 'ga-turn-in', esc(`第 ${++this.turnN} 轮 · ${short(m.input || '', 24)}`));
          wf.head.insertBefore(inp, wf.head.querySelector('.ga-work-title'));
          this.body.appendChild(wf.el);
          this.cur = { wf, t0: now(), label: this.L.thinking, wait: false, roundText: '' };
          break;
        }
        case 'round_start': if (c) c.roundText = ''; break;
        case 'say_delta': if (c) { c.roundText += m.text; c.label = '说话中…'; } break;
        case 'round_end':
          if (c && m.tool_calls > 0 && c.roundText.trim()) { c.wf.feed({ type: 'narration', text: c.roundText.trim() }); this.o.onSay && this.o.onSay(c.roundText.trim()); c.roundText = ''; }
          break;
        case 'step_start': if (c) { c.wf.feed(m); c.label = this.L.thinking; } break;
        case 'think_delta': if (c) c.wf.feed(m); break;
        case 'step_end': if (c) { c.wf.feed(m); c.label = '整理思路…'; } break;
        case 'tool_start': if (c) { c.wf.feed(m); c.label = '调用 ' + m.name + '…'; } break;
        case 'approval_required': if (c) { c.wf.feed(m); c.wait = true; c.label = this.L.waiting + '：' + m.name; if (this.o.autoOpenOnAsk && !this.isOpen) { this._pill(); this.open(); } } break;
        case 'approval_resolved': if (c) { c.wf.feed(m); c.wait = false; c.label = '调用 ' + m.name + '…'; } break;
        case 'tool_end': if (c) { c.wf.feed(m); c.label = '查看结果…'; } break;
        case 'turn_end': {
          if (!c) break;
          c.wf.feed(m); this.cur = null;
          if (c.wf.empty) { c.wf.destroy(); }
          else this.last = { wf: c.wf, state: c.wf.state, title: c.wf.head.querySelector('.ga-work-title').textContent };
          break;
        }
      }
      this._pill();
    }
    destroy() { clearInterval(this._tick); document.removeEventListener('keydown', this._key, true); this.pill.remove(); this.panel.remove(); }
  }

  /* ---------------------------------------------------------------- 完整 galgame 式结局后聊天画面（galLingS /galagent 页用） */
  class GalStage {
    /** opts: Client 的参数 + { mock, bg, sprite: url | {表情: url}, greeting, labels, onClose } */
    constructor(container, opts = {}) {
      injectCss();
      this.o = opts; this.who = (opts.character && opts.character.name) || '她';
      this.client = opts.client || (opts.mock ? new MockClient(opts) : new Client(opts));
      this.wrap = el('div', 'gs-wrap');
      this.st = el('div', 'gs-stage');
      this.st.innerHTML = `<div class="gs-bg"></div><div class="gs-layer"></div>
        <div class="gs-in"><input placeholder="${esc(tpl(LABELS.placeholder, { who: this.who }))}" autocomplete="off" spellcheck="false"><button class="gs-btn gs-send" title="发送">${ic('send')}</button></div>
        <div class="gs-dlg"><div class="gs-name"></div><div class="gs-text"></div>
          <div class="gs-ctl"><button class="gs-btn" data-c="log" title="回看">${ic('flow')}</button><button class="gs-btn" data-c="reset" title="清空记忆">${ic('reset')}</button>${opts.onClose ? `<button class="gs-btn" data-c="close" title="关闭">${ic('x')}</button>` : ''}</div></div>
        <div class="gs-log"><div class="gs-log-in"></div></div>`;
      this.wrap.appendChild(this.st); container.appendChild(this.wrap);
      const q = s => this.st.querySelector(s);
      this.bg = q('.gs-bg'); this.layer = q('.gs-layer'); this.nameEl = q('.gs-name'); this.textEl = q('.gs-text');
      this.inp = q('.gs-in input'); this.btn = q('.gs-send'); this.logEl = q('.gs-log'); this.logIn = q('.gs-log-in');
      if (opts.bg) this.bg.style.backgroundImage = `url("${opts.bg}")`;
      this.spr = el('div', 'gs-spr'); this.layer.appendChild(this.spr); this._sprite('');
      this.dock = new WorkDock(this.st, { pillParent: q('.gs-dlg'), who: this.who, labels: opts.labels,
        onApprove: (id, a, r) => this.client.approve(id, a, r), onSay: t => this._show(this.who, t),
        placePill: p => { const n = this.nameEl; p.style.left = (n.offsetLeft + n.offsetWidth + 14) + 'px'; } });
      this.backlog = []; this.busy = false;
      this.inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.submit(); } e.stopPropagation(); });
      this.btn.addEventListener('click', e => { e.stopPropagation(); this.busy ? this.client.stop() : this.submit(); });
      this.st.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation(); const c = b.dataset.c;
        if (c === 'log') this._log(true); else if (c === 'close') opts.onClose(); else { this.client.reset(); this.backlog = []; this._show(this.who, '……嗯，我们重新开始吧。'); }
      }));
      this.logEl.addEventListener('click', () => this._log(false));
      this._fit = () => { const w = this.wrap.clientWidth, h = this.wrap.clientHeight, k = Math.min(w / 1280, h / 720) || 1; this.st.style.transform = `translate(${(w - 1280 * k) / 2}px,${(h - 720 * k) / 2}px) scale(${k})`; };
      if (root.ResizeObserver) new ResizeObserver(this._fit).observe(this.wrap); else root.addEventListener('resize', this._fit);
      this._fit();
      this._wire();
      this._show(this.who, opts.greeting || '……');
      this.client.connect().then(() => this.inp.focus()).catch(e => this._show('', '（连接失败：' + e.message + '）'));
    }
    _sprite(emo) {
      const s = this.o.sprite;
      const url = typeof s === 'string' ? s.replace('{expr}', emo || '默认') : (s && (s[emo] || s['默认'] || Object.values(s)[0]));
      if (url) { this.spr.className = 'gs-spr img'; this.spr.innerHTML = `<img src="${esc(url)}" alt="">`; }
      else { this.spr.className = 'gs-spr sil'; this.spr.innerHTML = `<div class="h"></div><div class="b"></div><span>${esc(this.who)}</span>`; }
      this.spr.classList.remove('pop'); void this.spr.offsetWidth; if (emo) this.spr.classList.add('pop');
    }
    _show(name, text) { this.nameEl.textContent = name || ''; this.nameEl.style.display = name ? '' : 'none'; this.textEl.textContent = text; if (this.dock) this.dock._pill(); }
    _log(open) {
      if (open) this.logIn.innerHTML = this.backlog.map(b => `<div class="gs-log-row"><b>${esc(b.s)}</b><span>${esc(b.t)}</span></div>`).join('') || '<div class="gs-log-row"><span>还没有对话</span></div>';
      this.logEl.classList.toggle('show', open); if (open) this.logEl.scrollTop = this.logEl.scrollHeight;
    }
    _busy(b) { this.busy = b; this.btn.classList.toggle('stop', b); this.btn.innerHTML = ic(b ? 'stop' : 'send'); this.inp.disabled = b; }
    submit() {
      const t = this.inp.value.trim(); if (!t || this.busy) return;
      this.inp.value = ''; this.backlog.push({ s: '你', t }); this.client.send(t);
    }
    _wire() {
      const c = this.client; let text = '', fresh = false;
      c.on('ready', m => { const n = m.character && m.character.name; if (n && n !== this.who) { this.who = n; this.dock.o.who = n; this.inp.placeholder = tpl(LABELS.placeholder, { who: n }); if (!this.o.sprite) this._sprite(''); if (this.nameEl.textContent) this.nameEl.textContent = n; } });
      ['turn_start', 'round_start', 'round_end', 'step_start', 'think_delta', 'step_end', 'tool_start', 'approval_required', 'approval_resolved', 'tool_end'].forEach(t => c.on(t, m => this.dock.feed(m)));
      c.on('turn_start', () => { this._busy(true); text = ''; this._show(this.who, '……'); });
      c.on('round_start', () => { text = ''; fresh = true; });
      c.on('say_delta', m => { this.dock.feed(m); text += m.text; fresh = false; this._show(this.who, text.replace(/\*\*([^*\n]+)\*\*/g, '$1')); });
      c.on('emotion', m => this._sprite(m.name));
      c.on('turn_end', m => {
        this.dock.feed(m); this._busy(false);
        const r = String(m.reply || text || (m.stopped ? '（被打断了）' : '……')).replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/`([^`\n]+)`/g, '$1');
        this._show(this.who, r); this.backlog.push({ s: this.who, t: r }); this.inp.focus();
      });
      c.on('error', m => { if (!m.fatal) this._show(this.who, '（' + m.message + '）'); });
    }
    destroy() { this.dock.destroy(); this.client.close(); this.wrap.remove(); }
  }

  function mount(container, opts) { return new ChatView(container, opts); }

  root.GalAgent = { PROTOCOL, version: '0.3.0', Client, MockClient, WorkflowView, ChatView, WorkDock, GalStage, mount, registerToolRenderer, registerToolTitle, LABELS, fmtMs, _ic: ic };
})(typeof window !== 'undefined' ? window : globalThis);
    /* ==== GALAGENT-UI END ==== */
    window.GalAgent.__vnplug = true;
    return window.GalAgent;
  }
  /* ================================================================ VN Studio 插件部分 */
  const KEY_EVENTS = ['turn_start', 'round_start', 'say_delta', 'round_end', 'step_start', 'think_delta', 'step_end', 'tool_start', 'approval_required', 'approval_resolved', 'tool_end'];
  const plain = s => String(s || '').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/`([^`\n]+)`/g, '$1');

  VNPlugin.define({
    id: 'gallings.galagent',
    name: 'GalAgent',
    version: '0.3.0',
    api: 1,
    author: 'galLingS',
    icon: 'bot',
    homepage: 'https://github.com/Liyang1145/galLingS',
    description: '结局后和角色继续聊天；剧情里的 @agent 也能让角色调用工具帮你做事。思考和工具步骤收在名字牌旁的胶囊里，点开铺满画面。',
    permissions: ['network', 'agent', 'script', 'vars', 'tools'],
    settings: [
      { key: 'url', label: '后端地址', type: 'text', placeholder: '留空 = 离线模拟；ws://127.0.0.1:8765/ws/post_ending', help: '在 galLingS 作品页里玩时留空即可，自动连同一个 galLingS。' },
      { key: 'token', label: '令牌', type: 'password', local: true, placeholder: '双击打开（file://）时必填', help: '见 galLingS 启动日志或 ~/.gallings/post_ending_token.txt。只存在这台电脑上。' },
      { key: 'char', label: '结局后聊天', type: 'char', allowEmpty: '（自动：@postchat 或手账角色）', default: '' },
      { key: 'tools', label: '后端工具', type: 'bool', default: true, help: '允许角色用 powershell、读写文件等（危险操作仍会先问你）。' },
      { key: 'autoAsk', label: '确认时展开', type: 'bool', default: true, help: '角色要做需要你确认的事时，自动展开工作流程面板。' },
    ],
    actions: [{ id: 'dev', label: '调试台', icon: 'stethoscope', when: 'editor', run: vn => openDev(vn) }],

    setup(vn) {
      const GA = loadLib();
      const S = k => vn.settings.get(k);
      const defUrl = () => vn.engine.hosted ? (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws/post_ending' : '';
      const url = () => {
        let u = String(S('url') || '').trim() || defUrl(); if (!u) return '';
        const card = vn.project.soul()?.card; if (card && !/[?&]card=/.test(u)) u += (u.includes('?') ? '&' : '?') + 'card=' + encodeURIComponent(card);
        return u;
      };
      const charInfo = name => { const c = vn.chars.get(name) || { name, persona: '' }; return { name: c.name, persona: c.persona, expressions: vn.chars.expressions(name), avatar: vn.chars.avatar(name) }; };

      /* —— 前端工具：在玩家浏览器里执行。别的插件可以 vn.require('gallings.galagent').addClientTool({...}) 再加 —— */
      const clientTools = [
        { name: 'get_vars', effect: 'read', description: '读取当前所有游戏变量的值', parameters: { type: 'object', properties: {} }, handler: () => vn.vars.all() },
        { name: 'set_var', effect: 'perform', description: '修改一个游戏变量（只能改项目里定义过的变量），例如好感度',
          parameters: { type: 'object', required: ['name', 'value'], properties: { name: { type: 'string' }, value: { description: '新值，数字或文字' } } },
          handler: ({ name, value }) => ({ [name]: vn.vars.set(name, value) }) },
        { name: 'play_se', effect: 'perform', description: '播放一个音效素材（给玩家一点小惊喜）',
          parameters: { type: 'object', required: ['name'], properties: { name: { type: 'string', description: '音效名字' } } },
          handler: ({ name }) => { try { vn.audio.se(name); } catch (e) { throw new Error('没有这个音效，可用：' + vn.audio.list().join('、')); } return { played: name }; } },
      ];
      let dock = null;
      const newClient = o => {
        const opts = Object.assign({ url: url(), token: S('token'), clientTools }, o);
        return !opts.url || opts.mock ? new GA.MockClient(opts) : new GA.Client(opts);
      };
      Object.assign(vn.exports, {
        GalAgent: GA, clientTools, newClient, charInfo,
        addClientTool(t) { clientTools.push(t); return () => { const i = clientTools.indexOf(t); if (i >= 0) clientTools.splice(i, 1); }; },
        get dock() { return dock; },
      });

      /* —— 胶囊 + 工作流程面板：挂在 VN Studio 自己的对话框上 —— */
      const ensureDock = who => {
        if (!dock) dock = new GA.WorkDock(vn.ui.stage, {
          pillParent: vn.ui.el('dialog'), who, autoOpenOnAsk: S('autoAsk') !== false,
          onApprove: (id, a, r) => vn.chat.current?._ga?.client.approve(id, a, r),
          onSay: t => { const c = vn.chat.current; if (c && c.busy) vn.ui.el('text').textContent = plain(t); },   // 中途台词先显示在对话框
          placePill: p => { const n = vn.ui.el('name'); p.style.left = (n.textContent ? n.offsetLeft + n.offsetWidth + 14 : 28) + 'px'; },
        });
        dock.o.who = who; return dock;
      };
      const closeChat = chat => {
        if (chat && chat._ga) { chat._ga.client.close(); chat._ga = null; }
        if (dock) { dock.destroy(); dock = null; }
      };
      vn.on('chat:end', closeChat);
      vn.on('stop', () => closeChat(vn.chat.current));

      /* —— 大脑 galagent：剧情 @agent（设置里选 GalAgent）和结局后聊天都走它 —— */
      vn.agent.register('galagent', 'GalAgent', async (req, settings, C) => {
        const who = req.character.name;
        if (!C) throw new Error('没有对话');
        if (!C._ga) {
          const ctx = C.post ? C.ctx : { goal: req.scene.goal, story: req.scene.setup, vars: req.vars };
          const client = newClient({ character: charInfo(who), context: ctx, server_tools: C.serverTools ?? (S('tools') !== false) });
          C._ga = { client }; ensureDock(who);
          KEY_EVENTS.forEach(t => client.on(t, m => { if (vn.chat.current === C && dock) dock.feed(m); }));
          await client.connect();
        }
        const client = C._ga.client;
        return new Promise(resolve => {
          let emo = '', said = '';
          const finish = m => {
            offs.forEach(f => f()); if (dock) dock.feed(m);
            resolve({ text: plain(m.reply || m.error || said || (m.stopped ? '（被打断了）' : '……')), emotion: emo, set: '', end: false });
          };
          const offs = [
            client.on('say_delta', m => { said += m.text; }),
            client.on('round_start', () => { said = ''; }),
            client.on('emotion', m => { emo = m.name; vn.chars.setEmotion(who, m.name); }),
            client.on('error', m => { if (m.fatal) finish({ type: 'turn_end', error: m.message }); else said = said || '（' + m.message + '）'; }),
            client.on('close', () => finish({ type: 'turn_end', error: '连接已断开，请退出聊天后重试。' })),
            client.on('turn_end', finish),
          ];
          if (client.ready) client.send(req.input);
          else finish({ type: 'turn_end', error: '连接已断开，请退出聊天后重试。' });
        });
      });

      /* —— 剧本命令 @postchat 角色 [auto=on] [tools=off] goal=聊天方向；@postchat off —— */
      vn.script.command('postchat', {
        parse(arg, { kv, err }) {
          const gi = arg.indexOf('goal='), head = gi >= 0 ? arg.slice(0, gi) : arg, o = kv(head), ch = head.trim().split(/\s+/)[0];
          if (!ch) err('写法：@postchat 角色 [auto=on] [tools=off] goal=聊天方向；@postchat off 关闭');
          const d = vn.data.get();
          d.postChat = ch === 'off' || ch === 'none' ? { off: true } : { char: ch, auto: o.auto === 'on', tools: o.tools !== 'off', goal: gi >= 0 ? arg.slice(gi + 5).trim() : '' };
          vn.data.set(d);
        },
        export() {
          const pc = vn.data.get().postChat; if (!pc) return null;
          if (pc.off) return '@postchat off';
          return `@postchat ${pc.char}` + (pc.auto ? ' auto=on' : '') + (pc.tools === false ? ' tools=off' : '') + (pc.goal ? ' goal=' + pc.goal : '');
        },
      });
      vn.api.op('postchat', c => {
        const d = vn.data.get();
        d.postChat = !c.char || c.char === 'off' ? { off: true } : { char: String(c.char), auto: !!c.auto && c.auto !== 'off', tools: c.tools !== false && c.tools !== 'off', goal: String(c.goal || ''), greeting: String(c.greeting || '') };
        vn.data.set(d); return d.postChat;
      });
      vn.check(() => {
        const pc = postCfg(); const out = [];
        if (pc.char && !vn.chars.get(pc.char)) out.push([0, 'GalAgent：结局后聊天的角色不存在：' + pc.char]);
        return out;
      });

      /* —— 结局后聊天：结局卡“和 X 聊聊”→ 回到画面，用对话框继续聊（不限回合；⏹ 回结局卡） —— */
      function postCfg() {
        const pc = vn.data.get().postChat || {};
        if (pc.off) return {};
        const char = S('char') || pc.char || vn.project.soul()?.char || '';
        return Object.assign({ tools: true }, pc, { char });
      }
      function openPostChat(ending) {
        const pc = postCfg(); if (!pc.char) return;
        vn.ui.endingCard.hide();
        vn.chat.start({
          char: pc.char, goal: pc.goal || '', provider: 'galagent', turns: 9999,
          greeting: pc.greeting || '……', placeholder: `说点什么，或者请${pc.char}帮你做点事…`,
          onExit: () => { vn.ui.el('input').placeholder = ''; vn.ui.endingCard.show(); },
          extra: { post: true, endingName: ending, serverTools: pc.tools !== false && S('tools') !== false,
            ctx: { ending, goal: pc.goal || '', vars: vn.vars.all(), story: vn.story.backlog(12).map(b => (b.speaker ? b.speaker + '：' : '') + b.text).join('\n') } },
        });
      }
      vn.ui.addEndingButton({ primary: true, icon: 'message-square-text', label: () => `和${postCfg().char}聊聊`, show: () => !!postCfg().char, onClick: openPostChat });
      vn.on('ending', ({ name }) => {
        const pc = postCfg();
        if (pc.char && pc.auto) setTimeout(() => { if (vn.ui.el('endcard').classList.contains('show')) openPostChat(name); }, 1200);
      });
      vn.exports.openPostChat = openPostChat;

      return () => {   // 停用 / 卸载：收干净
        closeChat(vn.chat.current);
        document.getElementById('galagent-css')?.remove();
        document.getElementById('gaDev')?.remove();
        if (window.GalAgent === GA) delete window.GalAgent;
      };
    },
  });

  /* —— 调试台（编辑器）：不跑剧情直接和角色聊，看后端给了哪些工具 —— */
  function openDev(vn) {
    const X = vn.exports, GA = X.GalAgent;
    let ov = document.getElementById('gaDev'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'gaDev';
    const chars = vn.project.chars().map(c => c.name), esc = vn.ui.esc;
    const pcChar = vn.settings.get('char') || vn.data.get().postChat?.char || vn.project.soul()?.char || '';
    if (!document.getElementById('gaDevCss')) { const st = document.createElement('style'); st.id = 'gaDevCss'; st.textContent = DEV_CSS; document.head.appendChild(st); }
    ov.innerHTML = `<div class="gd-side"><h3>${vn.ui.icon('bot')} GalAgent 调试台</h3>
      <label>角色<select data-g="char">${(chars.length ? chars : ['（先在“角色”里加角色）']).map(n => `<option ${n === pcChar ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>结局名（上下文）<input data-g="ending" placeholder="例如：真结局"></label>
      <label>聊天方向<input data-g="goal" value="${esc(vn.data.get().postChat?.goal || '')}"></label>
      <label>后端地址（留空 = 离线模拟）<input data-g="url" value="${esc(vn.settings.get('url') || '')}" placeholder="ws://127.0.0.1:8765/ws/post_ending"></label>
      <label>令牌<input data-g="token" type="password" value="${esc(vn.settings.get('token') || '')}"></label>
      <label class="gd-ck"><input type="checkbox" data-g="tools" ${vn.settings.get('tools') === false ? '' : 'checked'}> 允许后端工具（powershell 等）</label>
      <div class="gd-btns"><button data-g="go" class="pri">开始聊天</button><button data-g="close">关闭</button></div>
      <div class="gd-tools"></div></div><div class="gd-main"></div>`;
    document.body.appendChild(ov);
    const q = k => ov.querySelector(`[data-g=${k}]`);
    let view = null;
    q('close').onclick = () => { if (view) view.destroy(); ov.remove(); };
    q('go').onclick = () => {
      vn.settings.set('url', q('url').value.trim()); vn.settings.set('token', q('token').value.trim());
      if (view) view.destroy();
      const name = q('char').value, main = ov.querySelector('.gd-main'); main.innerHTML = '';
      const client = X.newClient({ character: X.charInfo(name), server_tools: q('tools').checked, context: { ending: q('ending').value.trim(), goal: q('goal').value.trim(), vars: vn.vars.all() } });
      client.on('ready', m => { ov.querySelector('.gd-tools').innerHTML = '<b>可用工具</b>' + (m.tools || []).map(t => `<div><code>${esc(t.name)}</code> <small>${esc(t.source)} · ${esc(t.policy)}</small></div>`).join('') + (client instanceof GA.MockClient ? '<p>（离线模拟中）</p>' : ''); });
      view = GA.mount(main, { client, character: X.charInfo(name), greeting: '', onEmotion: e => { ov.querySelector('.gd-tools').insertAdjacentHTML('beforeend', `<div>表情 → ${esc(e)}</div>`); } });
    };
  }
  const DEV_CSS = `#gaDev{position:fixed;inset:0;z-index:1000;background:#05070d;display:flex;gap:16px;padding:20px;box-sizing:border-box;color:#eef3ff;font-size:14px}
#gaDev .gd-side{width:290px;display:flex;flex-direction:column;gap:10px;overflow-y:auto}
#gaDev h3{margin:0 0 4px;display:flex;align-items:center;gap:8px}
#gaDev label{display:flex;flex-direction:column;gap:4px;color:#9aa6c2;font-size:12px}
#gaDev label.gd-ck{flex-direction:row;align-items:center;gap:6px;color:#eef3ff}
#gaDev input:not([type=checkbox]),#gaDev select{background:#0d1220;border:1px solid #ffffff30;border-radius:8px;color:#fff;padding:7px 9px;font:inherit}
#gaDev .gd-btns{display:flex;gap:8px}
#gaDev button{border:1px solid #ffffff30;background:#ffffff10;color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font:inherit}
#gaDev button.pri{background:var(--acc,#8fd3ff);color:#0b1020;border-color:transparent;font-weight:600}
#gaDev .gd-tools{font-size:12px;color:#9aa6c2;line-height:1.8}#gaDev .gd-tools code{color:#eef3ff}
#gaDev .gd-main{flex:1;min-width:0}`;
})();
