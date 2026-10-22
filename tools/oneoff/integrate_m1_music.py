"""Archive the selected M1 file and map two ordinary coastal passages by node ID."""
import argparse
import copy
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from integrate_atri_music import GAME, ROOT, loudness, probe
from integrate_e4_music import write_json

ASSET_ID = 'bgm_m1_shallows_day'
PREVIOUS = 'bgm_emerald_dream_main_v01'
ARCHIVE = ROOT / 'A素材库/audio/bgm' / (ASSET_ID + '.mp3')
REPORT = ROOT / 'content/audio-records/m1-integration.json'
CUES = [
    ('qfuowzma', 'hnqx7w6w', '第三话：浅滩游泳准备与下水规矩；下潜时交给既有E2'),
    ('cpvlwvrk', 'ceip84bi', '第七话：沙洲捡贝壳、轻松闲谈到午后阴凉；随后保留原停奏'),
]


def integrate(source):
    game_file = GAME / 'game.js'
    project = json.loads(game_file.read_text('utf-8-sig').split('=', 1)[1].strip().removesuffix(';'))
    assert ASSET_ID not in project['assets'] and not REPORT.exists(), 'M1 already integrated; review its existing map'
    before = copy.deepcopy(project)
    info = probe(source)
    assert info['codec'] == 'mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(source), '-f', 'null', '-'], check=True)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    measured = loudness(source)
    reference = loudness(GAME / project['assets'][PREVIOUS]['src'])
    gain = round(min(1.0, 10 ** ((reference - 3 - measured) / 20)), 5)
    target = GAME / 'assets/bgm' / ARCHIVE.name
    assert not ARCHIVE.exists() and not target.exists()
    shutil.copy2(source, ARCHIVE)
    shutil.copy2(ARCHIVE, target)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
    project['assets'][ASSET_ID] = {
        'id': ASSET_ID, 'type': 'bgm', 'name': '浅滩日常 · M1（曲名待定）',
        'src': target.relative_to(GAME).as_posix(), 'dur': info['duration'], 'audioCategory': 'music',
        'auditionOnly': False, 'playbackGain': gain, 'trackCode': 'M1', 'titleStatus': 'untitled',
        'sourceAuthor': 'Liyang1145', 'sourceCurrentPath': ARCHIVE.relative_to(ROOT).as_posix(),
        'sourceSha256': digest, 'purposeStatus': 'scene-mapped', 'cueReport': REPORT.relative_to(ROOT).as_posix(),
    }
    positions = {line['id']: i for i, line in enumerate(project['lines'])}
    cues, changes = [], []
    for start, end, note in CUES:
        first, last = positions[start], positions[end]
        assert first <= last
        for index in range(first, last + 1):
            line = project['lines'][index]
            assert line['bgm'] == PREVIOUS, line['id']
            changes.append({'index': index, 'lineId': line['id'], 'before': PREVIOUS, 'after': ASSET_ID})
            line['bgm'] = ASSET_ID
        cues.append({'startLineId': start, 'lastLineId': end, 'startIndex': first,
            'endExclusive': last + 1, 'nodeCount': last - first + 1, 'note': note})
    assert len(changes) == 61
    for old, new in zip(before['lines'], project['lines']):
        assert {k: v for k, v in old.items() if k != 'bgm'} == {k: v for k, v in new.items() if k != 'bgm'}
        if old['bgm'] != new['bgm']:
            assert new['bgm'] == ASSET_ID and old['bgm'] == PREVIOUS
    assert all(project['assets'][key] == value for key, value in before['assets'].items())
    metadata = {'id': ASSET_ID, 'trackCode': 'M1', 'title': None, 'workingLabel': '浅滩日常',
        'titleStatus': 'untitled', 'selectedBy': 'Liyang1145', 'selectedOn': '2026-10-16',
        'originalFilename': source.name, 'archivePath': ARCHIVE.relative_to(ROOT).as_posix(),
        'runtimePath': target.relative_to(ROOT).as_posix(), 'sha256': digest, 'bytes': source.stat().st_size,
        'audio': info, 'measuredLUFS': measured, 'playbackGain': gain, 'targetReferenceLUFS': reference - 3,
        'processing': {'edited': False, 'reencoded': False, 'loudnessNormalized': False, 'seamlessLoopPrepared': False},
        'loopStart': None, 'loopEnd': None, 'loopPointStatus': '待音乐负责人试听与人工微调',
        'source': {'tool': 'Suno（源文件标签）', 'model': None, 'generationPrompt': None},
        'role': '普通浅滩/沙洲地图日常，显式事件曲和剧情停奏优先'}
    write_json(ROOT / 'A素材库/audio' / (ASSET_ID + '.metadata.json'), metadata)
    manifest_file = ROOT / 'A素材库/manifest.json'
    manifest = json.loads(manifest_file.read_text('utf-8-sig'))
    assert not any(item['id'] == ASSET_ID for item in manifest['assets'])
    manifest['assets'].append({'id': ASSET_ID, 'title': '浅滩日常（功能名）', 'title_status': 'untitled',
        'track_code': 'M1', 'category': 'bgm', 'path': ARCHIVE.relative_to(ROOT / 'A素材库').as_posix(),
        'format': 'mp3', 'bytes': metadata['bytes'], 'sha256': digest, 'duration_seconds': info['duration'],
        'source_filename': source.name, 'provenance': '音乐负责人提供并指定用于M1，正式曲名未定',
        'archived_on': '2026-10-16', 'license': '未指定开放许可证；不默认适用引擎代码许可证'})
    write_json(manifest_file, manifest)
    write_json(REPORT, {'assetId': ASSET_ID, 'workingLabel': '浅滩日常', 'titleStatus': 'untitled',
        'baselineCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'sourceGameSha256': hashlib.sha256(game_file.read_bytes()).hexdigest(), 'sourceSha256': digest,
        'cues': cues, 'nodeChanges': changes, 'changedNodes': len(changes), 'playbackGain': gain,
        'allOtherLineFieldsPreserved': True, 'existingAssetsPreserved': len(before['assets']),
        'originalAudioAssetsPreserved': sum(a['type'] not in ('bg', 'ch') for a in before['assets'].values()),
        'firstAppearanceAndCharacterThemePreserved': True, 'eventTracksAndSilencePreserved': True,
        'loopPoint': '播放器完整MP3循环，未制作无缝循环点'})
    game_file.write_text('window.VN_GAME = ' + json.dumps(project, ensure_ascii=False, indent=2) + ';\n',
        encoding='utf-8', newline='\n')
    print(json.dumps({'assetId': ASSET_ID, 'duration': info['duration'], 'sha256': digest,
        'playbackGain': gain, 'cues': len(cues), 'changedNodes': len(changes)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    integrate(parser.parse_args().source)
