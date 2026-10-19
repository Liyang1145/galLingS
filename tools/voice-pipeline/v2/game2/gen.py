import sys,os,json,re
sys.path.insert(0,'.')
src=open('gen9.py').read()
exec(src[:src.index('R={it')]); exec(src[src.index('def fixmood'):src.index('def silences')]); exec(src[src.index('def silences'):src.index('def weight')]); exec(src[src.index('def finish'):src.index('os.makedirs(')])
from concurrent.futures import ThreadPoolExecutor
L=json.load(open('gamelines.json')); I={x['id']:x for x in L}
M={k:re.sub('拔高|大声|喊|喝|急促|急|加快|慌|爆发|慢|拖长|耳语|颤抖','',v).strip('，,') or '认真' for k,v in json.load(open('game2/moods.json')).items()}
TAIL="，音量适中，语速轻快自然，音色保持一致"
VAR=["","，自然","，清晰","，轻柔","，干净","，流畅"]
def text(i): return I[i]['t'].strip('「」').replace("‘","").replace("’","").replace("“","").replace("”","")
def take(i,k):
    t=text(i); ins=ID+M[i]+VAR[k]+TAIL; raw=f'game2/raw/{i}_{k}.wav'
    if not os.path.exists(raw) and not tts(t,ins,raw): return None
    o=raw[:-4]+'.mp3'
    if not os.path.exists(o): finish(raw,0,dur(raw),o)
    tr=asr(o); d=dur(o)
    return dict(id=i,k=k,t=t,ins=ins,o=o,tr=tr,sim=round(sim(tr,t),3),dur=round(d,2),rate=round(len(norm(t))/max(d,.1),2))
def good(x): return x and x['sim']>=0.9 and 1.8<=x['rate']<=7.5
def line(i):
    out=[]
    with ThreadPoolExecutor(3) as ex: out=[x for x in ex.map(lambda k:take(i,k),range(3)) if x]
    if sum(map(good,out))<1:
        with ThreadPoolExecutor(3) as ex: out+=[x for x in ex.map(lambda k:take(i,k),range(3,6)) if x]
    return out
ids=list(M)
T=[]
if os.path.exists('game2/takes.json'): T=json.load(open('game2/takes.json'))
have={x['id'] for x in T}
todo=[i for i in ids if i not in have]
with ThreadPoolExecutor(3) as ex:
    for n,r in enumerate(ex.map(line,todo)):
        T+=r
        if n%20==0: json.dump(T,open('game2/takes.json','w'),ensure_ascii=False); print(n,flush=True)
json.dump(T,open('game2/takes.json','w'),ensure_ascii=False); print('done',len(T))
