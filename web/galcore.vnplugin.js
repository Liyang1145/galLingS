/* galcore 引擎桥 · VN Studio 插件（vn-plugin/1）
 *
 * 一个游戏（PLAN §3、§16.1）：剧情由 galLingS 的 Rust 引擎 galcore 跑，作品自己的播放器只负责画面。
 *   - 服务器把同一份作品（game.js）经导入器 compiler/vnstudio.py 变成 OP 程序；每句 SAY 带原句 ID。
 *   - 这里拦下作品的“下一句 / 选项 / 结局”，改问引擎（/ws），再按引擎给的句子 ID 让作品渲染。
 *   - 好感、尾鳍、变量、条件跳转都由引擎裁决；作品算的值只用于对照，不一致时以引擎为准并在控制台记一笔。
 *   - AI 模式：选项点出现“自己说”，打字交给引擎导演（守卫、好感预算、记忆都生效），说中某个选项就照那条走。
 * 存读档：作品存档时顺带存一份引擎快照；读这样的存档时引擎从同一刻接着跑（新时间线，PLAN §13.3）。
 *   没带快照的旧存档、从不是章节开头的地方开始的局，暂由作品自身运行（控制台注明）。
 * 只在 galLingS 作品页托管、且服务器当前游戏就是这部作品时接管。
 * 重播（录制回放演示模式，PLAN §2.1、§20）：连 /ws/replay?log=<局>&speed=<倍速>，服务器按录制节奏下发同样的 ops；
 *   这里照 ops 让作品渲染，玩家点击 / 选项 / 输入都不生效，选项按录制自动选中并短暂高亮，AI 即兴台词原样出现在对话框里。
 *   入口：作品标题画面“重播录像”、外框顶栏“重播”（postMessage galcore-replay），或作品页 ?replay=<局>&speed=2。
 */
