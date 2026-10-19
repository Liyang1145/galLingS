import json,urllib.request,base64,subprocess,glob,re,sys
def b64(p):
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',p,'-ac','1','-ar','16000','/tmp/j.wav'],check=True); return base64.b64encode(open('/tmp/j.wav','rb').read()).decode()
refs=[glob.glob(f'鲸鱼小姐_配音_前200句_v2/语音/{n}_*.mp3')[0] for n in ['047','053','060']]
def judge(p):
    c=[{"type":"text","text":"下面前三段是同一个动漫女声角色的标准音色参考。"}]
    for r in refs: c.append({"type":"input_audio","input_audio":{"data":b64(r),"format":"wav"}})
    c+= [{"type":"text","text":"这是待评音频："},{"type":"input_audio","input_audio":{"data":b64(p),"format":"wav"}},
         {"type":"text","text":"只评音色（不评台词内容）：与参考是否同一人、是否圆润甜美不尖、不发紧不变声。给0-10整数分，只输出数字。"}]
    for t in range(3):
        try:
            r=json.load(urllib.request.urlopen(urllib.request.Request("https://api.rinko.ai/v1/chat/completions",json.dumps({"model":"gemini-3.6-flash","messages":[{"role":"user","content":c}]}).encode(),{"Content-Type":"application/json"}),timeout=90))
            return r['choices'][0]['message']['content'].strip()
        except Exception as e: err=e
    return 'err'
ps=sorted(glob.glob('鲸鱼小姐_配音_前200句_v2/语音/05[12]_*'))+sorted(glob.glob('fix5152/raw/*.mp3'))
for p in ps: print(p.split('/')[-1],[judge(p) for _ in range(2)],flush=True)
