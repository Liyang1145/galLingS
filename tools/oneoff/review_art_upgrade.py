"""Record a visual review against the exact image hash, independently of workers."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'A素材库/art-upgrade'
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('status',choices=['approved','rework','rejected']);ap.add_argument('keys',nargs='+');ap.add_argument('--note',required=True);args=ap.parse_args()
    state=json.loads((ART/'production.json').read_text(encoding='utf-8'));path=ART/'reviews.json'
    reviews=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    for key in args.keys:
        item=state['items'][key];assert item['status']=='generated',key
        digest=hashlib.sha256((ART/'originals'/f'{key}.png').read_bytes()).hexdigest();assert digest==item['sha256'],key
        reviews[key]={'status':args.status,'sha256':digest,'note':args.note,'reviewer':'Codex visual inspection; not final user approval'}
    path.write_text(json.dumps(reviews,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'reviewed':args.keys,'status':args.status}))
