"""Queue story-specific repairs; preserve reviewed masters and fixed asset IDs."""
import json, shutil
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART, output, save

TAIL = ('Exactly ONE independent blue-and-white mammalian whale tail attaches behind her lower back, '
        'separate from her TWO human legs. It tapers to ONE narrow peduncle ending in EXACTLY TWO '
        'broad flattened left/right flukes with a deep visible central notch. Show both lobes clearly '
        'in the same plane, with believable volume. No single leaf, overlapping petal, third fin, '
        'fish fan, dorsal fin, disconnected lobe, tubular pointed tip or additional tail.')
IDENTITY = ('The same ADULT woman age24 as the reference, long cobalt/periwinkle blue hair, loop ahoge, '
            'cyan bow clips, blue-and-white fin ears, blue eyes, exact opaque navy sailor-collar '
            'dress with cyan chest bow and white double hem stripes. Healthy intact skin. '
            'Preserve her recognizable face, mature proportions, delicate painted anime VN finish. ')
FIXES = {
 'C01': ('story_catch', ['B02', 'L01'],
  'Redraw this opening event as ONE complete landscape 16:9 CG using FIRST image for the exact sunny '
  'shallow coastal bay, town, rocky shore, daylight and paint style; SECOND image for the heroine identity. '
  + IDENTITY + 'Specific script action: after the player has been thrown into the water, his small '
  'spiral-bound notebook has flown up out of his hands. She swiftly CATCHES it with ONE hand in '
  'mid-air beside and slightly above her face. Her right hand visibly closes on the lower corner '
  'of the notebook just as it arrives, loose damp pages and a few water drops showing the interrupted '
  'flight. Her other hand remains clearly away from the notebook at waist level. No handover, '
  'no offering the book to the viewer, no two-handed grip, no player hand touching it. The small '
  'A5 notebook has the same light blue-and-white whale-tail cover seen in the other opening props, '
  'a single spine, equal-sized covers, no readable lettering. Determined surprised eyes looking at '
  'the caught book, not posing. Viewpoint at water height from the player a few metres away; '
  'she stands in waist-deep clear shallows, naturally water-occluded lower body, opaque dress. '
  'One independent whale tail arches behind to the right, its two flukes clearly visible above water. '
  + TAIL + ' Main hand-book contact and face in top 65% above the dialogue panel. Coherent perspective, '
  'sunlight and water contact, not a pasted sprite. No UI, text or logo.'),
 'P14': ('notebook', ['P14_rejected_notebook'],
  'Precise local prop correction of this transparent full-body acting sprite. ' + IDENTITY +
  'Keep the exact face, mouth, hair, shoulders, standing pose, dress, skirt, legs, socks, shoes, '
  'tail, head position and framing unchanged. Correct the OPEN NOTEBOOK held at chest height: '
  'it is a real A5 spiral notebook opened to two facing inner pages; BOTH leaves have identical '
  'physical width and height. The upper edges align at the same top binding ring and bottom '
  'edges align at the same bottom ring, sharing ONE straight vertical binding spine and coherent '
  'perspective. Show a clean shallow V opening so that the left page is not a tiny rectangle '
  'and the right page is not an oversized trapezoid. Inner pages on BOTH sides are off-white '
  'with faint unreadable pencil lines; the light-blue outer cover is only a narrow rim behind '
  'the pages, not a huge graphic on the inside page. Adjust only fingers touching the book '
  'as needed for natural support; exactly five fingers per hand. No readable text. '
  'Actual transparent alpha, no background or halo, preserve original portrait canvas.'),
 'P02': ('tail_opening', ['P02_rejected_tail_opening'],
  'Repair ONLY the malformed tail on this transparent full-body sprite. ' + IDENTITY + TAIL +
  'The existing fork looks like two long crossing leaves at different heights. Redraw the '
  'terminal pair as a single natural horizontal whale fluke pair at her right side: one '
  'short curved peduncle joins both broad lobes at the same joint, central notch unmistakable, '
  'no crossing blades. Give tail enough space inside the canvas. Preserve exact adult face, '
  'expression, arm raised holding small notebook, other hand on waist, hair, clothing, legs, '
  'white socks, shoes and original head/shoe baselines. Clean transparent alpha, no scenery, '
  'ground shadow, halo or text. Same portrait dimensions.'),
 'L03': ('tail_opening', ['L03_rejected_tail_opening'],
  'Repair ONLY the tail anatomy in this transparent full-body sprite. ' + IDENTITY + TAIL +
  'The terminal single hooked crescent/leaf is WRONG. Replace that end with a recognizable '
  'broad TWO-lobed whale fluke pair, gently tilted to the side at one joint, separated by '
  'a central V notch. The whole tail can curve softly, but its tip cannot be a single '
  'hook or roll of fabric. Preserve exact thoughtful guarded face, chin hand, other arm, '
  'hair, dress, legs, socks, shoes, head position and framing. No new jewelry or wounds. '
  'Clean transparent alpha background, no scenery or glow. Same portrait dimensions.'),
 'C04': ('tail_opening', ['C04_rejected_tail_opening'],
  'Precise local correction in this complete 16:9 rocky-shore contract-writing CG. '
  + IDENTITY + 'Keep face, pen-holding hand, other hand, open notebook, adult man, navy dress, '
  'two human legs, rocks, coast, daylight, framing and all interaction unchanged. At upper '
  'LEFT the tail currently ends in ONE giant leaf. Replace the leaf with the proper '
  'TWO-lobed whale fluke silhouette, BOTH lobes clearly within the frame and the distinct '
  'central notch visible against blue sky. One lobe can be foreshortened but must remain '
  'clearly separate from the other. ' + TAIL + ' Keep mottled cobalt/white tail markings, '
  'consistent sunlight and painted outlines. No readable text, new props, background change or UI.'),
}
NEW = {
 'O12': ('门口温热烤小鱿鱼', 'cg', ['B15'],
  'Create a story-specific 16:9 coastal-campsite still-life CG based on this EXACT sunset '
  'tent reference. Same cream canvas tent, blue bedding, lantern on wooden crate, rocky '
  'beach, sunset over the ocean and delicate painted anime style. Move the camera closer '
  'to the OPEN TENT ENTRANCE: a single bamboo skewer with THREE SMALL WHOLE GRILLED SQUID '
  'rests on a small plain ceramic dish on a low wooden board at the threshold. The squid '
  'have recognizable tapered mantles and curled short tentacles, lightly browned glossy '
  'surface, subtle grill marks and a faint wisp of warmth; NOT round fish, sausage, '
  'octopus, empty skewer or raw squid. This is a modest gift for ONE person, not a feast. '
  'Place the dish and skewer at image centre-left around x=40%, y=53%, clearly visible '
  'ABOVE the bottom 30% dialogue area, big enough to recognize at 720p. Tent entrance '
  'and familiar lantern immediately behind it, sea and warm sunset on the right. No '
  'people, heroine, hands, writing, UI or invented house. Coherent close perspective, '
  'warm natural shadows, same location; no pasted sticker food.'),
 'C27': ('尾鳍悄悄带向岸边', 'cg', ['B02', 'L03'],
  'One fully coherent 16:9 story CG in the exact sunny shallow bay of FIRST reference. '
  'SECOND reference controls the same heroine identity and opaque navy dress. ' + IDENTITY +
  'Script: she secretly nudges the adult male player towards shore with the curved '
  'end of her independent whale tail, while pretending it is the sea current. Compose '
  'a downward-looking waist-height player viewpoint: at left foreground, just one of '
  'his trouser-covered lower legs and ankle under transparent shallow water; her '
  'smooth blue-and-white tail stalk curves into a loose OPEN C near the ankle and '
  'gently supports it from the seaward side, no tight binding. The two flat flukes '
  'remain visibly connected at the far tip to the right of the ankle. Both lobes '
  'and their central notch clearly readable through the water at centre image, '
  'around y=52%, above dialogue. Background upper-right: heroine waist-deep in water, '
  'face looking away with embarrassed defensive expression, two arms naturally '
  'folded, her two human legs independent beneath water. Near shoreline rocks '
  'on left show direction of gentle nudge towards land. ' + TAIL +
  ' Wholesome quiet rescue, no violent restraint, injuries, extra limbs, forced '
  'perspective giant feet or hand contact. Sunlight refracts through ripples, '
  'tail and human limb have coherent occlusion and scale. No lettering or UI.'),
}

