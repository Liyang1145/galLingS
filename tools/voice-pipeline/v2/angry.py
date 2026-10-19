exec(open('gen9.py').read().split("os.makedirs('raw'")[0])
import shutil
old={x['id']:x for x in json.load(open('res.json'))}
M={4:"甜甜笑着毒舌数落，嗓音软，字字带刺，从容不急",
   7:"笑意不减地轻声骂出口，羞恼藏在甜嗓里，不喊",
   18:"轻笑着否认，甜嗓里带嘲讽，语气笃定不急",
   34:"无奈又好笑地数落，软声带刺，慢条斯理",
   43:"先轻笑反问，再甜甜地毒舌讽刺，不喊不急",
   55:"羞恼却笑着压住，软声带刺地数落，不喊",
   39:"笑眯眯地喊回来，甜甜地威胁，带腹黑感",
   37:"甜甜笑着干脆拒绝，软中带刺，不喊"}
os.makedirs('angry',exist_ok=True)
outs=[]
def do(gi):
    g=G[gi]; ids=g['ids']; lines=[R[i]['speak'] for i in ids]
    ins=ID+M[gi]+"，音色保持一致"
    text=''.join(lines); best={}
    for att in range(3):
        raw=f'angry/g{gi:02d}_{att}.wav'
        if not tts(text,ins,raw): continue
        seg=split(raw,lines)
        if not seg: continue
        ok=True
        for k,(i,(a,b)) in enumerate(zip(ids,seg)):
            o=f'angry/g{gi:02d}_{att}_{k}.mp3'; finish(raw,a,b,o); tr=asr(o); s=sim(tr,lines[k])
            if s>best.get(i,(-1,))[0]: best[i]=(s,o,tr)
            ok&=s>=0.9
        if ok: break
    print(gi,ins,[(round(best[i][0],2),best[i][2]) for i in ids],flush=True)
    return [(i,best[i]) for i in ids]
with ThreadPoolExecutor(4) as ex: res=[x for r in ex.map(do,M) for x in r]
order=[it['id'] for r in json.load(open('runs.json')) for it in r[:-1]]
D='鲸鱼小姐_生气句_毒舌版'; shutil.rmtree(D,ignore_errors=True); os.makedirs(D)
for i,(s,o,tr) in res:
    n=order.index(i)+1; t=re.sub(r'[\\/:*?"<>|]','',R[i]['speak'])[:14]
    shutil.copy(o,f'{D}/{n:03d}_新_{t}.mp3'); shutil.copy(old[i]['src'],f'{D}/{n:03d}_旧_{t}.mp3')
subprocess.run(['zip','-qr',D+'.zip',D]); print(os.listdir(D))
