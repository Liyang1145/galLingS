"""Existing local settings and historical deliveries survive the directory move."""
from pathlib import Path

from server import runtime
from server.__main__ import _has_games
from tools.integrate_atri_music import music_source


def test_saved_legacy_directory_opens_migrated_game(tmp_path, monkeypatch):
    monkeypatch.setattr(runtime, "ROOT", tmp_path)
    migrated = tmp_path / "content/imports/vnstudio"
    (migrated / "game").mkdir(parents=True)
    (migrated / "game/index.html").write_text("game")
    legacy = tmp_path / "content/vn"
    legacy.mkdir(parents=True)
    (legacy / "README.md").write_text("old empty directory")
    for saved in ("content/vn", str(legacy), "content\\vn"):
        if saved == "content\\vn" and Path(saved).parts == (saved,):
            continue  # Windows spelling is an ordinary filename on POSIX.
        config = {"vn": {"games_dir": saved}, "server": {"data_dir": str(tmp_path / "data")}}
        assert runtime.resolve_games_dir(config) == migrated
        assert _has_games(config)
    custom = tmp_path / "custom"
    assert runtime.resolve_games_dir({"vn": {"games_dir": str(custom)}}) == custom
    (legacy / "other").mkdir()
    (legacy / "other/index.html").write_text("user's retained game")
    assert runtime.resolve_games_dir({"vn": {"games_dir": "content/vn"}}) == legacy


def test_music_source_uses_actual_historical_delivery_path(tmp_path):
    old = tmp_path / "music/mp3/E1.mp3"
    old.parent.mkdir(parents=True)
    old.write_bytes(b"old delivery")
    assert music_source(tmp_path, "E1.mp3").relative_to(tmp_path).as_posix() == "music/mp3/E1.mp3"
    new = tmp_path / "content/assets/music/mp3/E2.mp3"
    new.parent.mkdir(parents=True)
    new.write_bytes(b"new delivery")
    assert music_source(tmp_path, "E2.mp3") == new
