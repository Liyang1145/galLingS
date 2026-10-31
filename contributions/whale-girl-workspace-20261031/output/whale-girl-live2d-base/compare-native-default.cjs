// Compare actual native exports at their default parameter pose.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const coreFile = '<USERPROFILE>/Desktop/galagent/prototypes/live2d/vendor/CubismSdkForWeb-5-r.5/Core/live2dcubismcore.js';
const ctx = vm.createContext({console,require,process,Buffer,__dirname:path.dirname(coreFile),module:{exports:{}},exports:{},setTimeout,clearTimeout,WebAssembly,TextDecoder,TextEncoder});
vm.runInContext(fs.readFileSync(coreFile,'utf8'),ctx,{filename:coreFile});
setTimeout(() => {
  const core = ctx.Live2DCubismCore;
  const load = file => {
    file = path.resolve(file);
    const manifest = JSON.parse(fs.readFileSync(file,'utf8'));
    const bytes = fs.readFileSync(path.join(path.dirname(file),manifest.FileReferences.Moc));
    const moc = core.Moc.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    if (!moc) throw Error('Cannot load '+file);
    const model = core.Model.fromMoc(moc);
    model.parameters.values.set(model.parameters.defaultValues);
    model.update();
    return {file,moc,model};
  };
  const a = load(process.argv[2]), b = load(process.argv[3]);
  const rows = Array.from(a.model.drawables.ids, (id,i) => {
    const j = b.model.drawables.ids.indexOf(id);
    if(j<0)throw Error('Missing drawable '+id);
    const va = a.model.drawables.vertexPositions[i], vb = b.model.drawables.vertexPositions[j];
    if(va.length!==vb.length) {
      if(a.model.drawables.opacities[i]===0 && b.model.drawables.opacities[j]===0)
        return {id,maxDeltaModelPixels:0,opacityDelta:0,hiddenTopologyChanged:true,baselineVertices:va.length/2,candidateVertices:vb.length/2};
      throw Error('Visible default topology changed '+id);
    }
    let maxDelta = 0;
    for(let k=0;k<va.length;k++)maxDelta=Math.max(maxDelta,Math.abs(va[k]-vb[k])*1024);
    return {id,maxDeltaModelPixels:maxDelta,opacityDelta:Math.abs(a.model.drawables.opacities[i]-b.model.drawables.opacities[j])};
  });
  const report={baseline:a.file,candidate:b.file,testedAt:new Date().toISOString(),scope:'Default native drawable vertex positions and opacity only; topology changes are allowed only when both default opacities equal zero and are reported explicitly. Does not render masks, color blending or physics.',maxDeltaModelPixels:Math.max(...rows.map(r=>r.maxDeltaModelPixels)),rows};
  fs.writeFileSync(path.join(path.dirname(b.file),'default-pose-comparison.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  a.model.release();b.model.release();a.moc._release();b.moc._release();
  if(report.maxDeltaModelPixels>.05||rows.some(r=>r.opacityDelta>1e-6))process.exitCode=1;
},1200);
