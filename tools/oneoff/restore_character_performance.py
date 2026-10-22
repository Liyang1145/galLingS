"""Explicit, reviewable acting cues; story, score, sound and stable IDs stay intact."""
import copy,json,subprocess
from collections import Counter
from pathlib import Path
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ROOT,GAME,ART
from stage_art_upgrade import project

PRESENTATION={'bg','sprites','acts','fx','trans'}

def apply():
    p=project(GAME/'game.js')
    if p.get('characterPerformance'):raise ValueError('Already applied; review new cues explicitly')
    before=copy.deepcopy(p);lines=p['lines'];index={l['id']:i for i,l in enumerate(lines)}
    archive=ROOT/'archive/deliveries/character-performance';archive.mkdir(parents=True,exist_ok=True)
    baseline=archive/'before-game.js'
    if not baseline.exists():baseline.write_bytes(subprocess.check_output(['git','show','0f6de470e5ef1b96c0dfe91605c913f15251c0b9:content/imports/vnstudio/海风与布丁/game.js'],cwd=ROOT))
    art={a.get('productionArtId'):a['id'] for a in p['assets'].values() if a.get('productionArtId')}
    required={'L09','L10','L11','L12','L33','L34','L35','L36','P01','P02','P03','P04'}
    assert required<=set(art)
    common={f'L{i:02}' for i in range(1,13)}|{'P01','P02'}
    changes=[]
    def use(key,start,end=None,allowed=common,frame=None):
        begin=index[start];stop=index[end]+1 if end else begin+1
        assert stop>begin
        for line in lines[begin:stop]:
            for sp in line['sprites']:
                if p['assets'][sp['asset']].get('productionArtId') not in allowed:continue
                old=sp['asset'];sp['asset']=art[key]
                if frame:sp.update(h=frame[0],y=frame[0]+40,x=frame[1])
                changes.append({'id':line['id'],'text':line['text'],'before':old,'after':sp['asset'],'pose':key})
    def act(node,kind):
        line=lines[index[node]]
        if line['sprites']:line['acts']={**line.get('acts',{}),'鲸鱼小姐':kind}
    # Same adult actor for both legacy names and newly registered physical poses.
    for a in p['assets'].values():
        if a['type']=='ch' and a.get('productionArtId'):a['character']='鲸鱼小姐'
    # New portraits are wider and have lower hand positions; show their acting area.
    reframed=0
    for line in lines:
        for sp in line['sprites']:
            a=p['assets'][sp['asset']]
            if a.get('productionArtId') and a['type']=='ch' and (sp['h'],sp['y']) in {(1150,1190),(1060,1100),(1020,1060)}:
                sp['h']=1000 if sp['h']==1150 else 960;sp['y']=sp['h']+40;reframed+=1
    # The notebook belongs in her hands; then she raises that same book out of reach.
    use('L08','8divye5i','m4wlasdc')
    use('L06','s3arg4rw')
    use('P02','ewno9xr4','vfo56g8o');act('ewno9xr4','lean')
    use('L12','no3hzp1r','8ewkwxbl')
    use('P01','q9hjzk5k','jqmeeaid')
    # Keep her at the described watch distance, then visibly approach half a metre.
    for line in lines[index['q9hjzk5k']:index['ljqevszk']]:
        for sp in line['sprites']:sp.update(x=820,h=860,y=900)
    for line in lines[index['ljqevszk']:index['u7ne78gd']]:
        for sp in line['sprites']:sp.update(x=760,h=940,y=980)
    act('ljqevszk','lean')
    use('P01','nkz1goaq');act('nkz1goaq','settle')
    # Poetry and the final manuscript conversation are genuinely seated.
    use('L34','jifyqa4p','rg4rkhr4',frame=(940,640))
    act('jifyqa4p','settle')
    use('L34','pvyjs8ij','4lbhobyw',frame=(940,700))
    # Quiet campsite dialogue keeps its blanket/cardigan costume even when startled.
    start=index['uvp6gcsp'];end=index['54avw4hz']
    for line in lines[start:end+1]:
        for sp in line['sprites']:
            old=p['assets'][sp['asset']].get('productionArtId')
            if old not in common:continue
            key='P04' if old=='L05' else 'P03' if old=='L06' else 'L35'
            old_id=sp['asset'];sp.update(asset=art[key],h=940,y=980)
            changes.append({'id':line['id'],'text':line['text'],'before':old_id,'after':sp['asset'],'pose':key})
    act('uvp6gcsp','settle');act('65rzzs94','flinch');act('ytjn39z0','flinch');act('5dlec0jm','settle')
    use('L33','7pe0dqd5','uy1ur1k4',frame=(940,700));act('7pe0dqd5','settle')
    # Hurt is not the teasing smile or angry cartoon used in routine banter.
    use('L10','48jqdyhx','rkrt51j3');act('48jqdyhx','flinch')
    use('L10','xkvu95bb','n4h6j1jb');act('xkvu95bb','flinch')
    use('L12','swb6k9wp','z5qciq6u')
    use('L10','gaqro6n5','zgmf00yw')
    use('L12','39a7xd8b','zgmf00yw');act('39a7xd8b','flinch')
    for line in lines[index['39a7xd8b']:index['zgmf00yw']+1]:
        for sp in line['sprites']:sp['x']+=28
    use('L12','89lweywr','7x5exksj')
    use('L11','h1s7pefv','y9lddnwn');act('qtkbdqzg','flinch')
    use('L11','crjg8fpt','780pj9z2');act('crjg8fpt','lean')
    use('L09','6j32oqgi','s42wa3pz');act('6j32oqgi','nod')
    use('L36','fuqmayrh','gvuo4ujc',allowed={'L21','L22','L23'});act('fuqmayrh','settle')
    # Added inner dialogue had inherited the preceding hit effect: do not hit twice.
    for key in ('opening_second_hit_rebuke','opening_retrieve_notebook'):lines[index[key]]['fx']=''
    for key,kind in [('s3arg4rw','flinch'),('k1t4gr6o','lean'),('2360dvsq','nod'),('sb63ua0q','lean'),('0ryh3dec','jump'),('dg7yx2u8','nod'),('w7a9fozz','lean')]:
        act(key,kind)
    assert len(lines)==len(before['lines']) and [x['id'] for x in lines]==[x['id'] for x in before['lines']]
    for a,b in zip(before['lines'],lines):assert {k:v for k,v in a.items() if k not in PRESENTATION}=={k:v for k,v in b.items() if k not in PRESENTATION},a['id']
    p['characterPerformance']={'date':'2026-10-15','baseline':'0f6de470e5ef1b96c0dfe91605c913f15251c0b9','poseChanges':len(changes),'reframedSprites':reframed,'notes':'实体姿态、明确台词分镜与稳定角色归属；不加循环晃动或程序化音效。'}
    (GAME/'game.js').write_text('window.VN_GAME = '+json.dumps(p,ensure_ascii=False,indent=2)+';\n',encoding='utf-8',newline='\n')
    report={'summary':p['characterPerformance'],'poseChanges':changes,'uses':dict(Counter(x['pose'] for x in changes)),'storyAndAudioUnchanged':True}
    (ART/'performance-cues.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='poseChanges'},ensure_ascii=True))

if __name__=='__main__':apply()
