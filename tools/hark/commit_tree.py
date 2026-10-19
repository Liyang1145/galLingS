# 不 checkout、不全量 clone 地提交：python commit_tree.py <base> <msg> <changes.json>
# changes.json：{"仓库路径":"本地文件" 或 "blob:<sha>"}；用 mktree --missing，blobless 克隆也能用。REPO 环境变量指向本地仓库。
import os,subprocess,sys,json
base,msg=sys.argv[1],sys.argv[2];ch=json.load(open(sys.argv[3]))
os.chdir(os.environ.get('REPO','repo'));env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(*a,inp=None):
    r=subprocess.run(['git',*a],input=inp,capture_output=True,check=True,env=env);return r.stdout.decode()
C={}
for k,v in ch.items():
  if v.startswith('blob:'): C[k]=v[5:]
  else: C[k]=git('hash-object','-w',v).strip()
def build(t,prefix):
    ents={}
    if t:
        for e in git('ls-tree','-z',t).split('\0'):
            if e: meta,name=e.split('\t',1);m,ty,s=meta.split();ents[name]=[m,ty,s]
    subs=set()
    for k in C:
        if k.startswith(prefix):
            r=k[len(prefix):]
            if '/' in r: subs.add(r.split('/')[0])
            else: ents[r]=['100644','blob',C[k]]
    for d in subs: ents[d]=['040000','tree',build(ents[d][2] if d in ents else None,prefix+d+'/')]
    return git('mktree','-z','--missing',inp=''.join(f'{m} {ty} {s}\t{k}\0' for k,(m,ty,s) in ents.items()).encode()).strip()
t=build(git('rev-parse',base+'^{tree}').strip(),'')
print(git('-c','user.name=Hark','-c','user.email=hark-agent@users.noreply.github.com','commit-tree',t,'-p',base,'-m',msg).strip())
