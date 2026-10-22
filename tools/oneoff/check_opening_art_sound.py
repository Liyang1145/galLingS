"""Exercise actual audio playback, precise repaired actions and offline scenes."""
import argparse,asyncio,hashlib,json,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ROOT,GAME,ART

SCENES=[('空中接本','1ab8nnfn'),('首次对话','986487og'),('翻本','wxlmihwk'),
        ('举本','vfo56g8o'),('带向岸边','utu1zxyd'),('否认海流','i99npm13'),
        ('拍平水面','o6vhcy2x'),('门口烤鱿鱼','lsjm2p6r'),('鱿鱼连续镜头','wupi03c8'),
        ('契约尾鳍','urwxpwpj'),('写诗','jifyqa4p'),('柜台站起','1albn6n2'),('柜台坐姿','hkq3m6vy')]

async def review(out,single):
 out.mkdir(parents=True,exist_ok=True);checks={};errors=[]
 game=json.loads((GAME/'game.js').read_text('utf-8-sig').split('=',1)[1].strip().removesuffix(';'))
 overlay=json.loads((ART/'opening-art-sound-corrections.json').read_text('utf-8'))
 # Source file preservation is checked against actual Git blobs, not just metadata.
 baseline=json.loads(subprocess.check_output(['git','show',overlay['baseline']+':'+(GAME/'game.js').relative_to(ROOT).as_posix()],cwd=ROOT).decode('utf-8-sig').split('=',1)[1].strip().removesuffix(';'))
 audio={k:a for k,a in game['assets'].items() if a['type'] not in {'bg','ch'}}
 assert audio=={k:a for k,a in baseline['assets'].items() if a['type'] not in {'bg','ch'}}
 for aid,a in audio.items():
  path=GAME/a['src'];original=subprocess.check_output(['git','show',overlay['baseline']+':'+path.relative_to(ROOT).as_posix()],cwd=ROOT)
  assert hashlib.sha256(original).digest()==hashlib.sha256(path.read_bytes()).digest(),aid
 checks['audioAssetsAndBytesPreserved']=len(audio)
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless=True)
  page=await browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto((GAME/'index.html').as_uri());await page.wait_for_function('typeof P!=="undefined"')
  await page.locator('[data-t=start]').click()
  await page.evaluate('''()=>{window.__effectPlays=[];const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(this._assetId?.startsWith('sfx_'))
    window.__effectPlays.push({id:this._assetId,volume:this.volume,at:performance.now()});return original.call(this)}}''')
  async def enter(id):
   await page.evaluate('id=>{hideOverlays();startPlay(P.lines.findIndex(l=>l.id===id));finishTyping();clearTimers()}',id)
   await page.wait_for_timeout(550)
  for label,id in SCENES:
   await enter(id);await page.screenshot(path=str(out/(label+'.png')))
  checks['screenshots']=len(SCENES)
  await enter('o6vhcy2x')
  r=await page.evaluate('''()=>{const e=[...activeEffects].find(e=>e._assetId==='sfx_s04_tail_flattens_water_v01');
    return {id:P.lines[RT.idx].id,skip:RT.skip,active:!!e,playing:e?!e.paused:false,
    currentTime:e?.currentTime,volume:e?.volume,gain:e?._gain,ready:e?.readyState,
    ambience:[...ambientTracks.keys()]}}''')
  assert r['active'] and r['playing'] and r['currentTime']>.1 and r['gain']==.85 and r['ready']>=2,r
  checks['normalSlapPlayback']=r
  counts=[]
  for id,expected in [('frtp4eyj',['sfx_tail_water_double','sfx_tail_water_light']),
                      ('3ua9v325',['sfx_tail_water_double','sfx_tail_water_double','sfx_tail_water_light']),
                      ('kbwv46du',['sfx_tail_water_double','sfx_tail_water_double','sfx_tail_water_light'])]:
   await page.evaluate('()=>{stopEffects();window.__effectPlays=[]}')
   await enter(id);await page.wait_for_timeout(1900)
   actual=await page.evaluate('window.__effectPlays')
   assert [e['id'] for e in actual]==expected,(id,actual)
   counts.append({'lineId':id,'clips':actual})
  checks['threeAndFiveSlaps']=counts
  await enter('3ua9v325')
  await page.evaluate('()=>{RT.skip=true;applyLineAudio(P.lines[RT.idx]);}')
  r=await page.evaluate('({active:activeEffects.size,scheduled:scheduledEffects.size})')
  assert r=={'active':0,'scheduled':0};checks['skipSilencesAndCancelsSfx']=True
  await page.evaluate('()=>{RT.skip=false}')
  await enter('3ua9v325');await enter('wupi03c8')
  assert await page.evaluate('scheduledEffects.size')==0;checks['advanceCancelsDelayedSlaps']=True
  for id,sfx in [('n7sguoiy','sfx_tail_water_light'),('0xhf540s','sfx_tail_close_door')]:
   await page.evaluate('()=>{window.__effectPlays=[]}');await enter(id)
   assert await page.evaluate('(id)=>window.__effectPlays.some(e=>e.id===id)',sfx)
  checks['softSlapAndDoorTrigger']=True
  await page.close()
  if single:
   page=await browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
   page.on('pageerror',lambda e:errors.append('offline:'+str(e)))
   await page.route('http://**/*',lambda r:r.abort());await page.route('https://**/*',lambda r:r.abort())
   await page.goto(single.resolve().as_uri(),timeout=90000);await page.wait_for_function('typeof P!=="undefined"',timeout=90000)
   await page.locator('[data-t=start]').click()
   assert await page.evaluate('P.lines.length===3315 && Object.values(P.assets).every(a=>a.src.startsWith("data:"))')
   decoded=await page.evaluate('''async()=>{let count=0;for(const a of Object.values(P.assets).filter(a=>['bg','ch'].includes(a.type))){
     await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{i.removeAttribute('src');count++;resolve()};i.onerror=()=>reject(a.id);i.src=a.src});}return count}''')
   expected_ids={game['settings']['cover']['img']}
   for line in game['lines']:expected_ids.add(line['bg']);expected_ids.update(s['asset'] for s in line['sprites'])
   assert decoded==len([id for id in expected_ids if id in game['assets'] and game['assets'][id]['type'] in ['bg','ch']])
   checks['allOfflineImagesDecoded']=decoded
   await enter('utu1zxyd');await page.screenshot(path=str(out/'单文件_侧面动作.png'))
   await page.close()
  await browser.close()
 assert not errors,errors;checks['errors']=errors
 (out/'opening-validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(checks,ensure_ascii=True))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT.parent.parent/'outputs/opening-art-sound-corrections/review');p.add_argument('--single',type=Path);a=p.parse_args();asyncio.run(review(a.output,a.single))