(() => {
  'use strict';
  VNPlugin.define({
    id: 'gallings.galcore',
    name: 'galcore 引擎',
    version: '0.1.0',
    api: 1,
    author: 'galLingS',
    icon: 'cpu',
    description: '剧情交给 galLingS 引擎运行：存档回放、好感预算、守卫与 AI 演绎都生效。',
    settings: [
      { key: 'mode', label: '模式', type: 'select', options: [['choice', '纯选项'], ['ai', 'AI 模式（可以自己说）']], default: 'choice' },
      { key: 'replay_log', label: '重播哪一局', type: 'text', default: '', placeholder: '留空 = 最近录下的一局（局 id 见作品页“重播”）' },
      { key: 'replay_speed', label: '重播倍速', type: 'select', options: [['0.5', '0.5×'], ['1', '1×（原节奏）'], ['2', '2×'], ['4', '4×']], default: '1' },
    ],
    setup(vn) {
      if (!vn.engine.hosted) return;
      const g = window;
      const orig = { startPlay: g.startPlay, goNext: g.goNext, choose: g.choose, showEnding: g.showEnding, idbSet: g.idbSet };
      if (typeof orig.goNext !== 'function' || typeof orig.choose !== 'function') return;

      const B = { ws: null, on: false, busy: false, waiters: [], state: null, heroine: '', inputOpen: false, forced: null, snap: null };
      const idxOf = id => P.lines.findIndex(l => l.id === id);
      const log = (...a) => console.info('[galcore]', ...a);

      // 调试时间轴在外框（web/vn.html）里：引擎消息同源转给它（PLAN §14）
      const toHost = msg => { try { if (window.parent !== window) window.parent.postMessage({ gallings: 'galcore', ...msg }, location.origin); } catch (e) { /* 离线打开 */ } };
      const onHostMsg = ev => {
        if (ev.origin !== location.origin) return;
        const d = ev.data || {};
        if (d.gallings === 'galcore-replay') return startReplay(d.log || '', d.speed || vn.settings.get('replay_speed') || '1', d.from);
        if (d.gallings === 'galcore-replay-ctl') { if (RP.ws?.readyState === 1) RP.ws.send(JSON.stringify(d.msg || {})); return; }
        if (d.gallings === 'galcore-replay-stop') return stopReplay('外框停止重播');
        if (d.gallings !== 'galcore-seek') return;
        if (RP.on && RP.ws) return RP.ws.send(JSON.stringify({ type: 'jump', step: Number(d.step ?? d.seq) }));
        if (!B.on || !B.ws) return;
        B.ws.send(JSON.stringify({ type: 'seek', seq: Number(d.seq) }));
      };
      window.addEventListener('message', onHostMsg);

      function detach(why) {
        if (B.on) { log('不再接管：' + why); toHost({ ev: 'detach', why }); }
        B.on = false; B.busy = false;
        try { B.ws?.close(); } catch (e) { /* 已关 */ }
        B.ws = null;
        B.waiters.splice(0).forEach(w => w.reject(new Error(why)));
      }

      // 发一条消息，收齐这一步的 ops（直到出现 SAY / CHOICE / END 或 busy 结束）
      function ask(msg) {
        return new Promise((resolve, reject) => {
          if (!B.on || !B.ws) return reject(new Error('引擎未连接'));
          B.waiters.push({ resolve, reject, ops: [] });
          B.ws.send(JSON.stringify(msg));
        });
      }
      function onOps(ops) {
        const w = B.waiters[0];
        for (const o of ops) {
          if (o.op === 'STATE') { B.state = o; B.inputOpen = !!o.input_open; toHost({ ev: 'state', state: o }); }
          if (w) w.ops.push(o);
        }
        if (w && ops.some(o => o.op === 'SAY' || o.op === 'CHOICE' || o.op === 'END') && !w.streaming) {
          B.waiters.shift(); w.resolve(w.ops);
        }
      }

      // 桌面包 / 离线包：没有 Python 服务，引擎（galcore.wasm）就在页面里跑，消息格式和 /ws 一样（web/offline/）
      const OFFLINE = (() => { try { return !!(window.GALLINGS_OFFLINE || window.parent.GALLINGS_OFFLINE); } catch (e) { return false; } })();
      const loadJs = src => new Promise((ok, no) => {
        if (document.querySelector(`script[data-gl="${src}"]`)) return ok();
        const s = document.createElement('script'); s.src = src; s.dataset.gl = src; s.onload = ok; s.onerror = () => no(new Error('加载失败：' + src));
        document.head.appendChild(s);
      });
      const offlineReady = OFFLINE ? loadJs('/static/offline/galcore-wasm.js').then(() => loadJs('/static/offline/local-session.js')).then(() => window.GalcoreLocal.preload()) : null;
      offlineReady?.catch(e => console.warn('[galcore] 离线引擎不可用：', e));

      function connect(startLine, restore) {
        if (OFFLINE) return offlineReady.then(() => connectNow(startLine, restore));
        return connectNow(startLine, restore);
      }
      function connectNow(startLine, restore) {
        return new Promise((resolve, reject) => {
          detach('新的一局');
          B.snap = null;
          const q = new URLSearchParams({ mode: vn.settings.get('mode') || 'choice', endings: String(Object.keys((loadG(), G).endings || {}).length) });
          if (startLine) q.set('start', startLine.id);
          if (restore) q.set('restore', '1');
          const ws = OFFLINE ? window.GalcoreLocal.open('/ws?' + q)
            : new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?' + q);
          B.ws = ws; B.on = true;
          const first = { resolve, reject, ops: [] };
          B.waiters.push(first);
          let hello = null;
          ws.onmessage = ev => {
            const m = JSON.parse(ev.data);
            if (m.type === 'hello') {
              hello = m;
              if (m.chapter?.id !== P.id) { detach('服务器当前游戏不是这部作品（' + m.chapter?.id + '）'); return reject(new Error('not this game')); }
              B.heroine = (P.settings.soul && P.settings.soul.char) || (P.chars[0] && P.chars[0].name) || '';
              log('已接管，会话 ' + m.session + '，模式 ' + m.mode + (restore ? '（读档）' : ''));
              toHost({ ev: 'session', session: m.session, mode: m.mode, llm: m.llm, card: m.card, restore: !!restore, lines: P.lines.length });
              if (restore) ws.send(JSON.stringify({ type: 'restore', save: restore }));
            } else if (m.type === 'ops') onOps(m.ops);
            else if (m.type === 'timeline') onTimeline(m);
            else if (m.type === 'screen' && m.live === false) {   // 时间轴拖动：只看那一刻，不改当前进度
              const L = m.line_id && P.lines.find(x => x.id === m.line_id);
              toHost({ ev: 'seek', seq: m.seq, replay_ok: m.replay_ok, screen: m.screen, line: L ? lineView(L) : null });
            }
            else if (m.type === 'screen') {           // 读档完成：引擎已回到存档那一刻
              B.state = m.state; B.inputOpen = !!m.state?.input_open;
              const w = B.waiters[0];
              if (w === first) { B.waiters.shift(); w.resolve([]); }
            } else if (m.type === 'snapshot') {
              if (B.snapFor) { B.snap = { lineId: B.snapFor, save: m.save }; B.snapFor = null; }
            }
            else if (m.type === 'busy') {
              const w = B.waiters[0];
              if (w && w.streaming && !m.on) { B.waiters.shift(); w.resolve(w.ops); }
            } else if (m.type === 'error') {
              console.warn('[galcore] 引擎拒绝：', m.message);
              const w = B.waiters.shift(); w?.reject(new Error(m.message));
              if (!hello || w === first) detach(m.message);   // 开局 / 读档就失败：这一局交还作品
            }
          };
          ws.onerror = () => detach('连接出错');
          ws.onclose = () => { if (B.ws === ws) detach('连接已关闭'); };
        });
      }

      function onTimeline(m) {
        const r = m.row, line = (r.out || []).find(o => o.op === 'SAY');
        const id = line && String(line.src || '').replace(/^vn:/, '');
        const L = id && P.lines.find(x => x.id === id);
        if (L) r.chapter = chapterOf(L);
        toHost({ ev: 'row', row: r });
      }

      // 作品算的和引擎算的对一下；不一致以引擎为准
      function syncVars() {
        const s = B.state; if (!s || !RT.vars) return;
        const want = { '好感': s.affection, '尾鳍': s.tails };
        for (const [k, v] of Object.entries(want)) {
          if (k in RT.vars && RT.vars[k] !== v) { console.warn(`[galcore] ${k}：作品 ${RT.vars[k]}，引擎 ${v}，以引擎为准`); RT.vars[k] = v; }
        }
      }
      // 每句上屏后取一份引擎快照备用：作品存档时带走
      function requestSnap() {
        if (!B.on || !B.ws) return;
        B.snap = null; B.snapFor = P.lines[RT.idx]?.id || null;
        B.ws.send(JSON.stringify({ type: 'snapshot' }));
      }
      vn.on('line', () => {
        if (!B.on) return;
        syncVars();
        const l = P.lines[RT.idx];
        // 有选项的句子：引擎要再走一步才停到 CHOICE（读档回来时引擎可能已经停在 CHOICE）
        if (l && visibleChoices(l).length && !B.busy && B.state?.wait !== 'choice') {
          B.busy = true;
          ask({ type: 'advance' }).then(() => { B.busy = false; addSpeakButton(); requestSnap(); }).catch(() => { B.busy = false; });
        } else {
          if (l && visibleChoices(l).length) addSpeakButton();
          requestSnap();
        }
      });
      g.idbSet = function (k, v) {
        // 作品写存档：给刚存的那一格（当前这句、还没带快照）附上引擎快照
        if (B.on && B.snap && k === saveKey() && v && typeof v === 'object') {
          const cur = P.lines[RT.idx]?.id;
          const slot = Object.values(v).filter(s => s && !s.galcore && s.lineId === cur).sort((a, b) => b.time - a.time)[0];
          if (slot && B.snap.lineId === cur) slot.galcore = B.snap.save;
        }
        return orig.idbSet(k, v);
      };

      function lineFrom(ops) {
        const say = [...ops].reverse().find(o => o.op === 'SAY' && o.id);
        return say ? idxOf(say.id) : -1;
      }

      // ---------------------------------------------------------- 接管：开局、下一句、选项、结局
      g.startPlay = function (fromIdx, state) {
        if (RP.on) stopReplay('开始新的一局');
        const at = fromIdx ? P.lines[fromIdx] : null;
        if (state && state.galcore && state.lineId === at?.id) {
          return connect(null, state.galcore).then(() => orig.startPlay(fromIdx, state))
            .catch(() => orig.startPlay(fromIdx, state));
        }
        // 没带引擎快照的存档、或从不是章节开头的地方开始：这一局暂由作品自身运行
        if (state || (fromIdx && !(at && at.chapter))) { detach('读档（无引擎快照）/ 从中间开始'); return orig.startPlay(fromIdx, state); }
        connect(at).then(ops => {
          const i = lineFrom(ops);
          orig.startPlay(i >= 0 ? i : 0, state);
        }).catch(() => orig.startPlay(fromIdx, state));
      };

      g.goNext = function (i) {
        if (RP.on) {                       // 重播：只听录像的，玩家点击 / 自动播放不往下走
          if (B.forced != null) { const f = B.forced; B.forced = null; return orig.goNext(f); }
          return;
        }
        if (!B.on) return orig.goNext(i);
        if (B.forced != null) { const f = B.forced; B.forced = null; return orig.goNext(f); }
        if (B.busy) return;
        B.busy = true;
        ask({ type: 'advance' }).then(ops => {
          B.busy = false;
          const j = lineFrom(ops);
          if (j < 0) { const end = ops.find(o => o.op === 'END'); return end ? orig.goNext(P.lines.length) : null; }
          if (j !== i) console.warn(`[galcore] 下一句：作品 ${i}，引擎 ${j}，以引擎为准`);
          orig.goNext(j);
        }).catch(e => { B.busy = false; detach(e.message); orig.goNext(i); });
      };

      g.choose = function (c, timedOut) {
        if (RP.on) return;                 // 重播：选项由录像自动选中（见 replayPick）
        if (!B.on) return orig.choose(c, timedOut);
        const l = P.lines[RT.idx];
        const id = l.id + '.' + l.choices.indexOf(c);
        if (B.busy) return;
        B.busy = true;
        ask({ type: 'choose', option_id: id }).then(ops => {
          B.busy = false;
          const j = lineFrom(ops);
          if (j >= 0) B.forced = j;
          orig.choose(c, timedOut);
        }).catch(e => { B.busy = false; detach(e.message); orig.choose(c, timedOut); });
      };

      g.showEnding = function (name) {
        if (RP.on) return;                 // 重播：结局由录像里的 END 触发
        if (B.on) ask({ type: 'advance' }).then(() => detach('结局：' + name)).catch(() => {});
        return orig.showEnding(name);
      };

      // ---------------------------------------------------------- AI 模式：选项点自己说
      vn.agent.register('galcore', '引擎导演（galcore）', async req => {
        const said = req.history.filter(h => h.role === 'player').pop()?.text || '';
        const w = { ops: [], streaming: true };
        const ops = await new Promise((resolve, reject) => {
          Object.assign(w, { resolve, reject });
          B.waiters.push(w);
          B.ws.send(JSON.stringify({ type: 'input', text: said }));
        });
        const improvised = ops.filter(o => o.op === 'SAY' && !o.id).map(o => o.text);
        const j = lineFrom(ops);
        if (j >= 0) B.forced = j;          // 说中了某个选项：引擎已照那条走
        const st = B.state || {};
        return { text: improvised.join('\n') || '……', end: j >= 0 || !st.input_open };
      });

      function addSpeakButton() {
        if (!B.on || !B.inputOpen || (vn.settings.get('mode') !== 'ai')) return;
        const box = document.querySelector('#choices');
        if (!box || box.querySelector('.galcore-speak')) return;
        const b = document.createElement('button');
        b.className = 'galcore-speak'; b.textContent = '（自己说）';
        b.onclick = e => {
          e.stopPropagation();
          box.innerHTML = '';
          stopChoiceTimer();
          vn.chat.start({
            char: B.heroine, provider: 'galcore', turns: 99, placeholder: '想对她说什么……',
            onExit: () => {
              if (B.forced != null) { const f = B.forced; B.forced = null; return orig.goNext(f); }
              afterText(P.lines[RT.idx]);   // 回到选项
              addSpeakButton();
              requestSnap();
            },
          });
        };
        box.appendChild(b);
      }

      // ---------------------------------------------------------- 重播（录制回放演示模式）
      const RP = { on: false, ws: null, pick: null, info: null, endT: null, offCss: null };
      const el = n => vn.ui.el(n);
      function stopReplay(why) {
        if (!RP.on) return;
        RP.on = false; RP.pick = null; clearTimeout(RP.endT);
        const ws = RP.ws; RP.ws = null;
        try { ws?.close(); } catch (e) { /* 已关 */ }
        document.body.classList.remove('galcore-replay');
        closeReplayChat(false);
        log('重播结束：' + why);
        toHost({ ev: 'replay', event: 'stopped', why });
      }
      async function startReplay(logId, speed, from) {
        if (OFFLINE) { vn.ui.toast('离线包里没有录像，重播要在 galLingS 服务里用'); return; }
        detach('开始重播');
        stopReplay('换一局重播');
        let id = String(logId || vn.settings.get('replay_log') || '').trim();
        if (!id) {
          try {
            const r = await (await fetch('/api/replays')).json();
            const mine = (r.logs || []).find(x => x.current_chapter) || (r.logs || [])[0];
            id = mine?.id || '';
          } catch (e) { /* 服务不通 */ }
        }
        if (!id) { vn.ui.toast('还没有录下的局：先玩一局（每局都会自动录下）'); return; }
        if (!RP.offCss) RP.offCss = vn.ui.css(`body.galcore-replay #choices button{pointer-events:none}
          body.galcore-replay #choices button.galcore-pick{outline:3px solid #ffd27a;box-shadow:0 0 18px #ffd27a;transform:scale(1.04);transition:all .2s}
          body.galcore-replay #pinput{pointer-events:none;opacity:.85}
          body.galcore-replay #pinEnd{display:none}`);
        const q = new URLSearchParams({ log: id, speed: String(speed || 1) });
        if (from) q.set('from', String(from));
        const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/replay?' + q);
        RP.ws = ws; RP.on = true; RP.pick = null; B.forced = null;
        document.body.classList.add('galcore-replay');
        if (vn.story.playing && typeof g.stopPlay === 'function') g.stopPlay();
        ws.onmessage = ev => { if (RP.ws === ws) onReplayMsg(JSON.parse(ev.data)); };
        ws.onclose = () => { if (RP.ws === ws) { RP.ws = null; toHost({ ev: 'replay', event: 'closed' }); } };
      }
      function onReplayMsg(m) {
        if (m.type === 'hello') {
          if (m.chapter?.id !== P.id) { vn.ui.toast('这一局录的不是这部作品（' + (m.chapter?.title || m.chapter?.id) + '）'); return stopReplay('作品不符'); }
          B.heroine = (P.settings.soul && P.settings.soul.char) || (P.chars[0] && P.chars[0].name) || '';
          RP.info = m.replay;
          log('重播 ' + m.replay.id + '，共 ' + m.replay.steps + ' 步，' + m.replay.speed + '×' + (m.replay.recorded_screen ? '' : '（旧日志：画面按事件重建）'));
          toHost({ ev: 'session', session: m.session, mode: m.mode, llm: false, card: m.card, replay: true, lines: P.lines.length });
          toHost({ ev: 'replay', event: 'start', ...m.replay });
          vn.ui.toast('重播：' + (m.card?.name || '') + ' · ' + m.replay.steps + ' 步 · ' + m.replay.speed + '×');
        } else if (m.type === 'timeline') onTimeline(m);
        else if (m.type === 'ops') replayOps(m.ops);
        else if (m.type === 'screen' && m.replay) {          // 跳到第 N 步
          closeReplayChat(false); RP.pick = null;
          if (m.state) { B.state = m.state; toHost({ ev: 'state', state: m.state }); }
          const j = m.line_id ? idxOf(m.line_id) : -1;
          if (j >= 0) showLine(j);
          toHost({ ev: 'replay', event: 'jumped', at: m.at, seq: m.seq });
        } else if (m.type === 'screen') { if (m.state) B.state = m.state; }   // 录像里的读档
        else if (m.type === 'notice') vn.ui.toast(m.message);
        else if (m.type === 'replay') {
          if (m.event === 'choose') replayPick(m.option_id);
          else if (m.event === 'input') replayInput(m.text);
          else if (m.event === 'diverged') { console.warn('[galcore] 重播分歧：', m); vn.ui.toast('重播停下：' + m.message); }
          else if (m.event === 'done') vn.ui.toast('重播完毕：state_hash 逐条一致');
          if (m.event !== 'ignored') toHost({ ev: 'replay', ...m });
        } else if (m.type === 'error') { vn.ui.toast(m.message); stopReplay(m.message); }
      }
      function showLine(j) {
        if (!vn.story.playing) return orig.startPlay(j);
        if (j === RT.idx && !RP.pick) return;
        B.forced = j;
        if (RP.pick) { const c = RP.pick; RP.pick = null; return orig.choose(c, false); }   // 作品照常结算这个选项，再跳到引擎给的句子
        return g.goNext(j);
      }
      function replayOps(ops) {
        let say = -1, end = null;
        for (const o of ops) {
          if (o.op === 'STATE') { B.state = o; toHost({ ev: 'state', state: o }); }
          else if (o.op === 'SAY' && o.id) { const j = idxOf(o.id); if (j >= 0) say = j; }
          else if (o.op === 'SAY') replaySay(o.text);       // AI 即兴台词：录像里原样的那句
          else if (o.op === 'END') end = o;
        }
        if (say >= 0) { closeReplayChat(false); showLine(say); }
        if (end) {
          clearTimeout(RP.endT);
          RP.endT = setTimeout(() => { if (RP.on) orig.showEnding(P.lines[RT.idx]?.ending || end.ending || ''); }, 1500 / Math.max(0.5, +(RP.info?.speed || 1)));
        }
      }
      function replayPick(optionId) {
        closeReplayChat(true);
        const l = P.lines[RT.idx];
        const k = Number(String(optionId || '').split('.').pop());
        const c = l?.choices?.[k];
        if (!c) return;
        RP.pick = c;
        if (typeof g.stopChoiceTimer === 'function') g.stopChoiceTimer();
        const btn = [...document.querySelectorAll('#choices button')].find(b => b.textContent === (c.text || '…'));
        btn?.classList.add('galcore-pick');
      }
      function replayInput(text) {
        if (!vn.story.playing) return;
        if (!RT.chat) {
          vn.chat.start({ char: B.heroine, provider: 'galcore', turns: 99, placeholder: '（重播中）', greeting: '……',
            onExit: () => { const l = P.lines[RT.idx]; if (l && typeof g.afterText === 'function') g.afterText(l); } });
        }
        const inp = el('input'); if (inp) inp.value = text;
        RT.back.push({ s: '你', t: text });
      }
      function replaySay(text) {
        if (!vn.story.playing) return;
        if (!RT.chat) replayInput('');
        const inp = el('input'); if (inp) inp.value = '';
        const nm = el('name'), tx = el('text');
        if (nm && typeof g.setName === 'function') g.setName(nm, B.heroine); else if (nm) nm.textContent = B.heroine;
        if (typeof g.typeText === 'function') g.typeText(text, () => {}); else if (tx) tx.textContent = text;
        RT.back.push({ s: B.heroine, t: text });
      }
      function closeReplayChat(backToChoices) {
        if (!RT.chat) return;
        RT.chat.ending = true; RT.chat = null;
        el('inputBar')?.classList.remove('show');
        if (backToChoices) { const l = P.lines[RT.idx]; if (l && typeof g.afterText === 'function') g.afterText(l); }
      }
      const offTitle = vn.ui.addTitleButton?.({ label: '重播录像', show: () => !OFFLINE, onClick: () => startReplay('', vn.settings.get('replay_speed') || '1') });
      toHost({ ev: 'replay-ready' });

      function lineView(L) {
        const who = (P.chars || []).find(c => c.id === L.speaker)?.name || L.speaker || '';
        let bg = '';
        try { const a = typeof A === 'function' ? A(L.bg) : null; if (a?.src) bg = new URL(a.src, location.href).href; } catch (e) { /* 无背景 */ }
        return { id: L.id, who, text: L.text || '', bg, chapter: chapterOf(L) };
      }
      function chapterOf(L) {
        let i = P.lines.indexOf(L);
        for (; i >= 0; i--) if (P.lines[i].chapter) return String(P.lines[i].chapter);
        return '';
      }

      return () => {
        window.removeEventListener('message', onHostMsg);
        stopReplay('插件停用');
        if (typeof offTitle === 'function') offTitle();
        detach('插件停用');
        delete B.snapFor;
        Object.assign(g, orig);
      };
    },
  });
})();
