"""D04：VN Studio 编辑器的三种往返是否无损（真浏览器，Playwright）。

1. 项目 JSON：P → JSON.stringify → loadProject → 再导出，lines/vars/chars/settings/assets 逐字段一致。
2. 完整 HTML（单文件导出）：buildGameHtml(P) 写成文件 → 新页面打开 → window.VN_GAME 与原项目一致。
3. 文件夹导出：gameFolderFiles() 产出的 index.html + game.js 放进临时目录（素材目录软链）→ 打开 → 一致。
4. 文本剧本：scriptText() → importScript() → scriptText()，两次文本逐字一致（脚本格式本身是有损表示，
   只验它自己的不动点；另报 lines 数、句子 ID 以外的可见字段差异数）。

用法：python tools/check_editor_roundtrip.py <作品文件夹> [--out report.json]
需要 playwright + chromium（pip install playwright && python -m playwright install chromium）。
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import shutil
import socketserver
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

STRIP = ("recent", "cur")


def norm(p: dict) -> dict:
    o = {k: v for k, v in p.items() if k not in STRIP}
    o["assets"] = {k: {kk: vv for kk, vv in a.items() if kk not in ("file", "_inline")} for k, a in (o.get("assets") or {}).items()}
    return o


def diff(a, b, path="", out=None, limit=20):
    out = [] if out is None else out
    if len(out) >= limit:
        return out
    if type(a) is not type(b) and not (isinstance(a, (int, float)) and isinstance(b, (int, float))):
        out.append(f"{path}: {str(a)[:60]!r} != {str(b)[:60]!r}")
    elif isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f"{path}.{k}: 只在{'导出前' if k in a else '导出后'}")
            else:
                diff(a[k], b[k], f"{path}.{k}", out, limit)
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append(f"{path}: 长度 {len(a)} != {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            diff(x, y, f"{path}[{i}]", out, limit)
    elif a != b:
        out.append(f"{path}: {str(a)[:60]!r} != {str(b)[:60]!r}")
    return out


CANON = """window.__canon = o => { const c = JSON.parse(JSON.stringify(o)); delete c.recent; delete c.cur;
  for (const a of Object.values(c.assets || {})) { delete a.file; delete a._inline; }
  const srt = v => Array.isArray(v) ? v.map(srt) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, srt(v[k])])) : v;
  return srt(c); };
window.__digest = async o => { const c = __canon(o); const parts = {}; for (const k of Object.keys(c)) parts[k] = JSON.stringify(c[k]);
  const lines = (c.lines || []).map(l => JSON.stringify(l)); const out = {}; 
  for (const [k, v] of Object.entries(parts)) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)); out[k] = [...new Uint8Array(h)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); }
  return { parts: out, lines }; };"""


def cmp(a, b):
    d = [f"字段 {k} 不一致" for k in sorted(set(a["parts"]) | set(b["parts"])) if a["parts"].get(k) != b["parts"].get(k)]
    if "字段 lines 不一致" in d:
        la, lb = a["lines"], b["lines"]
        if len(la) != len(lb):
            d.append(f"lines 数 {len(la)} != {len(lb)}")
        bad = [i for i, (x, y) in enumerate(zip(la, lb)) if x != y]
        if bad:
            i = bad[0]
            d.append(f"{len(bad)} 句不同，第一处 #{i}: {la[i][:160]} || {lb[i][:160]}")
    return d


def serve(root: Path):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(root), **k)

        def log_message(self, *a):
            pass
    s = socketserver.ThreadingTCPServer(("127.0.0.1", 0), H)
    s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("game", type=Path)
    ap.add_argument("--out", type=Path)
    a = ap.parse_args()
    game = a.game.resolve()
    tmp = Path(tempfile.mkdtemp(prefix="d04_"))
    work = tmp / "site"
    work.mkdir()
    for f in game.iterdir():
        (work / f.name).symlink_to(f)
    srv = serve(work)
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    rep: dict = {"game": str(game)}
    ok = True
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page()
        errs: list[str] = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base + "/index.html?editor=1", wait_until="load")
        pg.wait_for_function("typeof P !== 'undefined' && P && P.lines && P.lines.length > 1", timeout=60000)
        pg.evaluate("() => {" + CANON + "}")
        orig = pg.evaluate("__digest(P)")
        rep["lines"] = len(orig["lines"])
        rep["assets"] = pg.evaluate("Object.keys(P.assets).length")

        # 1. 项目 JSON 往返
        again = pg.evaluate("""() => { const s = JSON.stringify(P); loadProject(JSON.parse(s)); return __digest(P); }""")
        d1 = cmp(orig, again)
        rep["project_json"] = {"ok": not d1, "diffs": d1}

        # 2. 完整 HTML（单文件）——素材 src 保持相对路径，放在同一目录下打开
        html = pg.evaluate("buildGameHtml(P)")
        (work / "_single.html").write_text(html, encoding="utf-8")
        # 3. 文件夹导出
        files = pg.evaluate("gameFolderFiles(Object.fromEntries(Object.entries(P.assets).map(([k,a])=>[k,Object.assign({},a,{file:undefined})])), undefined, P)")
        fold = work / "_folder"
        fold.mkdir()
        for n, t in files.items():
            (fold / n).write_text(t, encoding="utf-8")
        (fold / "assets").symlink_to(game / "assets")

        # 4. 文本剧本不动点
        st = pg.evaluate("""() => { const t1 = scriptText(); let t2 = null, n = null, err = null;
            try { const r = importScript(t1); n = (r && r.lines ? r.lines.length : P.lines.length); t2 = scriptText(); } catch (e) { err = String(e.message || e); }
            return { t1, t2, n, err }; }""")
        if st["err"]:
            rep["script_text"] = {"ok": False, "error": st["err"]}
        else:
            same = st["t1"] == st["t2"]
            first = None
            if not same:
                l1, l2 = st["t1"].split("\n"), st["t2"].split("\n")
                first = next((i for i, (x, y) in enumerate(zip(l1, l2)) if x != y), min(len(l1), len(l2)))
                first = {"row": first + 1, "before": l1[first] if first < len(l1) else None, "after": l2[first] if first < len(l2) else None}
            rep["script_text"] = {"ok": same, "rows": st["t1"].count("\n"), "first_diff": first}

        rep["page_errors"] = errs[:5]
        pg.close()
        for key, url in (("single_html", "/_single.html"), ("folder", "/_folder/index.html")):
            p2 = br.new_page()
            e2: list[str] = []
            p2.on("pageerror", lambda e: e2.append(str(e)))
            p2.goto(base + url, wait_until="load")
            p2.wait_for_function("window.VN_GAME && window.VN_GAME.lines", timeout=60000)
            p2.evaluate("() => {" + CANON + "}")
            got = p2.evaluate("__digest(window.VN_GAME)")
            d = cmp(orig, got)
            started = p2.evaluate("!!document.querySelector('body')")
            rep[key] = {"ok": not d and not e2 and started, "diffs": d, "page_errors": e2[:5], "bytes": len(html) if key == "single_html" else sum(len(t) for t in files.values())}
            p2.close()
        br.close()
    srv.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)
    for k in ("project_json", "single_html", "folder", "script_text"):
        ok &= rep[k]["ok"]
    rep["ok"] = ok
    txt = json.dumps(rep, ensure_ascii=False, indent=2)
    print(txt)
    if a.out:
        a.out.write_text(txt + "\n", encoding="utf-8")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
