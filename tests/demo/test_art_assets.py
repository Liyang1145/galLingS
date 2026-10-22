"""Authoring can read source art, never arbitrary project files or archives."""
from fastapi.testclient import TestClient

from server.api.app import create_app
from .conftest import FIX, make_runtime


def test_art_file_access_and_boundaries(tmp_path, mini_dir, monkeypatch):
    from server.api import app as api
    root = tmp_path / "repo"
    art = root / "素材库/backgrounds/a.png"
    art.parent.mkdir(parents=True)
    art.write_bytes(b"source-art")
    sprite = root / "content/imports/vnstudio/game/assets/ch/b.webp"
    sprite.parent.mkdir(parents=True)
    sprite.write_bytes(b"sprite")
    secret = root / "素材库/credentials.json"
    secret.write_text('"secret"')
    outside = root / "content/not-art.png"
    outside.write_bytes(b"nope")
    monkeypatch.setattr(api, "ROOT", root)
    rt = make_runtime(tmp_path, mini_dir, FIX / "cards", None)
    rt.config.setdefault("vn", {})["games_dir"] = str(root / "content/imports/vnstudio")
    rt.base_config.setdefault("vn", {})["games_dir"] = str(root / "content/imports/vnstudio")
    with TestClient(create_app(rt), base_url="http://127.0.0.1:8765") as client:
        assert client.get("/art-assets/assets/backgrounds/a.png").content == b"source-art"
        assert client.get("/art-assets/imports/vnstudio/game/assets/ch/b.webp").content == b"sprite"
        for path in ["assets/credentials.json", "not-art.png", "assets/%2e%2e/not-art.png",
                     "assets/backgrounds/missing.png", "imports/vnstudio/game/index.html", "../config.yaml"]:
            assert client.get("/art-assets/" + path).status_code == 404, path
