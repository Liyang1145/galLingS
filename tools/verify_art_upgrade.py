"""Audit line-ID continuity, adopted media and preservation of all original audio."""
import hashlib
import json
from stage_art_upgrade import project
from produce_art_upgrade import ART, GAME, ROOT

def verify():
    before=project(ROOT/'archive/deliveries/opening-revision/before-game.js')
    current=project(GAME/'game.js')
    old_ids=[l['id'] for l in before['lines']]
    new_ids=[l['id'] for l in current['lines']]
    assert len(set(new_ids))==len(new_ids)
    assert [i for i in new_ids if i in set(old_ids)]==old_ids
    by_id={l['id']:l for l in current['lines']}
    for old in before['lines'][160:]:
        a={k:v for k,v in old.items() if k not in {'bg','sprites'}}
        b={k:v for k,v in by_id[old['id']].items() if k not in {'bg','sprites'}}
        assert a==b,old['id']
    audio={k:a for k,a in before['assets'].items() if a['type'] not in {'bg','ch'}}
    assert all(current['assets'][k]==a for k,a in audio.items())
    for a in current['assets'].values():assert (GAME/a['src']).is_file(),a['id']
    used={current['settings']['cover']['img']}
    for l in current['lines']:
        used.add(l.get('bg'));used.update(s['asset'] for s in l['sprites'])
    active=[a for a in current['assets'].values() if a['id'] in used and a['type'] in {'bg','ch'}]
    remaining=[a['id'] for a in active if not a.get('productionArtId')]
    assert set(remaining)=={'nvgbi1x6','jtp36q4e'},remaining
    assert all(not a['src'].lower().endswith('.wav') for a in current['assets'].values())
    assert by_id['irma08fi']['choices'][1]['set']=='好感 -= 10'
    assert by_id['dk3o5u4e']['choices'][2]['set']=='好感 -= 1'
    assert by_id['kbwv46du']['motionCount']==5
    assert by_id['kbwv46du']['set']==next(l['set'] for l in before['lines'] if l['id']=='kbwv46du')
    for k in ('127wrb75','1sjdneqt','7b2f3g26'):assert not by_id[k]['text']
    report={'originalLineIdsPreserved':len(old_ids),'newLines':len(new_ids)-len(old_ids),
        'laterNodesNonVisualFieldsPreserved':len(before['lines'])-160,
        'originalAudioAssetsUnchanged':len(audio),'activeVisualIds':len(active),
        'activeReplacedVisualIds':len(active)-len(remaining),'manualWardrobeVisualIds':remaining,
        'wavPlaybackAssets':0,'chapters':sum(bool(l.get('chapter')) for l in current['lines']),
        'gameSha256':hashlib.sha256((GAME/'game.js').read_bytes()).hexdigest()}
    out=ART/'integration-validation.json'
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True))
    return report
if __name__=='__main__':verify()
