"""Queue the revised opening's unattended squid gift; record wardrobe gaps."""
import json
import shutil
from produce_art_upgrade import ART, MANIFEST, output, save

state = json.loads(MANIFEST.read_text(encoding='utf-8'))
overrides = json.loads((ART/'overrides.json').read_text(encoding='utf-8'))
for key in ('L18', 'C23'):
    state['items'][key].update(status='manual_pending', review='pending',
        gap='用户2026-10-15决定：保留原文泳装服饰，原图暂用，待人工处理；不采用外搭候选。')
state['items']['L17'].update(review='rejected',
    gap='外搭候选偏离原文泳装服饰，用户决定留待人工处理；只保留候选原件。')
item = state['items']['C03']
if not item.get('opening_revision_queued'):
    for suffix in ('.png', '.generation.json', '.production.json'):
        source = output('C03').with_suffix(suffix)
        if source.exists():
            target = output('C03_before_opening_revision').with_suffix(suffix)
            assert not target.exists()
            shutil.copy2(source, target)
    change = {
        'name': '营地门口·无人留下的烤鱿鱼',
        'spec': '新第一话结尾：门口一串仍温热的烤小鱿鱼，没有人物，没有蓝黑丝线证据。',
        'dependencies': ['B15'], 'references': ['B15'],
        'prompt': 'One finely painted Japanese romance visual novel 16:9 PROP EVENT CG. The single reference defines the exact coastal cream canvas tent, coast, camping materials and sunset lighting. Show a small unattended gift outside the open tent entrance: ONE bamboo skewer holding three small appetizing grilled squid, resting neatly on a small plain ceramic plate on the wooden threshold. A faint natural hint of warmth, realistic gentle food texture. Nobody is present: no person, girl, hands, feet, tail, or portrait. No grill or cooking action. No ribbon, thread, note, lettering, or jewelry. The story is the quiet discovery of a still-warm gift after its giver has left. Use a closer low three-quarter view toward the entrance, with familiar bedding and a strip of sunset sea softly visible in the background. Keep the entire plate and skewer in the middle third ABOVE the lower 28 percent dialogue area, generous breathing room below. Subtle coastal blue and golden evening light, delicate anime painting, coherent perspective, no watermark.',
    }
    overrides['C03'] = change
    item.update(change, status='queued', review='pending', opening_revision_queued=True)
    item.pop('sha256', None)
    (ART/'prompts/C03.txt').write_text(change['prompt']+'\n', encoding='utf-8')
(ART/'overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save(state)
print('Queued unattended squid gift; original swimsuit wardrobe reserved for manual work.')
