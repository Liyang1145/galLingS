"""Supply the script's notebook tease and make the seated reading pose awake."""
import copy,json,shutil
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART,MANIFEST,output,save
s=json.loads(MANIFEST.read_text(encoding='utf-8'))
overrides=json.loads((ART/'overrides.json').read_text(encoding='utf-8'))
changes={
 'L10':{'references':['L10_before_performance'],'dependencies':[],
  'prompt':'Edit ONLY the skin detail in this transparent sprite of a fully clothed ADULT woman age24. Remove ALL red scratches, scrape marks, wounds, bruises and bleeding from her arms and legs; restore healthy uninjured skin. Her hurt is EMOTIONAL after an upsetting phone conversation, not a physical injury. Keep the EXACT existing dejected expression, folded arm holding the opposite upper arm, lowered shoulders, navy sailor dress, opaque white socks and closed white shoes, blue hair, fin ears, loop ahoge, independent whale tail, full body framing and transparent alpha. No other pose, wardrobe, face or background changes.'},
 'P03':{'name':'裹毯夜谈怔住','references':['L35'],'dependencies':['L35'],
  'prompt':'Edit this transparent sprite of a fully clothed ADULT woman age24 sitting under a thick opaque whale blanket. Keep her exact recognizable adult identity, hair, ears, ahoge, cream cardigan, loose full-length trousers under the blanket, closed shoes, seated covered legs and independent whale tail. Change ONLY facial expression, shoulders and hands ABOVE the blanket: she has just heard an unexpected personal revelation, blue eyes wide, lips parted in surprise, shoulders slightly lifted, one open hand raised near her upper chest while the other rests on top of the blanket. Preserve the covered lower-body silhouette and identical canvas framing. Natural fingers, no uncovered legs or clothing removal, no text/scenery, clean transparent alpha.'},
 'P04':{'name':'裹毯夜谈受伤生气','references':['L35'],'dependencies':['L35'],
  'prompt':'Edit this transparent sprite of a fully clothed ADULT woman age24 sitting under a thick opaque whale blanket. Preserve exact adult face identity, blue hair, fin ears, ahoge, cream cardigan, loose full-length trousers under the blanket, closed shoes, covered seated legs and separate whale tail. Change the UPPER-BODY ACTING: she leans forward slightly from the shoulders, both hands grip the TOP EDGE of the blanket at chest level, brows furrowed, blue eyes glossy with hurt, mouth speaking in tense indignation. Fin ears alert, independent tail slightly tense to the side. This is fear of being treated as a replacement, not a comic grin. Keep all clothing and the opaque covered lower-body silhouette unchanged. Natural connected hands, no clothing removal, no text, scenery or symbols, clean transparent alpha.'},
 'L34':{'references':['L34_before_performance'],'dependencies':[],
  'prompt':'Edit ONLY the eyes and small facial expression in the reference sprite of the fully clothed ADULT woman age24 reading a book. Open BOTH blue eyes naturally: she is AWAKE, looking attentively toward the viewer with a small fond thoughtful smile. Keep the exact seated body, hand against cheek, other hand and open book on her lap, exact opaque navy sailor dress, white socks, closed white shoes, hair, fin ears, loop ahoge and independent whale tail. Preserve canvas and scale. No clothing, leg, pose, framing, or background change. Clean transparent alpha; no scenery or text.'},
 'P02':{'references':['L08'],'dependencies':['L08'],
  'prompt':'A full-body transparent-alpha visual-novel acting sprite of the exact same ADULT woman aged24 in the reference. Preserve her adult identity, blue hair, fin ears, loop ahoge, navy sailor-collar dress, white socks and closed shoes, two human legs and one separate whale tail. Change the acting pose clearly: she holds the SAME closed blue whale-cover spiral notebook ALOFT in one raised hand, high beside her head and just above the ahoge, teasing the viewer by keeping it out of reach. Other hand on her waist, shoulders slightly turned, confident challenging sidelong smile. The book and holding hand must both remain INSIDE generous canvas margins, visibly above shoulder height. Tail curls alertly upward behind her, naturally rooted behind her lower back. Natural fingers gripping the notebook, no extra arms, no duplicate books. Keep original face size and full-body framing; neutral daylight, clean transparent alpha, no text, scenery or floating symbols.'},
}
for key,change in changes.items():
 item=s['items'].get(key)
 if item and item.get('performance_round2_queued'):continue
 if item:
  for suffix in ('.png','.generation.json','.production.json'):
   source=output(key).with_suffix(suffix)
   if source.exists():shutil.copy2(source,output(key+'_before_performance').with_suffix(suffix))
 else:
  item=copy.deepcopy(s['items']['L35' if key in ('P03','P04') else 'L08']);item.update(id=key,name=change.get('name','常服举高笔记本'),old_names=[],anchors=[],costume='裹毯夜谈' if key in ('P03','P04') else '常服',spec=change.get('prompt'))
  s['items'][key]=item
 item.update(change,status='queued',review='pending',performance_round2_queued=True);item.pop('sha256',None)
 overrides[key]=change;(ART/'prompts'/f'{key}.txt').write_text(change['prompt']+'\n',encoding='utf-8')
(ART/'overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');save(s)
