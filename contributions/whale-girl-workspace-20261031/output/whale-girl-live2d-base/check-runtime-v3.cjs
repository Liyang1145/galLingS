const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = path.join(__dirname, 'runtime-test-v3');
const context = { console, Buffer, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(process.argv[2], 'utf8'), context);
const core = context.Live2DCubismCore;
async function main() {
  for (let n = 0; ; n++) {
    try { core.Version.csmGetVersion(); break; }
    catch (e) { if (n > 200) throw e; await new Promise(r => setTimeout(r, 50)); }
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'whale-girl-v3.model3.json')));
  const bytes = fs.readFileSync(path.join(dir, manifest.FileReferences.Moc));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const moc = core.Moc.fromArrayBuffer(buffer);
  assert(moc, 'MOC loads');
  assert.equal(moc.hasMocConsistency(buffer), 1);
  const model = core.Model.fromMoc(moc);
  assert(model);
  const p = model.parameters, d = model.drawables;
  assert.equal(d.count, 18, '18 visible meshes; four obsolete eye meshes excluded');
  assert.equal(p.count, 28);
  for (const id of ['EyeL_Open', 'EyeR_Open', 'EyeL_Closed', 'EyeR_Closed']) assert(!d.ids.includes(id));
  for (const file of manifest.FileReferences.Textures) assert(fs.existsSync(path.join(dir, file)));
  const physics = JSON.parse(fs.readFileSync(path.join(dir, manifest.FileReferences.Physics)));
  assert.equal(physics.PhysicsSettings.length, 2);
  assert.equal(physics.Meta.Fps, 60);
  for (const s of physics.PhysicsSettings) {
    for (const i of s.Input) assert(p.ids.includes(i.Source.Id));
    for (const o of s.Output) assert(p.ids.includes(o.Destination.Id));
  }
  const snapshot = () => d.ids.map((id, i) => ({ id, opacity: d.opacities[i], positions: Array.from(d.vertexPositions[i]) }));
  const reset = () => { p.values.set(p.defaultValues); model.update(); };
  reset();
  const baseline = snapshot();
  const changed = () => snapshot().filter((s, i) => Math.abs(s.opacity - baseline[i].opacity) > 1e-6 || s.positions.some((v, j) => Math.abs(v - baseline[i].positions[j]) > 1e-6)).map(s => s.id);
  const results = [];
  for (const id of ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ', 'ParamEyeLOpen', 'ParamEyeROpen', 'ParamMouthOpenY', 'ParamBreath', 'ParamHairBack']) {
    const index = p.ids.indexOf(id); assert(index >= 0, id);
    const samples = [];
    for (let step = 0; step <= 20; step++) {
      reset();
      const value = p.minimumValues[index] + (p.maximumValues[index] - p.minimumValues[index]) * step / 20;
      p.values[index] = value; model.update();
      for (const s of snapshot()) {
        assert(s.positions.every(Number.isFinite), id + ': finite geometry');
        assert(s.opacity >= 0 && s.opacity <= 1, id + ': opacity');
      }
      samples.push({ value, changed: changed() });
    }
    assert(samples.some(s => s.changed.length), id + ': actual exported effect');
    results.push({ id, samples });
  }
  const eyeEffects = results.filter(r => /Eye.Open/.test(r.id)).map(r => ({ id: r.id, affected: [...new Set(r.samples.flatMap(s => s.changed))] }));
  assert(eyeEffects.length === 2);
  assert(eyeEffects.every(r => r.affected.length >= 2));
  assert(!eyeEffects[0].affected.some(id => eyeEffects[1].affected.includes(id)), 'Blink geometry must be independent');
  const masks = d.ids.map((id, i) => ({ id, masks: Array.from(d.masks[i]).map(j => d.ids[j]) })).filter(r => r.masks.length);
  for (const id of ['Iris_Test', 'Iris_Test2']) {
    const m = masks.find(r => r.id === id); assert(m && m.masks.length === 1, id + ': isolated sclera clip');
  }
  assert.notEqual(masks.find(r => r.id === 'Iris_Test').masks[0], masks.find(r => r.id === 'Iris_Test2').masks[0]);
  let combinations = 0;
  for (const x of [-30, 0, 30]) for (const y of [-30, 0, 30]) for (const z of [-30, 0, 30]) {
    reset();
    for (const [id, value] of [['ParamAngleX', x], ['ParamAngleY', y], ['ParamAngleZ', z]]) p.values[p.ids.indexOf(id)] = value;
    model.update();
    for (const s of snapshot()) assert(s.positions.every(Number.isFinite));
    combinations++;
  }
  const report = { testedAt: new Date().toISOString(), scope: 'Core loading and geometry/reference integrity; not visual quality, physics playback, or game acceptance', drawableCount: d.count, drawableIds: Array.from(d.ids), parameterCount: p.count, physicsGroups: physics.PhysicsSettings.length, eyeEffects, masks, combinations, results };
  fs.writeFileSync(path.join(dir, 'runtime-core-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: 'passed', ...report, results: results.map(r => r.id) }, null, 2));
  model.release(); moc._release();
}
main().catch(e => { console.error(e); process.exitCode = 1; });
