import json,urllib.request,subprocess
from concurrent.futures import ThreadPoolExecutor
EP="https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
V={'01_龙璨蕊霜_降调0.92':('longcanruishuang',0.92,''),'02_龙璨蕊霜_原调1.0':('longcanruishuang',1.0,''),'03_龙璨蕊霜_0.95_少女感':('longcanruishuang',0.95,'像十五六岁的少女，不要太稚嫩，'),'04_龙薇荷筝21_甜萌_升调':('longweihezheng',1.08,''),'05_龙凌瑾泉24_元气少女_升调':('longlingjinquan',1.08,''),'06_龙嵐凌莹24_灵动少女_升调':('longlanlingying',1.08,''),'07_龙晓星漪23_灵动少女_升调':('longxiaoxingyi',1.08,''),'08_龙杉瑜星25_灵动少女_升调':('longshanyuxing',1.08,''),'09_龙柳桃虹22_傲娇俏皮_升调':('longliutaohong',1.08,'')}
L=[('哼，才、才不是特意等你的呢！别误会了！','日系动画女主的配音腔，甜美清透不尖锐，傲娇嘴硬，语速轻快自然，不拖腔不放慢'),
   ('笨蛋！谁、谁担心你了……只是刚好路过而已。','日系动画女主的配音腔，甜美清透不尖锐，慌张反驳后小声嘀咕，语速轻快，不拖腔'),
   ('……谢谢。我只说一次，听到了没有？','日系动画女主的配音腔，甜美清透不尖锐，害羞别扭但干脆，语速轻快，不拖腔')]
def one(a):
    k,i=a; t,ins=L[i]
    body=json.dumps({"model":"qwen-audio-3.0-tts-plus","input":{"text":t,"voice":"qwen-audio-3.0-tts-plus-"+V[k][0],"pitch":V[k][1],"instruction":V[k][2]+ins,"format":"wav","rate":1.1,"sample_rate":44100}}).encode()
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request(EP,body,{"Content-Type":"application/json"}),timeout=120))
        subprocess.run(["curl","-sf","-m","60","-o",f"{k}_{i+1}.wav",r["output"]["audio"]["url"]],check=True); return k,i,'ok'
    except urllib.error.HTTPError as e: return k,i,e.read().decode()[:200]
    except Exception as e: return k,i,str(e)
with ThreadPoolExecutor(10) as ex:
    for x in ex.map(one,[(k,i) for k in V for i in range(3)]): print(x)
