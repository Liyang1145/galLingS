"""Curated acting beats and SHA-bound eye anchors. Rebuilds from the local repair baseline."""
import copy,hashlib,json,subprocess
from pathlib import Path
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART,GAME,ROOT
from stage_art_upgrade import project

BASE='c9f0be4'
VISUAL={'bg','sprites','acts','fx','trans'}
# Approximate midpoint of the two pupils, visually annotated on 1024x1536 masters.
# Chin-down gestures deliberately keep an offset; they are not normalized into a stare.
EYES={
 'L01':(456,234,0),'L02':(452,212,0),'L03':(464,225,0),'L04':(415,231,0),
 'L05':(458,223,0),'L06':(441,213,-4),'L07':(460,229,0),'L08':(454,231,0),
 'L09':(453,228,0),'L10':(459,233,4),'L11':(460,232,0),'L12':(334,221,0),
 'L33':(464,285,30),'L34':(452,249,10),'L35':(457,231,0),'L36':(457,235,0),
 'P01':(414,221,0),'P02':(450,265,0),'P03':(461,244,-3),'P04':(470,274,10),
 'P05':(402,376,16),'P06':(442,212,0),'P07':(459,227,0),'P08':(459,233,0),
 'P09':(315,221,0),'P10':(462,229,0),'P11':(446,299,35),'P12':(452,233,0),
 'P13':(452,249,10),'P14':(466,226,10),'P15':(452,249,10),
 'P16':(452,249,10),'P17':(452,249,10),'P18':(452,249,10),
}
PUPIL_SPANS={'P05':110,'L34':95,'P13':95,'P15':95,'P16':95,'P17':95,'P18':95}

