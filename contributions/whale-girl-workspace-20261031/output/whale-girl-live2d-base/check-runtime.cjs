const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const coreFile = process.argv[2];
if (!coreFile) throw new Error('Pass the local Cubism Core JavaScript path');
const context = { console, Buffer, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(coreFile, 'utf8'), context, { filename: coreFile });
const core = context.Live2DCubismCore;
async function main() {
const deadline = Date.now() + 10000;
while (true) {
  try { core.Version.csmGetVersion(); break; }
  catch (error) {
    if (Date.now() >= deadline) throw new Error('Cubism Core initialization timed out: ' + error.message);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
const dir = path.join(__dirname, 'runtime-test');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'whale-girl.model3.json')));
const bytes = fs.readFileSync(path.join(dir, manifest.FileReferences.Moc));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const moc = core.Moc.fromArrayBuffer(buffer);
assert(moc, 'MOC must load');
assert.equal(moc.hasMocConsistency(buffer), 1, 'MOC consistency');
const model = core.Model.fromMoc(moc);
assert(model, 'Model must initialize');
const p = model.parameters, d = model.drawables;
assert.equal(d.count, 16, 'All 16 painted meshes must survive export');
for (const texture of manifest.FileReferences.Textures) assert(fs.existsSync(path.join(dir, texture)));
const expectedGroups = { EyeBlink: ['ParamEyeLOpen', 'ParamEyeROpen'], LipSync: ['ParamMouthOpenY'] };
for (const [name, ids] of Object.entries(expectedGroups)) {
  const group = manifest.Groups?.find(g => g.Name === name);
  assert(group, name + ' group must exist');
  assert.equal(group.Target, 'Parameter');
  assert.deepEqual(group.Ids, ids);
  for (const id of ids) assert(p.ids.includes(id), name + ': exported parameter ' + id);
}
const physics = JSON.parse(fs.readFileSync(path.join(dir, manifest.FileReferences.Physics)));
assert.equal(physics.Meta.Fps, 60);
assert.equal(physics.PhysicsSettings.length, 1);
for (const setting of physics.PhysicsSettings) {
  for (const input of setting.Input) assert(p.ids.includes(input.Source.Id), 'Physics input exists');
  for (const output of setting.Output) {
    assert(p.ids.includes(output.Destination.Id), 'Physics output exists');
    assert(output.VertexIndex > 0 && output.VertexIndex < setting.Vertices.length);
    assert(Number.isFinite(output.Scale) && output.Scale > 0);
  }
}
const metadataCheck = { groups: expectedGroups, physicsSettings: physics.PhysicsSettings.length, fps: physics.Meta.Fps, scope: 'Manifest and physics reference integrity only; not physics playback validation' };
const snapshot = () => d.ids.map((id, i) => ({ id, opacity: d.opacities[i], positions: Array.from(d.vertexPositions[i]) }));
const reset = () => { p.values.set(p.defaultValues); model.update(); };
reset();
const baseline = snapshot();
const results = [];
for (const id of ['ParamAngleZ', 'ParamEyeLOpen', 'ParamEyeROpen', 'ParamMouthOpenY', 'ParamBreath', 'ParamHairBack']) {
  const index = p.ids.indexOf(id);
  assert(index >= 0, id + ' must exist');
  const samples = [];
  for (let step = 0; step <= 20; step++) {
    reset();
    const value = p.minimumValues[index] + (p.maximumValues[index] - p.minimumValues[index]) * step / 20;
    p.values[index] = value;
    model.update();
    const state = snapshot();
    const changed = state.filter((s, i) => Math.abs(s.opacity - baseline[i].opacity) > 1e-6 || s.positions.some((v, j) => Math.abs(v - baseline[i].positions[j]) > 1e-6)).map(s => s.id);
    for (const s of state) {
      assert(s.positions.every(Number.isFinite), id + ': finite vertices');
      assert(s.opacity >= 0 && s.opacity <= 1, id + ': valid opacity');
    }
    samples.push({ value, changed });
  }
  assert(samples.some(s => s.changed.length), id + ' must affect exported model');
  results.push({ id, keys: Array.from(p.keyValues[index]), samples });
}
reset();
const bodyIndex = d.ids.indexOf('BodyCore');
const bodyBase = baseline[bodyIndex].positions;
const bodyY = bodyBase.filter((_, i) => i % 2 === 1);
const lowestY = Math.min(...bodyY), highestY = Math.max(...bodyY);
p.values[p.ids.indexOf('ParamBreath')] = 1;
model.update();
let maxFootDisplacement = 0;
for (let i = 0; i < bodyBase.length; i += 2) {
  if (bodyBase[i + 1] <= lowestY + (highestY - lowestY) * 0.1) {
    const distance = Math.hypot(d.vertexPositions[bodyIndex][i] - bodyBase[i], d.vertexPositions[bodyIndex][i + 1] - bodyBase[i + 1]);
    maxFootDisplacement = Math.max(maxFootDisplacement, distance);
  }
}
const breathFootCheck = { region: 'Lowest 10 percent of BodyCore vertex Y extent', maxDisplacementModelUnits: maxFootDisplacement, maxDisplacementSourcePixels: maxFootDisplacement * model.canvasinfo.PixelsPerUnit };
const report = { testedAt: new Date().toISOString(), scope: 'Cubism Core binary loading, finite geometry and six parameter effects. Does not verify rendering, animation quality or game integration.', mocBytes: bytes.length, drawableCount: d.count, drawableIds: d.ids, parameterCount: p.count, results, breathFootCheck };
report.metadataCheck = metadataCheck;
fs.writeFileSync(path.join(__dirname, 'runtime-core-check.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ mocBytes: bytes.length, drawableCount: d.count, parametersTested: results.map(r => r.id), breathFootCheck, status: 'passed' }, null, 2));
model.release();
moc._release();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
