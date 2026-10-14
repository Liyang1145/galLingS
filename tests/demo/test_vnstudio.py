"""VN Studio 作品 → OP 导入器 + galcore 执行：与 VN Studio 播放器的语义逐句一致。

参照实现 ``vn_reference`` 按作品 index.html 运行时的规则走（进句先改变量；有可见选项停下；
有结局就结束；否则按 jump/jumpIf 或下一句），引擎按导入后的 OP 程序走，两边逐句比对。
"""
from __future__ import annotations

import json
import random
import re
import shutil
from pathlib import Path

import galcore
import pytest
import yaml

from compiler.compile import canonical
from compiler.vnstudio import import_dir, read_game_js
from server.session import Session, SessionOptions

from .conftest import FIX, ROOT, make_runtime

MINI = FIX / "vnstudio" / "mini"
REAL = ROOT / "content" / "imports" / "vnstudio" / "海风与布丁"
WHALE = ROOT / "content" / "cards" / "whale.yaml"


# ---------------------------------------------------------------- 参照实现（VN Studio 语义）
def _set(s: str, v: dict) -> None:
    for p in (s or "").split(";"):
        if p.strip():
            m = re.match(r"\s*(\S+)\s*(\+=|-=|=)\s*(-?\d+)", p)
            n, o, x = m.group(1), m.group(2), int(m.group(3))
            v[n] = x if o == "=" else v.get(n, 0) + (x if o == "+=" else -x)


def _cond(c: str, v: dict) -> bool:
    ops = {"<": int.__lt__, "<=": int.__le__, ">": int.__gt__, ">=": int.__ge__, "==": int.__eq__, "!=": int.__ne__}
    for p in (c or "").split("&&"):
        if p.strip():
            m = re.match(r"\s*(\S+)\s*(<=|>=|==|!=|<|>)\s*(-?\d+)", p)
            if not ops[m.group(2)](v.get(m.group(1), 0), int(m.group(3))):
                return False
    return True


def vn_reference(game: dict, picks: list[int], endings_seen: int):
    L = game["lines"]
    lab = {ln["label"]: k for k, ln in enumerate(L) if ln["label"]}
    v = {x["name"]: int(x["init"]) for x in game["vars"]}
    v["结局数"] = endings_seen
    i, trace, pi = 0, [], 0
    while i < len(L):
        ln = L[i]
        _set(ln["set"], v)
        trace.append(ln["id"])
        vis = [c for c in ln["choices"] if _cond(c["cond"], v)]
        if vis:
            c = vis[picks[pi] % len(vis)]
            pi += 1
            _set(c["set"], v)
            trace.append(">" + c["text"])
            i = lab[c["target"]] if c["target"] else i + 1
            continue
        if ln["ending"]:
            return trace, ln["ending"], v
        i = lab[ln["jump"]] if ln["jump"] and _cond(ln["jumpIf"], v) else i + 1
    return trace, "script_end", v


def engine_walk(ch: dict, card: dict, picks: list[int], endings_seen: int, seed: int):
    vi = {x["var"]: x["init"] for x in ch["vars"] if x["var"] not in ("affection", "tails")}
    vi["结局数"] = endings_seen
    e = galcore.Engine(json.dumps(ch, ensure_ascii=False), json.dumps(card, ensure_ascii=False),
                       json.dumps({"mode": "choice", "vars_init": vi}), seed)
    trace, pi = [], 0
    res = json.loads(e.step('{"kind":"advance","payload":{}}'))
    for _ in range(50_000):
        st = json.loads(e.state_json())
        trace += [o["id"] for o in res["ops"] if o["op"] == "SAY"]
        if st["wait"] == "end":
            return trace, st["ending"], st
        if st["wait"] == "choice":
            c = [o for o in res["ops"] if o["op"] == "CHOICE"][-1]
            o = c["options"][picks[pi] % len(c["options"])]
            pi += 1
            trace.append(">" + o["label"])
            res = json.loads(e.step(json.dumps({"kind": "choice", "payload": {"option_id": o["id"]}})))
        else:
            res = json.loads(e.step('{"kind":"advance","payload":{}}'))
    raise AssertionError("没走到结局")


