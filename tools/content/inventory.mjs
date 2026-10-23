#!/usr/bin/env node
// 重构第 01 步：当前作品的节点、资源、变量与旧语义清单（只读）。
//
// 用法（仓库根目录）：
//   node tools/content/inventory.mjs            # 写入 docs/migration/baseline/
//   node tools/content/inventory.mjs --check    # 只重新计算并与已提交清单比对，不写文件
//
// 约束：
// - 不执行作品 JavaScript：把 `window.VN_GAME = {...};` 当纯 JSON 截取解析。
// - 不修改作品、素材或旧播放器；只写 docs/migration/baseline/ 下的生成物。
// - 表达式语法按旧播放器 player.js 的 tokenize / evalExpr / parseSet 原样复刻，
//   只用于诊断和标识符提取，不是新核心的表达式实现。
// - 无第三方依赖，Node 18+。

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_DIR = '海风与布丁';
const GAME_JS = join(GAME_DIR, 'game.js');
const PLAYER_JS = join(GAME_DIR, 'player.js');
const OUT_DIR = join('docs', 'migration', 'baseline');
const CHECK = process.argv.includes('--check');

/* ---------- 读入 ---------- */
const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const gameBuf = readFileSync(join(ROOT, GAME_JS));
const playerBuf = readFileSync(join(ROOT, PLAYER_JS));
const gameText = gameBuf.toString('utf8');
const PREFIX = 'window.VN_GAME =';
if (!gameText.trimStart().startsWith(PREFIX)) throw new Error(`${GAME_JS} 不是预期的 "${PREFIX} {...};" 纯数据包装`);
const game = JSON.parse(gameText.slice(gameText.indexOf('{'), gameText.lastIndexOf('}') + 1));
const lines = game.lines;
const assets = game.assets;


