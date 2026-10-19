# 剧本 Markdown 语法

> 接口冻结文档（PLAN §6、§18 M0a）。实现：`compiler/compile.py`；例子：`tests/fixtures/mini/mini.md` + `beats.yaml`（2 个选项点、2 次汇合、1 个存档点）。
> 产物格式：`schemas/op.schema.json`（Markdown 剧本那一支）。本文按编译器的真实行为写；与 PLAN 不同的地方在 §6 列出。

## 1. 一章由什么组成

一个章节目录 = 一个剧本 `.md`（除 `report.md`、`README.md` 外恰好一个）+ `beats.yaml`，可选附录 E（制作 ID 登记表）：

```
python -m compiler content/scripts/ch01 [--appendix 附录E.md]
```

写出 `chapter.json`（键排序、无时间戳，两次编译字节一致；`content_hash` = 产物 sha256 前 16 位）和 `report.md`（编译校验报告）。运行时 `server/content.py` 在源稿比 `chapter.json` 新时自动重编（附录 E 取章节目录上一级的 `appendix_e.md`）。

剧本是**节拍层**（与角色无关的剧情骨架），`beats.yaml` 补上编译器从正文里读不出来的东西：选项点的 ID 与性质、尾鳍标记映射哪个诚实信号、哪些字面量是角色槽位。

## 2. 逐行规则

编译器逐行读，先 `strip()`。下列行直接跳过：空行、`>` 开头（引用 / 注释）、`#` 开头（标题）、`---`。

### 2.1 横线块（场景头）

由一行 3 个以上 `━` 开始，再一行 `━` 结束；块里是标签行，一个标签的内容可以续写到下一行（直接拼接）：

```
━━━━━━━━━━━━━━━━━━
【场景】码头 · 清晨
【BGM】海浪
【立绘】猫小姐（警惕）
━━━━━━━━━━━━━━━━━━
```

块结束时按**固定顺序**产出 OP（与标签书写顺序无关）：

| 标签 | 产出 | 说明 |
|---|---|---|
| `【场景】地点 · 时间` | 先收拢未结束的分支，再 `SCENE{id:"地点·时间", bg:地点, time:时间}` | 按 `·` / `・` 切分 |
| `【事件】名字` | 先收拢分支，再 `SCENE{id:名字, bg:"", time:"", event:名字}` | 分支后的公共段落（如“糍粑事件”） |
| `【BGM】曲名` | `BGM{id:曲名, fade_in:1000, fade_out:1000}` | |
| `【立绘】名字（差分）` | `SPRITE{card:"heroine", expr:差分, pos:"center", kind:"static"}` | 没写括号 → `expr:"默认"`；写 `——` 或留空 → `expr:null`（退场） |
| `【CG预留】描述` | `CG{id, desc}` | id 按出现顺序取附录 E 里第一话的 `CG-xx`；不够时临时编号 `<chapter_id>.cg.<n>` 并报警 |

开块的那一行 `━` 还会先结算挂起的选项点（见 2.3）。`【第X话完】` 写在横线块里时视为本章结束，该块不需要闭合。

### 2.2 正文台词

| 写法 | 产出 SAY | 说明 |
|---|---|---|
| `旁白：文字` | `speaker:"narrator", layer:"narration", origin:"script"` | |
| `我：「文字」` | `speaker:"player", layer:"line", origin:"script"` | |
| `<女主名>「文字」` | `speaker:"heroine", layer:"line", origin:"locked", hash` | 女主名取 `beats.yaml` 的 `heroine_name_in_script`；名字后不是 `「…」` 时编译失败。`hash` = 文本 sha256 前 16 位（运行时锁定台词校验） |
| `（动作描写）` | `speaker:"narrator", layer:"action", origin:"script"` | 文本保留括号 |

每条 SAY 带 `voice:null`（TTS 预留）、`src:"<文件名>:<行号>"`；文本里出现 `beats.yaml` 某个槽位字面量时加 `slots:[槽位名…]`（换卡时演绎层替换）。

### 2.3 选项与分支

```
（选项）
A 「抱歉。」
B （默默接过）

——A线——
猫小姐「哼，还算懂礼貌。」
◆好感度+3

——B线（作死线）——
猫小姐「……你说什么？」
（→ 进"糍粑事件"）

——汇合——
```

| 写法 | 含义 |
|---|---|
| `（选项）` | 开一个选项点。之后连续的 `字母 「文字」` 或 `字母 （文字）` 行是选项（字母 A–Z）；第一条非选项行出现时结算 |
| 结算 | 依次取 `beats.yaml` 的下一个 `choices[]`，产出 `BEAT{beat_id, purpose, emotion_target}` + `CHOICE{id, beat_id, options, default_line}`。选项 `id = <choice id>.<字母>`，`label` 为引号内文字（括号写法保留括号），`nature` 取 `natures[字母]`，缺省 `诚实笨拙`；`default_line` = 这之前女主最后一句锁定台词（AI 失败时的默认衔接） |
| `——A线——` / `——A线（注释）——` | 分支 A 从这里开始（选项的 `target`）。开新分支时，上一个没收尾的分支自动补一条跳到汇合点的 `JUMP` |
| `（→ 任意文字）` | 当前分支到此结束：`JUMP` 到汇合点 |
| `——任意文字汇合——` | 汇合点 `MERGE{id:"merge:<choice id>"}`；所有未收尾分支跳到这里 |

`【场景】`、`【事件】`、`【第X话完】` 也会隐式收拢分支（生成汇合点）。分支里出现在 `——X线——` 之前没有选项、或字母不在选项里，编译失败。

