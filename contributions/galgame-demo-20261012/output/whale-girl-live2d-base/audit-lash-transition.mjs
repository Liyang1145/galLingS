// Diagnose painted lash positions in actual native MOC poses. Never edits source art.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const sharp = createRequire('file:///C:/Users/huang/Desktop/galagent/package.json')('sharp');
const modelFile = path.resolve(process.argv[2]);
const root = path.dirname(modelFile);
const viewerRight = process.argv[3] === 'viewer-right';
const eyeSide = viewerRight ? 'L' : 'R';
const manifest = JSON.parse(fs.readFileSync(modelFile,'utf8'));
const coreFile = 'C:/Users/huang/Desktop/galagent/prototypes/live2d/vendor/CubismSdkForWeb-5-r.5/Core/live2dcubismcore.js';
const context = vm.createContext({console,require,process,Buffer,__dirname:path.dirname(coreFile),module:{exports:{}},exports:{},setTimeout,clearTimeout,WebAssembly,TextDecoder,TextEncoder});
vm.runInContext(fs.readFileSync(coreFile,'utf8'),context,{filename:coreFile});
await new Promise(resolve=>setTimeout(resolve,1200));
const core = context.Live2DCubismCore;
const bytes = fs.readFileSync(path.join(root,manifest.FileReferences.Moc));
const moc = core.Moc.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
if (!moc) throw Error('Native MOC could not load');
const model = core.Model.fromMoc(moc), p = model.parameters, d = model.drawables;
const textures = await Promise.all(manifest.FileReferences.Textures.map(file=>sharp(path.join(root,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true})));
const set = (id,value)=>{const i=p.ids.indexOf(id);if(i<0)throw Error('Missing '+id);p.values[i]=value;};
const quantile = (values,q)=>{const v=values.slice().sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.floor((v.length-1)*q))];};
const ids = viewerRight ? ['Lash_Overlay_Test','ClosedLash_Hi_L_v5'] : ['Lash_Overlay_Test2','ClosedLash_Hi_v5'];
const selected = ids.map(id=>{const i=d.ids.indexOf(id);if(i<0)throw Error('Missing '+id);return i;});
const samples = new Map();
for (const j of selected) {
  const {data,info} = textures[d.textureIndices[j]];
  const uv=d.vertexUvs[j], idx=d.indices[j], points=[];
  for(let t=0;t<idx.length;t+=3) {
    const vi=[idx[t],idx[t+1],idx[t+2]];
    const a=vi.map(k=>[uv[2*k]*info.width,(1-uv[2*k+1])*info.height]);
    const denom=(a[1][1]-a[2][1])*(a[0][0]-a[2][0])+(a[2][0]-a[1][0])*(a[0][1]-a[2][1]);
    if(Math.abs(denom)<1e-8)continue;
    const minX=Math.max(0,Math.ceil(Math.min(...a.map(v=>v[0]))));
    const maxX=Math.min(info.width-1,Math.floor(Math.max(...a.map(v=>v[0]))));
    const minY=Math.max(0,Math.ceil(Math.min(...a.map(v=>v[1]))));
    const maxY=Math.min(info.height-1,Math.floor(Math.max(...a.map(v=>v[1]))));
    for(let y=minY;y<=maxY;y+=2)for(let x=minX;x<=maxX;x+=2) {
      const off=(y*info.width+x)*4;
      if(data[off+3]<128 || (data[off]+data[off+1]+data[off+2])/3>150)continue;
      const w0=((a[1][1]-a[2][1])*(x+.5-a[2][0])+(a[2][0]-a[1][0])*(y+.5-a[2][1]))/denom;
      const w1=((a[2][1]-a[0][1])*(x+.5-a[2][0])+(a[0][0]-a[2][0])*(y+.5-a[2][1]))/denom;
      const w2=1-w0-w1;
      if(Math.min(w0,w1,w2)>=-1e-5)points.push({vi,w:[w0,w1,w2]});
    }
  }
  if(points.length<30)throw Error('Insufficient painted lash samples for '+d.ids[j]);
  samples.set(j,points);
}
const rows=[];
for(const smile of [0,.5,1])for(const open of [0,.025,.03125,.05,.0625,.075,.09375,.1,.125,.1875,.25,.3125,.375,.4375,.5,.75,1]) {
  p.values.set(p.defaultValues);set('ParamEye'+eyeSide+'Smile',smile);set('ParamEye'+eyeSide+'Open',open);model.update();
  const mapped=selected.map(j=>{
    const pos=d.vertexPositions[j];
    const pts=samples.get(j).map(s=>s.w.reduce((v,w,k)=>[v[0]+w*pos[2*s.vi[k]]*1024,v[1]+w*pos[2*s.vi[k]+1]*1024],[0,0]));
    const xs=pts.map(v=>v[0]), x0=quantile(xs,.05), x1=quantile(xs,.95);
    return {j,pts,x0,x1};
  });
  const commonX0=Math.max(...mapped.map(m=>m.x0)),commonX1=Math.min(...mapped.map(m=>m.x1));
  if(commonX1<=commonX0)throw Error('Painted lashes have no common horizontal interval');
  const meshes=mapped.map(({j,pts,x0,x1})=>{
    const bins=Array.from({length:9},(_,n)=>{
      const left=commonX0+(commonX1-commonX0)*n/9,right=commonX0+(commonX1-commonX0)*(n+1)/9;
      const ys=pts.filter(v=>v[0]>=left&&v[0]<right).map(v=>v[1]);
      return {x:(left+right)/2,count:ys.length,yMedian:ys.length?quantile(ys,.5):null,yUpper:ys.length?quantile(ys,.9):null};
    });
    const pos=d.vertexPositions[j];
    const vx=Array.from(pos).filter((_,k)=>k%2===0).map(v=>v*1024);
    const vy=Array.from(pos).filter((_,k)=>k%2===1).map(v=>v*1024);
    return {id:d.ids[j],vertexCount:d.vertexCounts[j],opacity:d.opacities[j],paintedSamples:pts.length,xRange:[x0,x1],vertexBounds:[Math.min(...vx),Math.min(...vy),Math.max(...vx),Math.max(...vy)],bins};
  });
  rows.push({smile,open,commonX:[commonX0,commonX1],meshes,centralUpperGap:meshes[0].bins[4].yUpper-meshes[1].bins[4].yUpper,upperGaps:meshes[0].bins.map((b,k)=>b.yUpper-meshes[1].bins[k].yUpper)});
}
const report={modelFile,eyeSide:viewerRight?'viewer-right':'viewer-left',testedAt:new Date().toISOString(),scope:'Alpha/dark painted texel barycentric positions in native MOC for selected lashes. Model-pixel units, y upward. Central upper-edge gap is diagnostic, not art acceptance; upper and closed lash silhouettes differ. Does not render masks or physics.',rows};
fs.writeFileSync(path.join(root,viewerRight?'lash-transition-viewer-right.json':'lash-transition.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(rows.filter(r=>r.smile===1).map(r=>({open:r.open,opacity:r.meshes.map(m=>m.opacity),centralUpperGap:r.centralUpperGap,upperY:r.meshes.map(m=>m.bins[4].yUpper)}))));
model.release();moc._release();
