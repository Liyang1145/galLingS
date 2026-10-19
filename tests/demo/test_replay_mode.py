"""录制回放演示模式（PLAN §2.1、§20）：录一局 → 通过 /ws 重播 → 画面消息与原局逐条相同、state_hash 一致；
篡改日志一行 → 停在第一处分歧。重播用的服务器不配模型，证明重播不调用模型。"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server.recorder import read_log_full
from server.replay import list_logs, reconstruct_sent, replay
from server.session import Session, SessionOptions

from .conftest import FIX, jtext, make_runtime, tool

BASE = "http://127.0.0.1:8765"


async def _record(tmp_path: Path, mini_dir: Path) -> tuple[Session, list[dict]]:
    responses = [
        jtext({"intent": "剧本外", "matched_option": "", "confidence": 0.1}),
        {"tool_calls": [tool("say", text="（尾巴一甩）两脚兽，你看什么看喵。"),
                        tool("propose_affection", surface=1, reason="被搭话"),
                        tool("say", text="……哼。")]},
    ]
    rt = make_runtime(tmp_path, mini_dir, FIX / "cards", responses)
    await rt.start()
    out: list[dict] = []

    async def send(m):
        out.append(m)

    s = Session(rt, SessionOptions("cat", mode="ai", seed=7), send)
    await s.hello()
    await s.handle({"type": "advance"})
    while s.state["wait"] != "choice":
        await s.handle({"type": "advance"})
    await s.handle({"type": "input", "text": "早上好，小猫"})          # AI 回合：即兴台词来自模型
    assert s.state["wait"] == "choice"
    await s.handle({"type": "choose", "option_id": s.choice_op["options"][0]["id"]})
    for _ in range(40):
        st = s.state["wait"]
        if st == "end":
            break
        if st == "choice":
            await s.handle({"type": "choose", "option_id": s.choice_op["options"][-1]["id"]})
        else:
            await s.handle({"type": "advance"})
    assert s.state["wait"] == "end"
    await s.close()
    await rt.stop()
    return s, out


def _screen_msgs(msgs: list[dict]) -> list[dict]:
    return [m for m in msgs if m["type"] in ("ops", "screen", "notice")]


def _drain(ws, until: str = "done") -> tuple[list[dict], dict | None]:
    got, last = [], None
    for _ in range(2000):
        m = ws.receive_json()
        got.append(m)
        if m["type"] == "replay" and m["event"] in (until, "diverged"):
            last = m
            break
    return got, last


def _client(tmp_path: Path, mini_dir: Path) -> TestClient:
    from server.api.app import create_app
    rt = make_runtime(tmp_path, mini_dir, FIX / "cards", None)  # 不配模型
    return TestClient(create_app(rt), base_url=BASE)


@pytest.mark.asyncio
async def test_replay_over_ws_matches_live_game(tmp_path, mini_dir):
    s, live = await _record(tmp_path, mini_dir)
    h, events, sent = read_log_full(s.recorder.path)
    assert sent and replay(h, events)[2] is None
    live_screen = _screen_msgs(live)
    assert [x["msg"] for x in sent] == live_screen
    improvised = [o["text"] for m in live_screen if m["type"] == "ops" for o in m["ops"] if o["op"] == "SAY" and o.get("origin") == "improvised"]
    assert "（尾巴一甩）两脚兽，你看什么看喵。" in improvised

    # 旧日志（没有 sent 行）：按事件重建出来的画面消息也和原局一样
    assert [x["msg"] for x in reconstruct_sent(h, events, json.loads(Path(h["chapter_path"]).read_text(encoding="utf-8")))] == live_screen

    with _client(tmp_path, mini_dir) as c:
        logs = c.get("/api/replays").json()["logs"]
        mine = next(x for x in logs if x["id"] == s.id)
        assert mine["events"] == len(events) and mine["ai_turns"] == 1 and mine["recorded_screen"]
        for url in (f"/ws/replay?log={s.id}&speed=1000", f"/ws?replay={s.id}&speed=1000"):
            with c.websocket_connect("ws://127.0.0.1:8765" + url) as ws:
                hello = ws.receive_json()
                assert hello["type"] == "hello" and hello["replay"]["steps"] == len(events)
                assert hello["llm"] is False and hello["chapter"]["id"] == s.chapter["chapter_id"]
                got, last = _drain(ws)
                assert last["event"] == "done" and last["ok"]
                assert _screen_msgs(got) == live_screen                       # 前端收到的 ops 与实时局逐条相同
                rows = [m["row"] for m in got if m["type"] == "timeline"]
                assert [r["state_hash"] for r in rows] == [e["state_hash"] for e in events]
                chooses = [m for m in got if m["type"] == "replay" and m["event"] == "choose"]
                assert [m["option_id"] for m in chooses] == [e["payload"]["option_id"] for e in events if e["kind"] == "choice"]
                assert chooses[0]["label"]
                assert any(m["type"] == "replay" and m["event"] == "input" and m["text"] == "早上好，小猫" for m in got)
                # 重播时玩家操作不生效
                ws.send_json({"type": "advance"})
                assert ws.receive_json()["event"] == "ignored"


@pytest.mark.asyncio
async def test_replay_controls_pause_step_jump(tmp_path, mini_dir):
    s, live = await _record(tmp_path, mini_dir)
    with _client(tmp_path, mini_dir) as c:
        with c.websocket_connect(f"ws://127.0.0.1:8765/ws/replay?log={s.id}&speed=1000&paused=1") as ws:
            assert ws.receive_json()["replay"]["paused"] is True
            ws.send_json({"type": "step"})
            got, last = _drain(ws, until="step")
            assert last["at"] == 1
            ws.send_json({"type": "jump", "step": 5})
            m = ws.receive_json()
            assert m["type"] == "screen" and m["replay"] and m["at"] == 5 and m["state"]["op"] == "STATE"
            assert ws.receive_json()["event"] == "control"
            ws.send_json({"type": "speed", "speed": 2})
            assert ws.receive_json()["speed"] == 2
            ws.send_json({"type": "speed", "speed": 1000})
            ws.receive_json()
            ws.send_json({"type": "resume"})
            got, last = _drain(ws)
            assert last["event"] == "done"
            steps = [m["at"] for m in got if m["type"] == "replay" and m["event"] == "step"]
            assert steps[0] == 6 and steps[-1] == len(s.recorder.events)


@pytest.mark.asyncio
async def test_tampered_log_stops_at_first_divergence(tmp_path, mini_dir):
    s, _ = await _record(tmp_path, mini_dir)
    p = s.recorder.path
    lines = p.read_text(encoding="utf-8").splitlines()
    events = [json.loads(x) for x in lines[1:] if json.loads(x)["kind"] != "sent"]
    target = next(e for e in events if e["kind"] == "choice")
    k = next(i for i, x in enumerate(lines) if json.loads(x).get("seq") == target["seq"] and json.loads(x)["kind"] != "sent")
    row = json.loads(lines[k])
    a_id = row["payload"]["option_id"]
    row["payload"]["option_id"] = a_id[:-1] + ("B" if a_id.endswith("A") else "A")   # 篡改：把玩家的选项换成另一个
    lines[k] = json.dumps(row, ensure_ascii=False, separators=(",", ":"))
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    with _client(tmp_path, mini_dir) as c:
        with c.websocket_connect(f"ws://127.0.0.1:8765/ws/replay?log={s.id}&speed=1000") as ws:
            ws.receive_json()
            got, last = _drain(ws)
            assert last["event"] == "diverged" and last["seq"] == target["seq"]
            h, evs, _ = read_log_full(p)
            assert replay(h, evs)[2] == target["seq"]                    # 与命令行校验报的是同一处
            assert last["expected"] == target["state_hash"] and last["got"] != target["state_hash"]
            # 分歧那一步之后什么都没再下发
            assert all(m["row"]["seq"] < target["seq"] for m in got if m["type"] == "timeline")
    assert list_logs(tmp_path / "data")[0]["id"] == s.id


def test_cli_verifies_log(tmp_path, mini_dir, capsys):
    import asyncio

    from server.replay import main
    s, _ = asyncio.run(_record(tmp_path, mini_dir))
    assert main([str(s.recorder.path)]) == 0
    assert "回放一致" in capsys.readouterr().out


def test_front_end_has_replay_entry():
    from .conftest import ROOT
    js = (ROOT / "web" / "galcore.vnplugin.js").read_text(encoding="utf-8")
    assert "/ws/replay?" in js and "galcore-pick" in js and "replay_speed" in js
    html = (ROOT / "web" / "vn.html").read_text(encoding="utf-8")
    assert 'id="replayBtn"' in html and 'id="replayDlg"' in html
