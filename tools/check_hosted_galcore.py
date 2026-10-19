"""B02：托管模式（python -m server + 作品页 vn.html）下，galcore 引擎桥接管《海风与布丁》并能一路推进。

起本地服务（scripted 假模型，不花钱）→ 无头浏览器开 /vn.html → 进入游戏 → 连点推进 N 次（遇到选项点第一个），
统计：galcore 插件是否接管（控制台 [galcore] 日志 / 引擎 ws 消息）、推进的句数、引擎与作品是否有分歧告警、页面报错。

用法：GALLINGS_CONFIG=<config.yaml> python tools/check_hosted_galcore.py [--steps 60] [--port 8799] [--out r.json]
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=60)
    ap.add_argument("--port", type=int, default=8821)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--shot", type=Path)
    a = ap.parse_args()
    env = dict(os.environ, PYTHONUNBUFFERED="1")
    env.pop("PYTHONPATH", None)
    srv = subprocess.Popen([sys.executable, "-m", "server", "--no-browser", "--port", str(a.port)], cwd=ROOT, env=env,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    base = f"http://127.0.0.1:{a.port}"
    rep: dict = {"steps_requested": a.steps}
    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(base + "/api/vn/plugins", timeout=2)
                break
            except Exception:
                time.sleep(0.5)
        rep["plugins"] = json.loads(urllib.request.urlopen(base + "/api/vn/plugins").read())["plugins"]
        logs: list[str] = []
        errs: list[str] = []
        ws_in = {"n": 0, "types": {}}
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page(viewport={"width": 1280, "height": 720})
            pg.on("console", lambda m: logs.append(f"{m.type}: {m.text}"[:300]))
            pg.on("pageerror", lambda e: errs.append(str(e)[:300]))

            def on_ws(ws):
                if "/ws" not in ws.url:
                    return

                def rx(p):
                    ws_in["n"] += 1
                    try:
                        t = json.loads(p if isinstance(p, str) else p.decode()).get("type", "?")
                    except Exception:
                        t = "?"
                    ws_in["types"][t] = ws_in["types"].get(t, 0) + 1
                ws.on("framereceived", rx)
            pg.on("websocket", on_ws)
            # 作品页里的游戏在 iframe 里；直接开游戏本体（同源 + ?host=gallings）等价于作品页里的那一份
            pg.goto(base + "/vn.html", wait_until="load")
            pg.wait_for_timeout(4000)
            fr = next((f for f in pg.frames if "/vn/" in f.url), None)
            rep["game_frame"] = fr.url if fr else None
            if fr is None:
                raise SystemExit("作品页里没有找到游戏 iframe")
            fr.wait_for_function("typeof VNPlugins !== 'undefined'", timeout=60000)
            rep["vn_plugins_loaded"] = fr.evaluate("VNPlugins.list().map(p => p.id + ':' + (p.state || p.status || ''))")
            # 进游戏：标题画面的“开始”
            started = fr.evaluate("""() => { const b = [...document.querySelectorAll('button, .menu-item, [data-act], a')]
                .find(e => /开始|开始游戏|New Game|从头/.test(e.textContent || '')); if (b) { b.click(); return b.textContent.trim(); } return null; }""")
            rep["start_button"] = started
            pg.wait_for_timeout(2500)
            seen = []
            for i in range(a.steps):
                st = fr.evaluate("""() => { const t = (document.querySelector('#ptx') || {}).textContent || '';
                    const opts = [...document.querySelectorAll('#choices button')].filter(e => e.offsetParent);
                    return { t: t.trim().slice(0, 40), opts: opts.map(o => o.textContent.trim().slice(0, 20)) }; }""")
                seen.append(st)
                if st["opts"]:
                    fr.evaluate("() => { const o = [...document.querySelectorAll('#choices button')].filter(e => e.offsetParent)[0]; o && o.click(); }")
                else:
                    fr.evaluate("() => advance()")
                pg.wait_for_timeout(350)
            if a.shot:
                pg.screenshot(path=str(a.shot))
            br.close()
        texts = [s["t"] for s in seen if s["t"]]
        rep["distinct_lines_seen"] = len(dict.fromkeys(texts))
        rep["choices_hit"] = sum(1 for s in seen if s["opts"])
        rep["first_lines"] = list(dict.fromkeys(texts))[:8]
        rep["galcore_logs"] = [l for l in logs if "[galcore]" in l][:30]
        rep["divergence_warnings"] = [l for l in logs if "以引擎为准" in l or "分歧" in l][:20]
        rep["page_errors"] = errs[:10]
        rep["ws_frames_in"] = ws_in
        rep["ok"] = bool(ws_in["n"]) and rep["distinct_lines_seen"] >= min(20, a.steps // 3) and not errs and not rep["divergence_warnings"]
    finally:
        srv.terminate()
        try:
            out = srv.communicate(timeout=5)[0]
        except Exception:
            srv.kill()
            out = ""
        rep["server_tail"] = (out or "").splitlines()[-8:]
    txt = json.dumps(rep, ensure_ascii=False, indent=2)
    print(txt)
    if a.out:
        a.out.write_text(txt + "\n", encoding="utf-8")
    return 0 if rep.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
