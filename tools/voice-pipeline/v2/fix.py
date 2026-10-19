exec(open('gen9.py').read().split("os.makedirs('raw'")[0])
res=json.load(open('res.json'))
txt={'zv50a61e':'谁要替你……！','7y5p4ecl':'都重要？','o48jgiqf':'再说了……'}
for x in res:
    if x['id'] in txt:
        best=(x['sim'],x['src'],x['tr'])
        for att in range(4):
            raw=f"raw/f_{x['id']}_{att}.wav"
            if not tts(txt[x['id']],x['ins'],raw): continue
            o=raw[:-4]+'.mp3'; finish(raw,0,dur(raw),o); tr=asr(o); s=sim(tr,x['speak']); print(x['id'],s,tr,dur(o))
            if s>best[0]: best=(s,o,tr)
            if s>=0.9: break
        x['sim'],x['src'],x['tr']=round(best[0],3),best[1],best[2]; x['mode']+='+fix'
json.dump(res,open('res.json','w'),ensure_ascii=False,indent=0)
