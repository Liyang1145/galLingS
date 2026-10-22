# 角色卡格式

> 接口冻结文档（PLAN §7、§18 M0a）。机器可读定义：`schemas/card.schema.json`；语义校验：`server/cards/validate.py`；范例：`content/cards/whale.yaml`（鲸鱼小姐，原作卡）、`tests/fixtures/cards/cat.yaml`（测试用最小卡）。

## 1. 放在哪、怎么加载

- 内置卡：`content/cards/*.yaml|*.json`（只读）；玩家卡：`<data_dir>/cards/<id>.json`（建卡页保存，不能与内置卡同 id）。两处同 id 时内置优先；读不出来的坏卡跳过。
- 作者写 YAML，加载时转 JSON。启用前先按 Schema 校验（结构错误 = error），再跑语义规则（§4）。error 阻断启用，warn 只提示。
- 会话开局时整张卡写进事件日志头（`header.card`，回放据此建引擎），`card_hash` = 规范化 JSON 的 sha256 前 16 位。改卡后旧日志不能回放。

## 2. 字段

`*` 为 Schema 必填。

| 字段 | 类型 | 说明 / 谁在用 |
|---|---|---|
| `schema_version`* | `1` | |
| `id`* | `^[a-z0-9][a-z0-9_-]{1,40}$` | 卡 id（`/ws?card=`）。AI 填卡时会被清洗成合法 id |
| `locked_script` | bool，缺省 false | true = 原作卡：剧本台词用锁定原文，不经演绎层改写；false = 剧本台词由演绎层按本卡改写（`perform` 事件，`SAY.origin = performed`） |
| `identity`* | `{name*, name_en?, species*, role*, adult_anchor*}` | `name` 是显示名；`adult_anchor` 成年锚点（≥4 字，见 §4） |
| `appearance`* | 对象，值为字符串或数组，至少一项 | 外貌（提示词；图像生成预留的参考） |
| `personality`* | `{traits*[], laws*[], values*[]}`，各至少 1 条 | 性格、行为规律、不可演反的价值底线（提示词） |
| `speech`* | 见下 | 语言风格 |
| `speech.self_ref`* | 字符串数组，至少 1 个 | 自称 |
| `speech.endings`* | 字符串数组 | 句尾 |
| `speech.sentence_heads` `threats` `catchphrases` | 字符串数组 | 句首、威胁库、口癖（提示词） |
| `speech.metaphor_system` `action_markers` | 字符串 | 比喻体系、动作写法（提示词） |
| `speech.forbidden.checkable` | `[{pattern*, reason*}]` | 正则，**文本守卫逐句检查**（命中 → `text_verdict` 规则 `style.forbidden`，带原因重写） |
| `speech.forbidden.prose` | 字符串数组 | 只进提示词的禁用写法 |
| `honesty_signals`* | `[{id*, body_part*, action*, meaning*, intensity?}]`，至少 1 条（语义要求 ≥3） | 诚实信号（尾鳍）。`id` 为 `^[a-z][a-z0-9_]*$`；`meaning` ∈ `heart` `angry` `panic`；`intensity` 1–3。引擎只认卡表里的 `signal_id`（否则驳回 `unknown_signal`）；剧本里的 `※` 标记按 meaning 映射到本卡信号 |
| `address_system`* | `[{from*, to*, name*, stage_min*, stage_max*, unlock?}]`，至少 1 条 | 称呼。`from: heroine` 的条目决定她在各称呼阶段（`STATE.address_stage`）能怎么叫玩家；越期使用被守卫拦下（`address.too_early`） |
| `taboo`* | `{scale?[], reverse_scale_event?, no_comedy_topics?[]}` | 逆鳞部位；逆鳞事件（只能作剧情事件，模型说出即拦，`taboo.reverse_scale`）；禁语区话题（玩家提到时本轮切严肃模板） |
| `red_lines`* | 字符串数组 | 本卡追加的红线（只能收紧全局红线） |
| `hidden_layer` | 对象 | 隐藏设定（自由结构） |
| `slots`* | `{槽位名: 字符串}` | 剧本槽位的本卡取值（如 `treasured_object: 糍粑`）。章节 `slots[]` 要求的槽位必须填（§4） |
| `assets` | `{sprites?[], emotions?{}, emotion_valence?{}, live2d?, voice?}` | 立绘差分清单：引擎只接受清单里的差分（否则驳回 `unknown_sprite`），剧本差分不在清单里时演绎层就近替换；`emotions` 是 AI 回合 `say.emotion` 的枚举 → 差分（如 `{开心: 得意, 戒备: 警惕}`，值必须在 `sprites` 里；不写 = 每个差分名就是一个情绪），非法情绪被驳回（`emotion.invalid`）并回退默认差分；`emotion_valence` 给情绪标 -1/0/1，与 `mood` 方向冲突的回合在时间轴打标（不写按词表推断）；`live2d` / `voice` 预留，写 null |
| `stance_rules` | `[{id*, when?, match?, note?, hide?}]` | 确定性态度过滤（`server/memory/stance.py`）：召回之后、进提示词之前，按引擎状态给记忆条目加“她现在怎么看”的注记，`hide: true` 则不进提示词（理由进时间轴）。`when` 可写 `wound[]`（none / angry / dead / reconciled）、`provenance[]`（记忆来源）、`mood_min/max`、`stage_min/max`；`match` 为 `warm`（温暖类条目）、`any` 或关键词列表。卡里的规则先于通用规则表；不调模型、不改召回列表本身 |
| `style_examples`* | 字符串数组，至少 3 句（建议 ≥10） | 代表台词（提示词，前 16 句） |
| `build_record` | 对象 | 建卡页记录：原始描述、适配度提示 |

