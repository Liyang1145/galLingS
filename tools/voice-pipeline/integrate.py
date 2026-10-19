import json,os,shutil,hashlib,collections,datetime
R='/workspace/work/gal/vo/'
G=R+'content/imports/vnstudio/海风与布丁/'
raw=open(G+'game.js',encoding='utf8').read()
pre=raw[:raw.index('{')]; end=raw.rstrip().rstrip(';').rindex('}')+1; post=raw[end:]
g=json.loads(raw[raw.index('{'):end])
res={}
for l in open('results.jsonl'):
    d=json.loads(l)
    if d['status'] in('ok','review'): res[d['id']]=d
os.makedirs(G+'assets/vo',exist_ok=True)
n=0;man=[]
for line in g['lines']:
    d=res.get(line['id'])
    if not d: continue
    aid='vo_'+line['id']; src=f"assets/vo/{line['id']}.mp3"
    shutil.copy(f"mp3/{line['id']}.mp3",G+src)
    sha=hashlib.sha256(open(G+src,'rb').read()).hexdigest()
    g['assets'][aid]={"id":aid,"type":"vo","name":f"vo_{line['speaker']}_{line['id']}","src":src,"dur":d['dur'],"audioCategory":"voice","generator":"qwen-audio-3.1-tts-next","sha256":sha}
    line['voice']=aid; n+=1
    man.append({"line":line['id'],"speaker":line['speaker'],"asset":aid,"src":src,"dur":d['dur'],"sha256":sha,"speak":d['speak'],"direction":d['dir'],"asr":d['tr'],"asr_similarity":d['sim'],"status":d['status']})
g['voiceOver']={"model":"qwen-audio-3.1-tts-next","date":"2026-10-17","lines":n,"protagonist":"“我”不配音（玩家视角）","manifest":"content/audio/voice-over.json"}
open(G+'game.js','w',encoding='utf8').write(pre+json.dumps(g,ensure_ascii=False,separators=(',',':'))+post)
json.dump({"model":"qwen-audio-3.1-tts-next","references":{"鲸鱼小姐":"content/audio/voice-refs/whale.mp3","老奶奶":"content/audio/voice-refs/granny.mp3","银匠":"content/audio/voice-refs/smith.mp3"},"count":n,"by_speaker":collections.Counter(m['speaker'] for m in man),"needs_review":sum(m['status']=='review' for m in man),"items":man},open(R+'content/audio/voice-over.json','w'),ensure_ascii=False,indent=1)
os.makedirs(R+'content/audio/voice-refs',exist_ok=True)
for k in('whale','granny','smith'): os.system(f"ffmpeg -loglevel error -y -i ref/{k}.wav -ac 1 -b:a 96k {R}content/audio/voice-refs/{k}.mp3")
print(n)
