"""Local review gallery; honest route/quality metadata and actual alpha composition."""
import json
from pathlib import Path
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART, ROOT, output

def build():
    state=json.loads((ART/'production.json').read_text(encoding='utf-8'))
    reviews=json.loads((ART/'reviews.json').read_text(encoding='utf-8')) if (ART/'reviews.json').exists() else {}
    rows=[]
    for key,item in state['items'].items():
        if item['status']!='generated':continue
        md=item.get('generation',{})
        review=reviews.get(key,{})
        verdict=review.get('status',item['review']) if review.get('sha256')==item['sha256'] else item['review']
        rows.append({'id':key,'name':item['name'],'kind':item['kind'],'review':verdict,'src':output(key).as_uri(),'size':item.get('size'),'quality':md.get('backend_reported_quality') or '未回传','model':md.get('backend_reported_model') or '未回传','note':review.get('note',item.get('review_note','')),'prompt':(ART/'prompts'/f'{key}.txt').as_uri()})
    data=json.dumps(rows,ensure_ascii=False).replace('<','\\u003c')
    html='''<!doctype html><meta charset="utf-8"><title>海风与布丁 · 新美术审核</title>
<style>body{margin:0;background:#172126;color:#ebefe4;font:15px system-ui}header{position:sticky;top:0;background:#172126f5;padding:20px 30px;z-index:2}h1{font-size:25px;margin:0 0 10px}header p{color:#bdd1c8;margin:8px 0}input,select,button{background:#293d36;color:inherit;padding:10px;border:1px solid #6b8b7c;border-radius:6px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;padding:20px 30px}article{background:#22302f;border-radius:10px;overflow:hidden}article img{width:100%;height:260px;object-fit:contain;background:repeating-conic-gradient(#d7dbe0 0% 25%,#eff0ef 0% 50%) 0/24px 24px;cursor:zoom-in}article p{padding:0 15px}small{color:#b4c7be}dialog{max-width:94vw;background:#172126;color:#ebefe4;border:1px solid #819d8e}dialog img{max-width:90vw;max-height:84vh;object-fit:contain;background:repeating-conic-gradient(#d7dbe0 0% 25%,#eff0ef 0% 50%) 0/24px 24px}dialog::backdrop{background:#000a}a{color:#d4e7c3}</style>
<header><h1>新美术 · 审核与返工</h1><p>请求 Image2.5 / max；后端未确认模型，质量与尺寸按实际回传列出。只有审核合格项才用于试装。</p><input id="q" placeholder="名称或编号"><select id="kind"><option value="">全部类型</option><option value="sprite">人物立绘</option><option value="bg">背景</option><option value="cg">事件CG</option><option value="cover">封面</option></select><select id="review"><option value="">全部状态</option><option value="approved">审核合格</option><option value="pending">待审核</option><option value="rework">待返工</option></select><span id="count"></span></header><main></main><dialog><button onclick="this.parentNode.close()">关闭</button><br><img></dialog><script>
const rows=DATA;const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){const q=document.querySelector('#q').value.toLowerCase(),kind=document.querySelector('#kind').value,review=document.querySelector('#review').value;const found=rows.filter(r=>(!q||(r.id+' '+r.name).toLowerCase().includes(q))&&(!kind||r.kind===kind)&&(!review||r.review===review));document.querySelector('#count').textContent=' '+found.length+' / '+rows.length+' 已生成';document.querySelector('main').innerHTML=found.map(r=>'<article><img loading="lazy" data-id="'+r.id+'" src="'+esc(r.src)+'"><p><b>'+esc(r.id+' '+r.name)+'</b><br><small>'+esc(r.review)+' · '+esc(r.size?.join('×'))+' · 回传质量 '+esc(r.quality)+'</small></p><p><a href="'+esc(r.prompt)+'">提示词</a><br><small>'+esc(r.note)+'</small></p></article>').join('');document.querySelectorAll('[data-id]').forEach(i=>i.onclick=()=>{document.querySelector('dialog img').src=i.src;document.querySelector('dialog').showModal()})}document.querySelectorAll('header input,header select').forEach(x=>x.oninput=render);render();</script>'''.replace('DATA',data)
    dest=ROOT.parent.parent/'outputs/art-upgrade/新美术审核.html';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(html,encoding='utf-8');print(json.dumps({'file':str(dest),'generated':len(rows)},ensure_ascii=True))
if __name__=='__main__':build()
