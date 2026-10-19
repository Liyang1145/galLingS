import json,urllib.request,time,concurrent.futures as cf
L=json.load(open('gamelines.json'))
done=set(json.load(open('game1/pick.json')))
W=[x for x in L[449:1235] if x['sp'] in('鲸鱼小姐','???') and x['id'] not in done]
SYS="""你是日系动画配音导演。角色“鲸鱼小姐”：傲娇、自称本小姐、嘴硬心软。音色已锁定，你只写每句的表演情绪。
为每句写 mood：≤12个汉字。只能用这类安全词组合：嘴硬、带刺、嫌弃、小声、认真、温柔、别扭、得意、委屈、好奇、轻快、撒娇、坚定、心虚、开心、轻笑、挑剔、淡定、调皮。
禁止：拔高、大声、喊、喝、急、加快、慌、爆发、慢、拖长、耳语、颤抖。生气的句子也写成“带刺，嫌弃”之类，甜笑着扎人，不喊不急。
只输出 JSON 对象 {"id":"mood",...}，不要其它文字。"""
def call(chunk):
    a,b=chunk; lines=[]
    for x in L[a:b]:
        tag='【配】id='+x['id']+' ' if x['id'] in want else ''
        lines.append(f"{tag}{x['sp'] or '旁白'}：{x['t']}")
    body={"model":"claude-sonnet-5","messages":[{"role":"system","content":SYS},{"role":"user","content":"下面是连续剧本，只给标了【配】的句子写 mood：\n"+'\n'.join(lines)}],"max_tokens":8000}
    for t in range(4):
        try:
            r=json.load(urllib.request.urlopen(urllib.request.Request("https://api.rinko.ai/v1/chat/completions",json.dumps(body).encode(),{"Content-Type":"application/json"}),timeout=300))
            s=r['choices'][0]['message']['content']; return json.loads(s[s.index('{'):s.rindex('}')+1])
        except Exception as e: print('retry',e,flush=True); time.sleep(5)
    return {}
want={x['id'] for x in W}
chunks=[(a,min(a+80,1235)) for a in range(449,1235,80)]
M={}
with cf.ThreadPoolExecutor(5) as ex:
    for d in ex.map(call,chunks): M.update(d)
miss=[i for i in want if i not in M]; print(len(W),len(M),'miss',len(miss))
json.dump(M,open('game2/moods.json','w'),ensure_ascii=False,indent=0)
