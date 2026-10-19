"""把 GalAgent 插件随作品打包：写进 game.js 的 plugins（VN Studio 的“项目插件”）。

python tools/embed_galagent_plugin.py [作品文件夹]

- 先运行 plugins/builtin/galagent/web/build_vnplugin.py 生成 galagent.vnplugin.js，再运行本脚本。
- 离线游玩（游玩.html、单文件试玩版、APK、桌面版）因此都自带结局卡“和 X 聊聊”：
  没连 galLingS 时用游戏「设置 → AI 模型」直连模型；都没填时是离线模拟并提示去填。
- 在 galLingS 作品页里玩时，同源 /api/vn/plugins 托管的同 id 插件会覆盖这份（以后端版本为准）。
- 只改 game.js 里的 plugins 一项，其余内容逐字不变（json.dumps ensure_ascii=False, separators=(',',':')）。
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'content/imports/vnstudio/海风与布丁'
PLUG = ROOT / 'plugins/builtin/galagent/web/galagent.vnplugin.js'

p = GAME / 'game.js'
s = p.read_text(encoding='utf-8')
pre = 'window.VN_GAME = '
assert s.startswith(pre) and s.endswith(';\n'), 'game.js 格式和预期不同'
d = json.loads(s[len(pre):-2])
code = PLUG.read_text(encoding='utf-8')
m = re.search(r"id: '([^']+)',\s*name: '([^']+)',\s*version: '([^']+)'", code)
pid, name, ver = m.groups()
old = next((r for r in d.get('plugins') or [] if r.get('id') == pid), None)
rec = {'id': pid, 'name': name, 'version': ver, 'code': code, 'enabled': True, 'settings': (old or {}).get('settings', {})}
d['plugins'] = [r for r in d.get('plugins') or [] if r.get('id') != pid] + [rec]
out = pre + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n'
assert '</script' not in code
p.write_text(out, encoding='utf-8')
print('ok', pid, ver, 'game.js', len(s), '→', len(out))
