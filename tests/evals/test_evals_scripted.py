"""跑分器冒烟测试：scripted 模式跑一个小子集，保证 tests/evals/run.py 不坏（不联网、几秒内跑完）。

只断言"管线判定正确"的对照样本；守卫缺口探针（如 os-08、rt-04）的结果随实现修复而变，这里只要求它们被跑到、出了结论。
"""
from __future__ import annotations

import time

import pytest

from tests.evals import run as ev


@pytest.mark.asyncio
async def test_scripted_subset(tmp_path):
    t0 = time.perf_counter()
    only = {"os-01", "os-03", "os-08", "rt-01", "rt-16", "rt-23", "rt-29", "rt-04", "m02", "m15", "lamp"}
    rep = await ev.run_all(list(ev.SETS), "scripted", only=only)
    res = rep["results"]

    off = {r["id"]: r for r in res["offscript"]["items"]}
    assert set(off) == {"os-01", "os-03", "os-08"}
    for k in ("os-01", "os-03"):
        assert off[k]["ok"], off[k]
        assert off[k]["steer_round"] == 3 and off[k]["beat_kept"]
    assert off["os-03"]["violation_caught"] is True           # 称呼越期初稿被闸门拦下、重写后上屏
    assert off["os-08"]["violation_caught"] is not None       # 探针：有结论即可

    rt = {r["id"]: r for r in res["redteam"]["items"]}
    for k in ("rt-01", "rt-16", "rt-23", "rt-29"):
        assert rt[k]["intercepted"], rt[k]
    assert "intercepted" in rt["rt-04"]

    mem = {r["id"]: r for r in res["memory"]["items"]}
    assert mem["m02"]["recalled"] and mem["m02"]["ok"]
    assert mem["m15"]["lineage"] == "L0.1" and not mem["m15"]["recalled"]

    cards = {(r["card"], r["variant"]): r for r in res["cards"]["items"]}
    assert cards[("whale", "control")]["hits"] == 5
    assert cards[("lamp", "compliant")]["hits"] >= 4
    assert cards[("lamp", "violating")]["ok"]                 # 判据能检出注入的违规演绎

    md, js = ev.write_report(rep, tmp_path / "r.md")
    text = md.read_text(encoding="utf-8")
    assert "判据总表" in text and rep["versions"]["prompt_version"] in text and js.is_file()
    assert time.perf_counter() - t0 < 30