def _equivalent(game_dir: Path, card: dict, n: int) -> dict:
    game = read_game_js(game_dir / "game.js")
    ch, _ = import_dir(game_dir)
    lo, hi = ch["rules"]["affection_range"]
    heroine_var = "好感"
    ends: dict = {}
    for seed in range(n):
        r = random.Random(seed)
        picks = [r.randrange(97) for _ in range(300)]
        a, ea, va = vn_reference(game, picks, seed % 3)
        b, eb, sb = engine_walk(ch, card, picks, seed % 3, seed)
        assert a == b, f"seed {seed}：句序不同"
        assert ea == eb
        assert va.get(heroine_var, 0) == sb["affection"] and va.get("尾鳍", 0) == sb["tails_script"]
        assert lo <= sb["affection"] <= hi
        ends[eb] = ends.get(eb, 0) + 1
    return ends


@pytest.fixture()
def cat_card_dict() -> dict:
    return yaml.safe_load((FIX / "cards" / "cat.yaml").read_text(encoding="utf-8"))


# ---------------------------------------------------------------- 迷你作品
def test_import_is_deterministic_and_resolves_targets():
    ch1, report = import_dir(MINI)
    ch2, _ = import_dir(MINI)
    assert canonical(ch1) == canonical(ch2)
    prog = ch1["program"]
    for op in prog:
        if op["op"] in ("JUMP", "JUMP_IF"):
            assert isinstance(op["target"], int) and 0 <= op["target"] < len(prog)
        if op["op"] == "CHOICE":
            assert all(isinstance(o["target"], int) for o in op["options"])
    says = {o["id"]: o for o in prog if o["op"] == "SAY"}
    assert says["l03"]["speaker"] == "heroine" and says["l03"]["origin"] == "locked" and says["l03"]["hash"]
    assert says["l04"]["speaker"] == "player"
    assert says["l08"]["pause"] is True
    choice = next(o for o in prog if o["op"] == "CHOICE" and o["line_id"] == "l04")
    assert choice["timeout"] == {"seconds": 10, "default_option": "l04.1"}
    assert ch1["rules"]["affection_range"][0] <= -2 and ch1["rules"]["affection_range"][1] >= 5
    assert "结局 3" in report


def test_mini_matches_vn_semantics(cat_card_dict):
    ends = _equivalent(MINI, cat_card_dict, 120)
    assert set(ends) == {"好结局", "坏结局", "番外"}


def test_hidden_option_is_not_sent_and_cannot_be_taken(cat_card_dict):
    ch, _ = import_dir(MINI)
    e = galcore.Engine(json.dumps(ch, ensure_ascii=False), json.dumps(cat_card_dict, ensure_ascii=False),
                       json.dumps({"mode": "choice", "vars_init": {"玩笑": 0, "结局数": 1}}), 1)

    def to_choice(res):
        while not any(o["op"] == "CHOICE" for o in res["ops"]):
            res = json.loads(e.step('{"kind":"advance","payload":{}}'))
        return next(o for o in res["ops"] if o["op"] == "CHOICE")

    menu = to_choice(json.loads(e.step('{"kind":"advance","payload":{}}')))
    side = to_choice(json.loads(e.step(json.dumps({"kind": "choice", "payload": {"option_id": menu["options"][1]["id"]}}))))
    assert [o["label"] for o in side["options"]] == ["继续"]  # 好感重置为 0，条件选项不下发
    with pytest.raises(ValueError):
        e.step(json.dumps({"kind": "choice", "payload": {"option_id": "l12.0"}}))


