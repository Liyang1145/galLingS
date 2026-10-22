"""Audit line-ID continuity, adopted media and preservation of all original audio."""
import hashlib
import json
import copy
from stage_art_upgrade import project
from produce_art_upgrade import ART, GAME, ROOT

def verify():
    before=project(ROOT/'A素材库/归档/deliveries/opening-revision/before-game.js')
    current=project(GAME/'game.js')
    old_ids=[l['id'] for l in before['lines']]
    new_ids=[l['id'] for l in current['lines']]
    assert len(set(new_ids))==len(new_ids)
    assert [i for i in new_ids if i in set(old_ids)]==old_ids
    story_lines=copy.deepcopy(current['lines'])
    by_id={l['id']:l for l in story_lines}
    sfx_report=ART/'opening-art-sound-corrections.json'
    corrected_sound_nodes=0
    if sfx_report.exists():
        # Six story actions were explicitly repaired after the art/music checkpoint.
        # Undo only these documented SFX deltas for the historical preservation audit.
        corrections=json.loads(sfx_report.read_text(encoding='utf-8'))
        rows=corrections['soundNodeChanges']
        assert {r['lineId'] for r in rows}=={'o6vhcy2x','n7sguoiy','frtp4eyj','3ua9v325','kbwv46du','0xhf540s'}
        assert len(rows)==6
        for row in rows:
            line=by_id[row['lineId']]
            assert line['seEvents']==row['after'],row['lineId']
            if row['before']['present']:line['seEvents']=row['before']['value']
            else:line.pop('seEvents',None)
        corrected_sound_nodes=len(rows)
    overlay_nodes=0
    overlay_counts={}
    overlay_ids=set()
    for filename,expected_asset_id,expected_before in [
        ('e4-integration.json','bgm_e4_sunset_wait',None),
        ('m1-integration.json','bgm_m1_shallows_day','bgm_emerald_dream_main_v01'),
    ]:
        music_overlay=ROOT/'content/audio-records'/filename
        if not music_overlay.exists():continue
        # The music lead explicitly added tracks after the art checkpoint. Only the
        # documented music assignments may differ; keep all story checks strict.
        music=json.loads(music_overlay.read_text(encoding='utf-8'))
        asset_id=music['assetId'];rows=music['nodeChanges']
        assert asset_id==expected_asset_id
        assert len(rows)==music['changedNodes'] and len({r['lineId'] for r in rows})==len(rows)
        assert {l['id'] for l in current['lines'] if l['bgm']==asset_id}=={r['lineId'] for r in rows}
        for row in rows:
            assert current['lines'][row['index']]['id']==row['lineId']
            line=by_id[row['lineId']]
            assert row['lineId'] not in overlay_ids
            overlay_ids.add(row['lineId'])
            assert line['bgm']==row['after']==asset_id and row['before']==expected_before
            line['bgm']=row['before']
        audio_file=GAME/current['assets'][asset_id]['src']
        assert hashlib.sha256(audio_file.read_bytes()).hexdigest()==music['sourceSha256']
        overlay_nodes+=len(rows)
        overlay_counts[asset_id]=len(rows)
    for old in before['lines'][160:]:
        a={k:v for k,v in old.items() if k not in {'bg','sprites','acts','fx'}}
        b={k:v for k,v in by_id[old['id']].items() if k not in {'bg','sprites','acts','fx'}}
        assert a==b,old['id']
    performance_baseline=ROOT/'A素材库/归档/deliveries/character-performance/before-game.js'
    if current.get('characterPerformance'):
        performance_before=project(performance_baseline)
        assert [l['id'] for l in performance_before['lines']]==new_ids
        for a,b in zip(performance_before['lines'],story_lines):
            assert {k:v for k,v in a.items() if k not in {'bg','sprites','acts','fx','trans'}}=={k:v for k,v in b.items() if k not in {'bg','sprites','acts','fx','trans'}},a['id']
            if a.get('fx')!=b.get('fx'):
                assert a['id'] in {'opening_second_hit_rebuke','opening_retrieve_notebook'} and not b['fx'],a['id']
        for k,a in performance_before['assets'].items():
            if a['type'] not in {'bg','ch'}:assert current['assets'][k]==a,k
    audio={k:a for k,a in before['assets'].items() if a['type'] not in {'bg','ch'}}
    assert all(current['assets'][k]==a for k,a in audio.items())
    for a in current['assets'].values():assert (GAME/a['src']).is_file(),a['id']
    used={current['settings']['cover']['img']}
    for l in current['lines']:
        used.add(l.get('bg'));used.update(s['asset'] for s in l['sprites'])
    active=[a for a in current['assets'].values() if a['id'] in used and a['type'] in {'bg','ch'}]
    remaining=[a['id'] for a in active if not a.get('productionArtId')]
    assert set(remaining)=={'nvgbi1x6','jtp36q4e'},remaining
    state=json.loads((ART/'production.json').read_text(encoding='utf-8'))['items']
    reviews=json.loads((ART/'reviews.json').read_text(encoding='utf-8'))
    for a in active:
        key=a.get('productionArtId')
        if key:
            review=reviews.get(key,{})
            status=review.get('status') if review.get('sha256')==state[key]['sha256'] else state[key].get('review')
            assert status=='approved',key
            assert hashlib.sha256((ART/'originals'/f'{key}.png').read_bytes()).hexdigest()==state[key]['sha256'],key
    assert not current.get('seatedReworkPending'),'坐姿返工仍有临时空缺，不能当作完成包'
    assert all(not a['src'].lower().endswith('.wav') for a in current['assets'].values())
    assert by_id['irma08fi']['choices'][1]['set']=='好感 -= 10'
    assert by_id['dk3o5u4e']['choices'][2]['set']=='好感 -= 1'
    assert by_id['kbwv46du']['motionCount']==5
    assert by_id['kbwv46du']['set']==next(l['set'] for l in before['lines'] if l['id']=='kbwv46du')
    for k in ('127wrb75','1sjdneqt','7b2f3g26'):assert not by_id[k]['text']
    report={'originalLineIdsPreserved':len(old_ids),'newLines':len(new_ids)-len(old_ids),
        'laterNodesStoryAndAudioFieldsPreserved':len(before['lines'])-160,
        'performanceBaselineNodeIdsPreserved':len(new_ids) if current.get('characterPerformance') else None,
        'originalAudioAssetsUnchanged':len(audio),'activeVisualIds':len(active),
        'explicitMusicOverlayNodes':overlay_nodes,
        'explicitMusicOverlayCounts':overlay_counts,
        'explicitSoundCorrectionNodes':corrected_sound_nodes,
        'currentAudioAssets':sum(a['type'] not in {'bg','ch'} for a in current['assets'].values()),
        'activeReplacedVisualIds':len(active)-len(remaining),'manualWardrobeVisualIds':remaining,
        'wavPlaybackAssets':0,'chapters':sum(bool(l.get('chapter')) for l in current['lines']),
        'gameSha256':hashlib.sha256((GAME/'game.js').read_bytes()).hexdigest()}
    out=ART/'integration-validation.json'
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True))
    return report
if __name__=='__main__':verify()
