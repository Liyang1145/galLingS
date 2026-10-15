"""Build a separate review project using approved artwork. Never mutate the live story."""
import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from PIL import Image
from produce_art_upgrade import ART, GAME, ROOT, output
from compress_art_upgrade import build as compress

def project(path):return json.loads(path.read_text(encoding='utf-8-sig').split('=',1)[1].strip().removesuffix(';'))
def build():
    original=project(GAME/'game.js');draft=copy.deepcopy(original)
    runtime=compress()
    state=json.loads((ART/'production.json').read_text(encoding='utf-8'))
    reviews=json.loads((ART/'reviews.json').read_text(encoding='utf-8')) if (ART/'reviews.json').exists() else {}
    approved={k:v for k,v in state['items'].items() if v['status']=='generated' and (reviews.get(k,{}).get('status') if reviews.get(k,{}).get('sha256')==v['sha256'] else v['review'])=='approved'}
    by_name={name:key for key,item in approved.items() for name in item['old_names']}
    # The old dive ID uses the turnaround pose; the second pose is separately callable.
    if 'L19' in approved:by_name['鲸鱼小姐_潜水']='L19'
    changes=[];target_assets={}
    for asset in draft['assets'].values():
        if asset['type'] not in ['bg','ch']:continue
        match=re.search(r'/scenes/([BO]\d\d)\.webp$',asset['src'])
        key=match[1] if match else by_name.get(asset['name'])
        if key not in approved:continue
        item=approved[key];master=output(key);source=ROOT/runtime[key]['path']
        assert hashlib.sha256(master.read_bytes()).hexdigest()==item['sha256']
        assert runtime[key]['sourceSha256']==item['sha256']
        with Image.open(source) as im:asset['w'],asset['h']=im.size
        asset.setdefault('previousSourcePath',asset['src'])
        asset['src']=source.as_uri();asset['sourceMasterPath']=master.relative_to(ROOT).as_posix();asset['productionArtId']=key
        asset['modelRequested']=item['generation']['requested_model'];asset['modelReported']=item['generation'].get('backend_reported_model');asset['imageQualityReported']=item['generation'].get('backend_reported_quality')
        target_assets[key]=asset['id'];changes.append({'asset':asset['id'],'name':asset['name'],'art':key})
    for key,item in approved.items():
        if key in target_assets:continue
        master=output(key);source=ROOT/runtime[key]['path'];new_id='art_upgrade_'+key.lower()
        with Image.open(source) as im:w,h=im.size
        draft['assets'][new_id]={'id':new_id,'name':('CG_' if item['kind']=='cg' else '')+item['name'],'type':'ch' if item['kind']=='sprite' else 'bg','cg':item['kind']=='cg','src':source.as_uri(),'w':w,'h':h,'sourceMasterPath':master.relative_to(ROOT).as_posix(),'productionArtId':key,'modelRequested':item['generation']['requested_model'],'modelReported':item['generation'].get('backend_reported_model'),'imageQualityReported':item['generation'].get('backend_reported_quality')}
        target_assets[key]=new_id
    # Restore replaced bad CG only at the author's original matching line IDs.
    author=project(ROOT/'archive/deliveries/larry-vn/original-overridden-files/game.js')
    original_by_id={line['id']:line for line in author['lines']};restored=[]
    for line in draft['lines']:
        old=original_by_id.get(line['id'],{});bg=old.get('bg')
        if bg not in original['assets']:continue
        a=original['assets'][bg]
        if a.get('previewExcluded') and by_name.get(a['name']) in approved:
            line['bg']=bg;line['sprites']=[];draft['assets'][bg]['previewExcluded']=False;restored.append(line['id'])
    # Explicit anchors cover existing story nodes; no plot, branch or ID is added.
    for key,count in [('C05',3),('C17',3),('C20',3),('C21',3)]:
        item=approved.get(key)
        if not item or not item.get('anchors'):continue
        hits=[i for i,line in enumerate(draft['lines']) if line['text'] in item['anchors']]
        if len(hits)!=1:continue
        begin=hits[0]
        for line in draft['lines'][begin:begin+count]:line['bg']=target_assets[key];line['sprites']=[]
    if 'T01' in target_assets:
        draft['settings']['cover'].update(img=target_assets['T01'],title='left',ty=135)
    # Keep the campsite lamp dim after the explicit wick adjustment.
    if 'B18' in target_assets:
        bonus=False;dim=False
        for line in draft['lines']:
            if line.get('chapter'):
                bonus='番外' in line['chapter'] and '贝壳' in line['chapter'];dim=False
            if bonus and line['text']=='灯捻小了一半。':dim=True
            if bonus and dim and original['assets'].get(line.get('bg'),{}).get('name')=='帐篷内_夜':
                line['bg']=target_assets['B18']
    # Preserve every story value outside visuals exactly.
    for before,after in zip(original['lines'],draft['lines']):
        assert {k:v for k,v in before.items() if k not in ['bg','sprites']}=={k:v for k,v in after.items() if k not in ['bg','sprites']},before['id']
    assert draft['id']==original['id'] and len(draft['lines'])==len(original['lines'])
    dest=ROOT.parent.parent/'outputs/art-upgrade/试装项目.vnproj.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(draft,ensure_ascii=False,indent=2),encoding='utf-8')
    report={'approvedArtwork':len(approved),'replacedAssets':changes,'restoredCgLineIds':restored,'sourceGameUnchanged':True,'storyIdsAndNonVisualFieldsPreserved':True,'file':str(dest)}
    dest.with_suffix('.report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k not in ['replacedAssets','restoredCgLineIds']},ensure_ascii=True))
    return dest
if __name__=='__main__':build()
