"""Adopt only reviewed playback copies, keeping every original asset and stable ID."""
import hashlib
import json
import shutil
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import url2pathname
from stage_art_upgrade import build, project
from produce_art_upgrade import GAME, ROOT

def apply():
    source=project(GAME/'game.js')
    draft=json.loads(build().read_text(encoding='utf-8'))
    dest=GAME/'assets/art-upgrade';dest.mkdir(exist_ok=True)
    copies={}
    for asset in draft['assets'].values():
        if not asset.get('productionArtId'):continue
        path=Path(url2pathname(unquote(urlparse(asset['src']).path))).resolve()
        # runtime 是压缩中转站，不常驻仓库（与 GAME/assets/art-upgrade 内容完全重复）。
        # 接入新图前先跑 tools/compress_art_upgrade.py 重新生成，这里只做搬运与校验。
        assert path.parent==(ROOT/'A素材库/art-upgrade/runtime').resolve(),path
        target=dest/path.name
        shutil.copy2(path,target)
        assert hashlib.sha256(path.read_bytes()).digest()==hashlib.sha256(target.read_bytes()).digest()
        asset['src']=target.relative_to(GAME).as_posix()
        copies[asset['productionArtId']]=asset['src']
    used={draft['settings']['cover']['img']}
    for line in draft['lines']:
        if line.get('bg'):used.add(line['bg'])
        used.update(s['asset'] for s in line['sprites'])
    remaining=[{'asset':a['id'],'name':a['name'],'reason':'原文泳装服饰留待人工处理，用户2026-10-15决定'}
        for a in draft['assets'].values() if a['id'] in used and a['type'] in {'ch','bg'} and not a.get('productionArtId')]
    assert {a['asset'] for a in remaining}=={'nvgbi1x6','jtp36q4e'},remaining
    draft['artUpgrade']={'date':'2026-10-15','copiedReviewedArt':len(copies),'activeOriginalWardrobeGaps':remaining,
        'unmadeCg':'C23 泳装礁石CG：保留原文服饰待人工，不用外搭候选顶替；当前不恢复旧错误CG。',
        'requestedModel':'gpt-image-2.5-flare','modelRouteVerified':False,
        'nativeResolution':'立绘1024×1536；横图1672×941。未上采样；请求max不等于实际档位。'}
    (GAME/'game.js').write_text('window.VN_GAME = '+json.dumps(draft,ensure_ascii=False,indent=2)+';\n',encoding='utf-8',newline='\n')
    print(json.dumps({'adoptedOrCallableArt':len(copies),'activeOriginalImages':len(remaining),'lines':len(draft['lines'])}))

if __name__=='__main__':apply()
