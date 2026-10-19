import sys,os,json
sys.path.insert(0,'.')
src=open('gen9.py').read()
exec(src[:src.index('R={it')])
exec(src[src.index('def fixmood'):src.index('def silences')])
exec(src[src.index('def finish'):src.index('os.makedirs(')])
from concurrent.futures import ThreadPoolExecutor
TAIL="，音量适中，语速轻快自然，音色保持一致"
L={51:("深海的！海鸥带过来的！",["嘴硬找借口","心虚地嘴硬","嘴硬带点心虚","带刺地找借口","认真地辩解"]),
   52:("跟本小姐一点关系都没有！",["嘴硬撇清关系","嫌弃地撇清","带刺地否认","嘴硬，理直气壮","认真地撇清"])}
def take(n,i):
    t,ms=L[n]; ins=ID+ms[i]+TAIL; raw=f'fix5152/raw/{n:03d}_{i}.wav'
    if not os.path.exists(raw) and not tts(t,ins,raw): return None
    o=raw[:-4]+'.mp3'; finish(raw,0,dur(raw),o); tr=asr(o)
    return dict(n=n,i=i,mood=ms[i],o=o,tr=tr,sim=round(sim(tr,t),3),dur=round(dur(o),2))
with ThreadPoolExecutor(5) as ex: out=[x for x in ex.map(lambda j:take(*j),[(n,i) for n in L for i in range(5)]) if x]
json.dump(out,open('fix5152/takes.json','w'),ensure_ascii=False,indent=0)
for x in out: print(x)
