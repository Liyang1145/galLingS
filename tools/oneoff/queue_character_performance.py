"""Replace expression-only sprites with readable acting silhouettes, preserving masters."""
import copy
import json
import shutil
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART, MANIFEST, output, save

state=json.loads(MANIFEST.read_text(encoding='utf-8'))
overrides=json.loads((ART/'overrides.json').read_text(encoding='utf-8'))
base='''A full-body transparent-alpha production sprite for a Japanese romance visual novel. Reference is the exact SAME adult woman aged24, same long blue hair, loop ahoge, fin ears and cyan bows, navy sailor-collar dress, white socks, closed white shoes, two human legs and ONE separate whale tail from the lower back. Preserve her recognizable adult face and exact costume, head size and full-body canvas framing, body proportions, painting finish and neutral daylight. The user asks for a clear ACTING POSE, not merely a changed facial expression. Redraw the shoulders, arms, hands and tail into the specified pose. Keep important expressive hands and tail gesture in the UPPER HALF of the character canvas, visible above a game's lower dialogue box. Full figure inside the canvas, natural five-finger hands, coherent anatomy. No scenery, ground shadow, text, stickers, detached symbols, props not requested, duplicate arms or halo. Real clean transparent alpha. Pose: '''
poses={
 'L02': 'Self-assured teasing pride: torso upright, chin slightly raised, one hand laid lightly across her upper chest with an open graceful palm, the other hand on her waist. Slight three-quarter shoulder turn and a confident closed-mouth smile, eyes looking toward the viewer. Her independent whale tail curls UP behind her side, with its flukes visible around shoulder height. The silhouette must plainly differ from relaxed arms hanging down.',
 'L03': 'Caught being kind and trying to hide it: shoulders turned about thirty degrees away, head turned back toward the viewer, eyes glancing aside with a small embarrassed pout and modest blush. One hand near her cheek, the other lightly holding the opposite upper arm across her chest. Shoulders drawn inward, separate whale tail tip curling into a small compact loop behind her. Both expressive hands are near face/chest, not down at the skirt.',
 'L04': 'Mischievous playful victory: lean her upper torso slightly toward the viewer, lift one hand into a clear V-sign BESIDE her face, the other hand rests casually at her waist. One eyebrow raised, a small asymmetrical cheeky grin, lively direct eye contact. Tail makes a buoyant upward curve behind her. A teasing adult heroine, not an aggressive villain smile. Keep fingers and V-sign naturally formed and visible.',
 'L06': 'Startled and flustered: both hands lifted OPEN beside her shoulders, palms forward with naturally spread fingers, elbows away from the torso, body leaning back slightly. Wide blue eyes, a surprised open mouth, fin ears visibly raised. Whale tail rises sharply behind her side with flukes near shoulder level. Readable comic surprise through the whole upper-body silhouette. No floating sweat stickers or symbols.',
 'L07': 'Quiet sincere warmth: shoulders relaxed, head upright with attentive gentle eye contact and a small soft smile. BOTH hands held together lightly in front of her upper waist, palms and fingers relaxed, arms clearly gathered in front rather than hanging at the sides. Tail rests in a low relaxed curve. No intense blush, no teasing wink, no notebook. A distinct calm trusting stance.',
 'P01': 'Guarded tsundere watchfulness: ARMS CROSSED visibly over the chest, torso angled a little away, chin raised slightly, a restrained wary pout and sidelong gaze toward the viewer. Both forearms and hands clearly and naturally connected across her upper torso. Her separate whale tail held in an alert shallow S curve behind her. This is the arms-folded pose for watching a stranger from three metres away, not a smile or a hand-on-hip pose.',
}
for key,pose in poses.items():
    item=state['items'].get(key)
    if item and item.get('performance_queued'):continue
    if item:
        for suffix in ('.png','.generation.json','.production.json'):
            source=output(key).with_suffix(suffix)
            if source.exists():
                dest=output(key+'_before_performance').with_suffix(suffix)
                assert not dest.exists()
                shutil.copy2(source,dest)
    else:
        item=copy.deepcopy(state['items']['L01']);item.update(id=key,name='常服抱臂监视',old_names=[],anchors=[],costume='常服',spec='抱臂、侧视与警惕鲸尾，不同于默认站姿')
        state['items'][key]=item
    change={'prompt':base+pose,'references':['L01'],'dependencies':['L01']}
    item.update(change,status='queued',review='pending',performance_queued=True)
    item.pop('sha256',None)
    overrides[key]=change
    (ART/'prompts'/f'{key}.txt').write_text(change['prompt']+'\n',encoding='utf-8')
(ART/'overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save(state)
print('Queued five distinct acting poses and the missing arms-crossed watch pose.')
