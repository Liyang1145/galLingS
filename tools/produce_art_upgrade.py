"""Reference-driven, resumable art production through the installed subscription CLI.

Only requests images; adoption requires explicit review in the manifest.
No tokens, account records or API keys are copied to the repository.
"""
from __future__ import annotations
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'A素材库/art-upgrade'
GAME=ROOT/'content/imports/vnstudio/海风与布丁'
CLI=Path.home()/'.codex/skills/codex-gpt-image/scripts/codex_gpt_image.py'
MANIFEST=ART/'production.json'
LOCK=threading.Lock()
STYLE='''Match the two user references: premium finely painted Japanese anime visual novel art, clean delicate outlines, coherent anatomy and perspective, subtle painterly material detail, luminous coastal blue palette, restrained clear highlights, sophisticated soft light. The heroine is the SAME ADULT woman aged 24: blue/periwinkle long hair, blue eyes, loop ahoge, cyan bow clips, blue-white fin ears, two human legs PLUS an independent mottled-blue whale tail growing behind the lower back. Human legs never turn into a mermaid tail. Use exact costume references. No watermark, typography, pseudo-writing, UI, duplicated people, extra limbs, warped fingers, floaty unrelated props or sexualized framing. Important faces and story actions stay above the lower 28% reserved for dialogue.'''
SPRITE='''One full-body production CHARACTER SPRITE. Real transparent alpha background, no scenery, floor, shadow, halo or painted checkerboard. Opaque figure interiors, clean antialiased edges and transparent holes between hair, limbs and tail. Same framing, body size and shoe baseline as the costume master; preserve adult face, hairstyle, clothes and tail geometry exactly. Include whole ahoge, both feet and both whale flukes inside generous margins. Soft neutral daylight, no scene-specific colored glow. Single character only.'''
BG='''One complete 16:9 EMPTY BACKGROUND for the game. Preserve the scene reference's architectural layout, camera, coastline and recurring objects. Upgrade painting finesse and lighting to match the user illustration's environment. The user image is STYLE ONLY: do not paint its woman, tail, face, bows or giant character into the empty scene. Keep an open staging area for overlaid sprites. No principal characters or foreground hands; market scenes can contain tiny indistinct distant shoppers. Daylight, sky, moon and electric lamps must agree with the specified time. No printed text. Household and commercial kitchens are different rooms.'''
CG='''One complete 16:9 EVENT CG, a new coherent illustration rather than pasted sprites. The FIRST wide location reference is the target landscape canvas: preserve its 16:9 framing, location, architecture and time of day. The SECOND costume master controls the heroine's exact face, hair, anatomy, outfit and tail. The following user identity images reinforce her recognizable face and style. Characters interact naturally with the environment. Use expressive eyes, believable hands and physically connected actions. When a man is present he is an adult age 26, short black hair, rectangular glasses, white long-sleeved shirt and navy trousers; player-perspective hands/shoulder are preferred when the script allows it. Avoid showing a man's face unnecessarily. No swimsuit or outfit change unless requested. Water scenes still have two human legs and a separate whale tail. Keep the central emotional action visible above dialogue. The final CG must stay landscape even though character-reference images are portrait.'''
OUTFITS={
 'L13':'Replace ONLY the dress with a tasteful blue-and-white ankle-length summer sundress with thin straps and opaque fabric, white flat sandals. Keep the same adult identity. The SCRIPT explicitly says her whale tail is folded out of sight INSIDE the skirt during the market walk: no visible tail outside this sprite, but keep two normal human legs and the same underlying anatomy. Relaxed neutral pose. No necklace or bracelet.',
 'L17':'Ordinary summer holiday outfit: opaque DARK NAVY BLUE one-piece swimsuit (not light blue) with one small pale-blue whale motif, light white open short-sleeved beach cover-up, white thigh-high socks and flat sandals, following the script. Neutral relaxed standing pose. Adult age24, no provocative pose, no emphasis on intimate anatomy, no see-through swimwear. Keep both human legs and independent tail. No popsicle, jewelry or water droplets.',
 'L21':'Classic refined BLACK AND WHITE maid dress, modest knee-length skirt, white sewn-in apron panel and puff sleeves, dark stockings and plain low shoes. This is the dress AFTER the extra blue-and-white OUTER cooking apron was removed; keep the maid dress intact. Keep blue bow clips and fin ears; no generic human maid substituted. Neutral standing pose. No basket unless specified.',
 'L24':'Breakfast home outfit: comfortable opaque pale-blue knee-length robe with a white cooking apron tied over it, simple indoor slippers. Neutral attentive expression. No swimsuit, towel-only outfit or exposed underwear. This is a domestic cooking outfit.',
 'L27':'Opaque loose light-blue whale-pattern pajamas: long-sleeved top and full-length matching trousers, soft indoor slippers. Full everyday sleepwear, no nightgown or swimsuit. Neutral gentle expression, no necklace yet. Tail emerges behind the trousers at the lower back.',
 'L29':'Elegant simple opaque white ankle-length summer dress, subtle blue edging, plain flat sandals. Neutral warm expression. Preserve adult identity and whale tail; no necklace for this state.',
 'L31':'Formal grown-up outfit: an elegant solid navy-blue knee-length dress with a refined neckline, short sleeves, restrained pale-blue waist detail and white low shoes. Distinct from her everyday sailor-collar dress: NO sailor collar, school emblem or school uniform. Sincere neutral expression.'}
