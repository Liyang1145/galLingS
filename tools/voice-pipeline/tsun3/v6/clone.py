import json,sys,urllib.request
U=json.load(sys.stdin)
EP="https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/customization"
out={}
for k,u in U.items():
    b=json.dumps({"model":"voice-enrollment","input":{"action":"create_voice","target_model":"qwen-audio-3.0-tts-plus","prefix":"tsun"+k,"url":u,"language_hints":["zh"],"max_prompt_audio_length":30.0 if k=='A' else 15.0}}).encode()
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request(EP,b,{"Content-Type":"application/json"}),timeout=120)); out[k]=r["output"]["voice_id"]; print(k,r)
    except urllib.error.HTTPError as e: print(k,e.code,e.read().decode()[:300])
json.dump(out,open('voices.json','w'))
