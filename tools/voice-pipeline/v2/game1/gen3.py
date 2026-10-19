exec(open('game1/gen.py').read().split("jobs=")[0])
exec(src[src.index('def silences'):src.index('def weight')])
out=[]
for k,m in enumerate(['小声嘴硬，带点撒娇','嘴硬，别扭','带刺，嘴硬','嫌弃，小声','认真，嘴硬']):
    raw=f'game1/raw/9gce3m3h_c{k}.wav'
    if not os.path.exists(raw): tts('哼。那是因为你先卖关子。怪你。',ID+m+TAIL,raw)
    s=silences(raw); 
    if not s: print(k,'nosil'); continue
    D=dur(raw); s=[x for x in s if x[1]<D-0.25 and x[0]>0.3]
    if not s: print(k,'nosil'); continue
    a=s[-1]; st=(a[0]+a[1])/2
    o=raw[:-4]+'.mp3'; finish(raw,st,dur(raw),o); tr=asr(o)
    out.append(dict(id='9gce3m3h',k='c%d'%k,t='怪你。',ins=ID+m+TAIL,o=o,tr=tr,sim=round(sim(tr,'怪你'),3),dur=round(dur(o),2),rate=round(2/dur(o),2)))
    print(k,s,tr)
T=json.load(open('game1/takes.json'));T+=out;json.dump(T,open('game1/takes.json','w'),ensure_ascii=False,indent=0)
