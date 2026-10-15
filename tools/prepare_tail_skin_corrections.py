"""Queue four source-preserving local edits; never replace story or music."""
import copy,json,shutil
from pathlib import Path
from produce_art_upgrade import ART,save

FIXES={
 'C12':('skin','''Edit ONLY the mistaken injury marks in the FIRST full landscape illustration. The woman is the same adult age24. Her distress is EMOTIONAL after a hurtful conversation, not a bodily injury. Restore healthy, intact, unmarked skin on both upper arms, elbows, forearms, hands, knees and visible legs. Remove every red scratch, abrasion, bruise, scrape, blood mark and scab. Preserve natural anatomical shading and sun highlights. Retain EXACTLY her tearful offended expression, blush, watery eyes, phone held to chest, arm pose, face, blue hair, adult body proportions, navy sailor-collar dress, continuous opaque skirt, whale tail, man's foreground hand and the sunlit study. Do not add bandages or scars, do not make her cheerful, do not change the composition or redesign the scene. One finished coherent image with the same 16:9 landscape framing and painting style.'''),
 'C18':('skin_tail','''Correct ONLY the mistaken physical injuries and the malformed tail end in this full landscape illustration. Same adult heroine aged24, same sad and emotionally hurt face and self-comforting arm-holding pose at the fish stall. Her skin is physically healthy: remove ALL red scratches, abrasions, bruises, bleeding and scabs on the exposed arm, forearm, elbows and legs, including the knee near the lower edge. Keep natural skin shading and blush. No bandages, no wounds. At the LEFT of the heroine replace the single leaf-like tail end with one recognizable WHALE fluke pair: ONE continuous mottled-blue tail stalk comes from behind her lower back, narrows to ONE terminal joint, and ends in EXACTLY TWO broad left/right flukes with a central notch. Keep both flukes clear within the existing left-side space, correctly foreshortened; no third fin, no second tail, no spinal dorsal fin. Her two human legs remain independent from the tail. Keep her identity, hair, opaque navy dress and hem, hands, both adult characters, fish stall products, market buildings, camera, summer daylight and delicate illustration style otherwise unchanged. Same 16:9 full coherent scene, not a pasted silhouette. No text or new props.'''),
 'P09':('tail','''Precise local correction of the tail ONLY in this existing full-body transparent character sprite. Same adult heroine aged24. There are currently THREE fluke-like pointed lobes on the lower-right tail: a left-pointing lower lobe, a down/right-pointing lower lobe, and an EXTRA small upward-curled lobe above them. REMOVE the extra upward-curled lobe entirely and repair that empty region to transparent alpha. Keep ONE smooth continuous blue-and-white whale tail from the lower back, narrowing to ONE terminal joint with EXACTLY TWO broad flukes and a clear central notch. A whale fluke pair is a flattened left/right pair, not three petals, not a fish caudal fan and not an extra appendage. Preserve the existing two lower flukes' placement as much as possible. Keep ALL other pixels/geometry as faithfully as possible: recognizable face, warm shy look back over shoulder, hair strands, bow clips, fin ears, adult body, arms, opaque sailor dress and white double hem stripes, two healthy human legs, white ankle socks and closed white shoes, framing, scale and shoe baseline. Actual transparent alpha background, no scenery, shadow, halo, checkerboard, new jewelry or injuries. Keep original portrait aspect ratio.'''),
 'O11':('tail','''Repair ONLY the malformed whale tail in this complete moonlit coastal illustration. Keep the same two adults, faces, expressions, sitting poses, navy dress, two normal human legs, white shoes, rock, their moon-cast shadows, moon, town and coastline EXACTLY in place. The huge single leaf-shaped blue fin in the right foreground is anatomically wrong. Redraw it as ONE continuous independently attached whale tail from behind her LOWER BACK, tapering smoothly to ONE narrow peduncle and then EXACTLY TWO flattened broad left/right flukes, separated by a visible central notch, seen in natural perspective lying/curving over the rock. The pair must visibly read as a whale tail, not a single crescent blade, three-point fan, leaf, fish fin or separate tails. Keep the recognizable mottled cobalt blue/white skin pattern, plausible volume and the soft curved gesture around the couple's shadows. No added dorsal or side fins and no replacement of her human legs. Match the existing moonlight direction, contact shading, sharpness and painterly anime VN style; no glow outlines. No new text, accessories, wounds or changes to the pair's interaction. Same 16:9 landscape canvas.'''),
}

def prepare():
 state=json.loads((ART/'production.json').read_text('utf-8'))
 reviews=json.loads((ART/'reviews.json').read_text('utf-8'))
 overrides=json.loads((ART/'overrides.json').read_text('utf-8'))
 for key,(reason,prompt) in FIXES.items():
  item=state['items'][key];archived=key+'_rejected_'+reason
  assert not (ART/'originals'/f'{archived}.png').exists(),f'{key} already queued; do not overwrite review history'
  for suffix in ['.png','.generation.json','.production.json']:
   path=ART/'originals'/f'{key}{suffix}'
   if path.exists():shutil.copy2(path,ART/'originals'/f'{archived}{suffix}')
  shutil.copy2(ART/'prompts'/f'{key}.txt',ART/'prompts'/f'{archived}.txt')
  overrides[key]={**overrides.get(key,{}),'prompt':prompt,'references':[archived],'dependencies':[]}
  item.update(prompt=prompt,references=[archived],dependencies=[],status='queued',review='pending',correctionBaseline={'sha256':item['sha256'],'reason':reason,'original':f'originals/{archived}.png'})
  reviews[key]={'status':'rejected','sha256':item['sha256'],'note':'用户要求复核后撤销旧审核：'+reason+'；旧稿留档，修正输出须重新审核。','reviewer':'Codex source inspection, 2026-10-15'}
  (ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8',newline='\n')
 (ART/'reviews.json').write_text(json.dumps(reviews,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 (ART/'overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 save(state);print('Queued: '+', '.join(FIXES))

if __name__=='__main__':prepare()
