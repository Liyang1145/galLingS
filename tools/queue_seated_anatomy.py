"""Rebuild the seated mother from the standing costume reference, never the rejected leg geometry."""
import copy,json
from produce_art_upgrade import ART,MANIFEST,save

PROMPT='''Create a new full-body transparent-alpha production sprite of the SAME ADULT woman aged24 in the reference. Use the reference ONLY for her recognizable face, blue hair, fin ears, loop ahoge, cyan bows, exact navy sailor-collar dress with continuous double-white hem stripes, white socks and closed white shoes, two human legs and a separate whale tail. Do NOT copy its standing body pose.

Design a physically clear, ordinary seated pose in a gentle three-quarter view at roughly her chest height. Her pelvis is supported at the edge of an unseen rock just behind her, spine naturally upright, hips flexed, BOTH thighs extend forward from the pelvis toward TWO DISTINCT knees with proper foreshortening. Knees held together and bent naturally; shins descend from the knees toward two relaxed feet at the SAME believable ground level. Do not cross the legs or stack a leg on top of the other. Show a coherent pelvis-to-thigh-to-knee-to-calf chain, plausible thigh/calf lengths, natural knee caps and ankle perspective. No long shin growing directly out of the skirt, disconnected upper thigh, duplicate knee or fused leg. Hands rest loosely on her lap ABOVE the dress, not inside the fabric.

The navy dress remains one opaque intact garment. Its skirt lies naturally over her lap and upper thighs, draping forward under gravity from the waist and falling smoothly around both sides. One continuous hem with exactly two white stripes follows the cloth, not skin. No opening, split, triangular skin hole, hand piercing the skirt, pasted extra frill or unexplained floating fabric. Preserve the existing dress design and normal hem length; no transparent cloth or wardrobe substitution. The adult woman is fully dressed, a neutral visual-novel sitting pose, not a pinup or focus on legs.

Neutral attentive blue eyes, small reserved closed-mouth expression, no ring or other jewelry, no book or prop. One separate whale tail curves from BEHIND the lower back to her side and ends in EXACTLY ONE two-lobed fluke; no additional tail fin or branch. Premium clean finely painted anime visual-novel finish matching the reference, soft neutral daylight. Whole ahoge, both feet and complete tail inside generous margins. No scenery, chair, rock, ground shadow, text, outlines of a skeleton or labels. Real clean transparent alpha with opaque figure interiors. Check complete anatomy and skirt construction before adding surface detail.'''

def queue():
 state=json.loads(MANIFEST.read_text(encoding='utf-8'));key='S01'
 if key in state['items']:raise ValueError('S01 exists; review the result before requesting another')
 item=copy.deepcopy(state['items']['L01']);item.update(id=key,name='坐姿结构母图·并膝',old_names=[],anchors=[],costume='常服',spec=PROMPT,prompt=PROMPT,references=['L01'],dependencies=['L01'],status='queued',review='pending');item.pop('sha256',None);state['items'][key]=item
 (ART/'prompts'/f'{key}.txt').write_text(PROMPT+'\n',encoding='utf-8',newline='\n');save(state)
if __name__=='__main__':queue()
