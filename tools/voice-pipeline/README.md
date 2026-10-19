# 配音工作流（鲸鱼小姐 / NPC）

这里是《海风与布丁》角色配音在 Hark 会话里用到的脚本和中间数据（2026-10-16 ～ 10-19）。**不含任何密钥**：调用阿里云 / Rinko 时，key 是运行环境在网络层自动注入的，脚本里只写了接口地址。自己跑的话，需要在请求头补上 `Authorization: Bearer <你的 key>`。

不含音频文件（raw/、mp3/、各种打包结果都不在仓库里）。

## 两代方案

### 第一代（已接入仓库 fee2949，530/1525 句）
- 模型：Qwen-Audio-3.1-TTS-Next（dashscope.aliyuncs.com，按量计费 key）。音色用声音设计生成参考音频后复刻。
- `annotate*.py`：用 Claude 给每句台词写「speak 文本 + 表演指示」。
- `tts.py` / `asr.py` / `gen.py`：合成，再用 qwen omni 转写校对（相似度 ≥0.88），可以中断后续跑，结果写到 results.jsonl。
- `integrate.py`：写入 `assets/vo/<lineid>.mp3`、game.js 的 `line.voice`、`content/audio/voice-over.json`。

### 第二代（新音色，用户 2026-10-18 选定）
- 模型：`qwen-audio-3.0-tts-plus`，走 Token Plan 端点，没有 ASR，也没有复刻。
- 鲸鱼小姐：voice `qwen-audio-3.0-tts-plus-longcanruishuang`，pitch 1.0，rate 1.1。
- instruction = 固定身份前缀「嗓音再圆润成熟一点，像二十岁左右的甜萌动漫女声，日系动画女主的配音腔，甜美清透不尖锐，」+ 情绪（≤18 字）+「，音量适中，语速轻快自然，音色保持一致」。
  - 情绪词只用嘴硬、带刺、嫌弃、小声、认真这一类。不写拔高、大声、急、慌、爆发，也不用 [angry]/[shouting] 标签。生气的句子用"甜笑着扎刺"的毒舌感。
  - 耳语腔不算问题。
- 老奶奶：`qwen-audio-3.0-tts-plus-longyiqinghui`（慈祥祖母音），rate 1.0。
- 音色挑选：`tsun.py`、`tsun3/gen*.py`（几批音色对比）。

#### 第二代流程（v2/）
1. `gamelines.json`：把 game.js 的台词按顺序摊平，idx 对应试玩账本里的行号（idx→id/说话人/台词/voice）。
2. 写情绪：`direct*.py` / `game2/direct.py` 用 Claude 给每句写安全的情绪词，得到 moods.json。
3. 合成：前 200 句用 `gen9.py` / `gen10.py`（几句连在一起合成，再按静音切开）；后来改成每句单独合成，每句 3～6 个候选（`ch1/`、`game1/`、`game2/gen.py`）。
4. 校对：用 gemini 转写，和台词比相似度，≥0.9 才算合格，同时要求语速在 1.8～7.5 字/秒。
5. 选音：`pick.py` 在合格候选里，用 `fix5152/mf.py` 的粗略频谱距离，挑最接近基准音色的那条。resemblyzer 声纹（`spk.py`）效果更好，但装 torch 会把内存撑爆。
6. 打包：`game3/pack.py` 输出全量包，内容有：语音、按章节连听、清单.csv、试玩反馈处理表.csv。
7. 串句检查：`recheck.py` 把全部句子重新转写一遍，看转写里有没有混进相邻句的字。

#### 坑
- 同样的文本加同样的指令，接口会返回同一段音频。想要多个候选，得稍微改一下指令。
- instruction 大约有 100 字符的上限，太长时后面的情绪词可能被截掉。
- 极短句（怪你、等等、喂、……手）单独合成经常念错。办法是和上一句或下一句连着合成，再按静音切开（见 `game2/hand.py`）。
- 句首的「……」可能被念成"呃/哎"，必要时把它去掉。
- 偶尔会报 `upstream request failed`，脚本会自动重试。

## 当前状态（2026-10-19）
- 第一到七话鲸鱼小姐共 568 句、老奶奶 14 句，已经配成新音色，并以 zip 交付。**还没写入游戏仓库的 assets。**
- 第八话以后还是第一代音色。
