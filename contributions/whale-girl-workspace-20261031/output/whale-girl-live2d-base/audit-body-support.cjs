// Native support-region diagnostic. Mesh vertices are proxies, not painted feet.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const modelFile = path.resolve(process.argv[2]);
const root = path.dirname(modelFile);
const manifest = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
const coreFile = '<USERPROFILE>/Desktop/galagent/prototypes/live2d/vendor/CubismSdkForWeb-5-r.5/Core/live2dcubismcore.js';
const context = vm.createContext({console, require, process, Buffer, __dirname:path.dirname(coreFile), module:{exports:{}}, exports:{}, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder});
vm.runInContext(fs.readFileSync(coreFile, 'utf8'), context, {filename:coreFile});
setTimeout(() => {
  const core = context.Live2DCubismCore;
  const bytes = fs.readFileSync(path.join(root, manifest.FileReferences.Moc));
  const moc = core.Moc.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (!moc) throw Error('Native MOC failed to load');
  const model = core.Model.fromMoc(moc), p = model.parameters, d = model.drawables;
  const set = (id, value) => { const i = p.ids.indexOf(id); if (i < 0) throw Error('Missing ' + id); p.values[i] = value; };
  p.values.set(p.defaultValues); model.update();
  const base = d.vertexPositions.map(v => Array.from(v));
  const body = d.ids.indexOf('BodyCore');
  if (body < 0) throw Error('Missing BodyCore');
  const bodyYs = base[body].filter((_, i) => i % 2 === 1).sort((a, b) => a - b);
  const cutoff = bodyYs[Math.floor((bodyYs.length - 1) * .15)];
  const supportVertices = Array.from({length:d.vertexCounts[body]}, (_, i) => i).filter(i => base[body][2 * i + 1] <= cutoff);
  const tracked = ['BodyCore', 'Coverup', 'ArmL', 'ArmR', 'Face_Static_v4', 'HairCap', 'HairBack', 'Tail'];
  const sample = values => {
    p.values.set(p.defaultValues);
    for (const [id, value] of Object.entries(values)) set(id, value);
    model.update();
    const affected = tracked.map(id => {
      const j = d.ids.indexOf(id);
      if (j < 0) return {id, missing:true};
      let maxDelta = 0;
      for (let i = 0; i < d.vertexCounts[j]; i++) maxDelta = Math.max(maxDelta, Math.hypot(d.vertexPositions[j][2*i]-base[j][2*i], d.vertexPositions[j][2*i+1]-base[j][2*i+1]) * 1024);
      return {id, maxDeltaModelPixels:maxDelta};
    });
    const support = supportVertices.map(i => ({vertex:i, dx:(d.vertexPositions[body][2*i]-base[body][2*i])*1024, dy:(d.vertexPositions[body][2*i+1]-base[body][2*i+1])*1024}));
    return {values, affected, supportMaxDeltaModelPixels:Math.max(...support.map(v => Math.hypot(v.dx,v.dy))), support};
  };
  const ids = ['ParamBreath', 'ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ'];
  const parameters = ids.map(id => { const i=p.ids.indexOf(id); if(i<0)throw Error('Missing '+id); return {id,min:p.minimumValues[i],max:p.maximumValues[i],default:p.defaultValues[i]}; });
  const endpointRows = parameters.flatMap(q => [...new Set([q.min,q.default,q.max])].map(value => sample({[q.id]:value})));
  const combinedRows = [];
  for (const breath of [0,.25,.5,.75,1]) for (const x of [-10,-5,0,5,10]) for (const y of [-10,0,10]) for (const z of [-10,0,10]) combinedRows.push(sample({ParamBreath:breath,ParamBodyAngleX:x,ParamBodyAngleY:y,ParamBodyAngleZ:z}));
  const report = {modelFile,testedAt:new Date().toISOString(),scope:'Native single parameter endpoint displacement and 225 Breath x BodyX x BodyY x BodyZ combinations. BodyCore support region is the lowest 15 percent of default mesh vertex heights; these may include transparent geometry and do not prove painted-foot stability, seam quality, or physics.',parameters,supportVertices,endpointRows,combinedRows};
  fs.writeFileSync(path.join(root,'body-support.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({parameters,supportVertices,endpointRows:endpointRows.map(r=>({values:r.values,supportMaxDeltaModelPixels:r.supportMaxDeltaModelPixels,affected:r.affected})),combinedMaxSupportDeltaModelPixels:Math.max(...combinedRows.map(r=>r.supportMaxDeltaModelPixels))}));
  model.release(); moc._release();
},1200);
