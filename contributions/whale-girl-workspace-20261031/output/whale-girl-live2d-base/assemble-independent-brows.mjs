// PSD assembly only: preserve the two existing painted brows at native resolution.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire('file:///<USERPROFILE>/Desktop/galagent/package.json')('sharp');
const root='./output/whale-girl-live2d-base/';
const file=root+'layers/eyebrows-draft-v1.png';
const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const bounds=[];
for(let half=0;half<2;half++) {
  const start=Math.floor(info.width*half/2),end=Math.floor(info.width*(half+1)/2);
  let x0=end,y0=info.height,x1=start,y1=0;
  for(let y=0;y<info.height;y++)for(let x=start;x<end;x++)if(data[(y*info.width+x)*4+3]>=32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
  if(x1<=x0||y1<=y0)throw Error('Missing painted brow');
  bounds.push({left:Math.max(start,x0-4),top:Math.max(0,y0-4),width:Math.min(end,x1+4)-Math.max(start,x0-4),height:Math.min(info.height,y1+4)-Math.max(0,y0-4)});
}
const minX=Math.min(...bounds.map(b=>b.left)),minY=Math.min(...bounds.map(b=>b.top));
const cfg={width:2048,height:1536,output:root+'independent-brows-import-v6.psd',layers:bounds.map((b,i)=>({name:i?'Brow_ViewerRight_v6':'Brow_ViewerLeft_v6',file,crop:b,left:200+b.left-minX,top:200+b.top-minY})),provenance:'Unmodified eyebrows-draft-v1.png; spatial crop and PSD placement only; not yet imported or rigged.'};
await writeFile(root+'independent-brows-import-v6.json',JSON.stringify(cfg,null,2));
console.log(JSON.stringify({sourceSize:[info.width,info.height],bounds,paintedSpan:Math.max(...bounds.map(b=>b.left+b.width))-minX}));
