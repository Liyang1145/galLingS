# 10-19 Atri 界面同步到文件夹版 + 安卓试玩包

## Atri 改动（来源：release playtest-20261019 单文件 haifeng-pudding-trial-ledger-20261019.html）
与我 10-18 13:03 的单文件构建逐段比对（去掉内嵌素材后），Atri 的实际改动全部在播放器代码/样式，已移植到作品文件夹版：
- 对话回看每句加“回退到这里”：恢复到该句开始前的变量、回看记录和剧情位置（`goBackToHistory`，回看条目记 `h` = 历史下标）。
- 设置里加“对话框不透明度”滑条（35%–95%，`--ghost`），游戏内对话框 `#pdlg` 同样受控。
- 游戏内设置面板“海底刻度”样式：滑条填充进度、右侧显示数值（%、ms、×），触屏按钮 ≥44px。
- 未采纳：Atri 底稿比现行版旧，他那份里没有 10-18 审查加的“触屏不显示悬停提示 / 控制栏字影”，也没有音乐增益 playbackGain——这些是底稿差异，不是他的删改，保留现行版。
- 另补：滑条与数值同一行（`.control` 布局，Atri 原稿没有这条样式）。
- 验证：fix6/reg.py 3315 节点 0 报错；浏览器实测回退到第 3 句后 RT.idx 8→5、回看 6→3，无页面报错。

## 安卓试玩包（mobile/）
- `mobile/android/`：WebView 外壳（WebViewAssetLoader 以 https://appassets.androidplatform.net 读 assets/game/，存档用 localStorage 照常保存）；全屏沉浸、常亮、返回键先关弹出层、连按两次退出。调试签名，仅供试玩。
- `mobile/host.js`：只在 APK 注入。游戏设置首行“屏幕方向：横屏 / 竖屏 / 跟随旋转”，即时生效并记住；竖屏/跟随时直接用游戏自带竖屏排版。
- `mobile/prepare_assets.py`：复制作品文件夹，宽于 1920 的图缩到 1920（文件名不变），不带编辑器脚本，封面裁图标。
- `.github/workflows/android.yml`：推到 fix/character-performance（mobile/ 或作品文件夹有改动）或手动触发 → APK 上传到 Artifacts，并更新预发布 `android-playtest` 的附件。
