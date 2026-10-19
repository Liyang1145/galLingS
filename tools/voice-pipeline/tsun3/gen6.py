import json,urllib.request,subprocess
from concurrent.futures import ThreadPoolExecutor
EP="https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
V={'01_龙鹊桐望8_降调0.92':('longquetongwang',0.92),'02_龙鹊桐望8_降调0.86':('longquetongwang',0.86),'03_龙菊芙荷7_呆萌软糯':('longjufuhe',0.95),'04_龙兰雪珺10_温柔活泼':('longlanxuejun',1.0),'05_龙彤鹊泉10_活泼灵动':('longtongquequan',1.0),'06_龙筝兰瑶8_清亮明朗':('longzhenglanyao',0.95),'07_龙璨蕊霜8_甜萌':('longcanruishuang',0.95),'08_龙湘霄筝7_活泼灵动':('longxiangxiaozheng',0.95),'09_龙凤渊泉24_甜萌动漫_升调':('longfengyuanquan',1.06),'10_龙雪风荷22_甜萌_升调':('longxuefenghe',1.06)}
L=[('哼，才、才不是特意等你的呢！别误会了！','日系动画女主的配音腔，甜美清透不尖锐，傲娇嘴硬，语速轻快自然，不拖腔不放慢'),
   ('笨蛋！谁、谁担心你了……只是刚好路过而已。','日系动画女主的配音腔，甜美清透不尖锐，慌张反驳后小声嘀咕，语速轻快，不拖腔'),
   ('……谢谢。我只说一次，听到了没有？','日系动画女主的配音腔，甜美清透不尖锐，害羞别扭但干脆，语速轻快，不拖腔')]
def one(a):
    k,i=a; t,ins=L[i]
    body=json.dumps({"model":"qwen-audio-3.0-tts-plus","input":{"text":t,"voice":"qwen-audio-3.0-tts-plus-"+V[k][0],"pitch":V[k][1],"instruction":ins,"format":"wav","rate":1.1,"sample_rate":44100}}).encode()
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request(EP,body,{"Content-Type":"application/json"}),timeout=120))
        subprocess.run(["curl","-sf","-m","60","-o",f"{k}_{i+1}.wav",r["output"]["audio"]["url"]],check=True); return k,i,'ok'
    except urllib.error.HTTPError as e: return k,i,e.read().decode()[:200]
    except Exception as e: return k,i,str(e)
with ThreadPoolExecutor(10) as ex:
    for x in ex.map(one,[(k,i) for k in V for i in range(3)]): print(x)
