exec(open('game2/gen.py').read().split("ids=list(M)")[0])
import urllib.request
def tts2(text,voice,ins,out):
    body=json.dumps({"model":"qwen-audio-3.0-tts-plus","input":{"text":text,"voice":voice,"pitch":1.0,"rate":1.0,"instruction":ins,"format":"wav","sample_rate":44100}}).encode()
    for t in range(6):
        try:
            r=json.load(urllib.request.urlopen(urllib.request.Request(EP,body,{"Content-Type":"application/json"}),timeout=120))
            subprocess.run(["curl","-sf","-m","60","-o",out,r["output"]["audio"]["url"]],check=True); return True
        except Exception as e: print('err',e,flush=True); time.sleep(3)
    return False
jobs=[]
# whale fixes
WF={'mel30c1l':('怕你弄丢。',['认真，咬字清楚，带点别扭','小声认真，咬字清楚','别扭，咬字清楚','温柔，咬字清楚','嘴硬，咬字清楚']),
    'p0qw841g':('没出息。',['嫌弃，带点笑意','嘴硬，嫌弃','小声嫌弃','带刺，轻笑','别扭，嫌弃'])}
for i,(t,ms) in WF.items():
    for k,m in enumerate(ms): jobs.append((i,k,t,VOICE,ID+m+TAIL,1.1))
GV="qwen-audio-3.0-tts-plus-longyiqinghui"
GID="六十多岁的慈祥老奶奶，嗓音苍老温和带笑，"
gm={'9ws74e5o':'笑眯眯地招呼','tvp9j670':'笑呵呵地打趣','7qme2cg1':'慈祥热情','21fxt6my':'开心，笑呵呵','i9sk4w1d':'意味深长地笑','pka89k7l':'笑着打趣','po0f9odq':'热情招呼','orccjucs':'意味深长地笑','80gat538':'温和平静','whi0um5b':'慢悠悠地讲述','xrsn77qz':'慈祥大方','oc9jjyu4':'平实地解释','5gcyr22h':'轻轻感叹','77xb0qrx':'慈祥，笑眯眯'}
for i,m in gm.items():
    t=I[i]['t'].strip('「」')
    for k,v in enumerate(['','，自然','，亲切']): jobs.append((i,k,t,GV,GID+m+v+'，口语自然',1.0))
def run(j):
    i,k,t,v,ins,rate=j; raw=f'game3/raw/{i}_{k}.wav'
    if not os.path.exists(raw):
        ok=tts(t,ins,raw) if v==VOICE else tts2(t,v,ins,raw)
        if not ok: return None
    o=raw[:-4]+'.mp3'; finish(raw,0,dur(raw),o); tr=asr(o); d=dur(o)
    return dict(id=i,k=k,t=t,voice=v,ins=ins,o=o,tr=tr,sim=round(sim(tr,t),3),dur=round(d,2),rate=round(len(norm(t))/d,2))
with ThreadPoolExecutor(6) as ex: out=[x for x in ex.map(run,jobs) if x]
json.dump(out,open('game3/takes.json','w'),ensure_ascii=False,indent=0)
for x in out: print(x['id'],x['k'],x['tr'],x['sim'],x['rate'])
