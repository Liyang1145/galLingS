"""Record first-pass QA failures before requesting tighter image edits."""
import json,shutil
from produce_art_upgrade import ART,output,save

def refine():
 state=json.loads((ART/'production.json').read_text('utf-8'))
 reviews=json.loads((ART/'reviews.json').read_text('utf-8'))
 overrides=json.loads((ART/'overrides.json').read_text('utf-8'))
 jobs={
  'C01':('catch_crop',['C01_rejected_catch_crop'],
   'Keep this complete landscape illustration exactly the same except the small notebook '
   'and the hand/forearm catching it. The notebook is CUT OFF at the top edge; redraw '
   'the catching right arm bent a little lower so the WHOLE book, every loose page and '
   'both cover corners are fully within the frame with at least 70 pixels clear sky '
   'ABOVE it. One hand still catches the airborne damp book beside her head, open fan '
   'of pages and water drops convey interrupted flight. Do not change face, eyes, '
   'hair, dress, independent two-lobed whale tail, other hand, viewpoint, bay, water '
   'or sunlight. Same adult woman aged24, healthy skin, opaque outfit. Do not zoom or '
   'crop the scene. No text/UI.'),
  'P02':('tail_candidate',['P02_rejected_tail_candidate','L01'],
   'Correct the malformed tail in the FIRST transparent sprite by following the '
   'anatomically coherent tail in the SECOND sprite. FIRST sprite adult woman aged24 '
   'must retain EXACTLY her face, smile, hair, raised notebook hand, notebook, '
   'hand on hip, navy opaque sailor dress, human legs, socks, white shoes, framing '
   'and head/shoe positions. Replace the ENTIRE whale tail on her right with a '
   'natural descending C curve like SECOND reference: the thick tail root starts '
   'behind the right hip, curves out and DOWN, narrows to a clearly visible slim '
   'terminal stalk at knee height, then ends in a broad LEFT and RIGHT fluke pair '
   'lower beside the calves, like a horizontally spread whale-tail silhouette '
   'tilted slightly towards camera. TWO terminal lobes on the same joint, deep '
   'central notch, not two big leaves directly attached to the hip, not overlapping '
   'petals. Use the SECOND reference tail silhouette and proportions, including '
   'blue-white pattern. Both lobes entirely inside canvas. Clean transparent alpha, '
   'no background, no halo, no text or other changes.'),
  'C27':('tail_contact',['B02','L01'],
   'Create ONE 16:9 complete visual novel CG matching the exact coastal bay and '
   'bright daylight of FIRST reference and same adult woman age24 identity/opaque '
   'navy sailor dress of SECOND reference. Cinematic slightly downward looking '
   'composition: heroine at right waist deep in clear water, face upper-right '
   'looking away in embarrassed denial, arms folded. Viewer is an adult man '
   'standing in shallows: ONE trouser-covered ankle at middle-left, x=38% y=50%, '
   'with lower leg entering diagonally from bottom-left. Her whale TAIL STALK '
   'starts behind her lower back on the right, curves left UNDER the water '
   'behind his ankle, gently nudging him towards shore, then curves back to '
   'the right to end in a clearly visible PAIR of small broad flattened '
   'whale flukes near image CENTRE x=55% y=53%. The OPEN C around the ankle '
   'is formed by the continuous tapered TAIL STALK, NOT by bending one of '
   'the terminal lobes into a tube. The terminal left/right flukes stay '
   'flat, distinct, symmetrical at one narrow joint with central notch, '
   'like SECOND reference. One tail and exactly two terminal lobes; no '
   'extra fin, single leaf or snake tip. Her TWO human legs remain separate '
   'below opaque dress/water on right. Contact and both terminal flukes '
   'must be ABOVE y=60% because bottom30% holds dialogue. Natural low-force '
   'support, no restraint or injuries. Coherent transparent water refraction '
   'and volume, no giant limb, cut-and-paste, lettering or UI.'),
 }
 for key,(reason,refs,prompt) in jobs.items():
  item=state['items'][key];archive=f'{key}_rejected_{reason}';assert not output(archive).exists()
  for ext in ['.png','.generation.json','.production.json']:
   p=output(key).with_suffix(ext)
   if p.exists():shutil.copy2(p,output(archive).with_suffix(ext))
  shutil.copy2(ART/'prompts'/f'{key}.txt',ART/'prompts'/f'{archive}.txt')
  item.setdefault('candidateRejections',[]).append({'sha256':item['sha256'],'reason':reason,'file':output(archive).relative_to(ART.parents[2]).as_posix()})
  item.update(prompt=prompt,references=refs,dependencies=[],status='queued',review='pending')
  overrides[key].update(prompt=prompt,references=refs,dependencies=[])
  reviews[key]={'sha256':item['sha256'],'status':'rejected','note':reason}
  (ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8')
 for name,obj in [('reviews.json',reviews),('overrides.json',overrides)]:
  (ART/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 save(state)

if __name__=='__main__':refine()
