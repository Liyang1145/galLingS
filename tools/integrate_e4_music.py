"""Archive the music lead's E4 selection and add three explicit aftermath cues."""
import argparse
import copy
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from integrate_atri_music import GAME, ROOT, loudness, probe

ASSET_ID = 'bgm_e4_sunset_wait'
ARCHIVE = ROOT / '素材库/audio/bgm' / (ASSET_ID + '.mp3')
REPORT = ROOT / 'content/audio/e4-integration.json'
CUES = [
    ('x68g8tf7', 'eclt59o4', '第九话：黄昏退潮、离开后的笔记至章末；原稿L3594单音提示'),
    ('17nl2n08', '4rlyhkwh', '第十话：其后数日等待；第五日主动出发前结束，原稿L3813极慢提示'),
    ('0dejux6h', 'onk5pky8', '第十一话：救援后尚未解冻的回答；她重新回应前结束，原稿L3983单音提示'),
]


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def integrate(source):
    game_file = GAME / 'game.js'
    project = json.loads(game_file.read_text('utf-8-sig').split('=', 1)[1].strip().removesuffix(';'))
    assert ASSET_ID not in project['assets'] and not REPORT.exists(), 'E4 already integrated; review existing cues instead of overwriting'
    before = copy.deepcopy(project)
    info = probe(source)
    assert info['codec'] == 'mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(source), '-f', 'null', '-'], check=True)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    measured = loudness(source)
    reference = loudness(GAME / project['assets']['bgm_emerald_dream_main_v01']['src'])
    gain = round(min(1.0, 10 ** ((reference - 4 - measured) / 20)), 5)
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    assert not ARCHIVE.exists()
    shutil.copy2(source, ARCHIVE)
    target = GAME / 'assets/bgm' / ARCHIVE.name
    assert not target.exists()
    shutil.copy2(ARCHIVE, target)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
    asset = {'id': ASSET_ID, 'type': 'bgm', 'name': '日落空守 · E4（暂定名）',
             'src': target.relative_to(GAME).as_posix(), 'dur': info['duration'],
             'audioCategory': 'music', 'auditionOnly': False, 'playbackGain': gain,
             'trackCode': 'E4', 'provisionalTitle': True, 'sourceAuthor': 'Liyang1145',
             'sourceCurrentPath': ARCHIVE.relative_to(ROOT).as_posix(), 'sourceSha256': digest,
             'purposeStatus': 'scene-mapped', 'cueReport': REPORT.relative_to(ROOT).as_posix()}
    project['assets'][ASSET_ID] = asset
    positions = {line['id']: i for i, line in enumerate(project['lines'])}
    cues = []
    changes = []
    for start, end, note in CUES:
        first, last = positions[start], positions[end]
        assert first <= last
        for index in range(first, last + 1):
            line = project['lines'][index]
            assert line['bgm'] is None, (index, line['id'], line['bgm'])
            line['bgm'] = ASSET_ID
            changes.append({'index': index, 'lineId': line['id'], 'before': None, 'after': ASSET_ID})
        cues.append({'startLineId': start, 'lastLineId': end, 'startIndex': first,
                     'endExclusive': last + 1, 'nodeCount': last - first + 1, 'note': note})
    changed_ids = {row['lineId'] for row in changes}
    for old, new in zip(before['lines'], project['lines']):
        assert {k: v for k, v in old.items() if k != 'bgm'} == {k: v for k, v in new.items() if k != 'bgm'}
        if old['bgm'] != new['bgm']:
            assert new['id'] in changed_ids
    for aid, old in before['assets'].items():
        assert project['assets'][aid] == old
    metadata = {'id': ASSET_ID, 'trackCode': 'E4', 'title': '日落空守', 'titleStatus': 'provisional',
                'selectedBy': 'Liyang1145', 'selectedOn': '2026-10-16',
                'originalFilename': source.name, 'archivePath': ARCHIVE.relative_to(ROOT).as_posix(),
                'runtimePath': target.relative_to(ROOT).as_posix(), 'sha256': digest,
                'bytes': source.stat().st_size, 'audio': info, 'measuredLUFS': measured,
                'playbackGain': gain, 'targetReferenceLUFS': reference - 4,
                'processing': {'edited': False, 'reencoded': False, 'loudnessNormalized': False,
                               'seamlessLoopPrepared': False},
                'loopStart': None, 'loopEnd': None, 'loopPointStatus': '待音乐负责人试听与人工微调',
                'source': {'tool': 'Suno（源文件标签）', 'model': None, 'generationPrompt': None},
                'role': '争吵后的黄昏退潮、等待、和解前尚未解冻的情绪；不是争执动作配乐'}
    write_json(ROOT / '素材库/audio' / (ASSET_ID + '.metadata.json'), metadata)
    manifest_file = ROOT / '素材库/manifest.json'
    manifest = json.loads(manifest_file.read_text('utf-8-sig'))
    assert not any(a['id'] == ASSET_ID for a in manifest['assets'])
    manifest['assets'].append({'id': ASSET_ID, 'title': '日落空守', 'title_status': 'provisional',
        'track_code': 'E4', 'category': 'bgm', 'path': ARCHIVE.relative_to(ROOT / '素材库').as_posix(),
        'format': 'mp3', 'bytes': metadata['bytes'], 'sha256': digest,
        'duration_seconds': info['duration'], 'source_filename': source.name,
        'provenance': '音乐负责人提供并指定用于E4，名称暂定', 'archived_on': '2026-10-16',
        'license': '未指定开放许可证；不默认适用引擎代码许可证'})
    write_json(manifest_file, manifest)
    report = {'assetId': ASSET_ID, 'title': '日落空守', 'titleStatus': 'provisional',
              'baselineCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'sourceGameSha256': hashlib.sha256(game_file.read_bytes()).hexdigest(),
              'sourceSha256': digest, 'cues': cues, 'nodeChanges': changes, 'changedNodes': len(changes),
              'allOtherLineFieldsPreserved': True, 'existingAssetsPreserved': len(before['assets']),
              'originalAudioAssetsPreserved': sum(a['type'] not in ('bg', 'ch') for a in before['assets'].values()),
              'silencePreserved': ['电话和正面争执', '深夜解释失败与她离去', '第五日出发、水下、救援及咳水', '重新回应至原有翡翠之梦回归'],
              'playbackGain': gain, 'loopPoint': '未制作无缝循环，保留完整原MP3'}
    write_json(REPORT, report)
    game_file.write_text('window.VN_GAME = ' + json.dumps(project, ensure_ascii=False, indent=2) + ';\n',
                         encoding='utf-8', newline='\n')
    print(json.dumps({'assetId': ASSET_ID, 'duration': info['duration'], 'sha256': digest,
                      'playbackGain': gain, 'cues': len(cues), 'changedNodes': len(changes)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    integrate(parser.parse_args().source)
