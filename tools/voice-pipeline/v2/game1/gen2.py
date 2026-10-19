exec(open('game1/gen.py').read().split("jobs=")[0])
M2={'9gce3m3h':['嘴硬，干脆利落','小声嘟囔，带刺','嫌弃，短促收尾','别扭，干脆','认真，嘴硬收尾'],
'nz9xt4z0':['认真，干脆打断','警觉，短促','认真，小声打断','带刺，干脆','嘴硬，干脆'],
'fwecdcyr':['嘴硬，一本正经地解释','认真，假装淡定','嫌弃，认真解释','带刺，一本正经','小声嘴硬，认真'],
'dfnh1kkk':['小声，温柔地叫一声','轻轻地，带点别扭','小声，犹豫地开口','认真，轻声','小声，安静']}
def take2(i,k):
    t=text(i); ins=ID+M2[i][k]+TAIL; raw=f'game1/raw/{i}_b{k}.wav'
    if not os.path.exists(raw) and not tts(t,ins,raw): return None
    o=raw[:-4]+'.mp3'; finish(raw,0,dur(raw),o); tr=asr(o); d=dur(o)
    return dict(id=i,k='b%d'%k,t=t,ins=ins,o=o,tr=tr,sim=round(sim(tr,t),3),dur=round(d,2),rate=round(len(norm(t))/d,2))
with ThreadPoolExecutor(6) as ex: out=[x for x in ex.map(lambda j:take2(*j),[(i,k) for i in M2 for k in range(5)]) if x]
T=json.load(open('game1/takes.json'));T+=out;json.dump(T,open('game1/takes.json','w'),ensure_ascii=False,indent=0)
for x in out: print(x['id'],x['k'],x['tr'],x['sim'],x['rate'])
