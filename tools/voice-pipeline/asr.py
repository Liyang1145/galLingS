import json,base64,sys,urllib.request,subprocess,os,tempfile
def asr(path):
    t=tempfile.mktemp(suffix='.mp3'); subprocess.run(['ffmpeg','-loglevel','error','-y','-i',path,'-ac','1','-ar','16000','-b:a','48k',t],check=True)
    b=base64.b64encode(open(t,'rb').read()).decode(); os.remove(t)
    body={"model":"qwen-audio-3.0-asr-flash","messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":"data:audio/mpeg;base64,"+b,"format":"mp3"}}]}]}
    for i in range(3):
        try:
            r=json.load(urllib.request.urlopen(urllib.request.Request("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",json.dumps(body).encode(),{"Content-Type":"application/json"}),timeout=120))
            return r['choices'][0]['message']['content']
        except Exception as e: err=str(e)
    return None
def describe(path,q="请描述这段语音说话人的性别、大致年龄、音色特点、情绪和语气，以及是否有杂音、音乐或音效。简短回答。"):
    t=tempfile.mktemp(suffix='.mp3'); subprocess.run(['ffmpeg','-loglevel','error','-y','-i',path,'-ac','1','-ar','16000','-b:a','48k',t],check=True)
    b=base64.b64encode(open(t,'rb').read()).decode(); os.remove(t)
    body={"model":MODEL,"messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":"data:;base64,"+b,"format":"mp3"}},{"type":"text","text":q}]}],"modalities":["text"],"stream":True}
    r=urllib.request.urlopen(urllib.request.Request("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",json.dumps(body).encode(),{"Content-Type":"application/json"}),timeout=120)
    out=''
    for l in r:
        l=l.decode().strip()
        if l.startswith('data:') and 'choices' in l:
            d=json.loads(l[5:]); 
            if d['choices'] and d['choices'][0]['delta'].get('content'): out+=d['choices'][0]['delta']['content']
    return out
MODEL='qwen3.8-omni-flash'
if __name__=='__main__':
    for p in sys.argv[1:]: print(p,asr(p))
