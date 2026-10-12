"""Retiring the old player must leave API startup and card editing usable."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from server.api.app import create_app


def test_retired_player_and_remaining_pages():
    runtime = SimpleNamespace(start=AsyncMock(), stop=AsyncMock())
    with TestClient(create_app(runtime=runtime), base_url="http://127.0.0.1:8765") as client:  # 本机门卫只认 127.0.0.1
        root = client.get("/", follow_redirects=False)
        assert root.status_code == 307
        assert root.headers["location"] == "/docs"
        assert client.get("/docs").status_code == 200
        assert client.get("/static/index.html").status_code == 404
        assert client.get("/static/player.js").status_code == 404
        cards = client.get("/cards.html")
        assert cards.status_code == 200
        assert "保存角色卡" in cards.text
        assert "启用并重演第一话" not in cards.text
        assert client.get("/static/cards.js").status_code == 200
        assert client.get("/static/style.css").status_code == 200
    runtime.start.assert_awaited_once()
    runtime.stop.assert_awaited_once()
