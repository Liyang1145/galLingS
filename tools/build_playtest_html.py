"""单文件试玩版（含对白账本）：把作品文件夹的素材全部内嵌成一个 HTML。

python tools/build_playtest_html.py <输出.html> [作品文件夹]
图片转 webp（不透明 ≤1600、透明 ≤1280），音频原样内嵌；账本脚本是同目录 playtest_ledger.js。
"""
import re, base64, io, os, json, sys
from PIL import Image
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
G = sys.argv[2] if len(sys.argv) > 2 else str(ROOT / '海风与布丁')
MAXW = {'bg': 1920}
mime = {'.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4'}
cache = {}; stats = {'n': 0, 'raw': 0, 'out': 0, 'missing': []}

def data_uri(rel):
    if rel in cache: return cache[rel]
    p = os.path.join(G, rel)
    if not os.path.exists(p):
        stats['missing'].append(rel); cache[rel] = None; return None
    ext = os.path.splitext(p)[1].lower(); raw = open(p, 'rb').read(); stats['raw'] += len(raw)
    if ext in ('.webp', '.png', '.jpg', '.jpeg'):
        im = Image.open(io.BytesIO(raw)); alpha = im.mode in ('RGBA', 'LA', 'P')
        im = im.convert('RGBA' if alpha else 'RGB')
        w, h = im.size
        lim = 1600 if not alpha else 1280
        if max(w, h) > lim and (w >= h or alpha):
            s = lim / max(w, h); im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, 'WEBP', quality=80 if not alpha else 82, method=5)
        out = b.getvalue() if len(b.getvalue()) < len(raw) or ext != '.webp' else raw
        m = 'image/webp' if out is not raw else mime[ext]
    else:
        out = raw; m = mime.get(ext, 'application/octet-stream')
    stats['n'] += 1; stats['out'] += len(out)
    u = 'data:' + m + ';base64,' + base64.b64encode(out).decode()
    cache[rel] = u; return u

pat = re.compile(r'''(["'(])(assets/[^"'()\s]+?\.(?:webp|png|jpe?g|mp3|ogg|wav|m4a))(["')])''')
def inline(text):
    def rep(mo):
        u = data_uri(mo.group(2))
        return mo.group(1) + (u if u else mo.group(2)) + mo.group(3)
    return pat.sub(rep, text)

html = open(f'{G}/index.html', encoding='utf-8').read()
game = open(f'{G}/game.js', encoding='utf-8').read()
css = open(f'{G}/game-polish.css', encoding='utf-8').read()
ledger = open(pathlib.Path(__file__).with_name('playtest_ledger.js'), encoding='utf-8').read()

order = []; idx = {}
pat_js = re.compile(r'"(assets/[^"\s]+?\.(?:webp|png|jpe?g|mp3|ogg|wav|m4a))"')
def rep_js(mo):
    u = data_uri(mo.group(1))
    if not u: return mo.group(0)
    if mo.group(1) not in idx: idx[mo.group(1)] = len(order); order.append(u)
    return '__D[' + str(idx[mo.group(1)]) + ']'
body = pat_js.sub(rep_js, game)
css_i = inline(css)
html = html.replace('<link rel="stylesheet" href="game-polish.css">', '<style>\n' + css_i + '\n</style>', 1)
html = html.replace('<title>VN Studio</title>', '<title>海风与布丁 · 试玩版（含对白账本）</title>', 1)
assert '<script src="game.js"></script>' in html
pre, post = html.split('<script src="game.js"></script>', 1)
i = post.rfind('</body>')
out = sys.argv[1] if len(sys.argv) > 1 else 'out.html'
with open(out, 'w', encoding='utf-8') as f:
    f.write(pre); f.write('<script>\nconst __D=[\n')
    for k, u in enumerate(order):
        f.write(('' if k == 0 else ',\n') + '"' + u + '"')
    f.write('];\n'); f.write(body.replace('</script', '<\\/script')); f.write('\n</script>')
    f.write(post[:i] + '<script>\n' + ledger + '\n</script>\n' + post[i:])
print(json.dumps({k: (v if k != 'missing' else v[:20]) for k, v in stats.items()}, ensure_ascii=False), 'missing', len(stats['missing']), 'size', os.path.getsize(out))