def prepare():
 state=json.loads((ART/'production.json').read_text('utf-8'))
 reviews=json.loads((ART/'reviews.json').read_text('utf-8'))
 overrides=json.loads((ART/'overrides.json').read_text('utf-8'))
 for key,(reason,refs,prompt) in FIXES.items():
  item=state['items'][key]; archive=key+'_rejected_'+reason
  assert not output(archive).exists(), archive
  for ext in ['.png','.generation.json','.production.json']:
   p=output(key).with_suffix(ext)
   if p.exists():shutil.copy2(p,output(archive).with_suffix(ext))
  shutil.copy2(ART/'prompts'/f'{key}.txt',ART/'prompts'/f'{archive}.txt')
  item.update(correctionBaseline={'sha256':item['sha256'],'original':f'originals/{archive}.png','reason':reason})
  overrides[key]={**overrides.get(key,{}),'prompt':prompt,'references':refs,'dependencies':[]}
  item.update(prompt=prompt,references=refs,dependencies=[],status='queued',review='pending')
  reviews[key]={'sha256':item['sha256'],'status':'rejected','note':'用户逐句截图指出剧情或结构错误；旧稿留档，新输出重新审核。'}
  (ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8')
 for key,(name,kind,refs,prompt) in NEW.items():
  assert key not in state['items'],key
  item={'id':key,'name':name,'kind':kind,'spec':prompt,'prompt':prompt,'old_names':[],
        'dependencies':[],'references':refs,'requested_size':'3840x2160','status':'queued','review':'pending'}
  state['items'][key]=item;overrides[key]=dict(item)
  (ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8')
 for name,value in [('reviews.json',reviews),('overrides.json',overrides)]:
  (ART/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 save(state);print('Queued '+', '.join([*FIXES,*NEW]))

if __name__=='__main__':prepare()
