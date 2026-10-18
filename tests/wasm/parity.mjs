// WASM 引擎与 Python 引擎一致性：同一份剧本 + 种子 + 事件序列，state_hash 逐条相同、快照可互读。
// 用法：node tests/wasm/parity.mjs <galcore.wasm> <chapter.json> <card.json> <events.json>  → 输出每步 state_hash（JSON）
import fs from 'node:fs';
globalThis.window = globalThis;
globalThis.fetch = async p => ({ ok: true, arrayBuffer: async () => fs.readFileSync(p) });
await import(new URL('../../web/offline/galcore-wasm.js', import.meta.url));
const [wasm, chapter, card, events] = process.argv.slice(2);
const gc = await window.GalcoreWasm.load(wasm);
const ev = JSON.parse(fs.readFileSync(events, 'utf8'));
const eng = gc.engine(fs.readFileSync(chapter, 'utf8'), fs.readFileSync(card, 'utf8'), JSON.stringify(ev.config), ev.seed);
const hashes = [];
let snap = null;
for (const e of ev.events) {
  const r = JSON.parse(eng.step(JSON.stringify(e)));
  hashes.push(r.state_hash);
  if (hashes.length === ev.snap_at) snap = eng.snapshot();
}
const eng2 = gc.engine(fs.readFileSync(chapter, 'utf8'), fs.readFileSync(card, 'utf8'), JSON.stringify(ev.config), ev.seed);
if (ev.python_snapshot) eng2.restore(ev.python_snapshot);
console.log(JSON.stringify({ version: gc.ENGINE_VERSION, hashes, snapshot: snap, restored_hash: ev.python_snapshot ? eng2.state_hash() : null }));
