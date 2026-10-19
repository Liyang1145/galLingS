import sys,json,csv,os
exec(open('gen9.py').read().split("os.makedirs('raw'")[0])
from concurrent.futures import ThreadPoolExecutor
D='鲸鱼小姐_配音_前200句_v2'
rows=list(csv.DictReader(open(D+'/台词清单.csv',encoding='utf-8-sig')))
def f(r):
    p=f"{D}/语音/{int(r['序号']):03d}_{r['台词ID']}.mp3"
    return dict(n=int(r['序号']),t=r['台词'],tr=asr(p),dur=dur(p))
with ThreadPoolExecutor(6) as ex: out=list(ex.map(f,rows))
json.dump(out,open('recheck.json','w'),ensure_ascii=False,indent=0)