FAMILY_PARENT={'B01':'B02','B03':'B02','B04':'B02','B05':'B02','B06':'B05','B07':'B05','B08':'B02','B09':'B08','B10':'B08','B12':'B11','B14':'B02','B16':'B15','B17':'B19','B18':'B17','B20':'B26','B22':'B21','B23':'B21','B24':'B23','B25':'B23','B29':'B28','B30':'B28','B32':'B31','B33':'B34','B35':'B28','B36':'B35','B37':'B38','B39':'B38','B40':'B38','B41':'B38','B42':'B38','O01':'B15','O02':'B37'}
CG_OUTFIT={'C01':'L01','C02':'L01','C03':'L01','C04':'L01','C05':'L19','C06':'L20','C07':'L13','C08':'L34','C09':'L35','C10':'L01','C11':'L01','C12':'L10','C13':'L19','C14':'L11','C15':'L01','C17':'L27','C18':'L10','C19':'L31','C20':'L32','C21':'L34','C22':'L01','C23':'L17','C24':'L21','C25':'L28','T01':'L01'}
def save(state):
    reviews=ART/'reviews.json'
    if reviews.exists():
        for key,review in json.loads(reviews.read_text(encoding='utf-8')).items():
            item=state['items'].get(key,{})
            if item.get('sha256')==review['sha256']:
                item['review']=review['status'];item['review_note']=review['note']
    MANIFEST.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def output(key):return ART/'originals'/f'{key}.png'
def record(path):
    with Image.open(path) as im:
        im.load(); info={'size':list(im.size),'mode':im.mode}
        if im.mode=='RGBA':
            h=im.getchannel('A').histogram();info.update(alpha_zero=h[0],alpha_nearly_opaque=sum(h[250:]))
    return {'file':path.relative_to(ROOT).as_posix(),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),**info}
