// Native triangle-orientation diagnostic. Visibility uses opacity only; this
// does not render clipping masks, textures, or physics and is not art acceptance.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sharp = require('node:module').createRequire('<USERPROFILE>/Desktop/galagent/package.json')('sharp');
const modelFile = path.resolve(process.argv[2]);
const root = path.dirname(modelFile);
const viewerRight = process.argv[3] === 'viewer-right';
const includeHidden = process.argv.includes('--include-hidden');
const eyeSide = viewerRight ? 'L' : 'R';
const manifest = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
const coreFile = '<USERPROFILE>/Desktop/galagent/prototypes/live2d/vendor/CubismSdkForWeb-5-r.5/Core/live2dcubismcore.js';
const context = vm.createContext({console, require, process, Buffer, __dirname:path.dirname(coreFile), module:{exports:{}}, exports:{}, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder});
vm.runInContext(fs.readFileSync(coreFile, 'utf8'), context, {filename:coreFile});
setTimeout(async () => {
  const core = context.Live2DCubismCore;
  const bytes = fs.readFileSync(path.join(root, manifest.FileReferences.Moc));
  const moc = core.Moc.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
  if (!moc) throw Error('Native MOC cannot load');
  const model = core.Model.fromMoc(moc), p = model.parameters, d = model.drawables;
  const set = (id,value) => { const i=p.ids.indexOf(id); if(i<0)throw Error('Missing '+id); p.values[i]=value; };
  const areas = j => {
    const v=d.vertexPositions[j], idx=d.indices[j], result=[];
    for(let t=0;t<idx.length;t+=3) {
      const a=2*idx[t], b=2*idx[t+1], c=2*idx[t+2];
      result.push((v[b]-v[a])*(v[c+1]-v[a+1])-(v[b+1]-v[a+1])*(v[c]-v[a]));
    }
    return result;
  };
  const ids=viewerRight ? ['Lash_Overlay_Test','Sclera_Only_Test','ClosedLash_Hi_L_v5'] : ['Lash_Overlay_Test2','Sclera_Only_Test2','ClosedLash_Hi_v5'];
  const textures=await Promise.all(manifest.FileReferences.Textures.map(file=>sharp(path.join(root,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true})));
  const paintedTriangles = j => {
    const {data,info}=textures[d.textureIndices[j]], uv=d.vertexUvs[j], idx=d.indices[j], result=[];
    for(let t=0;t<idx.length;t+=3) {
      const a=[idx[t],idx[t+1],idx[t+2]].map(k=>[uv[2*k]*info.width,(1-uv[2*k+1])*info.height]);
      const denom=(a[1][1]-a[2][1])*(a[0][0]-a[2][0])+(a[2][0]-a[1][0])*(a[0][1]-a[2][1]);
      let opaque=0;
      if(Math.abs(denom)>1e-8) {
        const x0=Math.max(0,Math.ceil(Math.min(...a.map(v=>v[0])))), x1=Math.min(info.width-1,Math.floor(Math.max(...a.map(v=>v[0]))));
        const y0=Math.max(0,Math.ceil(Math.min(...a.map(v=>v[1])))), y1=Math.min(info.height-1,Math.floor(Math.max(...a.map(v=>v[1]))));
        for(let y=y0;y<=y1;y+=2)for(let x=x0;x<=x1;x+=2) {
          if(data[(y*info.width+x)*4+3]<128)continue;
          const w0=((a[1][1]-a[2][1])*(x+.5-a[2][0])+(a[2][0]-a[1][0])*(y+.5-a[2][1]))/denom;
          const w1=((a[2][1]-a[0][1])*(x+.5-a[2][0])+(a[0][0]-a[2][0])*(y+.5-a[2][1]))/denom;
          if(Math.min(w0,w1,1-w0-w1)>=-1e-5)opaque++;
        }
      }
      result.push(opaque);
    }
    return result;
  };
  p.values.set(p.defaultValues); model.update();
  const selected=ids.map(id=>{const j=d.ids.indexOf(id); if(j<0)throw Error('Missing '+id); return {id,j,base:areas(j),basePositions:Array.from(d.vertexPositions[j]),painted:paintedTriangles(j),vertexCount:d.vertexCounts[j]};});
  const failures=[];
  let poses=0, trianglesChecked=0, nearDegenerate=0;
  for(const x of [-30,0,30])for(const y of [-30,0,30])for(const z of [-30,0,30])
  for(const smile of [0,.5,1])for(const open of [0,.03125,.0625,.09375,.125,.15625,.1875,.21875,.25,.3125,.375,.4375,.5,.75,1]) {
    p.values.set(p.defaultValues); set('ParamAngleX',x); set('ParamAngleY',y); set('ParamAngleZ',z); set('ParamEye'+eyeSide+'Smile',smile); set('ParamEye'+eyeSide+'Open',open); model.update(); poses++;
    for(const {id,j,base,basePositions,painted} of selected) {
      if(!includeHidden && d.opacities[j]<.02)continue;
      const current=areas(j); let flips=0, paintedFlips=0, degenerate=0;
      const examples=[];
      for(let t=0;t<current.length;t++) {
        if(!Number.isFinite(current[t]))throw Error('Nonfinite triangle area');
        trianglesChecked++;
        if(Math.abs(current[t])<1e-10)degenerate++;
        if(Math.abs(base[t])>1e-10 && current[t]*Math.sign(base[t]) < -1e-10) {
          flips++; if(painted[t]>=3)paintedFlips++;
          if(x===0&&y===0&&z===0&&smile===0&&[.125,.25,.5].includes(open)&&painted[t]>=3) {
            const vertices=Array.from(d.indices[j].slice(3*t,3*t+3));
            const points=positions=>vertices.map(k=>[positions[2*k]*1024,positions[2*k+1]*1024]);
            examples.push({triangle:t,vertices,opaqueUvSamples:painted[t],defaultPoints:points(basePositions),currentPoints:points(d.vertexPositions[j])});
          }
        }
      }
      nearDegenerate+=degenerate;
      if(flips)failures.push({x,y,z,smile,open,id,opacity:d.opacities[j],flips,paintedFlips,degenerate,...(examples.length?{examples}:{})});
    }
  }
  const report={modelFile,eyeSide:viewerRight?'viewer-right':'viewer-left',includeHidden,testedAt:new Date().toISOString(),scope:'Selected eye triangle signs relative to default pose, '+(includeHidden?'including zero-opacity meshes':'opacity>=.02')+', XYZ x Smile x near-closed Open samples. Painted flips require >=3 alpha>=128 UV samples at 2px stride. Does not render masks, painted silhouettes, or physics.',meshes:selected.map(({id,j,base,painted,vertexCount})=>({id,vertexCount,triangleCount:base.length,paintedTriangles:painted.filter(n=>n>=3).length})),poses,trianglesChecked,nearDegenerate,failureCount:failures.length,paintedFailureCount:failures.filter(f=>f.paintedFlips>0).length,failures};
  fs.writeFileSync(path.join(root,'eye-folding'+(viewerRight?'-viewer-right':'')+(includeHidden?'-including-hidden':'')+'.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,failures:failures.slice(0,8)}));
  model.release(); moc._release();
  if(failures.length)process.exitCode=1;
},1200);
