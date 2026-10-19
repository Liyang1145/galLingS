import sys,json,os,numpy as np
sys.path.insert(0,'.')
exec(open('gen9.py').read().split("os.makedirs('raw'")[0])
from spk import emb
from concurrent.futures import ThreadPoolExecutor
c=np.load('centroid.npy')
L={89:('全世界只有你知道。','轻柔认真地说，带点珍重'),
   90:('这就是暗号。','认真笃定地宣布，带点小得意'),
   114:('怕你弄丢。','嘴硬地补一句，声音轻一点'),
   142:('别以为本小姐真的没收了。','嘴硬地澄清，傲娇')}
V=["，音量适中，语速轻快自然，音色保持一致","，音量适中，语速自然，音色保持一致","，正常音量，语速轻快自然，音色保持一致","，音量适中，吐字清楚，音色保持一致","，音量适中，自然不拖腔，音色保持一致","，正常音量，语速自然，保持同一个音色"]
def take(n,k):
    t,m=L[n]; ins=ID+m+V[k]; raw=f'top3/raw/{n:03d}_{k}.wav'
    if not os.path.exists(raw) and not tts(t,ins,raw): return None
    o=raw[:-4]+'.mp3'; finish(raw,0,dur(raw),o); tr=asr(o)
    return dict(n=n,k=k,o=o,tr=tr,sim=round(sim(tr,t),3),cos=round(float(emb(o)@c),3),dur=round(dur(o),2),rate=round(len(norm(t))/dur(o),2),ins=ins)
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(lambda j:take(*j),[(n,k) for n in L for k in range(6)]) if x]
json.dump(out,open('top3/takes.json','w'),ensure_ascii=False,indent=0)
for x in out: print(x['n'],x['k'],x['tr'],x['sim'],x['cos'],x['dur'],x['rate'])
