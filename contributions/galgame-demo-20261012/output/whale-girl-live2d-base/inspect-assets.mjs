import {createRequire} from 'node:module';
import {readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sharp=createRequire('file:///<USERPROFILE>/Desktop/galagent/package.json')('sharp');
const dir=new URL('./layers/',import.meta.url);
const assets=[];
for(const file of await readdir(dir)){
 if(!file.endsWith('.png'))continue;
 const {data,info}=await sharp(fileURLToPath(new URL(file,dir))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0,visible=0,soft=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a>0)soft++;if(a>=32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);visible++;}}
 assets.push({file,width:info.width,height:info.height,visiblePixels:visible,nonzeroAlphaPixels:soft,bounds:{left,top,right,bottom},sha256:createHash('sha256').update(data).digest('hex'),status:'artwork draft; native alignment and rigging pending'});
}
await writeFile(new URL('./source-assets.json',import.meta.url),JSON.stringify({method:'image_gen artwork, lossless PSD packaging',assets},null,2));
console.log(JSON.stringify({assets:assets.length,allNonempty:assets.every(a=>a.visiblePixels>0),manifest:'source-assets.json'}));
