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
        if (ev.origin !== location.origin || ev.data?.gallings !== 'galcore-seek' || !B.on || !B.ws) return;
        B.ws.send(JSON.stringify({ type: 'seek', seq: Number(ev.data.seq) }));
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

      function connect(startLine, restore) {
        return new Promise((resolve, reject) => {
          detach('新的一局');
          B.snap = null;
          const q = new URLSearchParams({ mode: vn.settings.get('mode') || 'choice', endings: String(Object.keys((loadG(), G).endings || {}).length) });
          if (startLine) q.set('start', startLine.id);
          if (restore) q.set('restore', '1');
          const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?' + q);
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
            else if (m.type === 'timeline') {
              const r = m.row, line = (r.out || []).find(o => o.op === 'SAY');
              const id = line && String(line.src || '').replace(/^vn:/, '');
              const L = id && P.lines.find(x => x.id === id);
              if (L) r.chapter = chapterOf(L);
              toHost({ ev: 'row', row: r });
            }
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
        detach('插件停用');
        delete B.snapFor;
        Object.assign(g, orig);
      };
    },
  });
})();
