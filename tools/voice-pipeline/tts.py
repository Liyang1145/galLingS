import json,sys,urllib.request,base64,time
EP="https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
def tts(prompt,out,refs=None,fmt='mp3',seed=42,rate=1.0):
    inp={"text_prompt":prompt,"format":fmt,"sample_rate":44100,"channels":1,"seed":seed,"rate":rate}
    if fmt=='mp3': inp.update(enable_cbr=True,bit_rate=96)
    if refs: inp["references"]=[{"audio_data":"data:audio/%s;base64,"%r.rsplit('.',1)[1]+base64.b64encode(open(r,'rb').read()).decode()} for r in refs]
    body=json.dumps({"model":"qwen-audio-3.1-tts-next","input":inp}).encode()
    for t in range(4):
        try:
            req=urllib.request.Request(EP,body,{"Content-Type":"application/json"})
            r=json.load(urllib.request.urlopen(req,timeout=300))
            url=r["output"]["audio"]["url"]
            import subprocess; subprocess.run(["curl","-sf","-m","120","-o",out,url],check=True)
            return r["output"]["audio"]["duration"],r.get("usage")
        except urllib.error.HTTPError as e:
            msg=e.read().decode()[:300]
            if e.code in(400,403,404): return None,msg
            time.sleep(5*(t+1))
        except Exception as e:
            msg=str(e); time.sleep(5*(t+1))
    return None,msg