def prepare():
    for folder in ['references','prompts','originals','review']:(ART/folder).mkdir(parents=True,exist_ok=True)
    old=json.loads((ROOT/'docs/content/art-production/全量图片制作清单.json').read_text(encoding='utf-8-sig'))
    project=json.loads((GAME/'game.js').read_text(encoding='utf-8-sig').split('=',1)[1].strip().removesuffix(';'))
    state=json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {'scope':'全量运行美术、36立绘、25事件CG、44背景、封面与必要增强，原件保留','requested_model':'gpt-image-2.5-flare','requested_quality':'max','source_game_sha256':hashlib.sha256((GAME/'game.js').read_bytes()).hexdigest(),'source_nodes':len(project['lines']),'items':{}}
    overrides_file=ART/'overrides.json'
    overrides=json.loads(overrides_file.read_text(encoding='utf-8')) if overrides_file.exists() else {}
    jobs=[]
    for row in old['rows']:
        key=row['id'];kind={'背景':'bg','角色差分':'sprite','事件CG':'cg','封面':'cover'}[row['category']]
        job={'id':key,'name':row['name'],'kind':kind,'spec':row['requirements'],'time':row['time'],'costume':row['costume'],'old_names':row['old_names'],'anchors':row['anchors'],'dependencies':[],'references':[],'status':'queued','review':'pending'}
        if kind=='bg':
            job['references']=[f'legacy:{key}','user:face']
            if key in FAMILY_PARENT:job['dependencies']=[FAMILY_PARENT[key]];job['references'].insert(1,FAMILY_PARENT[key])
            prompt=BG+'\n'+STYLE+'\nPrimary scene: '+row['name']+'\nTime: '+row['time']+'\nProduction constraints: '+row['requirements']+'\nReference order: FIRST is the exact target-location camera, SECOND generated family image if supplied is only for shared geometry/materials, LAST is user style. Do not replace the first target location with the family reference room or street. Final 16:9 landscape framing.'
        elif kind=='sprite':
            master=next((d for d in row['dependencies'] if d.startswith('L')),None)
            if key=='L01':master='R01_clean'
            if key in OUTFITS:master='L01'
            if key in ['L19','L33','L34','L35']:master='L01'
            if not master:master='L01'
            job['dependencies']=[master];job['references']=[master,'user:face','user:body']
            prompt=SPRITE+'\n'+STYLE+'\nAsset: '+row['name']+'\nCostume: '+row['costume']+'\nChange requested: '+OUTFITS.get(key,row['requirements'])+'\nThe first image is the exact character/costume master. The other two images define identity only. For expression variants change only facial expression, ear-fin emotion and indicated gestures; keep torso position, head size, dress hem, shoes and tail unchanged.'
            if key in ['L13','L14','L15','L16']:
                prompt+='\nPriority scene override: the market sundress hides her folded whale tail beneath the skirt, as specified in the script. Do not expose a whale tail outside the skirt; preserve both human legs. This outfit override takes priority over general visible-tail rules.'
            if master!='L01' or key in ['L02','L03','L04','L05','L06','L07','L08','L09','L10','L11','L12']:
                job['references']=[master]
        else:
            bg=next((d for d in row['dependencies'] if d.startswith('B')),None)
            costume=CG_OUTFIT.get(key,'L01');job['dependencies']=[costume]+([bg] if bg else [])
            job['references']=([bg] if bg else [])+[costume,'user:face','user:body']
            prompt=CG+'\n'+STYLE+'\nScene: '+row['name']+'\nTime/location: '+row['time']+'\nCostume/state: '+row['costume']+'\nExact story action: '+row['requirements']+'\nReference order: wide landscape location, exact character/costume master, then user identity originals. Read them in that role order. Highest-finish 16:9 painting.'
            if key=='C16':
                job['dependencies']=['B25'];job['references']=['B25'];prompt='One premium finely painted Japanese visual novel 16:9 PROP CLOSE-UP: two matching simple silver rings, each with ONE small sky-blue pearl, resting on a muted dark jeweler cloth in the exact silverworker shop reference. One adult feminine hand gently holds one ring. Identical ring design and pearl color. Avoid giant gems, extra jewelry, hearts, face/body portrait or printed labels. Leave engraving surfaces clean for later exact Chinese typography. Coherent perspective, delicate jewelry materials, gentle daylight.'
            if kind=='cover':prompt+='\nPlace the adult heroine on the right third beside the familiar daylight coastline, full human body and independent whale tail. Left half is calm open blue sea/sky for the existing title and menu, no generated title lettering or logos. No signature. This is a welcoming summer romance cover.'
        job['prompt']=prompt;job['requested_size']='1536x2304' if kind=='sprite' else '3840x2160'
        jobs.append(job)
    # All currently registered spare scenes are remade too; extra optional scenes remain assets until correctly anchored.
    for key,name,spec in [('O01','营地外清晨','同B15营地结构，清晨灯灭、火堆熄灭。'),('O02','店外初秋营业','同B37店外结构，初秋柔和日光、招牌留白。')]:
        parent=FAMILY_PARENT[key];jobs.append({'id':key,'name':name,'kind':'bg','spec':spec,'old_names':[],'dependencies':[parent],'references':[parent,f'legacy:{key}','user:face'],'prompt':BG+'\n'+STYLE+'\n'+spec,'requested_size':'3840x2160','status':'queued','review':'pending'})
    additions=[
     ('O03','常服薄外套','sprite','L01',None,'Add a simple light cream cardigan over the exact everyday navy dress, arms relaxed. Preserve clothes underneath, adult identity, two legs and tail. No jewelry.'),
     ('O04','未通过结局','cg','L01','B04','Moonlit shoreline ending branch: she gently holds the small silver chain with sky-blue pearl in her hand, NOT wearing it. Restrained hopeful uncertainty, same moon/coast as the reference. Not tragic collapse.'),
     ('O05','海盐布丁制作','cg','L24','B41','Commercial dessert-shop kitchen, ordinary daytime cooking: she calmly checks a small saucepan of sea-salt pudding, apron over opaque clothing. A few small pudding jars on the counter, focused fond expression. No text.'),
     ('O06','家庭日记共读','cg','L01','B33','Morning at the home dining table: two open small diaries side by side, the same adult heroine reading one and pointing to a line with a finger; viewer opposite. Blank non-readable pages for later typography, two breakfast settings, intimate domestic atmosphere.'),
     ('O07','采购天青珍珠','cg','L01','B24','Pearl seller in coastal market: heroine carefully compares one small sky-blue pearl to another small pearl in her open palm. Old keepsake compared with a new purchase; emotionally attentive eyes. Pearls plausible jewelry size, no giant orb, no text.'),
     ('O08','秋千验收','cg','L01','B26','Morning courtyard of the same blue-roofed house: heroine sits on the correctly attached wooden swing beneath the courtyard tree, hands on two ropes, shoes just above ground, tail independent behind her. Satisfied quietly proud expression. Believable swing construction.'),
     ('O09','窗前铃铛','cg','L01','B29','Sunset in the same home study: heroine holds a small blue-and-white shell wind-chime at the window, tail tip lightly curling near the wooden window frame. Tender, slightly proud expression, actual coast outside. No extra limbs.'),
     ('O10','开张时僵住','cg','L01','B37','Daytime shop opening outside the same dessert shop: she has just heard she is a co-owner, surprised and touched, one hand near chest, ears raised, tail held still. Ordinary adult woman, same outfit, no text, no invented ceremony.'),
     ('O11','月光尾鳍圈影','cg','L34','B04','Moonlit shoreline, quiet seated pair seen at a gentle diagonal: heroine and adult male shoulders close, her whale tail curving softly around their two moon-cast shadows on the rock. Show both human legs and tail separately. Intimate visual metaphor, no huge magical circle, same moon and coastline.')]
    for key,name,kind,costume,bg,spec in additions:
        jobs.append({'id':key,'name':name,'kind':kind,'spec':spec,'old_names':[],'dependencies':[costume]+([bg] if bg else []),'references':([bg] if bg else [])+[costume,'user:face','user:body'],'prompt':(SPRITE if kind=='sprite' else CG)+'\n'+STYLE+'\n'+spec,'requested_size':'1536x2304' if kind=='sprite' else '3840x2160','status':'queued','review':'pending'})
    for job in jobs:
        job.update(overrides.get(job['id'],{}))
        key=job['id'];existing=state['items'].get(key,{})
        state['items'][key]={**existing,**job,'status':existing.get('status','queued'),'review':existing.get('review','pending')};(ART/'prompts'/f'{key}.txt').write_text(job['prompt']+'\n',encoding='utf-8')
        if state['items'][key]['status']=='generated':state['items'][key].update(record(output(key)))
    # Mother sprite is deliberately reused, without claiming a separate generation.
    shutil.copy2(output('R01_clean'),output('L01'))
    state['items']['L01'].update(status='generated',review='approved',source='R01_clean',approval='Adult identity, two legs plus independent whale tail, alpha composited on checkerboard inspected',**record(output('L01')))
    state['items']['L01']['generation']=json.loads(output('R01_clean').with_suffix('.generation.json').read_text(encoding='utf-8'))
    state['mother']={'file':output('R01_clean').relative_to(ROOT).as_posix(),'review':'approved','requested_quality':'max','reported_quality':'medium','model_route_verified':False}
    save(state);return state
