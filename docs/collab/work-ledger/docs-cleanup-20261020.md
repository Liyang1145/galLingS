# 全仓文档整理 + 待办 B08 登记（2026-10-20）

- 负责人：Hark（音乐负责人 @Liyang1145 授权整理全部文档）
- 分支：`fix/character-performance`，基线 1e60e76；main（f336b35）未动
- 范围：只改文档（`.md`）并新增文档检查脚本 `tools/check_md_links.py`；不改代码、数据、JSON 清单，不碰 `content/imports/vnstudio/`（也就不会触发 playtest-html / android workflow）
- 对齐的事实源：[Hark 会话交接 20261020](../handoff/Hark会话交接_20261020.md)、[工作流速查](../工作流速查.md)，以及用户 10-20 00:39 补充：仓库已公开

## 1. 盘点结论

| 文档 | 用途 | 问题 | 处理 |
|---|---|---|---|
| `README.md` | 仓库入口 | 现状停在 10-19；单文件 workflow 写成“自动生成”；入口顺序未含交接 | 现状改 10-20；workflow 标暂停；入口链改为 README → docs/README → 接手说明 / 工作流速查 / 交接 / 待办 / 决策；授权段加“公开仓库不提交密钥和私人信息” |
| `AGENTS.md` | agent 开工入口 | 先读列表无交接；缺 main 现状、L01 尾巴、workflow 暂停 | 补齐，加 `check_md_links.py` |
| `docs/README.md` | 文档索引 | 缺交接、历史文件逐一列出、审查报告直链、其他目录 README | 重写为完整索引 |
| `docs/collab/接手说明.md` | 现行指令 | 鲸尾标准仍写“照 C05”（与交接 L01 矛盾）；缺“不移植像素”“图片先验收”；main 现状过时；推送做法未指向 tools/hark | 10-19 版存档为 `handoff/接手说明_20261019_历史.md`，现行版按交接重写，C05 标准在原处标“历史” |
| `docs/collab/待办总表.md` | 待办 | 已完成与未完成混排；N04/R12、S06/R13、A05/A22/A29/A32、D03/2752 单文件重复；C02 远端状态过时（608093d）；缺交接第 7 节多项 | 10-19 版存档为 `handoff/待办总表_20261019_历史.md`；现行版：基线对齐交接；未完成按章节，已完成移入文末「已完成」；合并重复；新增 B08、C05、C06、C07、M08、U10、R15、A42–A46 |
| `docs/collab/工作流速查.md` | 操作手册 | workflow 写成在用；“公开仓库内容”列为待拍板 | workflow 标暂停（待办 C06）；main 现状、tools/hark、sunburst、链接检查补入；“公开仓库内容”改为已公开 + 不提交密钥提醒 |
| `docs/collab/handoff/Hark会话交接_20261020.md` | 最新交接（事实源） | “最新提交 a634d41”是写作时状态 | 只补两行：仓库已公开提醒、提交头以 git log 为准；第 7 节加 B08 指引。规则内容未改 |
| `docs/decisions.md` | 决策 | 第 43 条 C05 标准无后续；10-19/20 决定未记 | 43 条标“历史”；新增 49–52（L01 + 不移植像素、图片先验收、workflow 暂停、10-19 配乐修订）；第 34 条小节标题注明已被第 40 条改为公开 |
| `docs/content/music-progress.md` | 音乐进度 | 10-18 说家居曲用于店内，10-19 已退出营业段 | 顶部加 10-19 现行说明，10-18 段标“历史，部分被取代” |
| `tools/README.md` | 脚本索引 | workflow 写成在用 | 标暂停；加入 `check_md_links.py` |
| `docs/collab/work-ledger/README.md` | 记录索引 | 缺 `chapter1-cg-animations-20261019.md`、`atri-music-v11-cues.csv`、`_template.md`、本记录 | 补齐；`tail-unify-c05` 标“历史，现行基准 L01” |
| work-ledger 中写“当前私有仓库 / 私有附件”的记录（coordination-setup、repo-consolidation、art-editor-library、boliyer-galagent-integration、handoff-assets、local-scene-audio-assembly、desktop-package、whale-ui-fades、_template） | 历史记录 | 现在仓库已公开 | 原文保留，加“（当时为私有；2026-10-16 起已公开）”注；模板改为“Release 附件（公开，不放密钥或私人资料）” |
| `docs/collab/handoff/仓库盘点_20261014_历史.md`、`共享台账_20261017_历史.md`、`archive/deliveries/larry-vn/README.md`、`archive/deliveries/local-assembly/Atri音乐协作.md` | 历史 | “私有附件 / 私有仓库”说法 | 原处加注“仓库已公开” |
| `archive/deliveries/local-assembly/缺失音效表.md` | 交付记录 | 断链 `../gal-polish/尾巴音效审核.md`（文件从未入库） | 去掉失效链接，文字保留并注明 |
| 其余（PLAN、protocol、script-syntax、card-format、design/*、content/*、audit/*、其他 work-ledger、archive/*、tests/*、tools/voice-pipeline） | 设计 / 历史依据 | 已自带日期或“历史”标注，未发现与交接矛盾的现行说法 | 未改 |

未处理（有意）：`content/imports/vnstudio/README.md` 第 8 行写“纳入私有仓库”，该路径在作品目录下，改动会触发 playtest-html 与 android workflow，按约定不动，留待用户决定 workflow 去留后再改。

## 2. 挪动与删除
- 新增历史存档（复制原文后再改现行版）：`docs/collab/handoff/接手说明_20261019_历史.md`、`docs/collab/handoff/待办总表_20261019_历史.md`。
- 删除：无。
- 新增：本记录、`tools/check_md_links.py`。

## 3. 统一后的口径（与交接一致）
- 尾巴一律对齐 L01，用 Image2.5 双图编辑重画，不移植像素；C05 标准为历史。
- 工作分支 `fix/character-performance`；main 停在 f336b35，合并提交先问用户。
- 图片改动先出候选给用户验收，确认后才推。
- 单文件自动构建 workflow 已暂停，删不删先问用户。
- 仓库已公开：不提交密钥、令牌或用户私人信息；内容授权仍未定。

## 4. 待办新增 B08
结局后没有进入 galagent（AI 模式 / 后端 AI 续写）的入口。来源：玩家群管理员，2026-10-20；复现 #3002 第十六话结局卡「— 退潮之后 —」只有「返回标题」。定位线索写在[待办总表](../待办总表.md)第六节：结局卡按钮只来自插件 `addEndingButton`，GalAgent 插件只在托管模式（`/vn.html` + `?host=gallings`，`HOSTED`）由 `/api/vn/plugins` 注入，离线 `游玩.html` / 单文件 / APK 都没有入口；标题菜单也没有 AI 入口。只记录，未修。

## 5. 检查结果
- 链接检查：整理前（1e60e76）全部 `.md` 共 500 条相对链接，断链 1 条（`archive/deliveries/local-assembly/缺失音效表.md -> ../gal-polish/尾巴音效审核.md`）；整理后共 557 条，**断链 0 条**（同一逻辑的 `tools/check_md_links.py`，跳过外链、锚点、代码块和作品目录）。
- 疑似密钥 / 令牌扫描：在全部 `.md`、`docs/` 与 `archive/` 下的 json/csv/txt/html、`config*.yaml`、`tools/hark/`、`tools/voice-pipeline/` 主要脚本中按 `sk-`、`ghp_`/`github_pat_`、`AKIA`、`LTAI`、`AIza`、JWT、私钥头、`api_key/token/secret/password = 长串` 等模式扫描，**未发现**真实密钥或令牌（只有 `sk-...` 占位符和“key 走环境变量”的说明）。