async def test_runtime_runs_imported_game(tmp_path):
    games = tmp_path / "games"
    shutil.copytree(MINI, games / "mini")
    from server.runtime import Runtime
    rt = Runtime({"server": {"data_dir": str(tmp_path / "data")},
                  "vn": {"games_dir": str(games)},
                  "game": {"source": "vnstudio", "vn_game": "mini", "default_card": "cat"},
                  "plugins": {"paths": [str(ROOT / "plugins" / "builtin")], "select": {"memory": ["gallings.memory.local"]},
                              "config": {}, "guards": [], "tools": [], "importers": []}})
    rt.cards.builtin_dir = FIX / "cards"
    await rt.start()
    out: list[dict] = []

    async def send(m):
        out.append(m)

    s = Session(rt, SessionOptions("cat", mode="choice", endings_seen=0), send)
    await s.hello()
    await s.handle({"type": "advance"})
    while s.state["wait"] != "choice":
        await s.handle({"type": "advance"})
    await s.handle({"type": "choose", "option_id": "l04.0"})
    while s.state["wait"] != "end":
        await s.handle({"type": "advance"})
    st = s.state
    assert st["ending"] == "好结局" and st["affection"] == 5 and st["tails_script"] == 1
    ids = [o["id"] for m in out if m["type"] == "ops" for o in m["ops"] if o["op"] == "SAY"]
    assert ids == ["l00", "l02", "l03", "l04", "l06", "l08", "l09", "l10"]
    await s.close()
    await rt.stop()


# ---------------------------------------------------------------- 正式作品（在仓库里时才跑）
@pytest.mark.skipif(not (REAL / "game.js").is_file() or not WHALE.is_file(), reason="没有《海风与布丁》作品或鲸鱼小姐卡")
def test_real_game_matches_vn_semantics():
    card = yaml.safe_load(WHALE.read_text(encoding="utf-8"))
    ends = _equivalent(REAL, card, 200)
    assert "海风与布丁" in ends and "番外篇一" in ends and "番外篇二" in ends


def test_api_offers_engine_bridge_and_ws_runs_imported_game(tmp_path):
    from fastapi.testclient import TestClient

    from server.api.app import create_app
    from server.runtime import Runtime
    games = tmp_path / "games"
    shutil.copytree(MINI, games / "mini")
    rt = Runtime({"server": {"data_dir": str(tmp_path / "data")}, "vn": {"games_dir": str(games)},
                  "game": {"source": "vnstudio", "vn_game": "mini", "default_card": "cat"},
                  "plugins": {"paths": [str(ROOT / "plugins" / "builtin")], "select": {"memory": ["gallings.memory.local"]},
                              "config": {}, "guards": [], "tools": [], "importers": []}})
    rt.cards.builtin_dir = FIX / "cards"
    with TestClient(create_app(rt), base_url="http://127.0.0.1:8765") as c:  # 本机门卫只认 127.0.0.1
        ps = c.get("/api/vn/plugins").json()["plugins"]
        assert ps[0]["id"] == "gallings.galcore"
        js = c.get(ps[0]["url"])
        assert js.status_code == 200 and "VNPlugin.define" in js.text
        with c.websocket_connect("ws://127.0.0.1:8765/ws?endings=1") as ws:
            hello = ws.receive_json()
            assert hello["type"] == "hello" and hello["chapter"]["id"] == "mini-vn"
            seen = []
            for _ in range(6):
                m = ws.receive_json()
                if m["type"] == "ops":
                    seen += [o for o in m["ops"] if o["op"] in ("SAY", "CHOICE")]
                    if any(o["op"] == "SAY" for o in m["ops"]):
                        break
            assert seen[0]["id"] == "l00"
            ops = []
            for _ in range(3):  # l01（菜单句）上屏后再走一步才停到 CHOICE
                ws.send_json({"type": "advance"})
                got = []
                while not any(o["op"] in ("SAY", "CHOICE") for o in got):
                    m = ws.receive_json()
                    got += m.get("ops", []) if m["type"] == "ops" else []
                ops += got
                if any(o["op"] == "CHOICE" for o in got):
                    break
            menu = next(o for o in ops if o["op"] == "CHOICE")
            assert [o["label"] for o in menu["options"]] == ["从头开始", "番外"]  # 结局数=1：l00 不跳，停在菜单


