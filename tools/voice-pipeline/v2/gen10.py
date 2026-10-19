import json,urllib.request,subprocess,re,os,base64,difflib,itertools,time,random,sys
from concurrent.futures import ThreadPoolExecutor
EP="https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
VOICE="qwen-audio-3.0-tts-plus-longcanruishuang"
ID="嗓音再圆润成熟一点，像二十岁左右的甜萌动漫女声，日系动画女主的配音腔，甜美清透不尖锐，"
R={it['id']:it for r in json.load(open('runs2.json')) for it in r[:-1]}
G=json.load(open('groups2.json'))
order=[it['id'] for r in json.load(open('runs2.json')) for it in r[:-1]]
def fixmood(m):
    m=re.sub(r'\[[a-z ]+\]','',m)
    m=re.sub(r'(语速放慢|慢速|放慢|拖长|一字一句|一字一顿)[，,]?','',m); return m.strip('，,')
def tts(text,ins,out):
    body=json.dumps({"model":"qwen-audio-3.0-tts-plus","input":{"text":text,"voice":VOICE,"pitch":1.0,"rate":1.1,"instruction":ins,"format":"wav","sample_rate":44100}}).encode()
    for t in range(8):
        try:
            r=json.load(urllib.request.urlopen(urllib.request.Request(EP,body,{"Content-Type":"application/json"}),timeout=120))
            subprocess.run(["curl","-sf","-m","60","-o",out,r["output"]["audio"]["url"]],check=True); return True
        except urllib.error.HTTPError as e:
            msg=e.read().decode()[:200]
            if 'Throttl' in msg: time.sleep(3+random.random()*5); continue
            print('tts err',msg,flush=True); time.sleep(2)
        except Exception as e: print('tts exc',e,flush=True); time.sleep(2)
    return False
def asr(path):
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',path,'-ac','1','-ar','16000',path+'.16k.wav'],check=True)
    b=base64.b64encode(open(path+'.16k.wav','rb').read()).decode(); os.remove(path+'.16k.wav')
    body={"model":"gemini-3.6-flash","messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":b,"format":"wav"}},{"type":"text","text":"逐字转写这段中文语音，只输出听到的文字，不要加任何说明。"}]}]}
    for t in range(4):
        try:
            r=json.load(urllib.request.urlopen(urllib.request.Request("https://api.rinko.ai/v1/chat/completions",json.dumps(body).encode(),{"Content-Type":"application/json"}),timeout=90))
            return r['choices'][0]['message']['content'].strip()
        except Exception as e: time.sleep(3)
    return None
norm=lambda s:re.sub(r'[^\w]','',re.sub(r'\[[a-z ]+\]','',s or ''))
def sim(a,b): return difflib.SequenceMatcher(None,norm(a),norm(b)).ratio()
def dur(p): return float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p],capture_output=True,text=True).stdout)
def silences(p):
    e=subprocess.run(['ffmpeg','-i',p,'-af','silencedetect=noise=-38dB:d=0.1','-f','null','-'],capture_output=True,text=True).stderr
    st=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',e)]; en=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',e)]
    return list(zip(st,en))
def weight(s): return len(norm(s))+2*s.count('……')+2*s.count('——')+1
def split(p,lines):
    D=dur(p); sil=[(a,b) for a,b in silences(p) if a>0.15 and b<D-0.1]
    n=len(lines)
    if n==1: return [(0,D)]
    if len(sil)<n-1: return None
    w=[weight(l) for l in lines]; cum=[sum(w[:i+1])/sum(w)*D for i in range(n-1)]
    best=None
    for comb in itertools.combinations(sil,n-1):
        c=sum(abs((a+b)/2-cum[i]) for i,(a,b) in enumerate(comb))/D - 0.6*sum(b-a for a,b in comb)
        if best is None or c<best[0]: best=(c,comb)
    cuts=[(a+b)/2 for a,b in best[1]]; bounds=[0]+cuts+[D]
    return [(bounds[i],bounds[i+1]) for i in range(n)]
def finish(src,a,b,out):
    af="silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.05,loudnorm=I=-18:TP=-1.5"
    subprocess.run(['ffmpeg','-loglevel','error','-y','-ss',str(a),'-to',str(b),'-i',src,'-af',af,'-ar','44100','-ac','1','-b:a','64k',out],check=True)
os.makedirs('raw2',exist_ok=True); os.makedirs('mp3',exist_ok=True)
def do(gi):
    g=G[gi]; ids=g['ids']; lines=[R[i]['speak'] for i in ids]
    tags=g.get('tags',{})
    ins=ID+fixmood(g['mood'])+"，语速轻快自然，不拖腔"
    best={}
    for att in range(3):
        text=''.join(tags.get(i,'').replace('[shouting]','[angry]')+R[i]['speak'] for i in ids)
        raw=f'raw2/g{gi:02d}_{att}.wav'
        if not tts(text,ins,raw): continue
        seg=split(raw,lines)
        if not seg: continue
        res=[]
        for k,(i,(a,b)) in enumerate(zip(ids,seg)):
            o=f'raw2/g{gi:02d}_{att}_{k}.mp3'; finish(raw,a,b,o); tr=asr(o); s=sim(tr,lines[k]); res.append((s,o,tr))
            if s>best.get(i,(-1,))[0]: best[i]=(s,o,tr,'group',att)
        if all(r[0]>=0.85 for r in res): break
    # fallback: single-line for weak ones
    for k,i in enumerate(ids):
        if len(ids)>1 and best.get(i,(0,))[0]<0.85:
            for att in range(2):
                raw=f'raw2/s_{i}_{att}.wav'
                if not tts(tags.get(i,'').replace('[shouting]','[angry]')+lines[k],ins,raw): continue
                o=f'raw2/s_{i}_{att}.mp3'; finish(raw,0,dur(raw),o); tr=asr(o); s=sim(tr,lines[k])
                if s>best.get(i,(-1,))[0]: best[i]=(s,o,tr,'single',att)
                if s>=0.85: break
    out=[]
    for i in ids:
        s,o,tr,mode,att=best.get(i,(0,None,None,'fail',0))
        out.append({'id':i,'speak':R[i]['speak'],'sim':round(s,3),'tr':tr,'src':o,'mode':mode,'group':gi,'ins':ins})
    print(gi,[(x['sim'],x['mode']) for x in out],flush=True)
    return out
with ThreadPoolExecutor(4) as ex: allr=[x for r in ex.map(do,range(len(G))) for x in r]
json.dump(allr,open('res2.json','w'),ensure_ascii=False,indent=0)
