# Larry 最新完整游戏交付

音乐负责人于2026-10-13提供 `海风与布丁_全16话+番外+音效_游戏.zip`，明确要求代 Larry 提交。检查时新、旧仓库均无开放PR，Larry分支没有更新的完整包，所以采用这份交付。

原ZIP保存在[私有附件](https://github.com/Liyang1145/galLingS/releases/download/workspace-20261012/larry-complete-game.zip)。附件复用原有交接发布容器；该ZIP是本次Larry交付，不表示它属于此前Live2D/RenPy快照。没有创建新版本号。

可运行目录为 [content/vn/海风与布丁](../../vn/海风与布丁/)，入口 `index.html`。双击可独立运行，也可通过 galLingS 的 `/vn.html` 加载。原包中的单文件HTML仍保留在原ZIP里，避免在Git重复保存嵌入的整套素材。

含16话+2篇番外、3308句、57张背景/CG、26张立绘、52份音效。游戏目录137个文件原样保存，逐文件大小和SHA-256见 [manifest.json](manifest.json)。没有覆写作者的图、音效、剧情或接口，也没有自动把之前代理的本地整合套进去。

这份导出原生提供 `VNHost` 和 `vamb` 环境音音量；仍需正式对接《翡翠之梦》主曲，核对界面提示声、尾巴情绪音和混音。作者文件没有配乐资产，音效元数据 `dur` 为0，不表示实际音频时长为0。听感验收、同源后端/手账连接和新旧存档迁移不在“文件已交付”声明里。

## 后续素材融合（2026-10-13）

用户后续明确要求提交全部本地成果，运行目录现已接入背景、主曲及音效，见 [任务记录](../../../docs/work-ledger/local-scene-audio-assembly.md)。上文描述本次原始交付，不再代表当前运行文件逐字未改。

原ZIP与137项清单保留；原始 `game.js`、`index.html` 位于 [original-overridden-files](original-overridden-files/)，其他135项原始文件继续保存在运行目录。按此取源复核，137项SHA全部匹配原清单。当前融合验证与原件验核分开，不命名发行版本。
