"""Adopt four visually reviewed replacements without rerunning story staging.

The archived PNGs are the edit references; exact source hashes bind each review.
This intentionally does not call apply_art_upgrade or direct_character_scenes.
"""
import copy
import hashlib
import json
import shutil
import subprocess

import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

import game_data
from compress_art_upgrade import build as compress
from produce_art_upgrade import ART, GAME, ROOT, output, record, save

BASELINE = '7c50dd2456510c7fb8b771d739838a8bf522fb74'
FIXES = {
    'C12': {
        'archive': 'C12_rejected_skin', 'expectedUsage': 5,
        'spec': '电话后抢手机，情绪受伤、委屈泪眼；身体皮肤完好，无擦伤、淤青、血痕或绷带。保留手机、姿态、服装和原室内构图。',
        'note': '逐图对照：手臂、肘部和膝部误画擦伤已去除；保留泪眼、脸部红晕、手机和人物互动。',
    },
    'C18': {
        'archive': 'C18_rejected_skin_tail', 'expectedUsage': 4,
        'spec': '鱼摊争执时的情绪受伤、抱臂自护；不是身体受伤，裸露皮肤健康无伤痕。一根独立鲸尾末端为明确双叶尾鳍；保留原市场构图和低落表情。',
        'note': '逐图对照：前臂、肘部、下边缘膝部误画擦伤已去除；左侧单叶尾端改为同一尾柄相连的双叶鲸尾鳍。',
    },
    'P09': {
        'archive': 'P09_rejected_tail', 'expectedUsage': 11,
        'spec': '常服嘴硬回望：一根从腰后独立生出的鲸尾，仅一对双叶鲸尾鳍，无第三片向上弯曲的鳍。保持原回望姿势、脸、裙摆、两条人腿和透明底；小幅卷动以完整双叶姿态表现。',
        'note': '灰底合成和全身放大复查：多余第三片上卷尾鳍已去除；保留原双叶、两条人腿、鞋基线、脸和回望动作。透明洞隙未烘焙背景。',
    },
    'O11': {
        'archive': 'O11_rejected_tail', 'expectedUsage': 0,
        'spec': '月光海岸双人坐礁石，独立鲸尾环绕两人影子；一根尾柄连接恰好一对宽扁双叶鲸尾鳍，有中缝、透视体积和礁石接触阴影。备用CG，不新增剧情引用。',
        'note': '逐图对照：单片叶状尾端改为有中央分叉的双叶鲸尾鳍，保留双人、两条人腿、礁石和月光影子；仍是备用CG。',
    },
}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def parse_project(text):
    return json.loads(text.split('=', 1)[1].strip().removesuffix(';'))


