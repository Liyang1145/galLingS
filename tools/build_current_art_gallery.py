"""Build a standalone gallery of only artwork referenced by the current game.

Full pictures retain the exact playback bytes. Small thumbnails are only for
the gallery grid; unused assets, source duplicates and rejected art are absent.
"""
import argparse
import base64
import hashlib
import io
import json
import subprocess
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / '海风与布丁'
ART = ROOT / 'A素材库/art-upgrade'
KIND_NAMES = {'cover': '封面', 'bg': '场景背景', 'sprite': '角色立绘', 'cg': '剧情CG'}


def data_url(data, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(data).decode('ascii')


def build(destination):
    game_file = GAME / 'game.js'
    project = json.loads(game_file.read_text('utf-8-sig').split('=', 1)[1].strip().removesuffix(';'))
    production = json.loads((ART / 'production.json').read_text('utf-8'))['items']
    cover = project.get('settings', {}).get('cover', {}).get('img')
    used = {cover} if cover else set()
    usage = {}
    chapter = None
    chapters = []
    for index, line in enumerate(project['lines']):
        if line.get('chapter'):
            chapter = line['chapter']
            chapters.append(chapter)
        ids = {s['asset'] for s in line.get('sprites', [])}
        if line.get('bg'):
            ids.add(line['bg'])
        used.update(ids)
        for aid in ids:
            usage.setdefault(aid, []).append((index, line['id'], chapter))
    active = [a for a in project['assets'].values() if a['id'] in used and a['type'] in {'bg', 'ch'}]
    by_hash = {}
    for asset in active:
        path = (GAME / asset['src']).resolve()
        assert path.is_file() and GAME.resolve() in path.parents
        payload = path.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        key = asset.get('productionArtId')
        item = production.get(key, {})
        kind = 'cover' if asset['id'] == cover else item.get('kind') or (
            'sprite' if asset['type'] == 'ch' else 'cg' if asset.get('cg') or asset['name'].startswith('CG_') else 'bg')
        if digest not in by_hash:
            with Image.open(path) as image:
                width, height = image.size
                thumb = image.convert('RGBA')
                thumb.thumbnail((560, 340))
                buffer = io.BytesIO()
                thumb.save(buffer, 'WEBP', quality=83, method=6)
            mime = Image.MIME[Image.open(path).format]
            by_hash[digest] = {'id': key or asset['id'], 'name': item.get('name') or asset['name'],
                'kind': kind, 'kindName': KIND_NAMES[kind], 'w': width, 'h': height,
                'sha256': digest, 'bytes': len(payload), 'assetIds': [], 'assetNames': [],
                'paths': [], 'nodeIds': [], 'chapters': [], 'firstUse': len(project['lines']),
                'manual': not bool(key), 'src': data_url(payload, mime),
                'thumb': data_url(buffer.getvalue(), 'image/webp'), 'extension': path.suffix.lower()}
        row = by_hash[digest]
        assert row['kind'] == kind
        row['assetIds'].append(asset['id'])
        row['assetNames'].append(asset['name'])
        row['paths'].append(path.relative_to(ROOT).as_posix())
        for index, node_id, chapter in usage.get(asset['id'], []):
            if node_id not in row['nodeIds']:
                row['nodeIds'].append(node_id)
            if chapter and chapter not in row['chapters']:
                row['chapters'].append(chapter)
            row['firstUse'] = min(row['firstUse'], index)
    rows = sorted(by_hash.values(), key=lambda r: (r['kind'] != 'cover', r['firstUse'], r['id']))
    assert {aid for row in rows for aid in row['assetIds']} == {a['id'] for a in active}
    counts = dict(Counter(row['kind'] for row in rows))
    for row in rows:
        row['usage'] = len(row['nodeIds'])
    manifest = {'title': '海风与布丁 · 当前图库', 'snapshotDate': '2026-10-16',
        'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'gameSha256': hashlib.sha256(game_file.read_bytes()).hexdigest(),
        'scope': '仅当前game.js的封面、逐句背景和立绘引用；相同SHA合并。未引用图不进入HTML或清单。',
        'activeAssetIds': len(active), 'uniqueImages': len(rows), 'counts': counts,
        'manualCurrentImages': sum(row['manual'] for row in rows),
        'items': [{k: v for k, v in row.items() if k not in {'src', 'thumb'}} for row in rows]}
    payload = {'rows': rows, 'chapters': chapters, 'counts': counts,
               'activeIds': len(active), 'date': manifest['snapshotDate']}
    html = TEMPLATE.replace('__PAYLOAD__', json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'))
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(html, encoding='utf-8', newline='\n')
    manifest['htmlSha256'] = hashlib.sha256(destination.read_bytes()).hexdigest()
    manifest['htmlBytes'] = destination.stat().st_size
    destination.with_suffix('.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    return {k: v for k, v in manifest.items() if k != 'items'}


TEMPLATE = r'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>海风与布丁 · 当前图库</title>
<style>
:root{color-scheme:light;--ink:#193b48;--muted:#617b83;--line:#dbe6e5;--sea:#176475;--paper:#f8f8f2}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 "Microsoft YaHei",system-ui,sans-serif}button,input,select,a{font:inherit}button,a,input,select{-webkit-tap-highlight-color:transparent}button,a{touch-action:manipulation}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #3b96aa;outline-offset:3px}header{max-width:1536px;padding:48px 38px 26px;margin:auto}.eyebrow{font-size:12px;letter-spacing:.18em;color:var(--sea)}h1{font-size:clamp(30px,4vw,44px);letter-spacing:.04em;font-weight:500;line-height:1.3;margin:10px 0}header p{margin:10px 0 0;color:var(--muted)}.totals{display:flex;gap:24px;flex-wrap:wrap;margin-top:24px}.totals span{color:var(--muted);font-size:13px}.totals b{font-size:24px;font-weight:500;color:var(--ink);margin-right:6px}nav{position:sticky;top:0;z-index:2;background:var(--paper);border-block:1px solid var(--line)}.toolbar{max-width:1536px;margin:auto;padding:14px 38px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}.tabs{display:flex;gap:6px;flex-wrap:wrap}.tabs button{background:transparent;color:var(--muted);border:1px solid transparent;border-radius:30px;padding:8px 15px}.tabs button[aria-pressed=true]{background:var(--sea);color:white}.tools{display:flex;gap:8px;margin-left:auto}input,select{border:1px solid var(--line);border-radius:8px;background:#fffefa;color:var(--ink);padding:10px 12px}input{width:240px;min-width:120px}select{max-width:220px}.results{max-width:1536px;margin:0 auto;padding:20px 38px 0;display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:13px}.grid{max-width:1536px;margin:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:22px;padding:20px 38px 48px}.card{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fffefa}.picture{display:block;width:100%;height:230px;padding:0;border:0;border-bottom:1px solid var(--line);background:#dce9e8;cursor:zoom-in}.picture img{width:100%;height:100%;object-fit:contain;display:block}.card[data-kind=sprite] .picture{background:#cbd6db}.card[data-kind=cg] .picture,.card[data-kind=bg] .picture,.card[data-kind=cover] .picture{background:#e5ebe9}.card .info{padding:15px 17px 17px}.card .topline{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--muted);letter-spacing:.06em}.card h2{font-size:16px;font-weight:500;margin:7px 0 8px;line-height:1.5}.card .detail{margin:0;color:var(--muted);font-size:12px}.manual{display:inline-block;margin-top:9px;color:#8b6229;font-size:11px;background:#faf0df;border-radius:4px;padding:3px 6px}.empty{grid-column:1/-1;padding:60px;text-align:center;color:var(--muted)}footer{padding:0 30px 34px;text-align:center;font-size:12px;color:var(--muted)}dialog{border:1px solid #56747c;border-radius:14px;padding:0;width:min(1320px,96vw);max-height:96vh;background:#f8f8f2;color:var(--ink)}dialog::backdrop{background:#102d36e8}.viewerbar{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--line)}.viewerbar button,.viewerbar a{padding:8px 12px;background:transparent;border:1px solid var(--line);border-radius:6px;color:var(--ink);text-decoration:none}.viewerbar .actions{display:flex;gap:8px}.viewer-title{font-size:15px;min-width:0}.viewer-title small{display:block;color:var(--muted);font-size:11px}.full-stage{height:calc(92vh - 133px);min-height:240px;background:#263c45;display:flex;align-items:center;justify-content:center}.full-stage.sprite{background:#cbd6db}.full-stage img{width:100%;height:100%;object-fit:contain;display:block}.viewerfoot{padding:10px 18px;color:var(--muted);font-size:12px;display:flex;justify-content:space-between;gap:12px}.viewerfoot button{padding:3px 10px;background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:5px}.viewerfoot .arrows{display:flex;gap:7px;white-space:nowrap}body:has(dialog[open]){overflow:hidden}@media(hover:hover){.card:hover{border-color:#8eb6bb;box-shadow:0 4px 20px #274c5510}.tabs button:hover{border-color:#a0bdc1}}@media(max-width:760px){header{padding:30px 20px 24px}.toolbar{padding:12px 18px;gap:10px}.tools{margin-left:0;width:100%}.tools input{width:100%;flex:1}.tools select{max-width:45%}.tabs button{padding:7px 11px}.grid{padding:16px 18px 36px;gap:14px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}.results{padding:17px 20px 0}.results .tip{display:none}.totals{gap:18px}.picture{height:230px}.viewerbar{padding:10px;align-items:flex-start}.viewerbar .actions{gap:5px}.viewerbar button,.viewerbar a{padding:7px}.viewer-title{max-width:56%}.full-stage{height:calc(90vh - 150px)}.viewerfoot{padding:10px;align-items:center}.viewerfoot #viewer-note{max-width:63%}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style></head><body>
<header><div class="eyebrow">海风与布丁 · ART COLLECTION</div><h1>当前图库</h1><p id="intro"></p><div class="totals" id="totals"></div></header>
<nav aria-label="图库筛选"><div class="toolbar"><div class="tabs" id="tabs"></div><div class="tools"><input id="search" type="search" aria-label="搜索图片" placeholder="搜索场景、动作或编号"><select id="chapter" aria-label="按章节筛选"><option value="">所有章节</option></select></div></div></nav>
<div class="results"><span id="count" aria-live="polite"></span><span class="tip">点击看大图 · ← → 切换 · Esc 关闭</span></div>
<main class="grid" id="grid" aria-label="当前使用图片"></main><footer>仅收录当前游戏封面与剧情实际引用的图片 · <span id="snapshot"></span></footer>
<dialog id="viewer" aria-labelledby="viewer-name"><div class="viewerbar"><div class="viewer-title"><span id="viewer-name"></span><small id="viewer-meta"></small></div><div class="actions"><a id="download" download>下载图片</a><button id="close" type="button" aria-label="关闭大图">关闭 ×</button></div></div><div class="full-stage" id="full-stage"><img id="full" alt=""></div><div class="viewerfoot"><span id="viewer-note"></span><div class="arrows"><button id="prev" aria-label="上一张">←</button><span id="position"></span><button id="next" aria-label="下一张">→</button></div></div></dialog>
<script id="gallery-data" type="application/json">__PAYLOAD__</script>
<script>
'use strict';
const data=JSON.parse(document.getElementById('gallery-data').textContent),rows=data.rows;
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=[['','全部'],['cover','封面'],['bg','场景'],['sprite','立绘'],['cg','CG']];
let kind='',filtered=rows.slice(),selected=0,returnFocus=null,downloadUrl=null;
$('intro').textContent=`${rows.length}张现用图片，按剧情首次出现的顺序整理。相同图片合并展示。`;
$('snapshot').textContent=data.date;
$('totals').innerHTML=categories.slice(1).map(([key,label])=>`<span><b>${data.counts[key]||0}</b>${label}</span>`).join('');
$('chapter').insertAdjacentHTML('beforeend',data.chapters.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(''));
$('tabs').innerHTML=categories.map(([key,label])=>`<button type="button" data-kind="${key}" aria-pressed="${key===''}">${label}</button>`).join('');
function chapterLabel(r){if(r.kind==='cover')return '标题画面';if(r.chapters.length===1)return r.chapters[0];return `用于${r.chapters.length}个章节`;}
function render(){const query=$('search').value.toLowerCase().trim(),chapter=$('chapter').value;
filtered=rows.filter(r=>(!kind||r.kind===kind)&&(!chapter||r.chapters.includes(chapter))&&(!query||[r.id,r.name,...r.assetNames,...r.chapters].join(' ').toLowerCase().includes(query)));
$('count').textContent=`显示 ${filtered.length} / ${rows.length} 张`;
$('grid').innerHTML=filtered.length?filtered.map((r,i)=>`<article class="card" data-kind="${r.kind}"><button type="button" class="picture" data-index="${i}" aria-label="查看${esc(r.name)}"><img loading="lazy" decoding="async" src="${r.thumb}" alt="${esc(r.name)}" width="${r.w}" height="${r.h}"></button><div class="info"><div class="topline"><span>${esc(r.kindName)}</span><span>${esc(r.id)}</span></div><h2>${esc(r.name)}</h2><p class="detail">${esc(chapterLabel(r))} · ${r.w} × ${r.h}</p>${r.manual?'<span class="manual">现用图 · 待人工统一</span>':''}</div></article>`).join(''):'<p class="empty">没有匹配的图片，试试其他关键词。</p>';
$('grid').querySelectorAll('[data-index]').forEach(b=>b.addEventListener('click',()=>openImage(Number(b.dataset.index),b)));
}
function showImage(){const r=filtered[selected];$('viewer-name').textContent=r.name;$('viewer-meta').textContent=`${r.kindName} · ${r.id} · ${r.w} × ${r.h}`;$('full-stage').classList.toggle('sprite',r.kind==='sprite');$('full').src=r.src;$('full').alt=r.name;$('position').textContent=`${selected+1} / ${filtered.length}`;$('viewer-note').textContent=r.manual?'当前游戏正在使用，服饰与画风仍待人工统一。':r.kind==='cover'?'当前标题封面':`${chapterLabel(r)} · ${r.usage}句使用`;
if(downloadUrl)URL.revokeObjectURL(downloadUrl);const [prefix,encoded]=r.src.split(','),bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));downloadUrl=URL.createObjectURL(new Blob([bytes],{type:prefix.slice(5,prefix.indexOf(';'))}));$('download').href=downloadUrl;$('download').download=`${r.id}_${r.name}${r.extension}`;
}
function openImage(index,button){selected=index;returnFocus=button;showImage();$('viewer').showModal();$('close').focus();}
function move(delta){selected=(selected+delta+filtered.length)%filtered.length;showImage();}
function close(){if($('viewer').open)$('viewer').close();}
$('tabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{kind=b.dataset.kind;$('tabs').querySelectorAll('button').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));render();}));
$('search').addEventListener('input',render);$('chapter').addEventListener('change',render);$('close').addEventListener('click',close);$('prev').addEventListener('click',()=>move(-1));$('next').addEventListener('click',()=>move(1));
$('viewer').addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}});
$('viewer').addEventListener('click',event=>{if(event.target===$('viewer')){const box=$('viewer').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}});
$('viewer').addEventListener('close',()=>{if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}$('full').removeAttribute('src');returnFocus?.focus();});render();
</script></body></html>'''


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT.parent.parent / 'outputs/current-art-gallery/海风与布丁_当前图库.html')
    print(json.dumps(build(parser.parse_args().output), ensure_ascii=True))
