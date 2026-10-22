"""Saved art adjustments must become portable media, without embedding private files."""
import base64
import json

import pytest

from tools import build_single_file_game as pack


def test_saved_project_export_keeps_adjustments_and_prunes_unused_library(tmp_path, monkeypatch):
    root = tmp_path / "repo"
    game = root / "content/imports/vnstudio/game"
    game.mkdir(parents=True)
    source = root / "素材库/new.png"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"source-image")
    (game / "cover.webp").write_bytes(b"cover-image")
    (game / "index.html").write_text('<link rel="stylesheet" href="game-polish.css"><script src="game.js"></script>', encoding="utf-8")
    (game / "game-polish.css").write_text('body{background:url("cover.webp")}', encoding="utf-8")
    monkeypatch.setattr(pack, "ROOT", root)
    monkeypatch.setattr(pack, "GAME", game)
    monkeypatch.setattr(pack.mimetypes, "guess_type", lambda name: ("application/octet-stream", None))
    imported = "data:image/png;base64," + base64.b64encode(b"imported-image").decode()
    project = {"id":"stable-project", "assets":{
        "bg": {"type":"bg", "src":"http://old-host/art-assets/assets/new.png", "libraryPath":"素材库/new.png"},
        "unused": {"type":"bg", "src":"missing.png", "libraryPath":"素材库/missing.png"},
        "import": {"type":"ch", "src":imported},
    }, "lines":[{"id":"stable-node", "bg":"bg", "chapter":"First", "sprites":[{"asset":"import", "x":701, "h":620}]}]}
    saved = tmp_path / "adjusted.vnproj.json"
    saved.write_text(json.dumps(project), encoding="utf-8")
    output = tmp_path / "play.html"
    result = pack.build(output, saved)
    html = output.read_text(encoding="utf-8")
    assert result["assets"] == 2 and result["files"] == 3
    assert '"x":701' in html and '"h":620' in html and 'stable-node' in html
    assert 'data:image/png;base64,' in html and imported in html
    assert 'data:image/webp;base64,' in html
    assert 'old-host' not in html and 'missing.png' not in html
    assert '<link' not in html and 'src="game.js"' not in html
    # A crafted project may not package arbitrary local files even if disguised as media.
    private = root / "private.png"
    private.write_bytes(b"private")
    project["assets"]["bg"]["libraryPath"] = "private.png"
    saved.write_text(json.dumps(project), encoding="utf-8")
    with pytest.raises(ValueError, match="unsafe media"):
        pack.build(output, saved)
