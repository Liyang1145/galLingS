"""Correct the two remaining visible details without changing the approved skirt anatomy."""
import json,shutil
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART,MANIFEST,output,save
state=json.loads(MANIFEST.read_text(encoding='utf-8'))
fixes={
 'S02':('S02_before_tailfix',['S02_before_tailfix','S01'],'''Edit FIRST image ONLY to correct the separate whale tail. Keep the exact adult woman, writing hands, pen, notebook, seated-on-folded-heels anatomy, complete opaque navy dress, face, hair, socks, shoes and transparent sprite framing unchanged. Replace ONLY the distorted tall branching tail behind her with ONE short thick naturally attached whale tail in a LOW relaxed C curve behind her right side, ending in exactly ONE anatomically clear two-lobed fluke. SECOND image is the reference for tail construction, blue mottling and a single terminal fluke ONLY; do not copy its sitting body or hands. Tail must emerge behind her lower back, one tapered stalk to one terminal fluke. No extra lateral fin, branch, fin at the root, duplicate tail, floating segment or giant vertical fin. Keep the complete two flukes inside canvas. Real transparent alpha, no scenery or text.'''),
 'P16':('P16_before_ringfix',['P16_before_ringfix','P13'],'''Edit ONLY the raised LEFT hand near her upper chest in FIRST image of the fully clothed ADULT woman age24. Add one small visibly sky-blue pearl ring in a simple silver setting on the ring finger of THAT raised hand. SECOND image shows the exact small sky-blue pearl ring for reference only. Preserve her exact proud expression, face, hair, full seated body, both knees and parallel legs, intact navy skirt and double-white hem, lap hand entirely above fabric, socks, shoes, SINGLE separate whale tail and transparent framing. No body, fingers, clothing folds or other pose changes. One ring only, no extra jewelry, no scenery or lettering.'''),
}
for key,(backup,refs,prompt) in fixes.items():
 item=state['items'][key]
 if item.get('detail_refinement_queued'):continue
 for suffix in ['.png','.generation.json','.production.json']:
  src=output(key).with_suffix(suffix);dst=output(backup).with_suffix(suffix)
  if src.exists() and not dst.exists():shutil.copy2(src,dst)
 item.update(prompt=prompt,references=refs,dependencies=['S01'] if key=='S02' else [],status='queued',review='pending',detail_refinement_queued=True)
 item.pop('sha256',None);(ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8',newline='\n')
save(state)