def apply():
 archive=ROOT/'A素材库/归档/deliveries/character-direction';archive.mkdir(parents=True,exist_ok=True)
 for file in ['game.js','index.html']:
  target=archive/('before-'+file)
  if not target.exists():target.write_bytes(subprocess.check_output(['git','show',f'{BASE}:content/imports/vnstudio/海风与布丁/{file}'],cwd=ROOT))
 before=project(archive/'before-game.js');p=project(GAME/'game.js')
 assert [l['id'] for l in before['lines']]==[l['id'] for l in p['lines']]
 for old,line in zip(before['lines'],p['lines']):
  for k in VISUAL:line[k]=copy.deepcopy(old[k])
 lines=p['lines'];index={l['id']:i for i,l in enumerate(lines)}
 art={a.get('productionArtId'):a['id'] for a in p['assets'].values() if a.get('productionArtId')}
 assert set(EYES)<=set(art)
 common={f'L{i:02}' for i in range(1,13)}|{f'P{i:02}' for i in range(1,19)}
 notes=[]
 def span(start,end=None):return lines[index[start]:index[end]+1] if end else [lines[index[start]]]
 def cue(key,start,end=None,reason='',soft=False,allowed=common):
  changed=[]
  for line in span(start,end):
   for s in line['sprites']:
    if p['assets'][s['asset']].get('productionArtId') not in allowed:continue
    s['asset']=art[key]
    if soft:s['poseSwitch']='soft'
    changed.append(line['id'])
  assert changed,(key,start,end)
  notes.append({'pose':key,'from':start,'to':end or start,'reason':reason,'lineIds':changed})
 def act(id,kind):
  line=lines[index[id]];assert line['sprites'],id
  if kind:line['acts']={**line.get('acts',{}),'鲸鱼小姐':kind}
  else:line['acts'].pop('鲸鱼小姐',None)
 def frame(start,end=None,x=None,h=None):
  for line in span(start,end):
   for s in line['sprites']:
    if x is not None:s['x']=x
    if h is not None:s.update(h=h,y=h+40)

 # First contact: a boundary is real, and curiosity is earned gradually.
 cue('P07','ps0r6nbx','gtc8s8ua','被冒犯后竖起尾巴；不能继续使用得意V手势')
 cue('P14','8divye5i','m4wlasdc','翻开笔记本检查，不再抱着闭合本子朗读')
 cue('L08','zknz0j4b','p4p4l5nc','追问重要性时本子仍在她手里')
 frame('ewno9xr4','vfo56g8o',x=680)
 cue('P09','no3hzp1r','8ewkwxbl','初遇嘴硬回望，区别争吵后的低落背身',True)
 cue('P01','rme9rp7m',reason='海鸥落下时仍延续抱臂戒备姿态')
 cue('P10','78arkzfg','ott3er5w','拿着剩余糍粑偷偷看饥饿的人类',True)
 cue('P06','ljqevszk','hcrs0mry','走近问问题：好奇但尚未完全亲密',True)
 cue('P06','7bjpv8xn',reason='直球搭讪之前仍处在审慎好奇状态')
 cue('P14','fefqrihh','4v9n0ev0','抢来笔记本时真正翻开检查')
 cue('P09','ysfx3a0y','dk3o5u4e','给出食物后刻意移开目光',True)
 cue('L03','19j7cn4u','25q42u4a','被夸手艺后由惊慌转为嘴硬害羞',True)
 act('n1u3boys',None)
 cue('P06','nvij36hj','n7sguoiy','默默吃掉后的等待与不满，不是胜利得意')
 cue('P06','sh7dcaxu','ux0qdh8i','听到桂花谢礼，先迟疑好奇',True)
 cue('P09','dg7yx2u8','b40zjswe','随便你：转身掩饰接受约定',True);act('dg7yx2u8',None)
 frame('dg7yx2u8','b40zjswe',x=710,h=970)
 for l in span('dg7yx2u8','b40zjswe'):
  for s in l['sprites']:s['out']='right'

 # Early contract and writing: the object in her hands must track the action.
 cue('P14','ci68sroe','3awuittl','翻到新页、读到桂花约定后停顿')
 cue('P14','r8v5y3ag',reason='展示打开的契约落款')
 cue('P05','zynsrwzg','joe6542h','补充契约条款时握笔',allowed=common|{'L08'})
 cue('P05','jifyqa4p','rg4rkhr4','诗签段真正跪坐写字，保持腿部结构与笔记本连续',allowed={'L34'})

 # Campfire reveal: listen, react, settle, then make acceptance physical.
 night={'L35','P03','P04','P11','P12'}
 cue('P11','lldr65m6','bv4hij9a','抱膝认真听完过去的经历',True,night)
 cue('P03','cpwu5gkq',reason='身份揭示后的空白与怔住',allowed=night);act('cpwu5gkq','flinch')
 cue('P03','6l7rcby3','9m22v7xh','消化不是替代品的解释，不能瞬间恢复微笑',allowed=night)
 cue('P11','5dlec0jm','6cwliu90','下巴放回膝上，思考记忆与自我',True,night)
 cue('L35','9gr04naa','ba3izm6n','嘴硬辩解，取消惊慌瞪眼',allowed=night);act('9gr04naa',None)
 cue('P11','vbf7gq78','g7g2x5uf','要求保证时压低情绪，认真等答复',True,night)
 cue('P12','vqiksage','kvt09y7b','递出一半毯子作为接纳的动作',True,night)

 # Phone conflict: concern -> tension -> hurt -> refusal -> departure.
 frame('mc3hzyu2','8dicgaxy',x=800,h=900)
 cue('P08','48jqdyhx','uih7a0td','从不可置信到站到面前，不用喜剧双手惊慌')
 frame('48jqdyhx',x=800,h=900);frame('rkrt51j3',x=720,h=980);frame('uih7a0td',x=660,h=1000)
 cue('P07','lqvlnz8o','zpdqlvme','真正害怕被替换，去掉漫画式额头怒符');act('lqvlnz8o','flinch')
 cue('L11','gaqro6n5','q2aoccrd','转身红眼、下巴抬高，先保持强硬')
 cue('P08','kwelvzlm','d046tqqp','声音短暂软下去，露出挽留',True)

 # Rescue: listen with worry before a late, reluctant thaw.
 cue('P08','kkgzbp5s','jdhwszjx','被答案击中后仍在担心，避免马上羞笑')
 cue('L10','lavqdy3h','c8ikc5q1','低头消化，鼻音仍在',True)
 cue('P06','rw2t93bv','a87ekdcz','审视承诺，替代不合语境的胜利V手势')
 cue('P09','gtpnwxzh','z4fjktc7','别过脸，声音很轻地重新接受',True)
 cue('P18','caqa6eg2','bnxnlk0y','和解后的抱膝谈话保持无首饰坐姿',True)
 frame('caqa6eg2','bnxnlk0y',x=700,h=940)

 # Finale: she remains seated throughout this conversation.
 cue('P13','pvyjs8ij','livwvbn2','手在膝上，珍珠戒指可见，尚未拿起手稿',True,{'L34'})
 # Preserve the emotions while changing the physical pose to remain seated.
 finale_spans=[('fdp1qtcz','9xhxnr36'),('kyg6ltxc','p7hu2gmh')]
 for l in [line for start,end in finale_spans for line in span(start,end)]:
  for s in l['sprites']:
   old=p['assets'][s['asset']].get('productionArtId')
   if old not in common:continue
   key='P15' if old=='L03' else 'P16' if old in {'L02','L04'} else 'P17' if old in {'L05','L06'} else 'P13'
   s['asset']=art[key];s['poseSwitch']='soft'
 for start,end in finale_spans:
  notes.append({'pose':'P13/P15/P16/P17','from':start,'to':end,'reason':'礁石长谈两条结局均保持坐姿，并保留害羞、得意、嗔怪的变化'})
  frame(start,end,x=700,h=940)
  for l in span(start,end):l['acts'].pop('鲸鱼小姐',None)
 act('re6akd65','settle')

 # Eye placement describes the same shot across a change of drawing, not a body pivot.
 anchor_file=ART/'acting-frames.json'
 if anchor_file.exists():anchors=json.loads(anchor_file.read_text(encoding='utf-8'))
 else:
  anchors={k:{'eyes':[x,y],'gazeOffset':offset,'pupilSpan':PUPIL_SPANS.get(k,86),'sourceSha256':hashlib.sha256((ART/'originals'/f'{k}.png').read_bytes()).hexdigest()} for k,(x,y,offset) in EYES.items()}
  anchor_file.write_text(json.dumps(anchors,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 for k,a in anchors.items():assert a['sourceSha256']==hashlib.sha256((ART/'originals'/f'{k}.png').read_bytes()).hexdigest(),k
 aligned=0
 for l in lines:
  for s in l['sprites']:
   a=p['assets'][s['asset']];key=a.get('productionArtId')
   if key not in anchors:continue
   anchor=anchors[key];x,y=anchor['eyes'];reference_h=s['h'];h=reference_h*86/anchor.get('pupilSpan',86)
   sign=-1 if s.get('flip') else 1
   target_x=s['x']+sign*(456-512)/1536*reference_h
   target_y=s['y']-reference_h+234/1536*reference_h+anchor['gazeOffset']*reference_h/1000
   # In the finale, the resting fingers and pearl ring are part of the scene's focus.
   if key in {'P13','P15','P16','P17'}:target_y-=20
   s['x']=round(target_x-sign*(x-512)/1536*h,2)
   s['y']=round(target_y+h-y/1536*h,2);s['h']=round(h,2);aligned+=1
 for a in p['assets'].values():
  if a.get('productionArtId') in anchors:a['actingEyes']=anchors[a['productionArtId']]['eyes']
 # Tiny once-only moves on a few event illustrations; never a repeating room pan.
 for key,focus,scale in [('C01',[.47,.38],1.02),('C02',[.46,.40],1.025),('C08',[.37,.45],1.025),('C14',[.43,.37],1.02),('C21',[.45,.45],1.02)]:
  p['assets'][art[key]]['shot']={'focus':focus,'scale':scale,'ms':2200}
 for a,b in zip(before['lines'],lines):assert {k:v for k,v in a.items() if k not in VISUAL}=={k:v for k,v in b.items() if k not in VISUAL},a['id']
 for id,a in before['assets'].items():
  if a['type'] not in {'ch','bg'}:assert p['assets'][id]==a,id
 report={'baseline':BASE,'curatedBeats':notes,'alignedSprites':aligned,'storyNodes':len(lines),'storyAndAudioUnchanged':True,
  'artNotes':'专用姿态、重做的坐姿结构与写诗CG；静态差分、一次性动作及CG缓推，不声称Live2D或逐帧尾巴已完成。'}
 p.pop('seatedReworkPending',None)
 p['characterDirection']={k:v for k,v in report.items() if k!='curatedBeats'}
 (GAME/'game.js').write_text('window.VN_GAME = '+json.dumps(p,ensure_ascii=False,indent=2)+';\n',encoding='utf-8',newline='\n')
 (ART/'direction-cues.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 print(json.dumps({k:v for k,v in report.items() if k!='curatedBeats'},ensure_ascii=True))
if __name__=='__main__':apply()
