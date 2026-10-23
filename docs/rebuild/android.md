# M5 Android 宿主接入切片

从 `77a18a3` 接续原方案步骤 19，先独立提交平台共享准备逻辑，再接入 Android。当前仅编写代码与文档，未安装依赖、运行准备命令、执行 Gradle、生成 APK、启动模拟器或连接设备；未类型检查、测试、额外审查或验收。

## 入口与产物

保留 `mobile/android/app` 及其默认入口、资源、旧桥和构建配置。新增同一 Gradle 工程下的 `:rebuild` 模块，使用独立应用 ID `net.gallings.haifeng.rebuild`，从已准备的共享前端启动，不加载旧作者脚本、播放器、WASM 或插件。Android 与 Windows 仍复用唯一 TypeScript 核心，不决定两端以后是否统一宿主。

`npm run android:prepare -- <产物摘要>` 调用 `tools/game/prepare.ts`，复用 Windows 的清单摘要、剧情修订、文件边界及逐文件大小/SHA-256 核对。只复制已登记文件，写入：

```text
dist/android/<产物摘要>/
  assets/game/             完整共享游戏包
  assets/host-bootstrap.js 原生文档启动时注入的宿主桥
  preparation.json         游戏清单与桥摘要、用途和存储范围
```

目录独占创建，不覆盖已有产物；失败保留不完整目录供定位，不自动删除。桥来自当前共享实现，只替换平台标记。准备命令不执行 Gradle、安装 SDK、编译或连接设备。

Gradle 参数 `-PrebuildPackage=<产物摘要>` 指定这份输入；`:rebuild` 的 `preBuild` 拒绝没有完成记录的目录，并核对记录身份、游戏清单和桥摘要。它不重新核对每个素材字节，准备后须保持目录原样，不能据此宣称具备已验证的安装校验。未指定参数时只在执行新模块构建任务时报告，不将准备要求加到旧 `:app` 的任务上。

新模块沿用现有 Android 工程的编译配置及版本环境输入，没有编新的作品发行版本。新模块只提供明确的调试构建入口，没有为其启用旧模块的 release 调试签名安排，没有改 CI 或发布工作流。

## 本地读取与启动

原生 `RebuildActivity` 使用已有 AndroidX WebKit 依赖和 `WebViewAssetLoader`，只提供 `https://appassets.androidplatform.net/assets/game/`。关闭文件/内容访问及真实网络加载，未声明互联网权限；缺失包内文件返回本地错误，不联网补齐或切换旧解释器。

宿主桥必须在页面脚本前注入。通过 `WebViewFeature.DOCUMENT_START_SCRIPT` 检查实际 WebView 能力；不支持时显示原生诊断并停止开局。没有虚构最低 WebView 版本号或把 Android API 级别当成完整浏览器能力保证；前端仍独立检查 Web Crypto 和内容格式。

导航仅允许本地入口，关闭远程导航、弹窗及页面内框架。媒体由共享播放器按需读取，没有一次解码全部素材。用户手势要求继续保留，系统播放限制和媒体解码仍需真机确认。

## 生命周期和返回键

两端共用 `packages/player/src/web/host-bootstrap.js` 和 `haifeng.host-state/1`；Windows 的原生包含路径同步改到共享文件。桥只缓存单调序号的窗口状态并提供本页返回键回调，不暴露文件、网络或剧情指令。

Android 在 `onPause/onResume`、窗口焦点和页面完成时发送当前综合暂停状态。页面启动先暂停；会话通过既有 `initialPauses` 采用当前状态，窗口恢复只解除 `host`，不解除菜单、后台、回看、加载或操作准备的暂停。没有墙钟补算，不重入节点或重放进入动作。

应用返回键处理顺序：

1. 关闭对白回看，并解除其自身暂停。
2. 关闭主页鉴赏。
3. 游玩中打开或关闭菜单。
4. 标题页交回原生，沿用旧宿主连按两次退出的试用方式；提示进度须先手动保存。

返回键不模拟点击、下一句或选择；原生等待本页处理结果时防止重复请求，回调核对页面代次，旧页面结果不能关闭新页面。缺失或无效处理结果给出提示，不据此退出。当前显式关闭预测返回回调，使用既有 Activity 返回入口；正式手势体验尚未验收。

原生页面投递尚无确认重试，音频焦点、电话/设备切换及各系统 WebView 的真实暂停表现尚未覆盖；不能因写了生命周期回调就宣称后台行为已验收。

## 存储和进程重建

独立应用 ID 使新模块拥有独立应用数据目录。游戏内仍通过相同的 IndexedDB 原子适配器保存进度和全局成果；第一话是 `development/normal-entry`，限时样例保持独立预览。没有迁移旧 APK 数据，没有切正式记录范围，没有接原生文件存档或云同步。

Activity 或渲染进程重建后重新开标题，由玩家显式读手动档；不会使用 `WebView.restoreState` 猜剧情位置。渲染进程退出显示可见诊断，当前未保存位置不承诺恢复。关闭时没有自动保存、自动恢复点、退出前事实排空或完整音频焦点接入，这些仍需后续落实。

本片关闭系统备份，不将试播记录默认交给系统云备份；正式备份、卸载保留和导出策略尚未决定。

## 统一测试阶段入口

以下命令本轮均未执行。在仓库根满足 Node 环境后：

```powershell
npm ci --ignore-scripts
npm run game:build
npm run android:prepare -- <game:build输出的产物摘要>
```

随后使用已配置的 JDK 17、与现有 Android Gradle Plugin 8.5.2 兼容的 Gradle 及 Android SDK 34，在 `mobile/android` 按准备命令打印的摘要执行：

```powershell
gradle :rebuild:assembleDebug -PrebuildPackage=<产物摘要>
```

仓库当前没有 Gradle wrapper；本轮没有安装工具或生成 wrapper，不能把命令存在当作环境已就绪。APK 的预期位置是 `mobile/android/rebuild/build/outputs/apk/debug/`；须以未来实际 Gradle 输出为准。

人工试用重点是安装完整后断网启动、声音和选择、切后台/锁屏/失焦后时间保持、返回键弹层顺序、手动保存后重开读取，以及旧进度不回滚全局解锁。缺少桥能力、缺损准备记录或本地资源时应给出诊断。所有情景均未执行；M5 全量主线、平台存储与设备兼容验收仍未完成。
