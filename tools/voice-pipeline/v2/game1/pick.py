import sys,json,re
sys.argv=['x'];exec(open('fix5152/mf.py').read().split("allz=")[0])
T=json.load(open('game1/takes.json'))
for t in T: t['mf']=round(score(t['o']),2)
json.dump(T,open('game1/takes.json','w'),ensure_ascii=False,indent=0)
from collections import defaultdict
G=defaultdict(list)
for t in T: G[t['id']].append(t)
pick={}
for i,ts in G.items():
    ok=[t for t in ts if t['sim']>=0.9 and 2.0<=t['rate']<=7.5]
    best=max(ok or ts,key=lambda t:(t['mf'] if ok else t['sim']))
    pick[i]=best; print(i,best['t'][:16],'ok%d'%len(ok),best['k'],best['sim'],best['rate'],best['mf'],'|',best['tr'][:20])
json.dump(pick,open('game1/pick.json','w'),ensure_ascii=False,indent=0)