def reference(raw):
    if raw=='user:face':return ART/'references/user_face_style.jpg'
    if raw=='user:body':return ART/'references/user_fullbody_tail.jpg'
    if raw.startswith('legacy:'):return ROOT/'A素材库/scene-backgrounds/originals'/f'{raw.split(":")[1]}.png'
    return output(raw)
def approved(state,key):
    item=state['items'].get(key,{})
    if item.get('status')!='generated' or not output(key).exists():return False
    reviews=ART/'reviews.json'
    if reviews.exists():
        review=json.loads(reviews.read_text(encoding='utf-8')).get(key)
        if review and review['sha256']==item.get('sha256'):return review['status']=='approved'
    return item.get('review')=='approved'
def generate(state,key):
    job=state['items'][key];refs=[reference(r) for r in job['references']]
    assert all(p.is_file() for p in refs),(key,refs)
    cmd=[sys.executable,str(CLI),'generate','--prompt-file',str(ART/'prompts'/f'{key}.txt'),'--model','gpt-image-2.5-flare','--quality','max','--size',job['requested_size'],'--background','transparent' if job['kind']=='sprite' else 'opaque','--output-format','png','--out',str(output(key)),'--timeout','300']
    for path in refs:cmd+=['--image',str(path)]
    with LOCK:job['status']='generating';job['started']=time.time();save(state)
    audit={'prompt':job['prompt'],'requested_model':'gpt-image-2.5-flare','requested_quality':'max',
           'requested_size':job['requested_size'],
           'references':[{'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in refs]}
    print(f'START {key} {job["name"]}',flush=True)
    try:
        result=subprocess.run(cmd,capture_output=True,encoding='utf-8',errors='replace',timeout=340)
        if result.returncode:raise RuntimeError(result.stderr[-1800:])
        info=record(output(key));metadata=json.loads(output(key).with_suffix('.generation.json').read_text(encoding='utf-8'))
        audit['output_sha256']=info['sha256'];audit['actual_size']=info['size']
        output(key).with_suffix('.production.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        if job['kind']=='sprite' and not info.get('alpha_zero'):raise ValueError('Sprite has no transparent background')
        with LOCK:job.update(status='generated',review='pending',generation=metadata,elapsed=round(time.time()-job['started'],1),**info);save(state)
        print(f'DONE {key} {info["size"]} quality={metadata.get("backend_reported_quality")}',flush=True)
    except Exception as exc:
        with LOCK:job.update(status='failed',error=str(exc));save(state)
        print(f'FAILED {key}: {str(exc)[:350]}',flush=True)
def run(state,workers,only=None):
    pending={key for key,item in state['items'].items() if item['status']=='queued' and (not only or key in only)}
    active={}
    with cf.ThreadPoolExecutor(max_workers=workers) as pool:
        while pending or active:
            ready=sorted(key for key in pending if all(approved(state,dep) for dep in state['items'][key]['dependencies']))
            while ready and len(active)<workers:
                key=ready.pop(0);pending.remove(key);active[pool.submit(generate,state,key)]=key
            if not active:break
            done,_=cf.wait(active,timeout=25,return_when=cf.FIRST_COMPLETED)
            for f in done:f.result();active.pop(f)
            if not done:print(f'PROGRESS generated={sum(i["status"]=="generated" for i in state["items"].values())}/{len(state["items"])} active={list(active.values())}',flush=True)
    print(json.dumps({'generated':sum(i['status']=='generated' for i in state['items'].values()),'failed':[k for k,v in state['items'].items() if v['status']=='failed'],'waiting':sorted(pending)},ensure_ascii=False),flush=True)
def sheets(state):
    font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
    for kind in ['sprite','bg','cg','cover']:
        ids=[k for k,v in state['items'].items() if v['kind']==kind and v['status']=='generated']
        for start in range(0,len(ids),6):
            width,height=(1800,1100) if kind!='sprite' else (1800,2100)
            sheet=Image.new('RGB',(width,height),'#d9dce0');draw=ImageDraw.Draw(sheet)
            for index,key in enumerate(ids[start:start+6]):
                x=index%3*600;y=index//3*(height//2)
                with Image.open(output(key)) as source:
                    source=source.convert('RGBA');source.thumbnail((590,height//2-55));tile=Image.new('RGBA',source.size,'#d9dce0');tile.alpha_composite(source);sheet.paste(tile.convert('RGB'),(x,y))
                draw.text((x+8,y+height//2-45),f'{key} {state["items"][key]["name"]}',font=font,fill='black')
            sheet.save(ART/'review'/f'{kind}_{start//6+1:02}.jpg',quality=96)
if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8');ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['prepare','run','sheets']);ap.add_argument('--workers',type=int,default=3);ap.add_argument('--only',nargs='*');args=ap.parse_args()
    if args.mode=='prepare':state=prepare();print(json.dumps({'items':len(state['items']),'kinds':{k:sum(v['kind']==k for v in state['items'].values()) for k in ['bg','sprite','cg','cover']}}))
    else:
        state=json.loads(MANIFEST.read_text(encoding='utf-8'))
        if args.mode=='run':run(state,args.workers,args.only)
        else:sheets(state)
