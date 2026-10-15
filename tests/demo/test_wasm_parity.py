"""WASM 版 galcore 与 Python 版逐步一致（离线包 / 桌面程序跑的就是 WASM 版，PLAN §17.2）。

需要 node 和编好的 core/target/wasm32-unknown-unknown/release/galcore.wasm，缺一样就跳过。
用迷你剧本走到底（遇到选项选第一个）：每步 state_hash 相同、中途快照逐字节相同、Python 快照能被 WASM 读回。
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

galcore = pytest.importorskip("galcore")
ROOT = Path(__file__).resolve().parents[2]
WASM = ROOT / "core" / "target" / "wasm32-unknown-unknown" / "release" / "galcore.wasm"
pytestmark = pytest.mark.skipif(not WASM.is_file() or not shutil.which("node"), reason="没有 galcore.wasm 或 node")


def test_wasm_matches_python(tmp_path: Path, mini_chapter: dict, cat_card: dict) -> None:
    config = {"mode": "choice", "honesty_gap_rule": False}
    seed = 12345
    args = (json.dumps(mini_chapter, ensure_ascii=False), json.dumps(cat_card, ensure_ascii=False), json.dumps(config), seed)
    py = galcore.Engine(*args)
    events, hashes, snap, choice = [], [], None, None
    for _ in range(500):
        st = json.loads(py.state_json())
        if st["wait"] == "end":
            break
        if st["wait"] == "choice" and choice:
            ev = {"kind": "choice", "payload": {"option_id": choice["options"][0]["id"]}, "source": "player"}
        else:
            ev = {"kind": "advance", "payload": {}, "source": "player"}
        res = json.loads(py.step(json.dumps(ev, ensure_ascii=False)))
        choice = next((o for o in res["ops"] if o.get("op") == "CHOICE"), choice)
        events.append(ev)
        hashes.append(res["state_hash"])
        if len(events) == 5:
            snap = py.snapshot()
    assert len(events) > 5 and any(e["kind"] == "choice" for e in events)
    for name, obj in (("chapter.json", mini_chapter), ("card.json", cat_card),
                      ("events.json", {"config": config, "seed": seed, "events": events, "snap_at": 5, "python_snapshot": snap})):
        (tmp_path / name).write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
    out = subprocess.run(["node", str(ROOT / "tests" / "wasm" / "parity.mjs"), str(WASM), *(str(tmp_path / n) for n in
                          ("chapter.json", "card.json", "events.json"))], capture_output=True, text=True, encoding="utf-8", check=True)
    got = json.loads(out.stdout)
    assert got["version"] == galcore.ENGINE_VERSION
    assert got["hashes"] == hashes
    assert got["snapshot"] == snap
    py.restore(snap)
    assert got["restored_hash"] == py.state_hash()
