import json,urllib.request,concurrent.futures as cf,os,re
chunks=json.load(open('chunks7.json'))
SYS="""你是游戏配音导演。作品《海风与布丁》：主角“我”（玩家，不配音）与深海鲸鱼族成年女性“鲸鱼小姐”（傲娇，自称本小姐，叫对方“人类”，嘴硬心软，真心话写在尾鳍上）的恋爱故事。其他配角：老奶奶、银匠、摊主等。
给你一话的完整剧本（含旁白和主角台词作为上下文）。只为标了【配音】的台词输出 JSON 数组，每项 {"id":..., "speak":..., "dir":...}：
- speak：实际念出的台词。去掉「」『』引号；去掉台词里描述动作的括号内容（如（别过脸））；保留……和——带来的停顿感；不改字、不加字。若整句都是无法念的符号，speak 为空串。
- dir：给语音模型的表演指示，15～30字中文，写清情绪、语气、音量、语速（例如“压低声音、别扭地小声嘟囔，尾音发软”），结合上下文，避免千篇一律。
只输出 JSON 数组，不要其它文字。"""
def run(i):
    out=f'ann/07_{i}.json'
    if os.path.exists(out): return i,'skip'
    c=chunks[i]; ids=[x for x in c if x['sp'] and x['sp']!='我']
    if not ids: json.dump([],open(out,'w')); return i,'empty'
    sc='\n'.join((f"【配音 id={x['id']}】{x['sp']}：{x['t']}" if (x['sp'] and x['sp']!='我') else (f"{x['sp']}：{x['t']}" if x['sp'] else f"（旁白）{x['t']}")) for x in c if x['t'])
    body={"model":"claude-sonnet-5","messages":[{"role":"system","content":SYS},{"role":"user","content":sc}],"max_tokens":32000}
    for t in range(4):
        try:
            body['stream']=True
            resp=urllib.request.urlopen(urllib.request.Request("https://api.rinko.ai/v1/chat/completions",json.dumps(body).encode(),{"Content-Type":"application/json"}),timeout=900)
            txt=''
            for ln in resp:
                ln=ln.decode('utf8','ignore').strip()
                if ln.startswith('data:') and ln[5:].strip()!='[DONE]':
                    try:
                        d=json.loads(ln[5:])
                        if d.get('choices') and d['choices'][0].get('delta',{}).get('content'): txt+=d['choices'][0]['delta']['content']
                    except Exception: pass
            txt=txt[txt.index('['):txt.rindex(']')+1]
            arr=json.loads(txt); got={a['id'] for a in arr}
            miss=[x['id'] for x in ids if x['id'] not in got]
            if len(miss)>len(ids)*0.05: raise Exception(f'missing {len(miss)}')
            json.dump(arr,open(out,'w'),ensure_ascii=False,indent=0); return i,len(arr),len(ids)
        except Exception as e: err=str(e)[:200]
    return i,'fail',err
with cf.ThreadPoolExecutor(8) as ex:
    for r in ex.map(run,range(len(chunks))): print(r,flush=True)
