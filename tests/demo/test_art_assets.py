"""Authoring can read source art, never arbitrary project files or archives."""
from fastapi.testclient import TestClient

from server.api.app import create_app
from .conftest import FIX, make_runtime


def test_art_file_access_and_boundaries(tmp_path, monkeypatch):
    from server.api import app as api
    root = tmp_path / "repo"
    art = root / "A素材库/backgrounds/a.png"
    art.parent.mkdir(parents=True)
    art.write_bytes(b"source-art")
    sprite = root / "海风与布丁/assets/ch/b.webp"
    sprite.parent.mkdir(parents=True)
    sprite.write_bytes(b"sprite")
    (root / "海风与布丁/index.html").write_text("game")
    secret = root / "A素材库/credentials.json"
    secret.write_text('"secret"')
    outside = root / "content/not-art.png"
    outside.parent.mkdir(parents=True)
    outside.write_bytes(b"nope")
    monkeypatch.setattr(api, "ROOT", root)
    rt = make_runtime(tmp_path, FIX / "cards", None)
    rt.config.setdefault("vn", {})["games_dir"] = str(root / "海风与布丁")
    rt.base_config.setdefault("vn", {})["games_dir"] = str(root / "海风与布丁")
    with TestClient(create_app(rt), base_url="http://127.0.0.1:8765") as client:
        # 作品资源与 A素材库 都可读
        assert client.get("/art-assets/A素材库/backgrounds/a.png").content == b"source-art"
        assert client.get("/art-assets/海风与布丁/assets/ch/b.webp").content == b"sprite"
        # 非图片、目录外、路径穿越一律拒绝
        for path in ["A素材库/credentials.json", "content/not-art.png", "A素材库/%2e%2e/not-art.png",
                     "A素材库/backgrounds/missing.png", "海风与布丁/index.html", "../config.yaml"]:
            assert client.get("/art-assets/" + path).status_code == 404, path
