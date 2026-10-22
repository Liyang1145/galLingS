"""Saved settings still resolve to a usable game directory after the layout move."""
from pathlib import Path

from server import runtime
from server.__main__ import _has_games
from tools.oneoff.integrate_atri_music import music_source


def test_missing_saved_directory_falls_back_to_default(tmp_path, monkeypatch):
    """设置里存的老路径（旧仓库结构）已失效时，回退到默认作品目录。"""
    monkeypatch.setattr(runtime, "ROOT", tmp_path)
    default = tmp_path / runtime.GAME_DIR
    default.mkdir(parents=True)
    (default / "index.html").write_text("game")
    config = {"vn": {"games_dir": "content/imports/vnstudio"},
              "server": {"data_dir": str(tmp_path / "data")}}
    assert runtime.resolve_games_dir(config) == default
    assert _has_games(config)


def test_single_game_directory_is_detected(tmp_path, monkeypatch):
    """作品目录本身就是一个作品（含 index.html）时，也要认。"""
    monkeypatch.setattr(runtime, "ROOT", tmp_path)
    game = tmp_path / "作品"
    game.mkdir()
    (game / "index.html").write_text("game")
    config = {"vn": {"games_dir": "作品"}}
    assert runtime.resolve_games_dir(config) == game
    assert _has_games(config)


def test_custom_parent_directory_with_sub_games(tmp_path, monkeypatch):
    """旧的多作品布局（父目录下每个子文件夹一个作品）继续兼容。"""
    monkeypatch.setattr(runtime, "ROOT", tmp_path)
    custom = tmp_path / "custom"
    (custom / "g").mkdir(parents=True)
    (custom / "g" / "index.html").write_text("game")
    config = {"vn": {"games_dir": str(custom)}}
    assert runtime.resolve_games_dir(config) == custom
    assert _has_games(config)


def test_music_source_uses_actual_historical_delivery_path(tmp_path):
    old = tmp_path / "music/mp3/E1.mp3"
    old.parent.mkdir(parents=True)
    old.write_bytes(b"old delivery")
    assert music_source(tmp_path, "E1.mp3").relative_to(tmp_path).as_posix() == "music/mp3/E1.mp3"
    new = tmp_path / "A素材库/music/mp3/E2.mp3"
    new.parent.mkdir(parents=True)
    new.write_bytes(b"new delivery")
    assert music_source(tmp_path, "E2.mp3") == new
