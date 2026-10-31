// Diagnose native MOC parameter influence; zero response is not a visual pass.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const modelFile = path.resolve(process.argv[2]);
const coreFile = process.argv[3] || '<USERPROFILE>/Desktop/galagent/prototypes/live2d/vendor/CubismSdkForWeb-5-r.5/Core/live2dcubismcore.js';
const context = vm.createContext({console, require, process, Buffer, __dirname:path.dirname(coreFile), module:{exports:{}}, exports:{}, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder});
vm.runInContext(fs.readFileSync(coreFile,'utf8'),context,{filename:coreFile});
setTimeout(() => {
  const manifest = JSON.parse(fs.readFileSync(modelFile,'utf8'));
  const bytes = fs.readFileSync(path.join(path.dirname(modelFile),manifest.FileReferences.Moc));
  const core = context.Live2DCubismCore;
  const moc = core.Moc.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  if (!moc) throw Error('MOC failed to load');
  const model = core.Model.fromMoc(moc), p=model.parameters, d=model.drawables;
  const snapshot = () => ({vertices:d.vertexPositions.map(a=>Array.from(a)),opacities:Array.from(d.opacities)});
  const rows=[];
  // Include closed and open mouth contexts because form may be conditional.
  for (const mouthOpen of [0,1]) {
    p.values.set(p.defaultValues); const oi=p.ids.indexOf('ParamMouthOpenY'); if(oi>=0)p.values[oi]=mouthOpen;
    model.update(); const base=snapshot();
    for (let i=0;i<p.count;i++) {
      const affected=new Map();
      for (const value of [p.minimumValues[i],p.maximumValues[i]]) {
        p.values.set(p.defaultValues); if(oi>=0)p.values[oi]=mouthOpen; p.values[i]=value; model.update();
        for(let j=0;j<d.count;j++) {
          let delta=0; for(let k=0;k<d.vertexPositions[j].length;k++)delta=Math.max(delta,Math.abs(d.vertexPositions[j][k]-base.vertices[j][k]));
          const opacityDelta=Math.abs(d.opacities[j]-base.opacities[j]);
          if(delta>1e-7||opacityDelta>1e-7) {
            const prev=affected.get(d.ids[j])||{id:d.ids[j],maxVertexDelta:0,maxOpacityDelta:0};
            prev.maxVertexDelta=Math.max(prev.maxVertexDelta,delta); prev.maxOpacityDelta=Math.max(prev.maxOpacityDelta,opacityDelta); affected.set(d.ids[j],prev);
          }
        }
      }
      rows.push({id:p.ids[i],mouthOpen,affected:Array.from(affected.values())});
    }
  }
  const report={modelFile,testedAt:new Date().toISOString(),scope:'Single parameter endpoint influence at mouth open 0 and 1. Does not validate artwork or physics.',rows};
  fs.writeFileSync(path.join(path.dirname(modelFile),'parameter-response.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(rows.filter(r=>r.id==='ParamMouthForm'||r.affected.length===0)));
  model.release();moc._release();
},1200);
