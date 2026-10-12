"""作品页：作品列表 / 作品文件（防目录穿越）/ 网页设置（密钥只回末 4 位、存本机、改完插件重启）。"""
from __future__ import annotations

from fastapi.testclient import TestClient

from server.api.app import create_app

from .conftest import FIX, make_runtime


def _client(tmp_path, mini_dir):
    rt = make_runtime(tmp_path, mini_dir, FIX / "cards", None)
    games = tmp_path / "vn"
    (games / "作品甲").mkdir(parents=True)
    (games / "作品甲" / "index.html").write_text("<p>game</p>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("nope", encoding="utf-8")
    rt.config.setdefault("vn", {})["games_dir"] = str(games)
    rt.base_config.setdefault("vn", {})["games_dir"] = str(games)
    return TestClient(create_app(rt), base_url="http://127.0.0.1:8765"), rt


def test_games_and_files(tmp_path, mini_dir):
    c, _ = _client(tmp_path, mini_dir)
    with c:
        assert c.get("/api/vn/games").json()["games"] == [{"id": "作品甲", "title": "作品甲"}]
        assert c.get("/vn/作品甲/index.html").text == "<p>game</p>"
        assert c.get("/vn/作品甲/../../secret.txt").status_code == 404
        assert c.get("/vn/作品甲/%2e%2e/%2e%2e/secret.txt").status_code == 404
        assert c.get("/vn/%2e%2e/secret.txt").status_code == 404   # 作品名本身是 ".."
        assert c.get("/vn.html").status_code == 200


def test_settings_roundtrip(tmp_path, mini_dir, monkeypatch):
    monkeypatch.delenv("GALLINGS_LLM_API_KEY", raising=False)
    c, rt = _client(tmp_path, mini_dir)
    with c:
        s = c.get("/api/settings").json()
        assert s["llm"]["key_set"] is False and s["memory"]["use"] == "local"
        r = c.post("/api/settings", json={"llm": {"base_url": "http://127.0.0.1:9", "model": "m1", "api_key": "sk-abcdef123456"}}).json()
        assert r["llm"]["model"] == "m1" and r["llm"]["key_tail"] == "3456" and "sk-abc" not in str(r)
        assert r["llm_ready"]  # 有密钥后 openai-compat 插件能启动
        assert (rt.data_dir / "secrets.json").stat().st_mode & 0o777 == 0o600
        r = c.post("/api/settings", json={"llm": {"api_key": ""}}).json()  # 清除
        assert r["llm"]["key_set"] is False


def test_lingshu_path_check(tmp_path):
    from server.api.app import lingshu_path_problem
    assert "没有灵枢" in lingshu_path_problem(str(tmp_path))
    (tmp_path / "dsh" / "md_cg").mkdir(parents=True)
    (tmp_path / "dsh" / "md_cg" / "mcp_server.py").write_text("")
    assert "下一层" in lingshu_path_problem(str(tmp_path))
    assert lingshu_path_problem(str(tmp_path / "dsh")) == ""


def test_local_only_guard(tmp_path, mini_dir):
    """没有登录的 /api/settings 只认本机网页：挡 DNS 重绑定（Host）和别的网站的后台请求（Origin）。"""
    c, _ = _client(tmp_path, mini_dir)
    with c:
        assert c.get("/api/settings").status_code == 200
        assert c.get("/api/settings", headers={"Origin": "http://localhost:8765"}).status_code == 200
        assert c.get("/api/settings", headers={"Host": "evil.example:8765"}).status_code == 403
        assert c.post("/api/settings", json={"llm": {"base_url": "http://evil.example"}},
                      headers={"Origin": "http://evil.example"}).status_code == 403
        assert c.get("/api/settings").json()["llm"]["base_url"] != "http://evil.example"
        import pytest
        from starlette.websockets import WebSocketDisconnect
        with pytest.raises(WebSocketDisconnect):
            with c.websocket_connect("ws://127.0.0.1:8765/ws/soul?card=cat", headers={"Origin": "http://evil.example"}) as ws:
                ws.receive_text()
    # server.host 改成 0.0.0.0（自己开局域网）：不查 Host，同源网页照常可用，别的网站仍然挡
    rt2 = make_runtime(tmp_path / "lan", mini_dir, FIX / "cards", None)
    rt2.base_config["server"]["host"] = "0.0.0.0"
    c2 = TestClient(create_app(rt2), base_url="http://192.168.1.5:8765")
    with c2:
        assert c2.post("/api/settings", json={}, headers={"Origin": "http://192.168.1.5:8765"}).status_code == 200
        assert c2.post("/api/settings", json={}, headers={"Origin": "http://evil.example"}).status_code == 403
    with c:
        with c.websocket_connect("ws://127.0.0.1:8765/ws/soul?card=cat", headers={"Origin": "null"}) as ws:  # 双击打开的游戏（file://）
            ws.send_text('{"type":"hello"}')
            assert '"hello"' in ws.receive_text()
