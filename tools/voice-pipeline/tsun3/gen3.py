import json,urllib.request,subprocess
from concurrent.futures import ThreadPoolExecutor
EP="https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
V={'1_傲娇俏皮_龙柳桃虹':'longliutaohong','2_傲娇闺秀_龙霜澈霄':'longshuangchexiao','3_撒娇甜蜜_龙竹泉望':'longzhuquanwang',
   '4_元气少女_龙凌瑾泉':'longlingjinquan','5_灵动少女_龙嵐凌莹':'longlanlingying','6_甜萌动漫_龙凤渊泉':'longfengyuanquan'}
L=[('哼，才、才不是特意等你的呢！别误会了！','傲娇少女，不耐烦又掩饰害羞，嘴硬'),
   ('笨蛋！谁、谁担心你了……只是刚好路过而已。','傲娇少女，慌张反驳，后半句越说越小声'),
   ('……谢谢。我只说一次，听到了没有？','傲娇少女，别过头，小声又别扭')]
def one(a):
    k,i=a; t,ins=L[i]
    body=json.dumps({"model":"qwen-audio-3.0-tts-plus","input":{"text":t,"voice":"qwen-audio-3.0-tts-plus-"+V[k],"instruction":ins,"format":"wav","sample_rate":44100}}).encode()
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request(EP,body,{"Content-Type":"application/json"}),timeout=120))
        subprocess.run(["curl","-sf","-m","60","-o",f"{k}_{i+1}.wav",r["output"]["audio"]["url"]],check=True); return k,i,'ok'
    except urllib.error.HTTPError as e: return k,i,e.read().decode()[:200]
    except Exception as e: return k,i,str(e)
with ThreadPoolExecutor(6) as ex:
    for x in ex.map(one,[(k,i) for k in V for i in range(3)]): print(x)
