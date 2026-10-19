import sys,json,os,re,numpy as np
sys.path.insert(0,'.')
exec(open('gen9.py').read().split("os.makedirs('raw'")[0])
from spk import emb
from concurrent.futures import ThreadPoolExecutor
c=np.load('centroid.npy')
res=json.load(open('res.json')); rows=res  # order == csv order for first 100
import csv
csvr=list(csv.DictReader(open('鲸鱼小姐_配音_前200句/台词清单.csv',encoding='utf-8-sig')))
M={int(l.split('|')[0]):l.split('|')[1].strip() for l in open('ch1/moods.txt') if l.strip()}
TAIL="，音量适中，语速轻快自然，音色保持一致"
def clean(t): return t.replace("'","").replace("‘","").replace("’","")
def take(n,att):
    r=csvr[n-1]; t=r['台词']; ins=ID+M[n]+TAIL
    raw=f'ch1/raw/{n:03d}_{att}.wav'
    if not os.path.exists(raw) and not tts(clean(t),ins,raw): return None
    o=raw[:-4]+'.mp3'; finish(raw,0,dur(raw),o)
    tr=asr(o); s=sim(tr,t); cs=float(emb(o)@c); d=dur(o)
    nch=len(norm(t)); rate=nch/d
    return dict(n=n,att=att,o=o,tr=tr,sim=round(s,3),cos=round(cs,3),dur=round(d,2),rate=round(rate,2),ins=ins)
os.makedirs('ch1/raw',exist_ok=True)
jobs=[(n,a) for n in [1,17,21,23,30,37,41,55] for a in range(4,9)]
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(lambda j:take(*j),jobs) if x]
json.dump(out,open('ch1/takes2.json','w'),ensure_ascii=False,indent=0)
print(len(out))
