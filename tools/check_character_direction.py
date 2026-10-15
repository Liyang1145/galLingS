"""Browser review of acting continuity, fast input, choices, CG motion and the art editor.

Run with the project's QA Python environment (Playwright + Pillow). No paid model calls.
"""
import argparse,asyncio,json,time
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'content/imports/vnstudio/海风与布丁'
CASES=[('冷怒','ps0r6nbx'),('翻本','8divye5i'),('举本','ewno9xr4'),('糍粑','78arkzfg'),('好奇','ljqevszk'),('回望','dg7yx2u8'),('写诗','jifyqa4p'),('抱膝','5dlec0jm'),('分毯','vqiksage'),('电话','48jqdyhx'),('边界','lqvlnz8o'),('退缩','39a7xd8b'),('救援','kkgzbp5s'),('和解坐姿','caqa6eg2'),('结局坐姿','pvyjs8ij'),('坐姿害羞','8tph43ss'),('坐姿得意','19js3h5w'),('坐姿嗔怪','tlygugmd')]

async def settled(page,id):
 await page.evaluate('(id)=>{hideOverlays();startPlay(P.lines.findIndex(l=>l.id===id));finishTyping();clearTimers()}',id)
 await page.wait_for_function('()=>{const l=P.lines[RT.idx];return l.sprites.every(s=>[...layer.querySelectorAll("img.spr:not(.leaving)")].some(e=>e.dataset.asset===s.asset&&e.complete&&e.naturalWidth))}')
 await page.wait_for_timeout(720)

