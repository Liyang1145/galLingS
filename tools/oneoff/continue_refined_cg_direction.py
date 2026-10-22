"""Continue the user-supplied tail design, retaining every rejected candidate."""
import json,shutil
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART,ROOT,output,save

def queue():
 state=json.loads((ART/'production.json').read_text('utf-8'))
 reviews=json.loads((ART/'reviews.json').read_text('utf-8'))
 overrides=json.loads((ART/'overrides.json').read_text('utf-8'))
 delivery=ROOT/'archive/deliveries/refined-cg-20261016/originals'
 for key in ['P02','C04','C20']:
  stem=key+'_teammate_refined';assert not output(stem).exists()
  shutil.copy2(delivery/(key+'.png'),output(stem))
 jobs={
  'P02':('direction_before_delivery',['P02_teammate_refined'],
   'Prepare the supplied ADULT woman age24 full-body visual novel sprite for game '
   'integration. Remove ONLY the solid WHITE BACKGROUND to actual transparent '
   'alpha, including enclosed spaces between hair strands, the raised arm, the '
   'body and the tail. Preserve the exact drawing: adult face and expression, '
   'hair, fin ears, loop ahoge, two bow clips, opaque navy sailor dress and skirt, '
   'raised hand holding notebook, hand on hip, two human legs, white socks and '
   'closed shoes. Preserve the refined tail exactly: one long smooth blue/white '
   'tail stalk connects behind lower back, curls UP on her right, ending in '
   'EXACTLY TWO broad flattened flukes at one narrow joint, central notch and '
   'white circular emblem on one lobe. No leaf-like single tip, no third fin. '
   'Keep original head/shoe placement and portrait framing. No white matte, '
   'halo, shadow, generated text or redesign. Finished crisp transparent PNG.'),
  'C01':('direction_before_delivery',['C01_rejected_direction_before_delivery','C04_teammate_refined'],
   'Precise design-unification edit: keep FIRST landscape illustration exactly '
   'unchanged except the whale tail. Same adult woman aged24. Her single hand '
   'catching the flying damp notebook, book and every loose page fully in frame, '
   'face, other hand, opaque navy dress, healthy skin, coast, water and daylight '
   'must stay unchanged. Replace the overly bulky mottled tail at right with '
   'the slim smoothly tapering blue-and-white independent whale tail design '
   'of SECOND illustration. ONE tail connects behind her lower back beneath '
   'water, curves naturally up on right, then ONE narrow terminal joint ends '
   'in EXACTLY TWO broad flattened whale flukes with clear central notch. '
   'Use the refined blue surface, white underside/fin edging and the same '
   'small WHITE CIRCULAR marine emblem on ONE fluke as SECOND reference. '
   'Both flukes fully within image, no third petal or fish fan. Match actual '
   'sunlight and water, no added letters or UI. Same 16:9 landscape camera.'),
  'C27':('detached_tail',['C27_rejected_detached_tail','C20_teammate_refined'],
   'Repair the SINGLE DETACHED TAIL in FIRST full landscape CG. The tail currently '
   'appears to grow out of the player ankle and is disconnected from the woman. '
   'Use SECOND reference only to understand a CONTINUOUS attached tail gently '
   'curving around a limb, and its refined slim blue/white texture, two-fluke '
   'tip and white circular marine emblem. Keep FIRST heroine adult age24, '
   'same face looking aside, opaque navy sailor dress, hair, folded arms, '
   'two independent human legs, clear sunny water and camera. Redraw the '
   'TAIL AS ONE VISIBLE CONTINUOUS PATH: thick root emerges from behind '
   'her lower back at right just below the waterline, travels diagonally '
   'LEFT along the surface UNDER WATER towards the player ankle, makes '
   'a loose open U-shaped nudge BEHIND the ankle, then narrows and returns '
   'right to end at centre-left in TWO flattened flukes on one terminal '
   'joint with central notch. Show the root-to-ankle segment clearly across '
   'middle foreground; no disconnected fin or second tail. It must NOT '
   'emerge from a human leg. Put contact at x=38% y=53% and flukes '
   'x=52% y=46% so both remain ABOVE the bottom dialogue area. '
   'Gentle rescue with natural water occlusion, no restraint or injuries. '
   'No extra limbs, lettering or UI.'),
 }
 for key,(reason,refs,prompt) in jobs.items():
  item=state['items'][key];arch=f'{key}_rejected_{reason}';assert not output(arch).exists()
  for ext in ['.png','.generation.json','.production.json']:
   p=output(key).with_suffix(ext)
   if p.exists():shutil.copy2(p,output(arch).with_suffix(ext))
  shutil.copy2(ART/'prompts'/f'{key}.txt',ART/'prompts'/f'{arch}.txt')
  item.setdefault('candidateRejections',[]).append({'sha256':item['sha256'],'reason':reason,'file':output(arch).relative_to(ROOT).as_posix()})
  item.update(prompt=prompt,references=refs,dependencies=[],status='queued',review='pending')
  overrides[key].update(prompt=prompt,references=refs,dependencies=[])
  reviews[key]={'sha256':item['sha256'],'status':'rejected','note':reason}
  (ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8')
 for name,obj in [('reviews.json',reviews),('overrides.json',overrides)]:
  (ART/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 save(state)

if __name__=='__main__':queue()
