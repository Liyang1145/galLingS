// Component assembly/PSD packaging only; all painted artwork is produced by image_gen.
import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire('file:///C:/Users/huang/Desktop/galagent/package.json')('sharp');
import {writePsdBuffer,readPsd,initializeCanvas} from 'file:///C:/Users/huang/Desktop/galagent/.tools/psd/node_modules/ag-psd/dist/index.js';
initializeCanvas(()=>{throw Error('Canvas unused');},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
const cfg=JSON.parse((await readFile(process.argv[2],'utf8')).replace(/^\uFEFF/,''));
const children=[];
for(const l of cfg.layers){
  let input=sharp(l.file).ensureAlpha();
  if(l.crop)input=input.extract(l.crop);
  if(l.width||l.height)input=input.resize({width:l.width,height:l.height,fit:l.width&&l.height?'fill':'inside'});
  const {data,info}=await input.raw().toBuffer({resolveWithObject:true});
  children.push({name:l.name,left:l.left||0,top:l.top||0,hidden:!!l.hidden,opacity:l.opacity??1,imageData:{data:new Uint8ClampedArray(data),width:info.width,height:info.height}});
}
const visible=children.filter(x=>!x.hidden&&x.opacity>0).map(x=>({input:Buffer.from(x.imageData.data),raw:{width:x.imageData.width,height:x.imageData.height,channels:4},left:x.left,top:x.top}));
const composite=await sharp({create:{width:cfg.width,height:cfg.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(visible).ensureAlpha().raw().toBuffer();
const bytes=writePsdBuffer({width:cfg.width,height:cfg.height,children,imageData:{width:cfg.width,height:cfg.height,data:new Uint8ClampedArray(composite)}},{generateThumbnail:false,trimImageData:false});
const check=readPsd(bytes,{useImageData:true,skipThumbnail:true});
for(let i=0;i<children.length;i++)if(!Buffer.from(children[i].imageData.data).equals(Buffer.from(check.children[i].imageData.data)))throw Error('Pixel mismatch');
await writeFile(cfg.output,bytes);
if(cfg.preview)await sharp(composite,{raw:{width:cfg.width,height:cfg.height,channels:4}}).png().toFile(cfg.preview);
console.log(JSON.stringify({output:cfg.output,layers:children.length,bytes:bytes.length,pixelRoundtrip:true}));
