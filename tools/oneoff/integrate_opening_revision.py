"""Apply the music owner's revised first chapter without changing later line IDs."""
import copy
import hashlib
import json
from pathlib import Path
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parents[1]))  # tools/

import game_data
from stage_art_upgrade import project
from produce_art_upgrade import ROOT, GAME

def apply():
    path=GAME/'game.js';p=project(path)
    if p.get('openingRevision'):raise ValueError('Already applied; review further changes explicitly')
    before=copy.deepcopy(p);lines=p['lines'];first={i:l for i,l in enumerate(lines[:160])}
    archive=ROOT/'A素材库/归档/deliveries/opening-revision'
    archive.mkdir(parents=True,exist_ok=True)
    assert not (archive/'before-game.js').exists()
    (archive/'before-game.js').write_bytes(path.read_bytes())
    changes={
        5:'手里还死死抱着一个……呃……似乎很重要的……笔记本？',
        7:'最后的记忆，……好像是……是坐在屏幕前对着大肥鱼敲了50天的字。',
        10:'凉凉的。滑滑的。似乎还带着一点鳞片的纹路。',
        12:'「——！！」',15:'被拍得横着飞出去三米多远，结结实实喝了一大口海水。',
        23:'（尾鳍拍水两下。）',
        24:'「喂！你这家伙，碰到了别人不知道道歉么！」',25:'「真是没礼貌。」',
        31:'第二记尾击。这次的力道更重。',32:'（尾鳍拍水五下。）',
        33:'她翻开潮湿笔记本，扫了一眼里面密密麻麻的字。',
        44:'她把笔记本抛回给你。刚好落进怀里。',
        49:'笔记本以一个完美的抛物线飞向深水区……快去捡回来！',
        50:'我扑过去捞了回来。呛了三口水。',
        54:'「人类，太贪心是会被淹死的。」',
        55:'她转身要走。蓝黑色的长发在水里铺开，像一小片退潮前的夜。',
        66:'「顺便！懂吗，顺便！」',68:'你低头看了一眼。',
        70:'「那是水流！海流懂不懂！」',71:'（尾鳍慌乱甩圈。此地无银。）',
        81:'——以及我正在用衣角一页页吸干的笔记本上。',
        89:'「生命，或者说智能的原理，究竟是什么。」',
        96:'（嘴上嫌弃，耳朵红了。）',
        100:'她真的来抢了。抢过去翻了五秒钟。',
        105:'小的那一半——塞进我手里。',110:'她抢在你问出口之前凶巴巴地宣布。',
        117:'「深海的！海鸥带过来的！」',
        128:'「……吃完就走啊。还愣着干嘛。」',
        133:'……她愣住。',137:'天青色的眼睛里，有什么飞快地转了一圈——',
        143:'蓝黑色的长发在水面上留下一道弧线，很快消失了。',
        150:'这附近没有什么住户。当然……海鸥也不会生火。',
        151:'',152:'',153:'你低头，在笔记本的日期下面，补了一行小字。',
        154:'『今日验证：智能的最小单元之外，似乎还需要一个“价值观”单元。』',
        155:'',
    }
    for i,text in changes.items():first[i]['text']=text
    first[12]['speaker']='???'
    first[18]['speaker']=first[19]['speaker']='鲸鱼小姐'
    first[22].update(text='（尾鳍拍水两下。）',speaker='',seEvents=[{'id':'sfx_tail_water_double','gain':.6}])
    first[23].update(text='「尾巴尖。也不行。」',speaker='鲸鱼小姐',seEvents=[])
    first[25].update(text='（尾鳍拍水两下。）',speaker='',seEvents=[{'id':'sfx_tail_water_double','gain':.6}])
    first[26].update(text='「真是没礼貌。」',speaker='鲸鱼小姐',seEvents=[])
    first[20]['choices'][1].update(text='「沉默」',set='好感 -= 10')
    first[113]['choices'][2]['set']='好感 -= 1'
    first[32]['seEvents']=[{'id':'sfx_tail_water_double','gain':.6},
        {'id':'sfx_tail_water_double','gain':.6,'delayMs':2400},
        {'id':'sfx_tail_water_light','gain':.6,'delayMs':4800}]
    # A physical five-hit reaction still counts as ONE tail-revealed emotion signal.
    first[32]['motionCount']=5
    additions={}
    def insert_after(index,key,text,speaker=''):
        line=copy.deepcopy(first[index])
        line.update(id=key,text=text,speaker=speaker,label='',chapter='',jump='',jumpIf='',set='',choices=[],se=None,seEvents=[],wait=0,voice=None)
        # Borrow staging, not dialogue-specific AI/audio-entry instructions.
        line['agent']=None
        additions.setdefault(index,[]).append(line)
    insert_after(16,'opening_notebook_cry','不！！！！！！！！','我')
    insert_after(16,'opening_notebook_pause','在那——')
    insert_after(17,'opening_mysterious_rescuer','你看着眼前这个似乎是罪魁祸首，又似乎是……救命恩人的家伙。')
    insert_after(21,'opening_tail_warning','「鲸鱼的尾巴摸不得。」','鲸鱼小姐')
    insert_after(31,'opening_second_hit_rebuke','「流氓！」','鲸鱼小姐')
    insert_after(37,'opening_notebook_importance','对呀！重要！为什么重要！快想想！快……')
    insert_after(49,'opening_retrieve_notebook','你的心里如是说。')
    rebuilt=[]
    for i,line in enumerate(lines):rebuilt.append(line);rebuilt.extend(additions.get(i,[]))
    p['lines']=rebuilt
    # Initial staging is noon, never the dawn placeholder.
    noon=next(a['id'] for a in p['assets'].values() if a.get('name')=='浅滩_正午')
    for i in range(2,18):first[i]['bg']=noon
    # Bypass removed evidence while retaining IDs for old saves and source history.
    for i in (151,152,155):first[i].update(wait=0,se=None,seEvents=[],agent=None)
    first[150]['jump']='c1new_diary_note';first[153]['label']='c1new_diary_note'
    first[154]['jump']='c1new_diary_coda';first[156]['label']='c1new_diary_coda'
    assert before['lines'][160:]==p['lines'][167:]
    assert len({l['id'] for l in rebuilt})==len(rebuilt)
    p['openingRevision']={'date':'2026-10-15','author':'音乐负责人提供的新文案',
        'retainedOriginalIds':True,'addedIds':[l['id'] for v in additions.values() for l in v],
        'retiredTextIds':[first[i]['id'] for i in (151,152,155)],
        'sourceBeforeSha256':hashlib.sha256((archive/'before-game.js').read_bytes()).hexdigest(),
        'editorialNormalizations':['衣负 → 衣角；统一引号和省略号；删除孤立（）占位符；在那补停顿破折号'],
        'continuityGap':'第一话敲字50天与第六话旧回忆15天有差异，其他章节原文保留待人工统一。'}
    game_data.save(path, p)
    source=ROOT/'docs/content/opening-revision-20261015.md'
    paragraphs=['# 第一话：音乐负责人新文案接入稿','',
        '用户于2026-10-15提供。下面为实际接入稿，保留原选项/汇合ID，仅作上述轻微标点与错字整理。原运行稿完整留档，后续十五话及两篇番外不改写。',
        '', '## 已执行与待人工统一', '',
        '- 第一组选项B“沉默”扣10好感；糍粑选项C扣1好感。',
        '- 作死线五次尾鳍拍水采用现有真实双拍片段两次、轻拍一次，延迟播放，切句取消未发生的拍水；尾鳍情绪信号仍只计一次。',
        '- 新开场50天与第六话15天冲突留待人工统一。',
        '- 原文“衣负”按“衣角”接入；“在那”保留为停顿；删除孤立（）编辑占位。',
        '- 结尾烤鱿鱼CG须无人、无蓝黑丝线，不提前揭示送礼者。','', '## 接入文本','']
    for l in rebuilt[2:167]:
        if l.get('label'):paragraphs+=['',f"【定位 {l['label']} · {l['id']}】"]
        if l['text']:paragraphs+=[(l.get('speaker') or '旁白')+'：'+l['text'],'']
        for n,c in enumerate(l.get('choices',[])):
            paragraphs += [f"{chr(65+n)} {c['text']} → {c['target']}；{c.get('set') or '无好感变化'}"]
    source.write_text('\n'.join(paragraphs)+'\n',encoding='utf-8')
    print(json.dumps({'lines':len(rebuilt),'added':len(rebuilt)-len(before['lines']),'laterChaptersUnchanged':True}))

if __name__=='__main__':apply()
