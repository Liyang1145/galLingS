exec(open('game2/gen.py').read().split("ids=list(M)")[0])
out=[]
for k,m in enumerate(['小声，别扭','小声，心虚','别扭，嫌弃','小声，害羞','认真，别扭']):
    raw=f'game2/raw/9onmu9do_c{k}.wav'
    if not os.path.exists(raw): tts('……手。手拿开。',ID+m+TAIL,raw)
    D=dur(raw); s=[x for x in silences(raw) if x[0]>0.4 and x[1]<D-0.3]
    if not s: print(k,'nosil');continue
    a=s[0]; o=raw[:-4]+'.mp3'; finish(raw,0,(a[0]+a[1])/2,o); tr=asr(o); print(k,s,tr)
    out.append(dict(id='9onmu9do',k='c%d'%k,t='……手。',ins=ID+m+TAIL,o=o,tr=tr,sim=round(sim(tr,'手'),3),dur=round(dur(o),2),rate=0))
json.dump(out,open('game2/hand.json','w'),ensure_ascii=False)
