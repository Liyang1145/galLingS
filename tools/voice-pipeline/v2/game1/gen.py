import sys,os,json,re
sys.path.insert(0,'.'); sys.path.insert(0,'game1')
src=open('gen9.py').read()
exec(src[:src.index('R={it')]); exec(src[src.index('def fixmood'):src.index('def silences')]); exec(src[src.index('def finish'):src.index('os.makedirs(')])
from moods import M
from concurrent.futures import ThreadPoolExecutor
L={x['id']:x for x in json.load(open('gamelines.json'))}
TAIL="，音量适中，语速轻快自然，音色保持一致"
VAR=["","，自然","，清晰","，轻柔","，干净"]
def text(i):
    t=L[i]['t'].strip('「」'); o=M[i][0]
    if o=='@dash': t=t.replace('——','……')
    elif o: t=o
    return t.replace("‘","").replace("’","")
def take(i,k):
    t=text(i); ins=ID+M[i][1]+VAR[k]+TAIL; raw=f'game1/raw/{i}_{k}.wav'
    if not os.path.exists(raw) and not tts(t,ins,raw): return None
    o=raw[:-4]+'.mp3'; finish(raw,0,dur(raw),o); tr=asr(o); d=dur(o)
    return dict(id=i,k=k,t=t,ins=ins,o=o,tr=tr,sim=round(sim(tr,t),3),dur=round(d,2),rate=round(len(norm(t))/d,2))
jobs=[(i,k) for i in M for k in range(5)]
with ThreadPoolExecutor(6) as ex: out=[x for x in ex.map(lambda j:take(*j),jobs) if x]
json.dump(out,open('game1/takes.json','w'),ensure_ascii=False,indent=0); print('done',len(out))