## 3. 最小例子

```yaml
schema_version: 1
id: cat
locked_script: true
identity: {name: 猫小姐, species: 猫族, role: 码头的常客, adult_anchor: 外表约 25 岁的成年女性}
appearance: {body: 修长, hair: 银灰短发, tail: 蓬松的猫尾}
personality: {traits: [傲娇], laws: [嘴硬心软], values: [从不拿亲密做交易]}
speech:
  self_ref: [本喵]
  endings: [喵, 呢]
  forbidden:
    checkable: [{pattern: "我是AI|语言模型", reason: 出戏}]
honesty_signals:
  - {id: heart, body_part: 尾巴尖, action: 勾一下, meaning: heart}
  - {id: angry, body_part: 尾巴, action: 拍打, meaning: angry}
  - {id: panic, body_part: 耳朵, action: 压平, meaning: panic}
address_system:
  - {from: heroine, to: player, name: 两脚兽, stage_min: 0, stage_max: 0}
  - {from: heroine, to: player, name: 主人, stage_min: 1, stage_max: 9}
taboo: {scale: [耳朵], reverse_scale_event: 离家出走, no_comedy_topics: [离家出走]}
red_lines: [幼态化表述]
slots: {treasured_object: 鱼干}
assets: {sprites: [默认, 警惕, 得意]}
style_examples: [哼。, 两脚兽，看什么看。, 本喵才没有等你。]
```

完整写法（含注释）见 `content/cards/whale.yaml`。

## 4. 语义校验（`server/cards/validate.py`）

Schema 通过后才跑：

| 级别 | 规则 |
|---|---|
| error | `identity.adult_anchor` 必须写明“成年”或 ≥18 的岁数；出现 <18 的岁数即错 |
| error | 全卡（除 `red_lines`、`build_record`）出现幼态化表述（萝莉 / 幼女 / 小女孩 / 未成年 / 少女 / loli） |
| error | `honesty_signals` 少于 3 条；信号 id 重复 |
| warn | 缺 `heart` / `angry` / `panic` 某一类信号 |
| error | `address_system` 没有 `stage_min = 0` 的初遇称呼；某条 `stage_min > stage_max` |
| error | `speech.forbidden.checkable` 的正则写不对 |
| warn | `style_examples` 少于 10 句 |
| error | 当前章节 `slots[]` 要求的槽位在卡里没填 |
| error | `assets.emotions` 映射到不在 `sprites` 里的差分；`stance_rules` 的 id 重复、`mood_min > mood_max` 或 `stage_min > stage_max` |
| warn | `stance_rules` 某条既没有 `note` 也不 `hide` |
| warn | 人设-剧本适配度：章节 `scene_tags` 与人设冲突（如浅滩场景 vs 怕水），永不阻断 |

## 5. 建卡页（`/cards.html`）

描述 → `POST /api/cards/generate`（AI 按模板填卡，强制 `locked_script: false`、清洗 id、写 `build_record`）→ 字段编辑 → `POST /api/cards/validate`（返回 `findings[{level, field, message}]`）→ `POST /api/cards` 保存（有 error 拒绝）。
