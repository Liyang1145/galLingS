/* 离线会话：没有 Python 服务时（桌面包 / 双击打开），在页面里跑 galcore（wasm），说和 /ws 一样的话。
 *
 * 对应 server/session.py 的纯选项部分（PLAN §3.2、§9）：开局、推进、选项、引擎快照存读档、调试时间轴回放。
 * AI 模式（模型、守卫、记忆）要服务端，离线版不提供：mode=ai 会退回纯选项。
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
      this.mode = 'choice';
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
      this.send({ type: 'hello', session: this.id, card: { id: this.B.card.id, name: this.B.card.identity?.name || '' },
        mode: this.mode, llm: false, memory: false, offline: true, chapter: { id: ch.chapter_id, title: ch.title }, seed: this.seed, header: hdr });
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
      return { op: 'STATE', affection: st.affection + st.deferred, tails: st.tails_script + st.tails_ai, mood: st.mood, mode: st.mode,
        lineage: st.lineage, turn: st.turn, input_open: false, address_stage: st.address_stage, wound: st.wound, wait: st.wait };
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
        } else if (t === 'input') this.send({ type: 'error', message: '离线版没有 AI 模式：请从选项里选一个' });
        else if (t === 'mode') {
          if (msg.mode === 'ai') return this.send({ type: 'error', message: '离线版没有 AI 模式（需要启动 galLingS 服务并配置模型）' });
          this.step('mode_switch', { mode: msg.mode }, 'player');
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
