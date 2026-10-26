# oneoff —— 一次性任务脚本

2026-10-26 作者源已迁至 `content/story/`。本目录中写死旧 `game.js`、旧下标/基线或旧采纳目标的脚本只作历史来源，不适配为新源写入工具，不得重跑。旧公共 `game_data.save` 也会拒绝回写本仓库作者地址；新采纳需求须独立面向分章格式实施。

这里的脚本都是**某一轮生产专用的**，跑完即完成使命，不再维护。留在仓库里是为了可追溯：知道某张图当时是怎么生成、怎么修、按什么顺序做的。

## 与上一层 `tools/` 的区别

| | `tools/` | `tools/oneoff/` |
|---|---|---|
| 性质 | 长期工具，反复使用 | 一次性，只服务某一批次 |
| 例子 | `check_full_regression.py`、`build_single_file_game.py`、`produce_art_upgrade.py` | `queue_art_review_round2.py`、`adopt_tail_skin_corrections.py` |
| 出问题要修吗 | 要 | 不用，直接照抄思路重写一个即可 |

## 怎么判断一个脚本该进这里

名字里带这些特征的基本都是：

- `queue_*` —— 生成某一轮的生图任务单
- 带 `round2` / `round3` —— 第二轮、第三轮评审
- 带 `opening` / `tail_skin` / `seated` / `writing_cg` —— 针对某个具体场景或部位的一次性修理
- `prepare_*` / `adopt_*` / `refine_*` / `rebuild_*` / `restore_*` —— 配合上面那些任务的准备与采纳脚本

## 运行注意

1. **必须在项目根目录执行**（`python tools/oneoff/xxx.py`），不要 `cd` 进本目录运行 —— 部分脚本用相对路径读 `A素材库/`。
2. 25 个脚本依赖上一层的模块（`produce_art_upgrade`、`compress_art_upgrade`、`stage_art_upgrade`、`build_art_catalog`），文件头部已自动加了两行 `sys.path` 修正；如果以后又移动目录结构，这两行要跟着改。
3. 少数脚本用 `Path(__file__).resolve().parents[2]` 定位项目根（因为本文件在 `tools/oneoff/` 里比原来深了一层）。

## 不要做的事

不要因为这些脚本"还能跑"就拿来复用。它们写死了当时的批次号、baseline 提交哈希、具体的素材 ID（比如 `BASELINE='33fba8eb...'`）。新的需求请写新脚本，放进上一层 `tools/`。