async def test_save_in_player_then_restore_in_new_session(tmp_path):
    """作品存档带走引擎快照；新会话 restore 后从同一刻接着走，结果与不中断一致，日志可回放。"""
    from server.replay import replay
    games = tmp_path / "games"
    shutil.copytree(MINI, games / "mini")
    from server.runtime import Runtime
    rt = Runtime({"server": {"data_dir": str(tmp_path / "data")}, "vn": {"games_dir": str(games)},
                  "game": {"source": "vnstudio", "vn_game": "mini", "default_card": "cat"},
                  "plugins": {"paths": [str(ROOT / "plugins" / "builtin")], "select": {"memory": ["gallings.memory.local"]},
                              "config": {}, "guards": [], "tools": [], "importers": []}})
    rt.cards.builtin_dir = FIX / "cards"
    await rt.start()
    out: list[dict] = []

    async def send(m):
        out.append(m)

    a = Session(rt, SessionOptions("cat", mode="choice"), send)
    await a.hello()
    await a.handle({"type": "start", "line_id": "l02"})
    while a.state["wait"] != "choice":
        await a.handle({"type": "advance"})
    await a.handle({"type": "snapshot"})
    save = next(m for m in out if m["type"] == "snapshot")["save"]
    json.dumps(save)  # 能原样存进浏览器
    await a.handle({"type": "choose", "option_id": "l04.1"})
    while a.state["wait"] != "end":
        await a.handle({"type": "advance"})
    want = a.state
    # 调试时间轴（PLAN §14）：每行带指令摘要与状态；选择行带选项原文；拖动回放给出那一刻的台词 ID
    rows = [m["row"] for m in out if m["type"] == "timeline"]
    pick = next(r for r in rows if r["kind"] == "choice")
    assert pick["option_text"] and pick["state"]["wait"] in ("say", "choice", "end")
    assert any(o["op"] == "SAY" and o["src"].startswith("vn:") for r in rows for o in r.get("out", []))
    first_say = next(r for r in rows if any(o["op"] == "SAY" for o in r.get("out", [])))
    out.clear()
    await a.handle({"type": "seek", "seq": first_say["seq"]})
    sc = next(m for m in out if m["type"] == "screen")
    assert sc["live"] is False and sc["replay_ok"] and sc["line_id"] == first_say["out"][0]["src"][3:]
    assert a.state["wait"] == "end"  # 只看，不改当前进度
    await a.close()

    out.clear()
    b = Session(rt, SessionOptions("cat", mode="choice"), send)
    await b.hello()
    await b.handle({"type": "restore", "save": save})
    screen = next(m for m in out if m["type"] == "screen")
    assert screen["state"]["wait"] == "choice" and screen["state"]["lineage"] == "L0.1"
    await b.handle({"type": "choose", "option_id": "l04.1"})
    while b.state["wait"] != "end":
        await b.handle({"type": "advance"})
    got = b.state
    assert (got["ending"], got["affection"], got["tails_script"], got["vars"]) == \
           (want["ending"], want["affection"], want["tails_script"], want["vars"]) == ("坏结局", -2, 1, {"玩笑": 1, "结局数": 0})
    _, _, bad = replay(b.recorder.header, b.recorder.events)
    assert bad is None
    await b.close()

    out.clear()
    c = Session(rt, SessionOptions("cat", mode="choice"), send)
    await c.handle({"type": "restore", "save": {**save, "content_hash": "0" * 16}})
    assert any(m["type"] == "error" for m in out) and c.state["seq"] == 0
    await c.close()
    await rt.stop()
