import sys,json
exec(open('fix5152/mf.py').read().split("allz=")[0])
T=json.load(open('game2/takes.json')); MO=json.load(open("game2/moods.json"))
from collections import defaultdict
G=defaultdict(list)
for t in T: G[t['id']].append(t)
pick={};bad=[]
for i in MO:
    ts=G.get(i,[])
    ok=[t for t in ts if t['sim']>=0.9 and 1.8<=t['rate']<=7.5]
    if not ok: bad.append((i,[(t['tr'],t['sim'],t['rate']) for t in ts])); continue
    for t in ok: t['mf']=score(t['o'])
    pick[i]=max(ok,key=lambda t:t['mf'])
json.dump(pick,open('game2/pick.json','w'),ensure_ascii=False,indent=0)
print(len(pick),len(bad))
L={x['id']:x for x in json.load(open('gamelines.json'))}
for i,b in bad: print(i,L[i]['i'],L[i]['t'],b[:3])
