"""Apply curated scene light defaults and a real rock seat; keep story/audio intact.

The counter-seat cue uses a coherent event CG, never a pasted seated sprite.
It never resets manual sceneFit overrides.
"""
import copy
import json
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from stage_art_upgrade import project
from produce_art_upgrade import ROOT, GAME, ART

PROFILES = {
    'clear': dict(brightness=.98, saturation=.96, warmth=0),
    'morning': dict(brightness=.98, saturation=.94, warmth=.12),
    'sunset': dict(brightness=.91, saturation=.87, warmth=.65),
    'moon': dict(brightness=.78, saturation=.85, warmth=-.40),
    'camp': dict(brightness=.89, saturation=.87, warmth=.45),
    'indoorDay': dict(brightness=.96, saturation=.90, warmth=.14),
    'indoorSunset': dict(brightness=.92, saturation=.87, warmth=.55),
    'indoorNight': dict(brightness=.88, saturation=.86, warmth=.38),
    'underwater': dict(brightness=.85, saturation=.87, warmth=-.25),
}
GROUPS = {
    'morning': ['B01','B26','B31','B33','B36','O01'],
    'sunset': ['B03','B06','B10','B14','B15'],
    'moon': ['B04','B07'], 'camp': ['B16'],
    'indoorDay': ['B23','B24','B25','B28','B38','B40','B41'],
    'indoorSunset': ['B29'],
    'indoorNight': ['B17','B18','B30','B34','B35','B39','B42'],
    'underwater': ['B11','B12','B13'],
}

def apply():
    p=project(GAME/'game.js');before=copy.deepcopy(p)
    bykey={a.get('productionArtId'):a for a in p['assets'].values() if a.get('productionArtId')}
    profiles={k:group for group,keys in GROUPS.items() for k in keys}
    for a in p['assets'].values():
        key=a.get('productionArtId','')
        if a['type']!='bg' or not key.startswith(('B','O')):continue
        group=profiles.get(key,'clear')
        a['sceneFit']=copy.deepcopy(PROFILES[group])
    # B07 has the foreground rock absent from B04. Keep its original framing:
    # a bottom-anchored zoom would lose the moon that the scene refers to.
    seat_id=bykey['B07']['id']
    # Whole continuous cuts use one camera; no per-expression camera popping.
    # Resolve authored spans by stable IDs and actual contiguous background cuts.
    indices={l['id']:i for i,l in enumerate(p['lines'])}
    targets=set()
    # Poem opening through its writing CG, and all three ending dialogue cuts.
    for lo,hi in [('h356tshs','rg4rkhr4'),('yojg9kqy','7vx8cjgu'),('kyg6ltxc','p7hu2gmh')]:
        targets.update(range(indices[lo],indices[hi]+1))
    for id in ['pvyjs8ij','19js3h5w']:
        i=indices[id];bg=p['lines'][i]['bg'];lo=hi=i
        while lo>0 and p['lines'][lo-1]['bg']==bg:lo-=1
        while hi+1<len(p['lines']) and p['lines'][hi+1]['bg']==bg:hi+=1
        targets.update(range(lo,hi+1))
    changes=[]
    for i in sorted(targets):
        l=p['lines'][i]
        if p['assets'][l['bg']].get('productionArtId') not in {'B04','B07'}:continue
        l['bg']=seat_id;changes.append(l['id'])
    # The user explicitly requires one coherently generated CG for sitting on the
    # counter. Registration happens only after the new original is reviewed.
    counter_ids=[]
    if 'C26' in bykey:
        for line in p['lines'][indices['hkq3m6vy']:indices['1qnucnh3']+1]:
            assert p['assets'][line['bg']].get('productionArtId') in {'B39','C26'},line['id']
            line['bg']=bykey['C26']['id'];line['sprites']=[]
            counter_ids.append(line['id'])
    # The writing beat and the poem reveal share one finished CG. Do not jump
    # from the centered neutral-light sprite to the left-framed event painting.
    poem_ids=[]
    for line in p['lines'][indices['jifyqa4p']:indices['8a3f78h1']+1]:
        line['bg']=bykey['C08']['id'];line['sprites']=[]
        poem_ids.append(line['id'])
    changes=[id for id in changes if p['lines'][indices[id]]['bg']==seat_id]
    # Never sacrifice the previous pass to a broad presentation reset.
    for a,b in zip(before['lines'],p['lines']):
        allowed={'bg','sprites'} if a['id'] in counter_ids+poem_ids else {'bg'}
        assert {k:v for k,v in a.items() if k not in allowed}=={k:v for k,v in b.items() if k not in allowed},a['id']
    for id,a in before['assets'].items():
        if a['type'] not in {'bg','ch'}:assert p['assets'][id]==a,id
    (GAME/'game.js').write_text('window.VN_GAME = '+json.dumps(p,ensure_ascii=False,indent=2)+';\n',encoding='utf-8',newline='\n')
    report={'baseline':'0f44363','backgroundProfiles':PROFILES,'profileGroups':GROUPS,
            'seatAsset':seat_id,'seatImage':'B07 (existing reviewed master), original framing keeps the moon',
            'seatLineIds':changes,'profiledBackdropIds':[a['id'] for a in p['assets'].values() if a.get('sceneFit')],
            'storyAudioUnchanged':True,'otherPosesAndPositionsUnchanged':True,
            'counterSeatLineIds':counter_ids,'counterSeat':{'cg':'C26','method':'one coherent image, no sprite composite'},
            'poemCoherentCgLineIds':poem_ids,'poemCoherentCg':'C08',
            'limits':['全局光色校正不等于有方向的重打光；夕阳背光、灯火/月光分区仍可由专门立绘差分升级。',
                      '明确涉水镜头仍缺与水线匹配的裙摆/尾鳍遮挡差分，不用统一淡出伪装浸水。']}
    (ART/'scene-integration.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'sceneLightBackdrops':len(report['profiledBackdropIds']),'rockSceneLines':len(changes),
                      'counterSeatLines':len(counter_ids),'storyAndAudioUnchanged':True}))

if __name__=='__main__':apply()
