"""Integrate reviewed user delivery and precise opening repairs, preserving story/audio."""
import copy,hashlib,json,shutil,subprocess
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART,GAME,ROOT,output,record,save,approved
from compress_art_upgrade import build as compress

BASELINE='33fba8eb176b992013483108215a36197be7e042'
DELIVERY=ROOT/'A素材库/归档/deliveries/refined-cg-20261016'
REPORT=ART/'opening-art-sound-corrections.json'

def write(path,obj):
 path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')

def parse(text):return json.loads(text.split('=',1)[1].strip().removesuffix(';'))

def archive(key,reason):
 stem=key+'_rejected_'+reason;assert not output(stem).exists(),stem
 for ext in ['.png','.generation.json','.production.json']:
  p=output(key).with_suffix(ext)
  if p.exists():shutil.copy2(p,output(stem).with_suffix(ext))
 shutil.copy2(ART/'prompts'/f'{key}.txt',ART/'prompts'/f'{stem}.txt')
 return stem

def adopt():
 state=json.loads((ART/'production.json').read_text('utf-8'));reviews=json.loads((ART/'reviews.json').read_text('utf-8'))
 overrides=json.loads((ART/'overrides.json').read_text('utf-8'));delivery=json.loads((DELIVERY/'manifest.json').read_text('utf-8'))
 project=parse((GAME/'game.js').read_text('utf-8-sig'))
 baseline=parse(subprocess.check_output(['git','show',BASELINE+':'+(GAME/'game.js').relative_to(ROOT).as_posix()],cwd=ROOT).decode('utf-8-sig'))
 assert project==baseline,'Reconcile concurrent changes before integration'
 report={'baseline':BASELINE,'deliverySha256':delivery['sourceSha256'],'art':{},'visualNodeChanges':[], 'soundNodeChanges':[]}
 # Nineteen complete CGs retain story staging. P02 requires a separate alpha derivation.
 for key,row in delivery['items'].items():
  if key=='P02':continue
  item=state['items'][key];old_sha=item['sha256'];stem=archive(key,'before_teammate_refinement')
  src=ROOT/row['path'];assert hashlib.sha256(src.read_bytes()).hexdigest()==row['sha256']
  shutil.copy2(src,output(key))
  metadata={'workflow':'user-supplied-refinement','sourceDelivery':row['path'],
            'sourceDeliverySha256':row['sha256'],'archiveSha256':delivery['sourceSha256'],
            'requested_model':None,'backend_reported_model':None,'model_selection_verified':False,
            'requested_quality':None,'backend_reported_quality':None,
            'note':'用户提供精修成品；未提供该包模型/提示词/原生分辨率记录，不继承旧生成元数据。'}
  prompt='用户提供《修复后CG图包.zip》中的'+key+'：以成品为准，统一细长连续尾柄、双叶尾鳍和白色圆形海洋纹样；保留角色与剧情动作。原始提示词未随包提供。'
  output(key).with_suffix('.generation.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  output(key).with_suffix('.production.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  (ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8')
  item.update(status='generated',review='approved',generation=metadata,prompt=prompt,sourceDelivery=row['path'],
              **record(output(key)))
  overrides[key]={**overrides.get(key,{}),'prompt':prompt,'sourceDelivery':row['path']}
  reviews[key]={'status':'approved','sha256':item['sha256'],'note':'与原CG逐项对照：尾柄连续、双叶与纹样明确；身份、服装、时段和互动保留。C12/C18皮肤完好。','reviewer':'Codex visual review, 2026-10-16'}
  report['art'][key]={'origin':'user-refined-package','oldSource':stem,'oldSha256':old_sha,'sourceSha256':item['sha256'],'sourceDelivery':row['path']}
 delivery['review']='19 CG visually reviewed and adopted; P02 white-background source retained, alpha derivative separately reviewed'
 write(DELIVERY/'manifest.json',delivery)
 generated_notes={
  'C01':'单手接住空中飞出的湿笔记本；松散书页与水珠，完整本角，保持另一只手远离本子；尾柄/双叶/白色纹样跟随精修包。',
  'P14':'左右内页共用一根装订轴、页高一致、大小透视合理；内页为浅线纸而不是错放的外封面。脸、手势与全身比例保留。',
  'L03':'单卷叶改为一根尾柄连接的双叶尾鳍；保留思考与防备动作。',
  'O12':'烤小鱿鱼在帐篷门口、同一黄昏营地，食物在对话框上方可读；只用于发现礼物的三句。',
  'P02':'队友白底版的透明衍生有杂边，未采用；重新选用本轮较早的干净双叶版，保持举本与另一手叉腰。队友上扬尾势留在编辑库待精确抠图。',
  'C27':'重新构图为侧面双人中景；完整尾根与尾柄连接她腰后，尾鳍轻触男主脚踝，非从男主裤腿长出的孤立尾巴。',
 }
 for key,note in generated_notes.items():
  assert approved(state,key),f'{key} must receive a separate SHA-bound visual approval first'
  item=state['items'][key];assert record(output(key))['sha256']==item['sha256']
  report['art'][key]={'origin':'codex-oauth-edit','sourceSha256':item['sha256'],'review':note,
                     'requestedModel':item['generation'].get('requested_model'),
                     'reportedModel':item['generation'].get('backend_reported_model'),
                     'reportedQuality':item['generation'].get('backend_reported_quality'), 'routeVerified':False}
 write(ART/'reviews.json',reviews);write(ART/'overrides.json',overrides);save(state)
 runtime=compress()
 for key in report['art']:
  item=state['items'][key]
  ids=[k for k,a in project['assets'].items() if a.get('productionArtId')==key]
  if not ids:
   asset_id='art_upgrade_'+key.lower();ids=[asset_id]
   project['assets'][asset_id]={'id':asset_id,'type':'bg','cg':True,'name':item['name'],
                              'src':'assets/art-upgrade/'+key+'.webp','productionArtId':key}
  for aid in ids:
   a=project['assets'][aid]
   a.update(w=item['size'][0],h=item['size'][1],sourceMasterPath=item['file'],
            modelRequested=item['generation'].get('requested_model'),modelReported=item['generation'].get('backend_reported_model'),
            imageQualityReported=item['generation'].get('backend_reported_quality'))
   shutil.copy2(ROOT/runtime[key]['path'],GAME/a['src'])
  report['art'][key].update(assetIds=ids,runtimeSha256=runtime[key]['sha256'],size=item['size'])
 frames=json.loads((ART/'acting-frames.json').read_text('utf-8'))
 for key in ['P02','P14','L03']:
  frames[key]['sourceSha256']=state['items'][key]['sha256']
 write(ART/'acting-frames.json',frames)
 by_id={l['id']:l for l in project['lines']}
 def place(ids,key):
  aid=report['art'][key]['assetIds'][0]
  for id in ids:
   l=by_id[id];before={k:copy.deepcopy(l[k]) for k in ['bg','sprites']}
   l['bg']=aid;l['sprites']=[]
   report['visualNodeChanges'].append({'lineId':id,'artId':key,'before':before,'after':{k:copy.deepcopy(l[k]) for k in before}})
 place(['1ab8nnfn'],'C01')
 place(['utu1zxyd','ab6i4shm','3iq8cnx2','i99npm13'],'C27')
 place(['lsjm2p6r','wupi03c8','luv45vih','127wrb75','1sjdneqt'],'O12')
 sound={
  'o6vhcy2x':([{'id':'sfx_s04_tail_flattens_water_v01','gain':.85}], '原拍平声偏轻；增益0.4→0.85，保留原真实音源；快进仍静音。'),
  'n7sguoiy':([{'id':'sfx_tail_water_light','gain':.25}], '第一话轻得几乎没有的拍水补真实轻拍声。'),
  'frtp4eyj':([{'id':'sfx_tail_water_double','gain':.6},{'id':'sfx_tail_water_light','gain':.6,'delayMs':1000}], '第二话三下：两下成品加一次轻拍。'),
  '3ua9v325':([{'id':'sfx_tail_water_double','gain':.6},{'id':'sfx_tail_water_double','gain':.6,'delayMs':1000},{'id':'sfx_tail_water_light','gain':.6,'delayMs':2000}], '第五话五下：两次双拍加一次单拍，原来只有一下。'),
  'kbwv46du':([{'id':'sfx_tail_water_double','gain':.6},{'id':'sfx_tail_water_double','gain':.6,'delayMs':1000},{'id':'sfx_tail_water_light','gain':.6,'delayMs':2000}], '第一话五下保持次数，收紧原4.8秒跨度；离开本句取消余下声音。'),
  '0xhf540s':([{'id':'sfx_tail_close_door','gain':.5}], '番外关门动作补队友真实关门录音；非电子提示。'),
 }
 for id,(events,reason) in sound.items():
  l=by_id[id];before={'present':'seEvents' in l,'value':copy.deepcopy(l.get('seEvents'))}
  assert not l.get('se');l['seEvents']=events
  report['soundNodeChanges'].append({'lineId':id,'before':before,'after':events,'reason':reason})
 # Every change outside reviewed visual placements and six explicit SFX edits is rejected.
 visual_ids={r['lineId'] for r in report['visualNodeChanges']};sound_ids=set(sound)
 for old,new in zip(baseline['lines'],project['lines']):
  allowed=({'bg','sprites'} if new['id'] in visual_ids else set())|({'seEvents'} if new['id'] in sound_ids else set())
  assert {k:v for k,v in old.items() if k not in allowed}=={k:v for k,v in new.items() if k not in allowed},new['id']
 old_audio={k:a for k,a in baseline['assets'].items() if a['type'] not in {'bg','ch'}}
 assert {k:a for k,a in project['assets'].items() if a['type'] not in {'bg','ch'}}==old_audio
 (GAME/'game.js').write_text('window.VN_GAME = '+json.dumps(project,ensure_ascii=False,indent=2)+';\n',encoding='utf-8',newline='\n')
 report.update(storyNodes=len(project['lines']),allTextChoicesVariablesAndMusicUnchanged=True,
               all105AudioAssetsUnchanged=len(old_audio)==105,adoptedArtCount=len(report['art']),
               gameSha256=hashlib.sha256((GAME/'game.js').read_bytes()).hexdigest())
 write(REPORT,report);print(json.dumps({k:v for k,v in report.items() if k not in ['art','visualNodeChanges','soundNodeChanges']}))

if __name__=='__main__':adopt()