def adopt():
    state = json.loads((ART / 'production.json').read_text('utf-8'))
    reviews = json.loads((ART / 'reviews.json').read_text('utf-8'))
    overrides = json.loads((ART / 'overrides.json').read_text('utf-8'))
    game_file = GAME / 'game.js'
    text = game_file.read_text('utf-8-sig')
    project = parse_project(text)
    before = copy.deepcopy(project)
    original = parse_project(subprocess.check_output([
        'git', 'show', BASELINE + ':' + game_file.relative_to(ROOT).as_posix()
    ], cwd=ROOT).decode('utf-8-sig'))
    assert project['lines'] == original['lines'], 'Do not overwrite concurrent story edits'
    report = {'baseline': BASELINE, 'scope': '仅修正当前参考重制批次；Larry原件不参与替换',
              'reviewedOn': '2026-10-16', 'items': {}}
    qa_dir = ROOT.parent.parent / 'outputs/tail-skin-corrections'
    evidence = ART / 'review/tail-skin-corrections'
    evidence.mkdir(parents=True, exist_ok=True)
    for key, fix in FIXES.items():
        item = state['items'][key]
        assert item['status'] == 'generated'
        assert record(output(key))['sha256'] == item['sha256']
        old = ART / 'originals' / (fix['archive'] + '.png')
        old_sha = hashlib.sha256(old.read_bytes()).hexdigest()
        assert old_sha == item['correctionBaseline']['sha256']
        assert old_sha != item['sha256']
        item['spec'] = fix['spec']
        overrides[key]['spec'] = fix['spec']
        reviews[key] = {'status': 'approved', 'sha256': item['sha256'],
                        'note': fix['note'], 'reviewer': 'Codex visual comparison, 2026-10-16'}
        comparison = evidence / (key + '-comparison.jpg')
        shutil.copy2(qa_dir / comparison.name, comparison)
        ids = [a['id'] for a in project['assets'].values() if a.get('productionArtId') == key]
        usages = [line['id'] for line in project['lines'] if line.get('bg') in ids or
                  any(sprite['asset'] in ids for sprite in line.get('sprites', []))]
        assert len(usages) == fix['expectedUsage'], (key, usages)
        report['items'][key] = {'name': item['name'], 'assetIds': ids,
            'rejectedOriginal': old.relative_to(ROOT).as_posix(), 'rejectedSha256': old_sha,
            'adoptedOriginal': item['file'], 'adoptedSha256': item['sha256'],
            'actualSize': item['size'], 'comparison': comparison.relative_to(ROOT).as_posix(),
            'visualReview': fix['note'], 'lineIds': usages,
            'requestedModel': item['generation'].get('requested_model'),
            'requestedQuality': item['generation'].get('requested_quality'),
            'reportedModel': item['generation'].get('backend_reported_model'),
            'reportedQuality': item['generation'].get('backend_reported_quality'),
            'routeVerified': item['generation'].get('model_selection_verified') is True}
    write_json(ART / 'reviews.json', reviews)
    write_json(ART / 'overrides.json', overrides)
    save(state)
    runtime = compress()
    for key in FIXES:
        item = state['items'][key]
        for asset in project['assets'].values():
            if asset.get('productionArtId') != key:
                continue
            # Keep fixed IDs, paths, sceneFit, actingEyes and authored scenes.
            assert asset['src'] == 'assets/art-upgrade/' + key + '.webp'
            shutil.copy2(ROOT / runtime[key]['path'], GAME / asset['src'])
            asset.update(w=item['size'][0], h=item['size'][1], sourceMasterPath=item['file'],
                         modelRequested=item['generation'].get('requested_model'),
                         modelReported=item['generation'].get('backend_reported_model'),
                         imageQualityReported=item['generation'].get('backend_reported_quality'))
        report['items'][key]['runtimeSha256'] = runtime[key]['sha256']
        report['items'][key]['runtimeBytes'] = runtime[key]['bytes']
    frames_path = ART / 'acting-frames.json'
    frames = json.loads(frames_path.read_text('utf-8'))
    # Eyes/geometry did not move in the reviewed local edit.
    assert frames['P09']['eyes'] == [315, 221]
    frames['P09']['sourceSha256'] = state['items']['P09']['sha256']
    write_json(frames_path, frames)
    assert before['lines'] == project['lines'] == original['lines']
    audio = {k: a for k, a in project['assets'].items() if a['type'] not in ('bg', 'ch')}
    old_audio = {k: a for k, a in original['assets'].items() if a['type'] not in ('bg', 'ch')}
    assert audio == old_audio and len(audio) == 103
    for key, asset in project['assets'].items():
        if asset.get('productionArtId') not in FIXES:
            assert asset == original['assets'][key]
    # Avoid even reformatting game.js if the source dimensions did not change.
    if project != before:
        game_data.save(game_file, project)
    report.update(storyAllFieldsUnchanged=True, storyNodeCount=len(project['lines']),
                  audioUnchanged=True, audioAssetCount=len(audio),
                  noNewScenePlacements=True, actualAffectedNodes=20,
                  approvedRuntimeCount=len(runtime),
                  limits=['L17/L18/C23原文泳装及P16戒指仍按既定人工缺口处理。',
                          '请求max，回传medium且未回传模型ID；不视为路由核实或4K交付。',
                          '本轮定向修正不等于此前所有动作、服装与场景一致性缺口均已解决。'])
    write_json(ART / 'tail-skin-corrections.json', report)
    print(json.dumps({'approvedRuntime': len(runtime), 'replacedKeys': list(FIXES),
                      'affectedNodes': 20, 'gameJsonChanged': project != before,
                      'storyAndAudioUnchanged': True}))


if __name__ == '__main__':
    adopt()
