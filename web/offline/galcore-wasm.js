/* galcore（Rust）在浏览器 / 桌面包里的胶水：接口和 Python 绑定 galcore.Engine 一一对应（PLAN §17.2）。
 *
 *   const gc = await GalcoreWasm.load('/static/offline/galcore.wasm');
 *   const eng = gc.engine(chapterJson, cardJson, configJson, seed);
 *   JSON.parse(eng.step(JSON.stringify({kind: 'advance', payload: {}})));
 *
 * wasm 侧约定见 core/src/lib.rs 的 `mod wasm`：字节进出，返回 `[len u32 LE][utf-8]`。
 */
(() => {
  'use strict';
  const enc = new TextEncoder(), dec = new TextDecoder();

  async function load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('取不到引擎 ' + url + '（' + res.status + '）');
    const bytes = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const x = instance.exports;
    const mem = () => new Uint8Array(x.memory.buffer);

    // 把字符串写进 wasm 内存（所有权交给 Rust，由 Rust 释放）
    function put(s) {
      const b = enc.encode(String(s));
      if (!b.length) return [0, 0];
      const p = x.gc_alloc(b.length);
      mem().set(b, p);
      return [p, b.length];
    }
    // 读 Rust 返回的 [len][bytes] 并还回去
    function got(p) {
      if (!p) return '';
      const m = mem();
      const n = m[p] | (m[p + 1] << 8) | (m[p + 2] << 16) | (m[p + 3] << 24);
      const s = dec.decode(m.slice(p + 4, p + 4 + (n >>> 0)));
      x.gc_free_result(p);
      return s;
    }
    function check(s) {
      if (s.startsWith('{"error"')) { const e = JSON.parse(s); throw new Error(e.error); }
      return s;
    }

    class Engine {
      constructor(chapter, card, config, seed) {
        const [cp, cn] = put(chapter), [kp, kn] = put(card), [gp, gn] = put(config);
        this.h = x.gc_new(cp, cn, kp, kn, gp, gn, BigInt.asUintN(64, BigInt(seed)));
        if (!this.h) throw new Error(got(x.gc_last_error()) || '引擎创建失败');
      }
      step(eventJson) { const [p, n] = put(eventJson); return check(got(x.gc_step(this.h, p, n))); }
      state_json() { return got(x.gc_state_json(this.h)); }
      state_hash() { return got(x.gc_state_hash(this.h)); }
      budget_json() { return got(x.gc_budget_json(this.h)); }
      visible_json() { return got(x.gc_visible_json(this.h)); }
      snapshot() { return check(got(x.gc_snapshot(this.h))); }
      restore(snap) { const [p, n] = put(snap); check(got(x.gc_restore(this.h, p, n))); }
      agm_recall(seeds, exclude, k) {
        const [sp, sn] = put(seeds), [xp, xn] = put(exclude);
        return check(got(x.gc_agm_recall(this.h, sp, sn, xp, xn, k)));
      }
      free() { if (this.h) { x.gc_drop(this.h); this.h = 0; } }
    }

    return {
      ENGINE_VERSION: got(x.gc_version()),
      fnv1a64(s) { const [p, n] = put(s); return got(x.gc_fnv1a64(p, n)); },
      engine: (chapter, card, config, seed) => new Engine(chapter, card, config, seed),
    };
  }

  window.GalcoreWasm = { load };
})();
