"""Queue specific visually reviewed fixes; never retry a blocked request unchanged."""
import json
import shutil
from produce_art_upgrade import ART, MANIFEST, output

state=json.loads(MANIFEST.read_text(encoding='utf-8'))
overrides=json.loads((ART/'overrides.json').read_text(encoding='utf-8'))
corrections={
 'C17':{'prompt':'Edit this EXACT completed adult seaside dinner CG. Remove the necklace and pendant completely; her neck is bare at this chapter because she already gave the shell necklace to the jeweler. Preserve the same adult age24 face, long blue hair, pajamas, knitted shoulder blanket, two seafood noodle bowls, chopsticks, room, moonlight and exact 16:9 composition. No new necklace or jewelry, no clothing changes. Coherent fine Japanese visual novel painting.', 'references':['C17_before_review']},
 'O09':{'prompt':'Edit this EXACT completed adult woman at the sunset window CG: replace ONLY the glass Japanese furin bell and its paper strip with a small handmade BLUE AND WHITE SHELL wind-chime. Three small blue-white scallop shells hang on thin linen strings with one small brass bell; no glass sphere and no paper strip. Keep both hands holding the cord naturally. Preserve the adult age24 woman, face, clothes, whale tail, window, room, sunset, camera and exact 16:9 composition. No necklace. Delicate believable shell materials, no text.', 'references':['O09_before_review']},
 'L35':{'name':'营地夜谈·裹毯坐姿','costume':'常服内搭，双腿由不透光长毯完整覆盖；保守替代动作',
   'prompt':'A NEW substantially more covered ADULT age24 character sprite for a quiet campsite conversation. Use the referenced fully dressed adult woman identity, same long blue hair, fin ears, loop ahoge, face and independent blue whale tail. She sits upright calmly, hands resting visibly on her lap. Wear loose full-length navy trousers and a comfortable opaque long-sleeved cream cardigan. An OPAQUE thick whale-pattern wool blanket wraps from her shoulders all the way to her ANKLES, completely covering the legs and clothing folds. Plain closed white shoes. Face and hands are the only exposed skin. No skirt lifting, no knees-to-chest pose, no exposed knees, no anatomical emphasis. Whole adult figure and independent whale tail inside the frame, transparent alpha. This is a new blanket-wrapped ordinary seated design, not the rejected short-skirt pose.',
   'references':['L01']},
}
for key,change in corrections.items():
    item=state['items'][key]
    if item.get('round2_queued'):continue
    if key!='L35':
        for suffix in ('.png','.generation.json','.production.json'):
            source=output(key).with_suffix(suffix)
            if source.exists():
                archive=output(key+'_before_review').with_suffix(suffix)
                assert not archive.exists(),archive
                shutil.copy2(source,archive)
    else:
        (ART/'controls/L35_blocked_attempt.json').write_text(json.dumps({'error':item.get('error'),'prompt':item['prompt'],'references':item['references']},ensure_ascii=False,indent=2),encoding='utf-8')
    overrides[key]=change;item.update(change,status='queued',review='pending',round2_queued=True)
    item.pop('sha256',None)
    (ART/'prompts'/f'{key}.txt').write_text(change['prompt']+'\n',encoding='utf-8')
item=state['items']['O04']
if item['status']=='failed':
    assert 'sexual' not in item.get('error','').lower() and 'blocked' not in item.get('error','').lower()
    item.update(status='queued',review='pending',retry_reason='Previous attempt was a network TLS failure, not an output block')
(ART/'overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
MANIFEST.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Queued C17 necklace, O09 shell-chime, new fully covered L35 alternative and network-only O04 retry.')
