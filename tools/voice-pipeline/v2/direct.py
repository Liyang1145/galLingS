import json,urllib.request
runs=json.load(open('runs.json'))
SYS="""你是日系动画/Galgame 的配音导演，为 Qwen-Audio-3.0-TTS-Plus 写合成参数。角色“鲸鱼小姐”：深海鲸鱼族年轻女性，傲娇，自称本小姐，叫主角“人类”，嘴硬心软。音色已锁定（甜萌动漫女主声），你不要描述音色、年龄、性别，只写表演。
用户要求：日配女主感，语气轻快自然，不刻意放慢、不拖腔，不要尖。
模型知识：instruction 用一句自然语言描述情绪/语气/音量/节奏，越短越具体越好；文本里可插控制标签（作用于其后文本直到下一个标签）：[angry][excited][sarcastic][curious][scornful][shouting][panicked][mischievously][reluctantly][serious][whispers][sad][amazed][trembling]；富语言标签（在该处插入声音）：[snorts]哼声 [sighing]叹气 [giggles]轻笑 [gasp]倒吸气。
任务：给你若干“连续台词段”（同一角色中间没有别人插话），每段附上下文。请把每段切成若干合成组：一组 1～3 句，总字数≤45，情绪接近的才合并（情绪突变就分组）；单字/极短句尽量和相邻句合并以免太碎。
每组输出 {"ids":[...], "mood":"…", "tags":{"id":"[tag]"}}：
- mood：≤18个汉字，写这组的情绪和语气（如“慌张嘴硬地连声否认，越说越急”），禁止写“慢”“拖长”“一字一顿”；可写“停顿”“压低声音”“小声”。
- tags：可选，最多给组内情绪转折的句子各加一个控制标签放句首；台词里有“哼”“啧”可不加 [snorts]。宁缺毋滥，大部分句子不加。
只输出一个 JSON 数组（所有组按顺序），不要其它文字。"""
user=[]
for k,r in enumerate(runs):
    user.append(f"## 段{k}\n上下文：\n"+'\n'.join(r[-1]['ctx'])+"\n本段台词：\n"+'\n'.join(f"id={it['id']}：{it['speak']}（原导演备注：{it['dir']}）" for it in r[:-1]))
body={"model":"claude-sonnet-5","messages":[{"role":"system","content":SYS},{"role":"user","content":'\n\n'.join(user)}],"max_tokens":16000,"stream":True}
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
G=json.loads(txt); json.dump(G,open('groups.json','w'),ensure_ascii=False,indent=0)
ids=[i for g in G for i in g['ids']]; want=[it['id'] for r in runs for it in r[:-1]]
print(len(G), ids==want, set(want)-set(ids))