/* ---------- 旧播放器表达式语法（复刻 player.js:210-276） ---------- */
const TOKEN_RE = /\s*(\d+(?:\.\d+)?|"[^"]*"|'[^']*'|[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*|>=|<=|==|!=|&&|\|\||[-+*/()<>!])/y;
const IDENT_RE = /^[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*$/;
function tokenize(src) {
  const s = String(src).trim(), out = [];
  TOKEN_RE.lastIndex = 0;
  while (TOKEN_RE.lastIndex < s.length) {
    const m = TOKEN_RE.exec(s);
    if (!m) throw new Error('看不懂：' + s.slice(TOKEN_RE.lastIndex));
    out.push(m[1]);
  }
  return out;
}
// 只做语法检查并返回用到的运算符；不求值
function parseExpr(src) {
  const t = tokenize(src); let i = 0; const ops = new Set();
  const peek = () => t[i], next = () => t[i++];
  const or = () => { and(); while (peek() === '||') { ops.add(next()); and(); } };
  const and = () => { not(); while (peek() === '&&') { ops.add(next()); not(); } };
  const not = () => { if (peek() === '!') { ops.add(next()); return not(); } cmp(); };
  const cmp = () => { add(); if (['==', '!=', '>', '<', '>=', '<='].includes(peek())) { ops.add(next()); add(); } };
  const add = () => { mul(); while (peek() === '+' || peek() === '-') { ops.add(next()); mul(); } };
  const mul = () => { unary(); while (peek() === '*' || peek() === '/') { ops.add(next()); unary(); } };
  const unary = () => { if (peek() === '-') { ops.add('neg'); next(); return unary(); } atom(); };
  const atom = () => {
    const k = next();
    if (k === undefined) throw new Error('表达式不完整');
    if (k === '(') { or(); if (next() !== ')') throw new Error('缺少右括号'); return; }
    if (/^\d/.test(k) || /^["']/.test(k) || IDENT_RE.test(k)) return;
    throw new Error('多余的符号：' + k);
  };
  if (!String(src || '').trim()) return { ops: [], idents: [] };
  or();
  if (i < t.length) throw new Error('多余的内容：' + t.slice(i).join(' '));
  return { ops: [...ops].sort(), idents: [...new Set(t.filter(k => IDENT_RE.test(k) && k !== 'true' && k !== 'false'))] };
}
function parseSet(src) {
  return String(src || '').split(/[;；\n]/).map(x => x.trim()).filter(Boolean).map(st => {
    const m = st.match(/^([A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*(\+=|-=|=)\s*(.+)$/);
    if (!m) throw new Error('看不懂：' + st);
    const e = parseExpr(m[3]);
    return { name: m[1], op: m[2], expr: m[3], idents: e.idents, ops: e.ops };
  });
}

/* ---------- 基础索引 ---------- */
const declaredVars = game.vars.map(v => v.name);
const BUILTIN_VARS = ['周目', '结局数']; // player.js:1750，只读投影
const labelToIdx = {};
const dupLabels = {};
lines.forEach((l, i) => {
  if (!l.label) return;
  if (l.label in labelToIdx) (dupLabels[l.label] ||= [labelToIdx[l.label]]).push(i);
  else labelToIdx[l.label] = i; // 旧播放器 labelIndex = findIndex，取第一处
});
const idCount = {};
lines.forEach(l => { idCount[l.id] = (idCount[l.id] || 0) + 1; });

const anomalies = [];
const note = (kind, i, detail) => anomalies.push({ kind, index: i, id: i == null ? null : lines[i].id, detail });

/* ---------- 字段使用 ---------- */
const fieldUse = {};
for (const l of lines) for (const [k, v] of Object.entries(l)) {
  const f = (fieldUse[k] ||= { present: 0, nonDefault: 0 });
  f.present++;
  const empty = v === null || v === '' || v === 0 || v === false || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
  if (!empty) f.nonDefault++;
}
// ambv / amb2v 默认 0.6，wait 默认 0：上面的"非空"对它们不精确，单独标注
const valueDomain = key => [...new Set(lines.map(l => l[key]).filter(v => v !== '' && v != null))].sort();

/* ---------- 资源引用 ---------- */
const refs = {}; // assetId -> {count, fields:Set}
const ref = (id, field, i) => {
  if (id == null || id === '') return;
  if (!assets[id]) { note('missing-asset-ref', i, `${field} → ${id}`); return; }
  const r = (refs[id] ||= { count: 0, fields: new Set() });
  r.count++; r.fields.add(field);
};
lines.forEach((l, i) => {
  ref(l.bg, 'bg', i); ref(l.bgm, 'bgm', i); ref(l.voice, 'voice', i); ref(l.se, 'se', i);
  ref(l.amb, 'amb', i); ref(l.amb2, 'amb2', i);
  l.sprites.forEach(s => ref(s.asset, 'sprites', i));
  (l.ambience || []).forEach(a => ref(a.id, 'ambience', i));
  (l.seEvents || []).forEach(e => ref(e.id, 'seEvents', i));
});
const coverImg = game.settings?.cover?.img; if (coverImg) ref(coverImg, 'settings.cover', null);
const assetTypes = {};
for (const a of Object.values(assets)) {
  const t = (assetTypes[a.type] ||= { registered: 0, referenced: 0, unreferenced: 0, retired: 0, auditionOnly: 0, cg: 0 });
  t.registered++;
  if (refs[a.id]) t.referenced++; else t.unreferenced++;
  if (a.retired) t.retired++;
  if (a.auditionOnly) t.auditionOnly++;
  if (a.type === 'bg' && !a.previewExcluded && (a.cg ?? /^cg[_\-\s]/i.test(a.name || ''))) t.cg++; // player.js:1751 isCG
}
const srcMissing = Object.values(assets).filter(a => !existsSync(join(ROOT, GAME_DIR, a.src))).map(a => ({ id: a.id, type: a.type, src: a.src }));
srcMissing.forEach(a => note('asset-file-missing', null, `${a.type} ${a.id} → ${a.src}`));

/* ---------- 表达式、变量 ---------- */
const exprs = {}; // key: kind|src
const varUse = {}; // name -> {reads, writes}
const use = (name, rw) => { (varUse[name] ||= { reads: 0, writes: 0 })[rw]++; };
const addExpr = (kind, src, i, where) => {
  if (!src) return;
  const k = kind + '|' + src;
  const e = (exprs[k] ||= { kind, src, uses: 0, nodes: [], error: null, idents: [], ops: [] });
  e.uses++; if (e.nodes.length < 50) e.nodes.push(where ? `${lines[i].id}${where}` : lines[i].id);
  try {
    if (kind.endsWith('set')) {
      const st = parseSet(src);
      e.ops = [...new Set(st.flatMap(s => [s.op, ...s.ops]))].sort();
      e.idents = [...new Set(st.flatMap(s => [s.name, ...s.idents]))];
      if (e.uses === 1) st.forEach(s => { use(s.name, 'writes'); s.idents.forEach(n => use(n, 'reads')); });
      st.forEach(s => {
        if (BUILTIN_VARS.includes(s.name)) note('write-builtin-var', i, src);
        else if (!declaredVars.includes(s.name)) note('write-undeclared-var', i, src);
      });
    } else {
      const p = parseExpr(src); e.ops = p.ops; e.idents = p.idents;
      if (e.uses === 1) p.idents.forEach(n => use(n, 'reads'));
    }
    e.idents.forEach(n => { if (!declaredVars.includes(n) && !BUILTIN_VARS.includes(n)) note('read-undeclared-var', i, `${kind}: ${src}`); });
  } catch (err) { e.error = err.message; note('expr-syntax-error', i, `${kind}: ${src} (${err.message})`); }
};
lines.forEach((l, i) => {
  addExpr('set', l.set, i);
  addExpr('jumpIf', l.jumpIf, i);
  l.choices.forEach((c, k) => { addExpr('choice.cond', c.cond, i, `#${k}`); addExpr('choice.set', c.set, i, `#${k}`); });
});
// 用到次数按全部出现计（上面只在首次登记时累加，这里修正为真实次数）
for (const n of Object.keys(varUse)) varUse[n] = { reads: 0, writes: 0 };
for (const e of Object.values(exprs)) {
  const times = e.uses;
  if (e.error) continue;
  if (e.kind.endsWith('set')) parseSet(e.src).forEach(s => { varUse[s.name] ||= { reads: 0, writes: 0 }; varUse[s.name].writes += times; s.idents.forEach(n => { (varUse[n] ||= { reads: 0, writes: 0 }).reads += times; }); });
  else e.idents.forEach(n => { (varUse[n] ||= { reads: 0, writes: 0 }).reads += times; });
}

/* ---------- 流转、选择、结局 ---------- */
const choiceNodes = [], timedChoices = [], jumps = [], endings = [], chapters = [];
lines.forEach((l, i) => {
  if (l.chapter) chapters.push({ index: i, id: l.id, label: l.label || null, chapter: l.chapter });
  if (idCount[l.id] > 1) note('duplicate-node-id', i, l.id);
  if (l.choices.length) {
    const opts = l.choices.map((c, k) => {
      const tIdx = c.target ? labelToIdx[c.target] : undefined;
      if (c.target && tIdx === undefined) note('choice-target-missing', i, `#${k} → ${c.target}（旧播放器回落到下一节点 ${i + 1}）`);
      if (!c.target) note('choice-without-target', i, `#${k}（旧播放器进入下一节点 ${i + 1}）`);
      return { slot: k, text: c.text, target: c.target || null, targetIndex: tIdx ?? null, targetId: tIdx != null ? lines[tIdx].id : null, cond: c.cond || null, set: c.set || null };
    });
    if (l.choices.every(c => c.cond)) note('all-choices-conditional', i, '全部选项都有条件：可能出现空菜单，旧播放器此时按普通节点推进');
    if (l.jump) note('choices-with-jump', i, `同时有选项与 jump=${l.jump}：旧播放器有可见选项时忽略 jump`);
    if (l.ending) note('choices-with-ending', i, `同时有选项与 ending=${l.ending}`);
    const entry = { index: i, id: l.id, speaker: l.speaker || null, text: l.text, choices: opts };
    if (l.ctime > 0) {
      const def = l.choices.find(c => c.target === l.cdef);
      if (!l.cdef) note('timed-choice-no-default', i, '未设 cdef：旧播放器超时选最后一项');
      else if (!def) note('timed-choice-default-missing', i, `cdef=${l.cdef} 不是本节点的选项目标：旧播放器超时选最后一项`);
      entry.timed = { seconds: l.ctime, cdef: l.cdef || null, defaultSlot: def ? l.choices.indexOf(def) : l.choices.length - 1, defaultResolvedBy: def ? 'cdef' : 'last-choice-fallback' };
      timedChoices.push(entry);
    } else if (l.cdef) note('cdef-without-ctime', i, `cdef=${l.cdef} 但 ctime=0`);
    choiceNodes.push(entry);
  }
  if (l.jump) {
    const tIdx = labelToIdx[l.jump];
    if (tIdx === undefined) note('jump-target-missing', i, `jump → ${l.jump}（旧播放器回落到下一节点）`);
    jumps.push({ index: i, id: l.id, jump: l.jump, jumpIf: l.jumpIf || null, targetIndex: tIdx ?? null, targetId: tIdx != null ? lines[tIdx].id : null, fallthroughIndex: l.jumpIf ? i + 1 : null });
  } else if (l.jumpIf) note('jumpIf-without-jump', i, l.jumpIf);
  if (l.ending) endings.push({ index: i, id: l.id, ending: l.ending, hasText: !!l.text });
  if (l.agent) note('agent-node', i, '主线节点配置了 agent');
  if ((l.amb || l.amb2) && !(l.ambience || []).length) note('legacy-amb-only', i, '只有 amb/amb2、没有 ambience：旧播放器运行时只读 ambience');
});

// 可达性：按旧播放器流转（顺序、jump、选项目标、结局终止、选项条件全部视为可能成立）
// 游戏模式“开始游戏”从第一个带 chapter 的节点进入（player.js:2217），不是数组第 0 项。
const gameEntryIndex = Math.max(0, lines.findIndex(l => l.chapter));
function reachFrom(...starts) {
const reach = new Uint8Array(lines.length); const stack = [...starts];
while (stack.length) {
  const i = stack.pop();
  if (i < 0 || i >= lines.length || reach[i]) continue;
  reach[i] = 1; const l = lines[i];
  if (l.choices.length) {
    l.choices.forEach(c => stack.push(c.target && labelToIdx[c.target] !== undefined ? labelToIdx[c.target] : i + 1));
    if (l.choices.every(c => c.cond)) { if (l.jump && labelToIdx[l.jump] !== undefined) stack.push(labelToIdx[l.jump]); stack.push(i + 1); }
    continue;
  }
  if (l.ending) continue; // 结局：记下来回标题
  if (l.jump && labelToIdx[l.jump] !== undefined) { stack.push(labelToIdx[l.jump]); if (l.jumpIf) stack.push(i + 1); }
  else stack.push(i + 1);
}
return reach;
}
const reach = reachFrom(0);
const reachGame = reachFrom(gameEntryIndex);
// “章节试阅”可以从任一 chapter 节点以初始变量开始（player.js:1602-1606）
const reachAnyEntry = reachFrom(...chapters.map(c => c.index));
const unreachableFromGameEntry = [], unreachableFromAnyEntry = [];
lines.forEach((l, i) => { if (!reachGame[i]) unreachableFromGameEntry.push(i); if (!reachAnyEntry[i]) unreachableFromAnyEntry.push(i); });
const unreachable = [];
lines.forEach((l, i) => { if (!reach[i]) unreachable.push({ index: i, id: l.id, label: l.label || null, text: l.text.slice(0, 30) }); });
// 走到末尾而非结局：最后一个节点不是结局且可达
if (reach[lines.length - 1] && !lines[lines.length - 1].ending && !lines[lines.length - 1].choices.length && !lines[lines.length - 1].jump) note('falls-off-end', lines.length - 1, '最后一个节点可达且不是结局：旧播放器 stopPlay 回标题');

/* ---------- 场景、演出、音频值域 ---------- */
const bgmRuns = []; let prevBgm;
lines.forEach((l, i) => { if (i === 0 || l.bgm !== prevBgm) bgmRuns.push({ index: i, id: l.id, bgm: l.bgm, fadeOutMs: l._musicFadeOutMs ?? null }); prevBgm = l.bgm; });
const domains = {
  trans: valueDomain('trans'),
  fx: valueDomain('fx'),
  mood: valueDomain('mood'),
  acts: [...new Set(lines.flatMap(l => Object.values(l.acts)))].sort(),
  spriteKeys: [...new Set(lines.flatMap(l => l.sprites.flatMap(s => Object.keys(s))))].sort(),
  spriteIn: [...new Set(lines.flatMap(l => l.sprites.map(s => s.in).filter(v => v != null)))].sort(),
  spriteOut: [...new Set(lines.flatMap(l => l.sprites.map(s => s.out).filter(v => v != null)))].sort(),
  spriteLook: [...new Set(lines.flatMap(l => l.sprites.map(s => s.look).filter(v => v != null)))].sort(),
  spritePoseSwitch: [...new Set(lines.flatMap(l => l.sprites.map(s => s.poseSwitch).filter(v => v != null)))].sort(),
  ambienceKeys: [...new Set(lines.flatMap(l => (l.ambience || []).flatMap(a => Object.keys(a))))].sort(),
  seEventKeys: [...new Set(lines.flatMap(l => (l.seEvents || []).flatMap(e => Object.keys(e))))].sort(),
  choiceKeys: [...new Set(lines.flatMap(l => l.choices.flatMap(c => Object.keys(c))))].sort(),
  waitValues: [...new Set(lines.map(l => l.wait).filter(v => v > 0))].sort((a, b) => a - b),
  typeMulValues: [...new Set(lines.map(l => l.typeMul).filter(v => v != null))].sort((a, b) => a - b),
  holdMsValues: [...new Set(lines.map(l => l.holdMs).filter(v => v != null))].sort((a, b) => a - b),
  musicFadeOutMsValues: [...new Set(lines.map(l => l._musicFadeOutMs).filter(v => v != null))].sort((a, b) => a - b),
  maxSpritesPerNode: Math.max(...lines.map(l => l.sprites.length)),
  maxAmbiencePerNode: Math.max(...lines.map(l => (l.ambience || []).length)),
  textPlaceholders: [...new Set(lines.flatMap(l => l.text.match(/\{[^{}\s]{1,16}\}/g) || []))],
  savePointTexts: lines.filter(l => /^【[^】]*完[^】]*】\s*存档点/.test(l.text || '')).length, // player.js:1855
};
// 旧播放器没有读取的节点字段（静态核对 player.js 源码中是否出现该字段名）
const playerSrc = playerBuf.toString('utf8');
const unconsumedFields = Object.keys(fieldUse).filter(k => !new RegExp('\\.' + k.replace(/[$]/g, '\\$') + '\\b').test(playerSrc));
unconsumedFields.forEach(k => note('field-not-read-by-player', null, `${k}（${fieldUse[k].present} 个节点带此字段）`));

const nodeKinds = { dialogue: 0, narration: 0, pause: 0, choice: 0, ending: 0 };
lines.forEach(l => {
  if (l.choices.length) nodeKinds.choice++;
  else if (l.ending) nodeKinds.ending++;
  else if (!l.text && !l.agent) nodeKinds.pause++; // player.js:188 isPause
  else if (l.speaker) nodeKinds.dialogue++;
  else nodeKinds.narration++;
});

/* ---------- 汇总 ---------- */
function toRanges(idx) { const out = []; for (const i of idx) { const last = out[out.length - 1]; if (last && last.to === i - 1) last.to = i; else out.push({ from: i, to: i }); } return out.map(r => ({ ...r, fromId: lines[r.from].id, toId: lines[r.to].id, fromLabel: lines[r.from].label || null })); }
const anomalyCounts = {};
anomalies.forEach(a => { anomalyCounts[a.kind] = (anomalyCounts[a.kind] || 0) + 1; });
const inventory = {
  generatedBy: 'tools/content/inventory.mjs',
  baseline: {
    gameFile: GAME_JS.replace(/\\/g, '/'), gameSha256: sha256(gameBuf),
    playerFile: PLAYER_JS.replace(/\\/g, '/'), playerSha256: sha256(playerBuf),
    formatV: game.v, workId: game.id, title: game.title,
  },
  topLevelKeys: Object.keys(game),
  counts: {
    nodes: lines.length, chapters: chapters.length, labels: Object.keys(labelToIdx).length,
    choiceNodes: choiceNodes.length, choiceOptions: choiceNodes.reduce((n, c) => n + c.choices.length, 0),
    timedChoiceNodes: timedChoices.length, jumpNodes: jumps.length, conditionalJumpNodes: jumps.filter(j => j.jumpIf).length,
    endingNodes: endings.length, agentNodes: lines.filter(l => l.agent).length,
    nodesWithSet: lines.filter(l => l.set).length, nodesWithVoice: lines.filter(l => l.voice).length,
    nodesWithSeEvents: lines.filter(l => (l.seEvents || []).length).length, nodesWithWait: lines.filter(l => l.wait > 0).length,
    unreachableNodes: unreachable.length, gameEntryIndex, unreachableFromGameEntry: unreachableFromGameEntry.length, unreachableFromAnyEntry: unreachableFromAnyEntry.length, nodeKinds,
    assetsRegistered: Object.keys(assets).length, assetsReferenced: Object.keys(refs).length, assetFilesMissing: srcMissing.length,
  },
  variables: {
    declared: game.vars.map(v => ({ name: v.name, init: v.init, initType: typeof v.init, global: !!v.global, reads: varUse[v.name]?.reads || 0, writes: varUse[v.name]?.writes || 0 })),
    builtinReadOnly: BUILTIN_VARS.map(n => ({ name: n, reads: varUse[n]?.reads || 0 })),
    undeclaredUsed: Object.keys(varUse).filter(n => !declaredVars.includes(n) && !BUILTIN_VARS.includes(n)),
  },
  expressions: Object.values(exprs).sort((a, b) => a.kind.localeCompare(b.kind) || b.uses - a.uses),
  expressionOperatorsUsed: [...new Set(Object.values(exprs).flatMap(e => e.ops))].sort(),
  chapters,
  labels: Object.entries(labelToIdx).map(([label, index]) => ({ label, index, id: lines[index].id })),
  duplicateLabels: dupLabels,
  choiceNodes, timedChoices, jumps, endings,
  bgmRuns,
  domains,
  fieldUse,
  unconsumedFields,
  assetTypes,
  assetsUnreferenced: Object.values(assets).filter(a => !refs[a.id]).map(a => ({ id: a.id, type: a.type, name: a.name, retired: !!a.retired, auditionOnly: !!a.auditionOnly })),
  unreachable,
  unreachableFromGameEntryRanges: toRanges(unreachableFromGameEntry),
  unreachableFromAnyEntryRanges: toRanges(unreachableFromAnyEntry),
  anomalyCounts,
  anomalies,
  characters: (game.chars || []).map(c => ({ name: c.name, hasPersona: !!c.persona })),
  settingsKeys: Object.keys(game.settings || {}),
};

/* ---------- 表格 ---------- */
const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (head, rows) => [head.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n') + '\n';
let curChapter = '';
const nodesCsv = csv(
  ['index', 'id', 'chapter', 'label', 'kind', 'speaker', 'text', 'bg', 'sprites', 'bgm', 'ambience', 'voice', 'seEvents', 'trans', 'fx', 'mood', 'acts', 'wait', 'set', 'choices', 'ctime', 'cdef', 'jump', 'jumpIf', 'ending', 'reachable', 'reachableFromGameEntry', 'reachableFromAnyEntry'],
  lines.map((l, i) => {
    if (l.chapter) curChapter = l.chapter;
    const kind = l.choices.length ? 'choice' : l.ending ? 'ending' : (!l.text && !l.agent) ? 'pause' : l.speaker ? 'dialogue' : 'narration';
    return [i, l.id, curChapter, l.label, kind, l.speaker, l.text, l.bg, l.sprites.map(s => s.asset).join(' '), l.bgm, (l.ambience || []).map(a => `${a.id}@${a.gain}`).join(' '), l.voice,
      (l.seEvents || []).map(e => `${e.id}+${e.delayMs || 0}ms`).join(' '), l.trans, l.fx, l.mood, Object.entries(l.acts).map(([c, a]) => `${c}:${a}`).join(' '), l.wait || '', l.set,
      l.choices.length, l.ctime || '', l.cdef, l.jump, l.jumpIf, l.ending, reach[i] ? 1 : 0, reachGame[i] ? 1 : 0, reachAnyEntry[i] ? 1 : 0];
  }));
const assetsCsv = csv(
  ['id', 'type', 'name', 'src', 'fileExists', 'refCount', 'refFields', 'cg', 'retired', 'auditionOnly', 'sha256'],
  Object.values(assets).map(a => [a.id, a.type, a.name, a.src, srcMissing.some(m => m.id === a.id) ? 0 : 1, refs[a.id]?.count || 0, refs[a.id] ? [...refs[a.id].fields].sort().join(' ') : '',
    a.type === 'bg' && !a.previewExcluded && (a.cg ?? /^cg[_\-\s]/i.test(a.name || '')) ? 1 : 0, a.retired ? 1 : 0, a.auditionOnly ? 1 : 0, a.sha256 || '']));

const outputs = {
  'inventory.json': JSON.stringify(inventory, null, 2) + '\n',
  'nodes.csv': nodesCsv,
  'assets.csv': assetsCsv,
};

if (CHECK) {
  let same = true;
  for (const [f, body] of Object.entries(outputs)) {
    const p = join(ROOT, OUT_DIR, f);
    const ok = existsSync(p) && readFileSync(p, 'utf8') === body;
    console.log(`${ok ? '一致' : '不一致'}  ${OUT_DIR}/${f}`);
    same &&= ok;
  }
  process.exit(same ? 0 : 1);
}
mkdirSync(join(ROOT, OUT_DIR), { recursive: true });
for (const [f, body] of Object.entries(outputs)) writeFileSync(join(ROOT, OUT_DIR, f), body);
console.log(JSON.stringify({ counts: inventory.counts, anomalyCounts }, null, 2));
