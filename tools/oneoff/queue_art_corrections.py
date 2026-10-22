"""Prepare explicit, auditable corrections; never silently overwrite the rejected original."""
import json, shutil
from pathlib import Path
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART, output

def configure():
    path=ART/'production.json';state=json.loads(path.read_text(encoding='utf-8'))
    overrides_path=ART/'overrides.json';overrides=json.loads(overrides_path.read_text(encoding='utf-8')) if overrides_path.exists() else {}
    fixes={
     'B01':('Cool early-morning change of this EXACT shoreline reference. Preserve every rock, horizon, town and camera. Much softer pale dawn light with cool blue-white sky, less intense sea sparkle than noon, long delicate shadows, no orange sunset and no noon glare. Empty background, 16:9.', ['B02']),
     'B13':('Edit this EXACT deep-sea bioluminescent coral scene: remove ALL direct sunlight rays and bright surface-sky illumination from the top. The upper water is deep navy, with no visible sky. Only blue glowing coral, sea anemones and algae illuminate the rocks and water faintly from below. Preserve coral shapes, camera and central floating space. Quiet intimate deep ocean, no people. 16:9.', ['B13']),
     'B14':('Use the FIRST image as the exact resurfacing WATER-LEVEL camera. Viewpoint is right at the sea surface, gently rippling water filling the foreground and distant familiar coast on the horizon. No dry beach sand in the foreground, no standing-on-shore camera. Sunset, soft amber and blue reflection. SECOND image is only the coastline and style family. Empty landscape, 16:9.', ['legacy:B14','B03']),
     'B20':('Use the FIRST reference as the exact quiet coastal TOWN-EDGE PATH camera, not the house courtyard. Preserve the narrow stone lane past coastal buildings leading toward the distant sea-facing white-and-blue house. The SECOND reference is only the same house design, not the target viewpoint. Fresh early morning. No people, no text, 16:9.', ['legacy:B20','B26']),
     'B23':('Use the FIRST reference as the exact small JEWELRY SIDE ALLEY camera. It is a narrow accessory lane with modest shell and bead displays, not the main fruit/fish market street. Preserve its stone paving, awnings and narrow viewpoint. SECOND reference is only the adjacent market visual family. Bright morning, no text or people. 16:9.', ['legacy:B23','B21']),
     'B33':('Precise light-fixture correction of this EXACT morning home dining room. Keep the camera, table, two open blank diaries, breakfasts, cabinet, window and blue daylight sea. Turn OFF EVERY electric ceiling pendant, task lamp, lantern and candle: cream lampshades without glowing yellow bulbs, no orange lamp halos. The room is lit only by MORNING sunlight through the window. Do not change to night or move furniture. 16:9.', ['B33']),
     'B40':('Precise light-fixture correction of this EXACT AFTERNOON dessert-shop interior. The script says no lamps are switched on. Turn OFF ALL hanging lamps, ceiling downlights, stair lamp and counter task lamps, leaving every fixture in place with matte cream shades and NO yellow bulb glow. Preserve display case, stairs, chairs, cabinets, window, sky and exact camera. Natural DAYLIGHT only; no night sky, no candles. 16:9.', ['B40']),
     'L14':('Precise minor accessory correction of the adult woman in this sprite. Remove the bracelet from her wrist; restore a bare wrist. Preserve her proud facial expression, blue-and-white sundress, hidden tail, blue hair, fin ears, adult proportions, pose, hands, shoes and transparent alpha exactly. No jewelry for this early-story state. Full-body production sprite, no scenery.', ['L14']),
     'L17':('Create a NEW, more modest FULLY CLOTHED summer beach-day sprite using this adult woman identity reference. Adult woman aged24, same face, blue hair, fin ears, loop ahoge and separate whale tail. Wear a loose OPAQUE white linen sun coat buttoned closed from the collar to BELOW THE KNEES, navy clothing underneath, opaque white legwear and simple closed white flat shoes. Clothing is comfortable and non-form-fitting. Face and hands are the only visible skin; no swimsuit-cut silhouette. Calm relaxed standing pose, whole adult figure and whale tail visible, no emphasis on body parts. Preserve identity, proportions and fine anime painting. Genuine transparent alpha, no scenery or text. This is a substantially more covered alternative holiday outfit, not a foot-detail edit.', ['L01']),
     'L18':('Make a shy gentle-expression version of this ADULT age24 FULLY CLOTHED holiday sprite. Preserve the loose opaque white linen sun coat BUTTONED CLOSED to below the knees, navy clothing underneath, opaque white legwear and closed white flat shoes. Keep her face, hair, fin ears, ahoge, two human legs, independent whale tail and canvas framing. Only face and hands visible, no body-part focus, no lifted garment or stocking gesture. Both hands relaxed beside the coat. Slight warm blush and eyes glancing aside. Transparent alpha, no scene or text. This is the covered holiday-coat alternative, not the previously rejected exposed swimwear pose.', ['L17'])
    }
    for key,(prompt,refs) in fixes.items():
        item=state['items'][key]
        if item.get('correction_queued'):continue
        before=key+'_before_review'
        if output(key).exists():
            shutil.copy2(output(key),output(before))
            md=output(key).with_suffix('.generation.json')
            if md.exists():shutil.copy2(md,output(before).with_suffix('.generation.json'))
        refs=[before if r==key else r for r in refs]
        overrides[key]={'prompt':prompt,'references':refs}
        item.update(status='queued',review='pending',correction_queued=True)
        if key=='L17':overrides[key].update(name='泳装段·完整外搭候选',costume='完整白色外搭+深蓝内搭，较保守替代方案')
        if key=='L18':overrides[key].update(name='泳装段·完整外搭害羞候选',costume='同L17保守外搭')
    path.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    overrides_path.write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'corrections':list(fixes)}))
if __name__=='__main__':configure()
