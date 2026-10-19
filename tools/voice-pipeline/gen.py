import json,glob,os,re,subprocess,difflib,concurrent.futures as cf,sys,time
from tts import tts
from asr import describe
REF={'鲸鱼小姐':'ref/whale.wav','???':'ref/whale.wav','老奶奶':'ref/granny.wav','银匠':'ref/smith.wav'}
PERSONA={'摊主':'一位三十多岁热情爽朗的女摊主，嗓门洪亮','摊主甲':'一位三十多岁热情爽朗的女摊主，嗓门洪亮','摊主乙':'一位四十岁左右的男摊主，嗓音粗厚，熟络热情'}
ann={}
for f in sorted(glob.glob('ann/*.json')):
    for a in json.load(open(f)): ann[a['id']]=a
chunks=json.load(open('chunks.json'))
import re as _r
for c in chunks:
    for x in c:
        if x['sp'] and x['sp']!='我' and x['id'] not in ann:
            ann[x['id']]={'id':x['id'],'speak':_r.sub(r'（[^）]*）','',x['t']).strip('「」『』 '),'dir':'自然地，贴合上下文的情绪'}
items=[x for c in chunks for x in c if x['sp'] and x['sp']!='我']
done={}
if os.path.exists('results.jsonl'):
    for l in open('results.jsonl'): d=json.loads(l); done[d['id']]=d
norm=lambda s:re.sub(r'[\W_]+','',s)
def one(x):
    a=ann[x['id']]; sp=a['speak'].strip()
    if not norm(sp): return {'id':x['id'],'status':'skip_empty','speaker':x['sp']}
    d=a['dir'].strip().rstrip('。，,')
    if x['sp'] in REF: prompt=f"@voice1 {d}，说：“{sp}”"; refs=[REF[x['sp']]]
    else: prompt=f"游戏台词配音，单人，只有人声，无音效。{PERSONA[x['sp']]}，{d}，说：“{sp}”"; refs=None
    best=None
    for att in range(3):
        w=f"wav/{x['id']}_{att}.wav"
        dur,u=tts(prompt,w,refs=refs,fmt='wav',seed=42+att*97)
        if not dur: best=best or {'err':str(u)}; continue
        try: tr=describe(w,'只逐字转写这段语音的内容，不要任何其他说明。')
        except Exception as e: tr=''
        sim=difflib.SequenceMatcher(None,norm(sp),norm(tr)).ratio()
        cand={'wav':w,'dur':dur,'tr':tr,'sim':sim,'att':att}
        if not best or 'err' in best or sim>best['sim']: best=cand
        if sim>=0.88: break
    if 'err' in best: return {'id':x['id'],'status':'fail','err':best['err'],'speaker':x['sp']}
    mp=f"mp3/{x['id']}.mp3"
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',best['wav'],'-af','silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.15,areverse,loudnorm=I=-18:TP=-1.5:LRA=11','-ar','44100','-ac','1','-b:a','64k',mp],check=True)
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',mp],capture_output=True,text=True).stdout)
    return {'id':x['id'],'status':'ok' if best['sim']>=0.88 else 'review','speaker':x['sp'],'speak':sp,'dir':d,'tr':best['tr'],'sim':round(best['sim'],3),'dur':round(dur,3),'att':best['att']}
todo=[x for x in items if x['id'] not in done or done[x['id']]['status']=='fail']
print('todo',len(todo),'of',len(items),flush=True)
deadline=time.time()+float(sys.argv[1] if len(sys.argv)>1 else 1080)
with open('results.jsonl','a') as fo, cf.ThreadPoolExecutor(10) as ex:
    futs=[]
    for x in todo: futs.append(ex.submit(lambda x=x: one(x) if time.time()<deadline else None))
    n=0
    for f in cf.as_completed(futs):
        r=f.result()
        if r: fo.write(json.dumps(r,ensure_ascii=False)+'\n'); fo.flush(); n+=1
print('wrote',n,flush=True)
