import json,urllib.request,subprocess
from concurrent.futures import ThreadPoolExecutor
EP="https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
V={'1_呆萌软糯16_龙晖杉朔':'longhuishanshuo','2_动漫风格15_龙岚鹊焱':'longlanqueyan','3_清亮动漫16_龙鹤澈蓉':'longhecherong','4_呆萌软糯9_龙薇梅翼':'longweimeiyi','5_甜萌动漫8_龙鹊桐望':'longquetongwang','6_甜萌动漫8_龙云凌柏':'longyunlingbai','7_不耐烦躁8_龙璨莲岫':'longcanlianxiu','8_元气动漫9_龙萱桃烁':'longxuantaoshuo'}
L=[('哼，才、才不是特意等你的呢！别误会了！','萌系傲娇小萝莉，奶声奶气，不耐烦又掩饰害羞，嘴硬'),
   ('笨蛋！谁、谁担心你了……只是刚好路过而已。','萌系傲娇小萝莉，奶声奶气，慌张反驳，后半句越说越小声'),
   ('……谢谢。我只说一次，听到了没有？','萌系傲娇小萝莉，奶声奶气，别过头，小声又别扭')]
def one(a):
    k,i=a; t,ins=L[i]
    body=json.dumps({"model":"qwen-audio-3.0-tts-plus","input":{"text":t,"voice":"qwen-audio-3.0-tts-plus-"+V[k],"instruction":ins,"format":"wav","sample_rate":44100}}).encode()
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request(EP,body,{"Content-Type":"application/json"}),timeout=120))
        subprocess.run(["curl","-sf","-m","60","-o",f"{k}_{i+1}.wav",r["output"]["audio"]["url"]],check=True); return k,i,'ok'
    except urllib.error.HTTPError as e: return k,i,e.read().decode()[:200]
    except Exception as e: return k,i,str(e)
with ThreadPoolExecutor(8) as ex:
    for x in ex.map(one,[(k,i) for k in V for i in range(3)]): print(x)
