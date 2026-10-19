from tts import tts
from concurrent.futures import ThreadPoolExecutor
V={
'A_经典傲娇':'十六岁少女，清亮偏高的声线，语速偏快，嘴硬心软，带着恼羞成怒的劲儿',
'B_大小姐傲娇':'十七岁大小姐，声线略低而优雅，咬字讲究，带点高傲的鼻音，骄矜又别扭',
'C_元气小傲娇':'十五岁娇小少女，软萌奶音，气鼓鼓地赌气，尾音上扬',
'D_冷淡系傲娇':'十七岁少女，清冷的中音，平静淡漠，害羞时会微微停顿、声音变小',
'E_毒舌傲娇':'十八岁少女，干脆利落的声线，略带一点沙哑，毒舌又藏着在意',
}
L=['哼，才、才不是特意等你的呢！别误会了！','笨蛋！谁、谁担心你了……只是刚好路过而已。','……谢谢。我只说一次，听到了没有？']
D=['不耐烦又掩饰害羞','慌张地反驳，后半句越说越小声','别过头，小声又别扭']
def one(k):
    d=V[k]; ref=f'tsun/{k}_1.wav'
    r=tts(f'{d}，{D[0]}，说：“{L[0]}”',ref,fmt='wav',seed=7); out=[r]
    for i in (1,2):
        out.append(tts(f'@voice1 {D[i]}，说：“{L[i]}”',f'tsun/{k}_{i+1}.wav',refs=[ref],fmt='wav',seed=7))
    return k,out
with ThreadPoolExecutor(5) as ex:
    for k,o in ex.map(one,V): print(k,[x[0] for x in o])
