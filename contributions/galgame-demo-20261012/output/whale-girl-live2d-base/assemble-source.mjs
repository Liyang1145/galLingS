// Place generated component artwork into a common coordinate system for Cubism.
// This performs size/position registration, not painting, segmentation or inpainting.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
const sharp=createRequire('file:///C:/Users/huang/Desktop/galagent/package.json')('sharp');
const root=fileURLToPath(new URL('./',import.meta.url)).replaceAll('\\','/');
// Back-to-front drawing order. Coordinates are an initial assembly, subject to visual QA.
const specs=[
 ['Tail','tail',560,755,null,570],
 ['HairBack','rear-hair',205,75,null,625],
 ['ArmR','arm-viewer-left',224,332,null,505],
 ['ArmL','arm-viewer-right',620,332,null,505],
 ['BodyCore','body-core',365,260,null,1210],
 ['Coverup','white-coverup',302,292,null,568],
 ['Face','face-base',418,78,null,230],
 ['EyeR_Open','eye-viewer-left',435,226,55,26],
 ['EyeL_Open','eye-viewer-right',516,226,55,26],
 ['EyeR_Closed','closed-eye-viewer-left',435,246,55,6,0],
 ['EyeL_Closed','closed-eye-viewer-right',516,246,55,6,0],
 ['Eyebrows','eyebrows',434,211,138,10],
 ['MouthOpen','mouth-open',490,272,25,15,0],
 ['MouthClosed','mouth-closed',490,279,25,4],
 ['HairFrontStrands','front-strands',385,210,null,310],
 ['HairCap','bangs-accessories',326,18,350,null]
];
const layers=[];
for(const [name,id,left,top,width,height,opacity] of specs){
 const v2=root+'layers/'+id+'-draft-v2.png';
 const file=process.argv.includes('--v2')&&existsSync(v2)?v2:root+'layers/'+id+'-draft-v1.png';
 if(process.argv.includes('--partial')&&!existsSync(file)){console.error('Pending artwork: '+id);continue;}
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=info.width,y0=info.height,x1=0,y1=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
 x0=Math.max(0,x0-4);y0=Math.max(0,y0-4);x1=Math.min(info.width,x1+4);y1=Math.min(info.height,y1+4);
 layers.push({name,file,left,top,crop:{left:x0,top:y0,width:x1-x0,height:y1-y0},...(width?{width}:{}),...(height?{height}:{}),...(opacity===0?{opacity:0}:{})});
}
const suffix=process.argv.includes('--partial')?'partial-v1':process.argv.includes('--v2')?'v2':'v1';
const cfg={width:1024,height:1536,layers,output:root+'whale-girl-layered-'+suffix+'.psd',preview:root+'assembly-preview-'+suffix+'.png',status:process.argv.includes('--partial')?'partial artwork assembly; native rig pending':'initial assembly; native rig pending'};
await writeFile(root+'whale-girl-layered-'+suffix+'.json',JSON.stringify(cfg,null,2));
console.log(JSON.stringify({layers:layers.length,output:cfg.output}));