### 2.4 状态标记

| 写法 | 产出 | 说明 |
|---|---|---|
| `◆好感度+3` / `◆好感度-4（理由）` | `AFFECT{surface, inner:null, reason, source:"script"}` | `inner:null` = 与表层相同 |
| `※描述` | `TAIL{signal_id, count, desc, noticed:false, source:"script"}` | `signal_id` 取 `tail_signals` 里第一个 `match` 是描述子串的条目；都不匹配 → `heart` 并报警。`×N` 写拍水次数（`count`），分析时一个标记只算一次“出卖” |

### 2.5 章末

| 写法 | 产出 |
|---|---|
| `【第X话完】` | 收拢分支，本章正文结束；之后只认 `存档点：` 和 `本章收集` 两种行 |
| `存档点：名字` | `SAVEPOINT{id, name}` + `END{ending_id:"<chapter_id>.end", kind:"chapter"}`。id 按名字查附录 E 的 `SP-xx`；没登记 → `ch01.save.1` 并报警 |
| `本章收集…` | 忽略（给人看的） |

其余任何写法都是编译错误（`第 N 行：未识别的写法`）。

## 3. `beats.yaml`

```yaml
chapter_id: mini
title: 码头上的猫
heroine_name_in_script: 猫小姐
declared_affection_range: [-4, 5]   # 剧本声明的整章好感区间，与可达区间不等即报警
ai_tail_max: 1                      # AI 本章最多出卖几次尾鳍（rules.ai_tail_max，缺省 1）
tail_total_max: 2                   # 剧本 + AI 尾鳍总上限（缺省 5）
choices:                            # 按剧本里出现的顺序一一对应，数量必须相等
  - {id: mini.choice.1, beat: mini.beat.shadow, purpose: 初遇试探, emotion_target: 警惕 → 放松, natures: {A: 顺毛, B: 作死}}
tail_signals:                       # ※ 描述 → 诚实信号
  - {match: 勾, signal: heart, meaning: heart}
slots:                              # 剧本里与角色绑定的字面量（建卡校验 / 换卡演绎）
  - {literal: 鱼干, slot: treasured_object, type: object}
scene_tags: [码头, 清晨]            # 人设-剧本适配度检查用
```

`declared_tail_total` 等其它键目前编译器不读。

## 4. 产物

```jsonc
{"schema_version":1,"compiler_version":"0.1.0","chapter_id":"mini","title":"码头上的猫",
 "program":[ /* 扁平 OP 程序，JUMP / CHOICE 的 target 已解析成 pc 下标 */ ],
 "rules":{"affection_range":[-4,5],"ai_tail_max":1,"tail_total_max":2,"step_clamp":5,"excursion_net_max":3,"ai_rounds_max":3},
 "analysis":{"affection":[-4,5],"tails":[1,1],"rem":{"6":[-4,5]},"unreachable":[],"dead_ends":[]},
 "slots":[{"literal":"鱼干","slot":"treasured_object","type":"object","uses":1}],
 "scene_tags":["码头","清晨"],"warnings":["…"],"content_hash":"a969c1e9cbda5cf7"}
```

- `analysis` 是对剧情图做的动态规划：整章好感 / 尾鳍可达区间、每个 `CHOICE` / `MERGE` 之后剧本还能给出的好感 `[最小, 最大]`（`rem`，运行时好感预算用，PLAN §8.2）、不可达 OP、走不到结尾的 OP。剧情图有环时编译失败。
- `warnings` 进 `report.md`：附录 E 未登记的 ID、无法映射的尾鳍、可达区间与声明不符、不可达 / 死路。

## 5. 另一种来源：VN Studio 导入

VN Studio 导出的 `game.js`（`window.VN_GAME = {...}`）经 `compiler/vnstudio.py` 变成同一种 OP 程序（`format: "gallings.chapter/1"`），句子 ID 原样保留在 `SAY.id` 与 `src: "vn:<ID>"`。映射：`chapter`→`CHAPTER`、背景变化→`SCENE`、`bgm` 变化→`BGM`、`set`→`SET`（`好感`→`affection`、`尾鳍`→`tails`，其余进通用变量）、说话 / 空句→`SAY`（空句 `pause:true`，女主台词锁定带哈希）、`choices`→`CHOICE`（选项 `set` / `cond`，限时写进 `timeout`）、`ending`→`END{kind:"ending"}`、`jump` / `jumpIf`→`JUMP` / `JUMP_IF`、文件末尾→`END{ending_id:"script_end"}`。变量修改语法 `名 += 2; 名 = 0`，条件语法 `名 >= 3 && 名2 == 0`。

## 6. 与 PLAN §6.5 的差异（以代码为准）

- 实际产出的 OP：`SCENE BGM SPRITE SAY BEAT CHOICE AFFECT TAIL JUMP MERGE SAVEPOINT END CG`（Markdown）与 `CHAPTER SCENE BGM SET SAY CHOICE JUMP JUMP_IF END`（VN Studio）。
- PLAN 里的 `SFX` `INPUT` `AI_TURN` `BRANCH_IF` `FRAGMENT` 编译器不产出；`FLAG` `CALL` 引擎已实现但编译器不产出；条件跳转叫 `JUMP_IF`（cond 为 `[{var,cmp,value}]`），不叫 `BRANCH_IF`。
- `END` 由剧本的存档点行产出（`kind:"chapter"`），不是导演发出。
- AI 回合不是 OP：选项点（`CHOICE`）在 AI 模式下同时开放输入框，由会话发起回合。