async def review(out,edge,single):
 out.mkdir(parents=True,exist_ok=True);errors=[];checks={}
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=edge,headless=True)
  ctx=await browser.new_context(viewport={'width':1440,'height':900},record_video_dir=str(out/'recording'),record_video_size={'width':1280,'height':800})
  page=await ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto((GAME/'index.html').as_uri());await page.wait_for_function('typeof P!=="undefined"')
  for label,id in CASES:
   await settled(page,id);await page.screenshot(path=str(out/(label+'.png')))
  checks['reviewedScenes']=len(CASES)
  # Artificially delay decoding, then enter three different poses before any can commit.
  checks['rapidPoseChanges']=await page.evaluate('async()=>{const at=id=>P.lines.findIndex(l=>l.id===id),original=HTMLImageElement.prototype.decode;spriteDecodeCache.clear();HTMLImageElement.prototype.decode=function(){return new Promise(r=>setTimeout(r,110)).then(()=>original.call(this))};try{startPlay(at("ps0r6nbx"));goNext(at("ljqevszk"));goNext(at("dg7yx2u8"));finishTyping();clearTimers();await new Promise(r=>setTimeout(r,500));let el=layer.querySelector("img.spr:not(.leaving)");return {actual:el.dataset.asset,expected:P.lines[RT.idx].sprites[0].asset,active:layer.querySelectorAll("img.spr:not(.leaving)").length,ghosts:layer.querySelectorAll(".pose-ghost").length,cache:spriteDecodeCache.size};}finally{HTMLImageElement.prototype.decode=original}}')
  r=checks['rapidPoseChanges'];assert r['actual']==r['expected'] and r['active']==1 and r['ghosts']==0 and r['cache']<=6,r
  checks['cgShot']=await page.evaluate('async()=>{const at=id=>P.lines.findIndex(l=>l.id===id);startPlay(at("cp31i7u2"));finishTyping();clearTimers();await new Promise(r=>setTimeout(r,180));const a=bgEl._shot;goNext(at("p8jn2vcp"));finishTyping();clearTimers();const reused=a===bgEl._shot;await new Promise(r=>setTimeout(r,2300));const resting={scale:getComputedStyle(bgEl).scale,active:!!bgEl._shot,willChange:bgEl.style.willChange};goNext(at("ljqevszk"));finishTyping();clearTimers();return {reused,resting,cleared:bgEl.style.scale===""}}')
  r=checks['cgShot'];assert r['reused'] and r['resting']['active'] is False and r['resting']['willChange']=='' and r['cleared'],r
  # Full first-episode paths, including the four actual choice points.
  routes=[]
  for choice in range(3):
   route=await page.evaluate('async(choice)=>{startPlay(2);let visited=[],picks=0;for(let n=0;n<190;n++){finishTyping();clearTimers();const l=P.lines[RT.idx];if(l.chapter&&RT.idx>2)break;visited.push(l.id);const options=visibleChoices(l);if(options.length){choose(options[Math.min(choice,options.length-1)],false);picks++}else goNext(nextIndex(l));if(n%8===0)await new Promise(r=>setTimeout(r,20));}finishTyping();clearTimers();await new Promise(r=>setTimeout(r,300));return {choice,picks,visited:visited.length,vars:RT.vars,chapter:P.lines[RT.idx].chapter,cache:spriteDecodeCache.size,ghosts:layer.querySelectorAll(".pose-ghost").length}}',choice)
   assert route['picks']==4 and route['visited']>90 and route['cache']<=6 and not route['ghosts'],route;routes.append(route)
  checks['openingRoutes']=routes
  choice_checks=[]
  for width,height in [(1440,900),(960,540)]:
   await page.set_viewport_size({'width':width,'height':height})
   for id in ['irma08fi','vfo56g8o','fm43foif','dk3o5u4e']:
    await settled(page,id)
    hit=await page.evaluate('()=>{const r=layer.querySelector("img.spr:not(.leaving)").getBoundingClientRect();const a=P.assets[P.lines[RT.idx].sprites[0].asset];const point=a.actingEyes;const face={x:r.left+point[0]/a.w*r.width,y:r.top+point[1]/a.h*r.height};const margin=45*r.height/1000;const collisions=[...document.querySelectorAll("#choices button")].filter(b=>{const q=b.getBoundingClientRect();return face.x+margin>q.left&&face.x-margin<q.right&&face.y+margin>q.top&&face.y-margin<q.bottom});return {id:P.lines[RT.idx].id,face,buttons:document.querySelectorAll("#choices button").length,collisions:collisions.length}}')
    assert hit['buttons']==3 and not hit['collisions'],hit;choice_checks.append({'width':width,**hit})
   await page.screenshot(path=str(out/f'选项避让_{width}.png'))
  checks['choices']=choice_checks
  await page.set_viewport_size({'width':1440,'height':900});await settled(page,'dg7yx2u8')
  checks['frameSample']=await page.evaluate('()=>new Promise(resolve=>{let times=[],last=performance.now(),start=last;function f(t){times.push(t-last);last=t;if(t-start<2200)requestAnimationFrame(f);else{times.sort((a,b)=>a-b);resolve({frames:times.length,p95:times[Math.floor(times.length*.95)],max:times[times.length-1],over50:times.filter(x=>x>50).length,cache:spriteDecodeCache.size})}}requestAnimationFrame(f)})')
  await ctx.close()
  reduced=await browser.new_context(reduced_motion='reduce');rp=await reduced.new_page();await rp.goto((GAME/'index.html').as_uri());await rp.wait_for_function('typeof P!=="undefined"');await settled(rp,'cp31i7u2')
  checks['reducedMotion']=await rp.evaluate('bgEl._shot===null && getComputedStyle(bgEl).animationName==="none"');assert checks['reducedMotion'];await reduced.close()
  editor=await browser.new_page();editor.on('pageerror',lambda e:errors.append('editor:'+str(e)));await editor.goto((ROOT/'引擎开发.html').as_uri());await editor.wait_for_function('window.VN_ART_READY===true')
  assert await editor.evaluate('VN_ART_CATALOG.items.every(a=>P.assets[a.id])')
  await editor.locator('#bArt').click();await editor.locator('[aria-label="搜索美术素材"]').fill('P16');await editor.locator('[aria-label="采用状态"]').select_option('adopted');await editor.locator('.art-card').first.click();before=await editor.evaluate('L().sprites.length');await editor.locator('[data-use=single]').click();assert await editor.evaluate('L().sprites.length')==before+1;await editor.locator('#bUndo').click();assert await editor.evaluate('L().sprites.length')==before
  checks['editor']=await editor.evaluate('({items:VN_ART_CATALOG.items.length,files:VN_ART_CATALOG.physicalFiles,insertUndo:true})');await editor.close()
  if single:
   offline=await browser.new_page();offline.on('pageerror',lambda e:errors.append('offline:'+str(e)));await offline.route('https://**/*',lambda r:r.abort());await offline.route('http://**/*',lambda r:r.abort());t=time.monotonic();await offline.goto(single.as_uri(),timeout=60000);await offline.wait_for_function('typeof P!=="undefined"',timeout=60000);checks['offlineStartupSeconds']=round(time.monotonic()-t,2)
   await offline.locator('[data-t=start]').click();await settled(offline,'pvyjs8ij');assert await offline.evaluate('P.lines.length===3315 && Object.values(P.assets).every(a=>a.src.startsWith("data:"))')
   checks['offlineImages']=await offline.evaluate('Promise.all(Object.values(P.assets).filter(a=>["ch","bg"].includes(a.type)).map(a=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(a.id);i.onerror=()=>reject(a.id);i.src=a.src;}))).then(a=>a.length)')
   await offline.screenshot(path=str(out/'单文件坐姿.png'));await offline.close()
  await browser.close()
 assert not errors,errors;checks['errors']=errors
 (out/'browser-validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20);sheet=Image.new('RGB',(1440,470*((len(CASES)+1)//2)),'#c9d1d7');d=ImageDraw.Draw(sheet)
 for i,(label,_) in enumerate(CASES):
  im=Image.open(out/(label+'.png'));im.thumbnail((720,450));x=i%2*720;y=i//2*470;sheet.paste(im,(x,y+20));d.text((x+10,y),label,font=font,fill='black')
 sheet.save(out/'实机演出总览.jpg',quality=89);print(json.dumps(checks,ensure_ascii=True))

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,default=ROOT.parent.parent/'outputs/character-direction/review');ap.add_argument('--edge',default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');ap.add_argument('--single',type=Path);a=ap.parse_args();asyncio.run(review(a.output,a.edge,a.single.resolve() if a.single else None))
