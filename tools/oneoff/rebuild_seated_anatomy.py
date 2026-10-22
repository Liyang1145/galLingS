"""Replace the rejected crossed-leg family; keep every rejected original for comparison."""
import copy,hashlib,json,shutil
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

from produce_art_upgrade import ART,MANIFEST,output,record,save

KEEP='''Edit the FIRST reference sprite of the same fully clothed ADULT woman age24. Keep her exact NEW knees-together seated anatomy, pelvis and thigh foreshortening, two distinct bent knees, parallel lower legs, both closed white shoes, independent single whale tail and generous full-body framing unchanged. Keep the opaque navy sailor dress as ONE INTACT garment: its lap surface, complete skirt silhouette, folds and continuous double-white hem stripes remain unchanged. Hands stay clearly ABOVE the fabric, with no skin hole, opening, cutout or hand piercing the skirt. Preserve her adult face identity, blue hair, bows, ears, ahoge, socks, lighting and true transparent alpha. Change only the upper-body acting requested. No crossed legs, scenery, letters, new tail branch or extra jewelry. '''
JOBS={
 'P13':('常服并膝坐姿·戒指',['S01'],KEEP+'Keep the exact quiet neutral face, shoulders and hands resting loosely on her lap. Add ONE small sky-blue pearl ring with a simple silver band to her left ring finger. No other jewelry or object. Do not change a single lower-body fold or leg position.'),
 'P15':('常服并膝坐姿·害羞',['S01'],KEEP+'She is quietly embarrassed. Her left hand rises to lightly gather a lock of hair near the collar, her right hand remains relaxed on top of her skirt. A small sky-blue pearl ring stays on the left ring finger of the raised hand. Shoulders turn a little aside, blue eyes glance sideways, small blush and restrained shy pout. The entire opaque skirt and both legs stay exactly as in the reference.'),
 'P16':('常服并膝坐姿·得意',['S01'],KEEP+'She is playfully proud. Her left hand rises lightly to her upper chest with a graceful open palm, a small sky-blue pearl ring on its ring finger. Her right hand RESTS FLAT ON TOP OF THE NAVY CLOTH at mid-lap, away from the hem; no finger is under or through the fabric. Chin slightly raised, a small confident smile. Keep BOTH existing flukes at the SAME location: no tail motion and no extra fin. Preserve the complete existing skirt and knee anatomy exactly.'),
 'P17':('常服并膝坐姿·嗔怪',['S01'],KEEP+'An affectionate playful scolding. Her right hand lifts near chest height with a single admonishing index finger. Her left hand rests flat on top of her skirt with one small sky-blue pearl ring on its ring finger. Mild furrowed brows and a small speaking mouth, not fury. No smile sticker. Keep the original intact skirt, knees, lower legs and single two-lobed tail completely unchanged.'),
 'L34':('并膝坐姿持本',['S01'],KEEP+'A quiet reading pose. Put ONE open dark-blue whale notebook securely on top of her lap. Both forearms support the open book, fingers naturally outside the page edges. Eyes open and looking toward the open pages, a restrained thoughtful face. No pen, no ring or jewelry. Do not put a hand against her cheek. The complete intact skirt remains beneath the book and unchanged, with both legs in the same parallel seated pose.'),
 'S02':('写诗跪坐结构母图',['L01'],'''One full-body transparent-alpha production sprite of the SAME fully clothed ADULT woman aged24 in the reference, matching her adult face identity, blue hair, ears, bows, loop ahoge, opaque navy sailor dress, white socks and closed shoes, and separate whale tail. New ordinary sitting pose for writing a poem on a flat rock: a natural Japanese seiza posture, seated on her folded heels, spine upright, both knees together pointing forward, both lower legs folded underneath her. The opaque skirt drapes naturally over her lap and knees with one continuous double-white hem stripe. Anatomically coherent pelvis, thighs, knees and folded legs. Do not cross the legs or draw two long shins hanging from the front of the skirt. Her body weight is supported on her folded legs, not hovering. An open dark-blue whale notebook rests on her lap, her right hand naturally holds a slim blue pen with its tip touching the page, left hand steadies the upper page. Eyes focus thoughtfully down toward her writing. Whole adult figure and separate single tail with exactly one two-lobed fluke inside generous margins. Natural hands and cloth, no fabric holes or extra limbs. No ring, scenery, rock, ground shadow, letters or annotations. Match the reference finely painted anime quality and neutral soft daylight. Real clean transparent alpha, opaque figure interior.'''),
}

def queue():
 s=json.loads(MANIFEST.read_text(encoding='utf-8'));overrides=json.loads((ART/'overrides.json').read_text(encoding='utf-8'))
 for key,(name,refs,prompt) in JOBS.items():
  item=s['items'].get(key)
  if item and item.get('anatomy_queued'):continue
  if not item:
   item=copy.deepcopy(s['items']['L01']);s['items'][key]=item;item.update(id=key,old_names=[],anchors=[])
  change={'name':name,'references':refs,'dependencies':refs,'prompt':prompt}
  item.update(change,status='queued',review='pending',anatomy_queued=True);item.pop('sha256',None);overrides[key]=change
  (ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8',newline='\n')
 (ART/'overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n');save(s)

def adopt_copy(source,target,name):
 s=json.loads(MANIFEST.read_text(encoding='utf-8'));item=s['items'][target]
 for suffix in ['.png','.generation.json']:
  shutil.copy2(output(source).with_suffix(suffix),output(target).with_suffix(suffix))
 item.update(status='generated',review='pending',name=name,derivedCopy=source,references=[source],dependencies=[source],generation=s['items'][source]['generation'],**record(output(target)))
 audit={'operation':'exact copy of reviewed anatomy master; not a separate generation','source':source,'sourceSha256':s['items'][source]['sha256'],'outputSha256':item['sha256']}
 output(target).with_suffix('.production.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n');save(s)

if __name__=='__main__':queue()
