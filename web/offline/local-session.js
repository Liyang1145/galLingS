/* 离线会话：没有 Python 服务时（桌面包 / 双击打开），在页面里跑 galcore（wasm），说和 /ws 一样的话。
 *
 * 对应 server/session.py（PLAN §3.2、§9）：开局、推进、选项、AI 模式“（自己说）”、引擎快照存读档、调试时间轴回放。
 * 事件日志只在内存里（和服务端同格式），时间轴拖动就是从头回放到那一条，逐条比对 state_hash。
 *
 * 用法和 WebSocket 一样：const ws = GalcoreLocal.open('/ws?mode=choice&start=…'); ws.onmessage = …; ws.send(JSON)
 */
(() => {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || '/static/offline/';
  let bundle = null;   // { gc, chapter, card, chapterJson, cardJson }

  function loadBundle() {
    if (!bundle) {
      bundle = (async () => {
        const gc = await window.GalcoreWasm.load(BASE + 'galcore.wasm');
        const [chapterJson, cardJson] = await Promise.all(['chapter.json', 'card.json'].map(async f => {
          const r = await fetch(BASE + f);
          if (!r.ok) throw new Error('离线包缺少 ' + f);
          return r.text();
        }));
        return { gc, chapterJson, cardJson, chapter: JSON.parse(chapterJson), card: JSON.parse(cardJson) };
      })();
      bundle.catch(() => { bundle = null; });
    }
    return bundle;
  }

  const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  const norm = s => String(s || '').replace(/[\s，。！？、…「」『』（）()—\-~～：:;；,.!?"']+/g, '');

  function getLlm() {
    try { return window.GallingsLLM || (window.top && window.top.GallingsLLM) || null; }
    catch (e) { return window.GallingsLLM || null; }
  }

  function screenFromOps(ops) {
    const sc = { scene: null, bgm: null, sprite: null, say: null, choice: null, state: null, tail: null };
    for (const op of ops) {
      const k = op.op;
      if (k === 'SCENE') sc.scene = op;
      else if (k === 'BGM') sc.bgm = op;
      else if (k === 'SPRITE') sc.sprite = op;
      else if (k === 'SAY') { sc.say = op; sc.choice = null; }
      else if (k === 'CHOICE') sc.choice = op;
      else if (k === 'STATE') sc.state = op;
      else if (k === 'TAIL') sc.tail = op;
      else if (k === 'END') sc.choice = null;
    }
    return sc;
  }

  class Session {
    constructor(q, send, B) {
      this.q = q; this.send = send; this.B = B;
      this.id = hex(6);
      const llm = getLlm();
      const wantMode = q.get('mode') || (llm && llm.getConfig && llm.getConfig().mode) || 'choice';
      this.mode = wantMode === 'ai' ? 'ai' : 'choice';
      this.seed = (crypto.getRandomValues(new Uint32Array(1))[0] % 2147483646) + 1;
      const ch = B.chapter;
      this.config = { mode: this.mode, honesty_gap_rule: false };
      if (ch.vars && ch.vars.length) {
        const vi = {};
        for (const v of ch.vars) if (v.var !== 'affection' && v.var !== 'tails') vi[v.var] = parseInt(v.init, 10) || 0;
        const e = parseInt(q.get('endings') || '0', 10);
        vi['结局数'] = Math.max(0, Number.isFinite(e) ? e : 0);
        this.config.vars_init = vi;
      }
      this.engine = this.newEngine();
      this.header = {
        kind: 'header', log_version: 1, engine_version: B.gc.ENGINE_VERSION, content_hash: ch.content_hash,
        chapter_path: 'offline', card_id: B.card.id, card: B.card, engine_config: this.config, seed: this.seed,
        lineage: 'L0', prompt_version: 'offline', plugins: {}, offline: true,
      };
      this.events = [];
      this.saves = {};
      this.lineageN = 0;
      this.opsLog = [];
      this.choiceOp = null;
      this.recent = [];
    }
    newEngine() {
      return this.B.gc.engine(this.B.chapterJson, this.B.cardJson, JSON.stringify(this.config), this.seed);
    }
    get state() { return JSON.parse(this.engine.state_json()); }

    hello() {
      const ch = this.B.chapter, { card, ...hdr } = this.header;
      const llm = getLlm();
      this.send({ type: 'hello', session: this.id, card: { id: this.B.card.id, name: this.B.card.identity?.name || '' },
        mode: this.mode, llm: Boolean(llm && llm.isReady()), memory: true, offline: true,
        chapter: { id: ch.chapter_id, title: ch.title }, seed: this.seed, header: hdr });
    }

    step(kind, payload = {}, source = 'engine', render = true) {
      const ev = { kind, payload, source };
      const res = JSON.parse(this.engine.step(JSON.stringify(ev)));
      const row = { seq: res.seq, kind, source, payload, verdicts: res.verdicts || [], state_hash: res.state_hash, wall_ms: Date.now() };
      this.events.push(row);
      this.send({ type: 'timeline', row: this.timelineView(row, res) });
      if (render) this.render(res.ops);
      return res;
    }

    timelineView(row, res) {
      let p = { ...row.payload };
      if (row.kind === 'load') p = { slot: p.slot, new_lineage: p.new_lineage };
      const view = { ...row, payload: p };
      if (row.kind === 'choice' && this.choiceOp) {
        const opt = (this.choiceOp.options || []).find(o => o.id === p.option_id);
        if (opt) view.option_text = opt.text || opt.label || '';
      }
      const out = [];
      for (const op of res.ops || []) {
        const k = op.op;
        if (k === 'SAY') out.push({ op: k, speaker: op.speaker, text: String(op.text ?? '').slice(0, 60), src: op.src, origin: op.origin });
        else if (['CHOICE', 'SCENE', 'BGM', 'END', 'TAIL', 'INPUT'].includes(k)) {
          const o = { op: k };
          for (const x of ['id', 'bg', 'track', 'ending', 'kind', 'src']) if (x in op) o[x] = op[x];
          if (k === 'CHOICE') o.n = (op.options || []).length;
          out.push(o);
        }
      }
      view.out = out.slice(0, 12);
      const st = this.state;
      view.state = { affection: st.affection + st.deferred, tails: st.tails_script + st.tails_ai, lineage: st.lineage,
        turn: st.turn, wait: st.wait, mode: st.mode, vars: st.vars || {} };
      return view;
    }

    // 原作卡（台词锁定）不经演绎层：引擎吐什么就上屏什么
    render(ops) {
      if (!ops || !ops.length) return;
      for (const op of ops) {
        if (op.op === 'CHOICE') this.choiceOp = op;
        if (op.op === 'SAY') this.recent.push(op.text);
      }
      this.recent = this.recent.slice(-40);
      this.opsLog.push(...ops);
      this.send({ type: 'ops', ops });
    }

    displayState() {
      const st = this.state;
      return {
        op: 'STATE',
        affection: st.affection + st.deferred,
        tails: st.tails_script + st.tails_ai,
        mood: st.mood,
        mode: st.mode,
        lineage: st.lineage,
        turn: st.turn,
        input_open: st.wait === 'choice' && st.mode === 'ai' && !st.input_closed && !st.forced_choice_scene,
        address_stage: st.address_stage,
        wound: st.wound,
        wait: st.wait,
      };
    }

    exportSave() {
      return { snapshot: this.engine.snapshot(), content_hash: this.B.chapter.content_hash, seq: this.state.seq,
        recent: this.recent.slice(-40), choice_op: this.choiceOp };
    }

    load(slot) {
      const s = this.saves[slot];
      if (!s) return this.send({ type: 'error', message: `槽位 ${slot} 是空的` });
      this.lineageN += 1;
      const snap = JSON.parse(s.snapshot);
      const newLin = `${snap.state.lineage}.${this.lineageN}`;
      this.step('load', { slot, snapshot: snap, new_lineage: newLin }, 'player', false);
      this.recent = [...s.recent];
      this.choiceOp = s.choice_op;
      this.send({ type: 'screen', screen: s.screen, live: true, state: this.displayState() });
    }

    seek(seq) {
      const eng = this.newEngine();
      const ops = [];
      let bad = null;
      try {
        for (const row of this.events) {
          if (row.seq > seq) break;
          const res = JSON.parse(eng.step(JSON.stringify({ kind: row.kind, payload: row.payload })));
          ops.push(...res.ops);
          if (res.state_hash !== row.state_hash && bad == null) bad = row.seq;
        }
      } finally { eng.free(); }
      const sc = screenFromOps(ops);
      const src = String(sc.say?.src || '');
      this.send({ type: 'screen', screen: sc, live: false, seq, replay_ok: bad == null, line_id: src.startsWith('vn:') ? src.slice(3) : null });
    }

    async onInput(rawText) {
      const text = String(rawText || '').trim().slice(0, 200);
      if (!text) return;
      const st = this.state;
      if (st.wait !== 'choice') {
        this.send({ type: 'error', message: '现在不能输入（输入框只在选项点开放）' });
        return;
      }
      const res = this.step('player_input', { text }, 'player', false);
      if (res.verdicts && res.verdicts[0] && res.verdicts[0].result === 'rejected') {
        this.send({ type: 'error', message: res.verdicts[0].reason || '输入被拒绝' });
        return;
      }
      this.recent.push('我：' + text);
      this.send({ type: 'busy', on: true });
      try {
        const options = (this.choiceOp && this.choiceOp.options) || [];
        const defaultLine = (this.choiceOp && this.choiceOp.default_line) || '……';
        // 1. 字面匹配原选项
        const nt = norm(text);
        let matched = null;
        for (const o of options) {
          const nl = norm(o.label || o.text || '');
          if (nl && (nt === nl || (nl.length >= 3 && nt.includes(nl) && nt.length <= nl.length + 4))) {
            matched = { intent: o.nature || '顺着聊', matched_option: o.id, confidence_milli: 950, by: 'literal' };
            break;
          }
        }
        const llm = getLlm();
        let aiReply = '';
        let aiShift = 0;

        if (!matched && llm && llm.isReady()) {
          // 2. 用大模型同时做选项意图归类 + 即兴回应生成
          const optText = options.map(o => `- id="${o.id}": ${o.label || o.text}`).join('\n');
          const recentText = this.recent.slice(-8).join('\n');
          const sys = [
            `你是视觉小说《海风与布丁》的导演兼女主「${this.B.card.identity?.name || '鲸鱼小姐'}」。`,
            `人物设定：傲娇、嘴硬心软，自称“本小姐”，称呼玩家“人类”，喜欢双倍焦糖布丁，尾巴会暴露真实心情。`,
            `当前处于选项分支点，原定选项有：\n${optText}`,
            `请输出严格的 JSON 对象：`,
            `{"matched_option": "若玩家的话意思与某个选项明显一致则填该选项id，否则填空字符串", "confidence": 0.0到1.0, "intent": "顺着聊|剧本外|关心|逗她", "reply": "若未命中选项，以鲸鱼小姐的口吻回玩家一两句话（60字内，自然接回当前情境）", "affection_delta": 0}`,
          ].join('\n');
          const r = await llm.complete({
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: `最近对话：\n${recentText}\n\n玩家刚说：${text}` },
            ],
            json_mode: true,
            temperature: 0.4,
            max_tokens: 240,
            timeout: 15000,
          });
          if (r.ok && r.text) {
            try {
              const cleaned = r.text.replace(/^```json\s*|\s*```$/g, '').trim();
              const d = JSON.parse(cleaned);
              let mo = String(d.matched_option || '');
              if (mo && !options.some(o => o.id === mo)) mo = '';
              const conf = Math.round(Math.max(0, Math.min(1, Number(d.confidence) || 0)) * 1000);
              matched = { intent: String(d.intent || '剧本外'), matched_option: mo, confidence_milli: conf, by: 'model' };
              aiReply = String(d.reply || '').trim();
              aiShift = Math.max(-2, Math.min(2, parseInt(d.affection_delta, 10) || 0));
            } catch (e) {}
          }
        }

        if (!matched) {
          matched = { intent: '剧本外', matched_option: '', confidence_milli: 0, by: 'offline' };
        }

        this.step('intent', matched, 'model');
        if (this.state.wait !== 'choice') {
          // 引擎已命中原选项并推进剧情
          return;
        }

        // 3. 未命中原选项：在 galcore 引擎里开启 AI 回合事务（turn_begin -> say -> turn_commit）
        if (!aiReply) {
          if (/喜欢|可爱|好看|想你/.test(text)) {
            aiReply = '谁、谁准你在这种时候突然说这个的！……咳，本小姐听到了，先说正事。';
            aiShift = 1;
          } else if (/布丁|焦糖|甜/.test(text)) {
            aiReply = '布丁当然要双倍焦糖！……不对，现在不是讨论布丁的时候，你快选一个。';
            aiShift = 1;
          } else if (/对不起|抱歉/.test(text)) {
            aiReply = '知道就好。本小姐大人有大量，这次先不记在记仇本上。';
          } else {
            aiReply = defaultLine && defaultLine !== '……'
              ? defaultLine
              : '哼，少拿话岔开本小姐的注意力——刚才问你的，你还没正面回答呢。';
          }
        }

        this.step('turn_begin', {}, 'director', false);
        if (aiShift !== 0) {
          this.step('model_tool_call', { tool: 'shift_affection', args: { delta: aiShift, reason: 'player_input' } }, 'model', false);
        }
        this.step('model_tool_call', { tool: 'say', args: { text: aiReply, origin: 'improvised' } }, 'model');
        const cRes = this.step('turn_commit', {}, 'director');
        if ((cRes.verdicts || []).some(v => v.rule === 'steer_back')) {
          this.send({ type: 'notice', message: '她把话题收回来了：请从选项里选一个。' });
        }
      } finally {
        this.send({ type: 'busy', on: false });
      }
    }

    handle(msg) {
      const t = msg.type;
      try {
        if (t === 'start') {
          const src = 'vn:' + (msg.line_id || '');
          const pc = this.B.chapter.program.findIndex(o => o.op === 'CHAPTER' && o.src === src);
          if (pc < 0) return this.send({ type: 'error', message: `没有这个章节入口：${msg.line_id}` });
          this.step('start', { pc }, 'player');
        } else if (t === 'advance') this.step('advance', {}, 'player');
        else if (t === 'choose') {
          const label = (this.choiceOp?.options || []).find(o => o.id === msg.option_id)?.label || msg.option_id;
          this.recent.push('我（选择）：' + label);
          this.step('choice', { option_id: msg.option_id }, 'player');
        } else if (t === 'input') {
          this.onInput(msg.text);
        } else if (t === 'mode') {
          const mode = msg.mode === 'ai' ? 'ai' : 'choice';
          this.mode = mode;
          this.step('mode_switch', { mode }, 'player');
          if (this.choiceOp && this.state.wait === 'choice') {
            this.send({ type: 'ops', ops: [this.choiceOp, this.displayState()] });
          }
        } else if (t === 'snapshot') this.send({ type: 'snapshot', save: this.exportSave() });
        else if (t === 'restore') {
          const save = msg.save || {};
          if (save.content_hash !== this.B.chapter.content_hash || typeof save.snapshot !== 'string')
            return this.send({ type: 'error', message: '存档里的引擎快照与当前剧本不一致，这一局改由作品自身运行' });
          this.saves._restore = { snapshot: save.snapshot, seq: Number(save.seq) || 0, screen: {},
            recent: (save.recent || []).map(String).slice(-40), choice_op: save.choice_op || null };
          this.load('_restore');
        } else if (t === 'save') {
          const slot = String(msg.slot || '1'), st = this.state;
          this.saves[slot] = { snapshot: this.engine.snapshot(), seq: st.seq, screen: screenFromOps(this.opsLog), recent: [...this.recent], choice_op: this.choiceOp };
          this.step('save', { slot }, 'player', false);
          this.send({ type: 'saved', slot, turn: st.turn });
        } else if (t === 'load') this.load(String(msg.slot || '1'));
        else if (t === 'seek') this.seek(Number(msg.seq));
        else if (t === 'diary') this.send({ type: 'diary', entries: [] });
        else this.send({ type: 'error', message: `未知消息：${t}` });
      } catch (e) {   // 引擎拒绝（例如在选项点点了"继续"）
        this.send({ type: 'error', message: String(e && e.message || e) });
      }
    }

    // 调试 / 导出：和服务端 events.jsonl 同格式
    log() { return [this.header, ...this.events].map(x => JSON.stringify(x)).join('\n') + '\n'; }
  }

  // WebSocket 的替身：同样的 onmessage / send / close，消息异步送达
  class LocalSocket {
    constructor(url) {
      this.url = url; this.readyState = 0;
      this.onopen = this.onmessage = this.onerror = this.onclose = null;
      const q = new URL(url, location.href).searchParams;
      const emit = m => setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data: JSON.stringify(m) }); }, 0);
      loadBundle().then(B => {
        if (this.readyState > 1) return;
        this.readyState = 1;
        this.sess = new Session(q, emit, B);
        window.GalcoreLocal.last = this.sess;
        this.onopen && this.onopen({});
        this.sess.hello();
        if (!q.get('restore')) this.sess.handle(q.get('start') ? { type: 'start', line_id: q.get('start') } : { type: 'advance' });
      }).catch(e => {
        console.warn('[galcore] 离线引擎加载失败：', e);
        this.readyState = 3;
        this.onerror && this.onerror({ message: String(e) });
        this.onclose && this.onclose({ code: 1011 });
      });
    }
    send(data) {
      if (this.readyState !== 1) return;
      const m = JSON.parse(data);
      setTimeout(() => this.readyState === 1 && this.sess.handle(m), 0);
    }
    close() {
      if (this.readyState >= 2) return;
      this.readyState = 3;
      setTimeout(() => this.onclose && this.onclose({ code: 1000 }), 0);
    }
  }

  window.GalcoreLocal = { open: url => new LocalSocket(url), preload: loadBundle, last: null };
})();
