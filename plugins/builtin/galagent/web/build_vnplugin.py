"""把前端库 galagent-ui.js + VN Studio 插件代码 vnplugin.src.js 拼成 galagent.vnplugin.js（vn-plugin/1）。
改了这两个文件之后运行：python plugins/builtin/galagent/web/build_vnplugin.py
（作品页里的游戏从 /galagent/galagent.vnplugin.js 装它；也可以把生成的文件发给只用 VN Studio 的作者，在“插件”里导入。）"""
import pathlib, sys
here = pathlib.Path(__file__).parent
lib = (here / 'galagent-ui.js').read_text(encoding='utf-8').strip()
src = (here / 'vnplugin.src.js').read_text(encoding='utf-8').rstrip()
head = '''/* GalAgent · VN Studio 插件（vn-plugin/1）
 * 结局后聊天 + 带工具的角色扮演，对接 galLingS 插件 gallings.tool.galagent（galagent/1）。
 * 装法：VN Studio 顶栏“插件”→ 导入插件；或在导出游戏的开始界面“插件”里导入。在 galLingS 作品页里玩时会自动提供。
 *  - 剧情里的 @agent：编辑器设置里“机器人”选 GalAgent。
 *  - 剧本 @postchat 角色 [auto=on] [tools=off] goal=聊天方向：结局卡出现“和 X 聊聊”。没写时用插件设置里的角色，再没有就用 @soul 手账角色。
 *  - 名字牌旁的胶囊显示工作进度（默认折叠）；点开后工作流程面板平滑铺满画面，每一步可展开。
 *  - 后端地址留空 = 离线模拟；在 galLingS 作品页里自动连同源 /ws/post_ending。
 *  - 扩展：别的插件写 requires: ['gallings.galagent']，然后
 *      const ga = vn.require('gallings.galagent');
 *      ga.addClientTool({ name, description, parameters, effect, handler })      // 前端工具
 *      ga.GalAgent.registerToolRenderer(name, (step, box) => {})                 // 自定义工具结果显示
 *    后端工具照旧写 galLingS 插件（capabilities: [galagent]），见 galLingS docs/galagent.md。
 * 前端库与 galLingS plugins/builtin/galagent/web/galagent-ui.js 是同一份（构建时嵌入），勿手改这一段。 */
(() => {
  'use strict';
  function loadLib() {
    if (window.GalAgent && window.GalAgent.__vnplug) return window.GalAgent;
    /* ==== GALAGENT-UI BEGIN ==== */
''' + lib + '''
    /* ==== GALAGENT-UI END ==== */
    window.GalAgent.__vnplug = true;
    return window.GalAgent;
  }
'''
out = head + src + '\n})();\n'
assert '</script>' not in out
(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / 'galagent.vnplugin.js').write_text(out, encoding='utf-8')
print('ok', len(out))
