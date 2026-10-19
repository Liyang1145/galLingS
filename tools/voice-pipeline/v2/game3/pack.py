import json,csv,os,shutil,subprocess,re,sys
exec(open('fix5152/mf.py').read().split("allz=")[0])
L=json.load(open('gamelines.json')); I={x['id']:x for x in L}
W=[x for x in L[:1235] if x['sp'] in('鲸鱼小姐','???')]
src={}
v2rows=list(csv.DictReader(open('鲸鱼小姐_配音_前200句_v2/台词清单.csv',encoding='utf-8-sig')))
import glob
for r in v2rows:
    f=glob.glob(f"鲸鱼小姐_配音_前200句_v2/语音/{int(r['序号']):03d}_*.mp3")[0]; src[r['台词ID']]=(f,'前200句v2')
g1=json.load(open('game1/pick.json'))
for i,p in g1.items(): src[i]=(p['o'],'试玩反馈29句')
g2=json.load(open('game2/pick.json'))
for i,p in g2.items(): src[i]=(p['o'],'第三～七话整体重配')
h=[x for x in json.load(open('game2/hand.json')) if x['k']=='c2'][0]; src['9onmu9do']=(h['o'],'第三～七话整体重配')
T3=json.load(open('game3/takes.json'))
for i in ['mel30c1l','p0qw841g']:
    ok=[t for t in T3 if t['id']==i and t['sim']>=0.9 and 2<=t['rate']<=7.5]
    b=max(ok,key=lambda t:score(t['o'])); src[i]=(b['o'],'试玩反馈重配'); print(i,b['k'],b['ins'][-30:])
miss=[x for x in W if x['id'] not in src]
print('whale ch1-7',len(W),'covered',sum(1 for x in W if x['id'] in src),'miss',[(x['i'],x['t']) for x in miss])
D='鲸鱼小姐_第一至七话_新音色'; shutil.rmtree(D,ignore_errors=True)
for s in ['鲸鱼小姐','老奶奶','连听']: os.makedirs(f'{D}/{s}')
rows=[];chap=[(2,'第一话'),(167,'第二话'),(344,'第三话'),(518,'第四话'),(662,'第五话'),(778,'第六话'),(912,'第七话'),(1235,'end')]
def ch(i): return [c for a,c in chap if a<=i][-1]
per={}
for x in W:
    if x['id'] not in src: rows.append([x['i'],ch(x['i']),x['id'],x['t'],'保留旧版（无台词的语气句）','']);continue
    f,s=src[x['id']]; fn=f"{x['i']:04d}_{x['id']}.mp3"; shutil.copy(f,f'{D}/鲸鱼小姐/{fn}')
    rows.append([x['i'],ch(x['i']),x['id'],x['t'],s,fn]); per.setdefault(ch(x['i']),[]).append(f'{D}/鲸鱼小姐/{fn}')
# 1769 extra
f,s=src['05ee3el4']; shutil.copy(f,f'{D}/鲸鱼小姐/1769_05ee3el4.mp3'); rows.append([1769,'第十一话','05ee3el4',I['05ee3el4']['t'],'剧本已改重录','1769_05ee3el4.mp3'])
for i in [x['id'] for x in L if x['sp']=='老奶奶']:
    ts=[t for t in T3 if t['id']==i]; b=max(ts,key=lambda t:(t['sim'],-t['k']))
    fn=f"{I[i]['i']:04d}_{i}.mp3"; shutil.copy(b['o'],f'{D}/老奶奶/{fn}'); rows.append([I[i]['i'],'老奶奶',i,I[i]['t'],'新音色 龙漪晴晦（慈祥祖母音）',fn])
    if I[i]['i']<1235: per.setdefault(ch(I[i]['i']),[]).append((I[i]['i'],f'{D}/老奶奶/{fn}'))
with open(f'{D}/清单.csv','w',encoding='utf-8-sig',newline='') as fo:
    w=csv.writer(fo); w.writerow(['句号','章节','句ID','台词','来源','文件']); w.writerows(sorted(rows,key=lambda r:(r[1]=='老奶奶',r[0])))
subprocess.run('ffmpeg -loglevel error -y -f lavfi -i anullsrc=r=44100:cl=mono -t 0.5 -b:a 64k /tmp/gap.mp3',shell=True)
for k,(c,fs) in enumerate([(c,per[c]) for a,c in chap if c in per]):
    fs=sorted(fs,key=lambda f:int(os.path.basename(f[1] if isinstance(f,tuple) else f)[:4]))
    fs=[f[1] if isinstance(f,tuple) else f for f in fs]
    open('/tmp/c.txt','w').write(''.join(f"file '{os.path.abspath(x)}'\nfile '/tmp/gap.mp3'\n" for x in fs))
    subprocess.run(['ffmpeg','-loglevel','error','-y','-f','concat','-safe','0','-i','/tmp/c.txt','-ar','44100','-ac','1','-b:a','64k',f'{D}/连听/{k+1}_{c}.mp3'],check=True)
print(len(os.listdir(D+'/鲸鱼小姐')),len(os.listdir(D+'/老奶奶')))
