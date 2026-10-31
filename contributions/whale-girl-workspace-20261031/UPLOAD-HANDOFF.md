# GALgame 工作区完整交接快照

更新：2026-10-12（Asia/Shanghai）。本次按用户要求暂停制作并上传当前工作区；这是制作中快照，不是已完成的 Live2D 或游戏发行。

## 从哪里开始

1. 读本文件、`HANDOFF-LIVE2D.md` 和 `output/whale-girl-live2d-base/PLAN-v6.md`。
2. 在 Cubism Editor 5.3.04 打开 `output/whale-girl-live2d-base/whale-girl-face-refinement-v6.cmo3`。
3. 以 `output/whale-girl-live2d-base/user-target-face-v6.jpg` 为最新美术目标。用户已重新要求修改眼睛；旧的“眼睛冻结”意见不再适用。
4. 完整目录（含 SDK、发行包、历史模型、依赖来源与旧项目）见同仓库 Release 的 `galgame-workspace-sanitized.zip`。分支中的可直接浏览副本在 `contributions/galgame-demo-20261012/`。
5. 以 `WORKSPACE-MANIFEST.json` 检查完整包的逐文件 SHA-256，查看 `PRIVACY-REPORT.json` 的排除与清理范围。

## 最新模型的确切状态

- 权威源：`whale-girl-face-refinement-v6.cmo3`，9,055,673 字节，2026-10-11 23:59:11 保存。配套回退源：`whale-girl-thin-mouth-checkpoint-v6.cmo3`。
- 双眼默认 Open=1 的上睑已收敛，眼角过渡已微调。Editor 分别观察了两眼 0 / 0.5 / 1，没有明显残白或虹膜溢出；仍需连续动画、角度组合、Core 和 Viewer 验证。
- 下巴缩短、扩圆后又修顺底部局部起伏。仍需对照目标图检查整脸比例与头颈衔接。
- 新嘴 `MouthClosed_v6` / `MouthOpen_v6` 共用 `Rotation4`，倍率 5.5%，父级 `Head_Turn`。旧嘴保留并隐藏。
- 新薄口缘原画为 `layers/mouth-open-thin-v6.png`。`mouth-thin-replacement-v6.psd` 已在 Editor 原生替换嘴部来源；保留几何、父级和参数。全开口厚唇感已减轻。
- Open 0 / 0.5 / 1：闭口透明度 100 / 0 / 0，开口透明度 0 / 100 / 100；开口有闭合收拢与展开几何。Editor 观察约 0.3、0.5、1。不是独立上下唇、牙舌细分绑定的最终成果。
- MouthForm 尚未制作新嘴角表情。暂停前只选择了共享父级，未创建新表情变形器。最后一次 Computer Use 保存尝试收到物理 Esc 停止信号，未实际保存；上面的磁盘检查点仍是权威。

## 接手顺序与验收

1. 自然闭口、微笑、不悦的 MouthForm 关键形，检查与 Open 的组合，避免双唇线和拉厚。
2. 刘海对额头/眼周投影、鼻口体积、脸颊转折和下颌接颈阴影，统一光源与笔触。
3. 按参考采用轻微侧脸和小幅倾斜，修头部 XYZ 关键形和近远透视，检查眉/眼/嘴组合。
4. 完整全身拆层连接、稳定脚部、呼吸重心、发衣尾物理；补画确有需要的缺失层。
5. 重新分配/检查纹理图集，排除旧网格与失败候选，导出新的 v6 MOC3、model3、texture、physics、motions/expressions。
6. 运行 `check-runtime-v6.cjs` 前先核对脚本断言与实际最终网格合同。v5 的通过报告只证明 v5，不能作为 v6 验收。
7. 真正打开新包的 Cubism Viewer 验证全身与连续动作，再接入真实游戏并本机测试。完整目标包含上述全部步骤，当前均未完成。

## 游戏与团队仓库的关系

- `galLingS/` 是团队引擎的本地检出；本快照不把旧 Ren'Py 设计重新确立为团队架构。以团队当前 main 的 README 和企划为准。
- `Seabreeze/`、`art/`、`dist/`、`backups/` 是保留的旧项目历史；根目录 `运行游戏.bat` 启动旧 0.1.1。0.1.2 是被撤回的历史包。
- 新模型未接入任何游戏；旧 Ren'Py 游戏可以启动不代表 Live2D 接入已通过。团队仓库 README 将 Live2D 列为后续能力。
- 旧本地团队检出曾有依赖安装与测试问题，见历史 NEXT。没有在本次上传中修改团队 main 的实现或重跑其完整测试。

## 工具与可移植性

- 完整包包含原工作区内 SDK 和发行包；本机 `.venv`、Python 字节码缓存、游戏存档、Git 本地元数据因个人路径/运行记录不上传。按 `galLingS/pyproject.toml` 重建虚拟环境。
- 工作区外的 Cubism Editor、Cubism SDK Core、galagent 工具并未假装打包。需安装相应工具，并按其许可证取得 Core。源脚本中的外部工具路径已脱敏，需要配置自己的工具目录。
- PSD 拼装只处理格式和图层，不用代码代替绘画；新绘画素材由内置 imagegen 生成。薄嘴最终提示目标：细动漫口缘、去除厚粉唇与镜面高光、保留口腔/少量舌面/薄齿条、真透明背景。
- CU 必须使用 node_repl + `@oai/sky`。窗口截图可能包括小浮层，所有坐标操作（含 scroll）选择面积最大的主截图 ID。
- 捕获报 `window crop is outside captured monitor` 时，本次已两次验证：重新列窗口、逐一激活返回的 Cubism Viewer、最后激活 Editor 再捕获可恢复。不是已证明的根因。失败时不要沿用旧坐标或盲目输入。
- 保存遇到“删除未使用原画”选否。保留检查点，实际保存/导出/运行证据分别记录。

## 上传与隐私边界

本次明确授权把本工作区所有非隐私内容上传至 `TanPowasd/galLingS`。独立分支和贡献目录用于避免覆盖团队已有代码；完整包与清单用于保留被 .gitignore 忽略的大文件。个人绝对路径已脱敏，压缩包内部也审查。清理仅作用于上传副本；本机原资产和存档不删除。不是对任意历史文件、加密格式或画面内容的绝对隐私保证；具体扫描结果见隐私报告。
