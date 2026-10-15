"""Reviewed prop corrections and a covered campsite CG; preserve earlier candidates."""
import json
import shutil
from produce_art_upgrade import ART, MANIFEST, output

state=json.loads(MANIFEST.read_text(encoding='utf-8'))
overrides=json.loads((ART/'overrides.json').read_text(encoding='utf-8'))
corrections={
 'L28':{'prompt':'Edit ONLY the necklace on this fully clothed ADULT age24 pajama character sprite. Replace the single pink heart/gem pendant with EXACTLY TWO small separate PINK SCALLOP SHELLS on a simple colored cord. Each shell has a fan outline and fine radiating shell ridges; they are two independent real shell pieces, not a heart-shaped stone, not pearls. Preserve the exact adult face, long blue hair, fin ears, blue whale pajamas with full-length trousers, stuffed whale cushion, hands, shoes, tail and framing. Transparent alpha, no scenery, no clothing changes.', 'references':['L28_before_review']},
 'L30':{'prompt':'Edit ONLY the necklace on this fully clothed ADULT age24 white-dress character sprite. Replace the single pink heart/gem pendant with EXACTLY TWO small separate PINK SCALLOP SHELLS on a simple colored cord. Each shell has a fan outline and fine radiating shell ridges; keep the two pieces individually readable, no heart stone or pearl. Preserve the exact adult face, hair, fin ears, white summer dress, hands, shoes, independent whale tail and framing. Transparent alpha, no scenery, no clothing changes.', 'references':['L30_before_review']},
 'O11':{'prompt':'A NEW wide 16:9 Japanese romance visual-novel illustration, a moonlit composition showing a STORY ACTION rather than a portrait crop. FIRST reference establishes the exact coast and moon. SECOND reference establishes the adult age24 blue-haired whale heroine in opaque navy dress, white socks and closed shoes. THIRD reference identifies the adult age26 man with black hair, rectangular glasses, white long-sleeved shirt and navy trousers. Use a wider elevated diagonal camera: both adults sit shoulder to shoulder in the UPPER LEFT half, their faces tender and clearly recognizable. Show an open flat rock in the CENTER and RIGHT half with TWO unmistakable human moon-cast SHADOWS next to each other. Her separate blue whale tail curls in a soft natural C-shape around those TWO SHADOWS on the rock. Two human legs remain separate from the tail. The tail and shadows must be fully visible above the bottom 28% reserved for dialogue. Moonlight comes from the upper right so the shadows extend consistently toward the foreground left. Ordinary fully clothed adults, no erotic framing, no magic circle, no duplicate people or disconnected tail. This scene is about the shadows enclosed by a real tail, not just a close-up seated couple.', 'references':['B04','L34','O11_before_review']},
 'C09':{'name':'原来你是真·营地裹毯夜谈','costume':'常服内搭完整裹毯，保守坐姿',
   'prompt':'One 16:9 EVENT CG of a quiet ordinary campsite conversation. FIRST landscape reference is the exact moonlit tent campsite with small campfire. SECOND fully clothed sprite defines the SAME ADULT woman aged24, her blue hair, fin ears, ahoge, face and independent blue whale tail. She sits upright beside the adult age26 man in a white long-sleeved shirt and full-length navy trousers. Her body and legs are completely wrapped in the thick opaque whale-pattern blanket from SHOULDERS TO ANKLES, with loose full-length trousers and a cream cardigan underneath and closed white shoes. Only her face and resting hands are exposed. No short-skirt pose, no exposed knees, no knees-to-chest pose, no body-part emphasis. Both sit calmly with hands resting on their laps, gentle wistful eye contact at the realization that the other person is real. Two human legs under the blanket remain separate from her whale tail. Believable covered silhouettes, clean anatomy, detailed coastal anime painting, warm firelight and blue moonlight. Important faces and emotional action above the lower 28% dialogue area. No jewelry, text or watermark.',
   'references':['B16','L35']},
 'C25':{'prompt':'One quiet 16:9 Japanese visual-novel night conversation CG inside the EXACT tent in the FIRST landscape reference. The SECOND reference defines the SAME ADULT woman aged24: blue hair, blue-white fin ears, loop ahoge, separate whale tail, opaque long-sleeved whale pajamas, full-length pajama trousers and TWO small separate PINK SCALLOP SHELLS on a simple cord. Keep that complete sleepwear and recognizable adult identity. She sits comfortably on the bedding with the thick blanket covering her legs, holding a soft whale cushion; both hands rest naturally. Warm slightly embarrassed smile and attentive eyes directed toward the viewer, a quiet shared bedtime story. Only face and hands visible; no clothes being removed, no revealing outfit, no intimate body emphasis. Gentle low lantern light agrees with the moonlit coastal campsite. The two shell pieces must remain real ridged fan-shaped shells, not a heart gemstone or blue pearl. Landscape 16:9, face and two-shell necklace above the dialogue area, no text or watermark.',
   'references':['B18','L28'],'name':'贝壳番外·睡衣夜谈','costume':'完整鲸鱼睡衣、两枚粉色扇贝，保守夜谈构图'},
}
for key,change in corrections.items():
    item=state['items'][key]
    if item.get('round3_queued'):continue
    if key in ('L28','L30','O11'):
        for suffix in ('.png','.generation.json','.production.json'):
            source=output(key).with_suffix(suffix)
            if source.exists():
                target=output(key+'_before_review').with_suffix(suffix)
                assert not target.exists(),target
                shutil.copy2(source,target)
    overrides[key]=change;item.update(change,status='queued',review='pending',round3_queued=True)
    item.pop('sha256',None)
    (ART/'prompts'/f'{key}.txt').write_text(change['prompt']+'\n',encoding='utf-8')
item=state['items']['C19']
if item['status']=='failed':
    assert 'sexual' not in item.get('error','').lower() and 'blocked' not in item.get('error','').lower()
    item.update(status='queued',review='pending',retry_reason='HTTP 503 upstream connection timeout, not an output block')
(ART/'overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
MANIFEST.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Queued two-shell prop fixes, literal shadow composition, covered night-talk CG and network-only C19 retry.')
