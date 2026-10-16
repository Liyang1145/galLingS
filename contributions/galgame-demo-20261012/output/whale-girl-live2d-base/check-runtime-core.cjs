// Checks actual native exports. This does not establish visual or game acceptance.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const coreFile = process.argv[3] || 'C:/Users/huang/Desktop/galagent/prototypes/live2d/vendor/CubismSdkForWeb-5-r.5/Core/live2dcubismcore.js';
const modelFile = path.resolve(process.argv[2]);
const root = path.dirname(modelFile);
const manifest = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
const context = vm.createContext({console, require, process, Buffer, __dirname:path.dirname(coreFile), module:{exports:{}}, exports:{}, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder});
vm.runInContext(fs.readFileSync(coreFile, 'utf8'), context, {filename:coreFile});
setTimeout(() => {
  const core = context.Live2DCubismCore;
  const bytes = fs.readFileSync(path.join(root, manifest.FileReferences.Moc));
  const moc = core.Moc.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert(moc, 'MOC cannot load');
  const model = core.Model.fromMoc(moc);
  assert(model, 'Model cannot instantiate');
  const p = model.parameters, d = model.drawables;
  const set = (id, value) => { const i = p.ids.indexOf(id); assert(i >= 0, `Missing parameter ${id}`); p.values[i] = value; };
  const reset = () => p.values.set(p.defaultValues);
  const geometry = () => { model.update(); for (const a of d.vertexPositions) for (const v of a) assert(Number.isFinite(v), 'Nonfinite vertex'); for (const v of d.opacities) assert(Number.isFinite(v) && v >= 0 && v <= 1, 'Invalid opacity'); };
  reset(); geometry();
  const drawableIds = Array.from(d.ids);
  const required = ['Face_Static_v4', 'MouthClosed_v6', 'MouthOpen_v6', 'BangsCenterShadow_v6', 'JawNeckShadow_v6'];
  for (const id of required) assert(drawableIds.includes(id), `Missing adopted drawable ${id}`);
  const shadows = required.slice(3).map(id => { const i = drawableIds.indexOf(id); return {id, opacity:d.opacities[i], drawOrder:d.drawOrders[i], masks:Array.from(d.masks[i], n => drawableIds[n])}; });
  assert.deepEqual(shadows[0].masks, ['Face_Static_v4']);
  assert.deepEqual(shadows[1].masks, ['BodyCore']);
  for (const id of ['Face','EyeL_Open','EyeR_Open','MouthClosed','MouthOpen']) assert(!drawableIds.includes(id), `Obsolete mesh exported ${id}`);
  let combinations = 0;
  for (const x of [-30,0,30]) for (const y of [-30,0,30]) for (const z of [-30,0,30]) {
    for (const l of [0,.25,.5,.75,1]) for (const r of [0,.5,1]) for (const open of [0,.5,1]) for (const form of [-1,0,1]) {
      reset(); set('ParamAngleX',x); set('ParamAngleY',y); set('ParamAngleZ',z); set('ParamEyeLOpen',l); set('ParamEyeROpen',r); set('ParamMouthOpenY',open); set('ParamMouthForm',form); geometry(); combinations++;
    }
  }
  let gazeCombinations = 0;
  for (const x of [-30,0,30]) for (const y of [-30,0,30]) for (const z of [-30,0,30]) {
    for (const gx of [-1,0,1]) for (const gy of [-1,0,1]) for (const l of [0,.25,.5,.75,1]) for (const r of [0,.25,.5,.75,1]) {
      reset(); set('ParamAngleX',x); set('ParamAngleY',y); set('ParamAngleZ',z); set('ParamEyeBallX',gx); set('ParamEyeBallY',gy); set('ParamEyeLOpen',l); set('ParamEyeROpen',r); geometry(); gazeCombinations++;
    }
  }
  let browCombinations = 0;
  if (drawableIds.includes('Brow_ViewerLeft_v6') && drawableIds.includes('Brow_ViewerRight_v6')) {
    assert(!drawableIds.includes('Eyebrows'), 'Old combined eyebrows exported alongside independent brows');
    for (const x of [-30,0,30]) for (const y of [-30,0,30]) for (const z of [-30,0,30]) {
      for (const ly of [-1,0,1]) for (const ry of [-1,0,1]) for (const la of [-1,0,1]) for (const ra of [-1,0,1]) {
        for (const lf of [-1,0,1]) for (const rf of [-1,0,1]) for (const l of [0,.5,1]) for (const r of [0,.5,1]) {
          reset(); set('ParamAngleX',x); set('ParamAngleY',y); set('ParamAngleZ',z);
          set('ParamBrowLY',ly); set('ParamBrowRY',ry); set('ParamBrowLAngle',la); set('ParamBrowRAngle',ra);
          set('ParamBrowLForm',lf); set('ParamBrowRForm',rf);
          set('ParamEyeLOpen',l); set('ParamEyeROpen',r); geometry(); browCombinations++;
        }
      }
    }
  }
  let smileCombinations = 0;
  for (const x of [-30,0,30]) for (const y of [-30,0,30]) for (const z of [-30,0,30]) {
    for (const ls of [0,.5,1]) for (const rs of [0,.5,1]) for (const l of [0,.5,1]) for (const r of [0,.5,1]) {
      for (const gx of [-1,0,1]) for (const gy of [-1,0,1]) {
        reset(); set('ParamAngleX',x); set('ParamAngleY',y); set('ParamAngleZ',z);
        set('ParamEyeLSmile',ls); set('ParamEyeRSmile',rs); set('ParamEyeLOpen',l); set('ParamEyeROpen',r);
        set('ParamEyeBallX',gx); set('ParamEyeBallY',gy); geometry(); smileCombinations++;
      }
    }
  }
  const blink = [];
  for (const eye of ['ParamEyeLOpen','ParamEyeROpen']) for (const value of [0,.25,.5,.75,1]) {
    reset(); set(eye,value); geometry(); blink.push({eye,value, drawables:drawableIds.filter(id => /Iris|Sclera|Lash/.test(id)).map(id => {const i=drawableIds.indexOf(id); return {id,opacity:d.opacities[i]};})});
  }
  const files = [manifest.FileReferences.Moc, ...manifest.FileReferences.Textures, manifest.FileReferences.Physics, manifest.FileReferences.DisplayInfo].filter(Boolean);
  for (const file of files) assert(fs.statSync(path.join(root,file)).size > 0);
  const report = {testedAt:new Date().toISOString(), scope:'Native export loading, adopted/obsolete meshes, shadow mask IDs and opacity, mouth/head/blink, gaze/head/blink, independent brow Y/angle/form/head/blink, and smile/head/blink/gaze finite geometry combinations. Does not verify parameter influence, painted quality, geometric folding, physics playback, or game acceptance.', drawableCount:d.count, drawableIds, parameterCount:p.count, shadows, combinations, gazeCombinations, browCombinations, smileCombinations, blink, files};
  fs.writeFileSync(path.join(root,'runtime-core-check.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify({drawableCount:d.count,parameterCount:p.count,shadows,combinations,gazeCombinations,browCombinations,smileCombinations,report:path.join(root,'runtime-core-check.json')}));
  model.release(); moc._release();
}, 1200);
