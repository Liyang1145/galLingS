"""便携包的复制边界和现有输出保护；不下载 Python 或启动后端。"""
import importlib.util
import csv
import json
from pathlib import Path, PurePosixPath
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("windows_app", Path(__file__).resolve().parents[1] / "tools/build_windows_app.py")
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class WindowsPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        for directory in builder.CODE_DIRS:
            (self.root / directory).mkdir(parents=True)
        (self.root / "server/__main__.py").write_text("pass\n")
        (self.root / "requirements.txt").write_text("fastapi\n")
        (self.root / "config.example.yaml").write_text("game: {vn_game: 海风与布丁}\n", encoding="utf-8")
        self.game = self.root / builder.GAME_NAME
        (self.game / "assets").mkdir(parents=True)
        (self.game / "assets/real.webp").write_bytes(b"approved-picture")
        (self.game / "index.html").write_text('<script src="game.js"></script>')
        (self.game / "game.js").write_text('window.VN_GAME=' + json.dumps({"assets": {"bg": {"src": "assets/real.webp"}}, "lines": [{"id": "original", "bg": "bg"}]}) + ';')

    def tearDown(self):
        self.temporary.cleanup()

    def test_uses_root_game_and_excludes_production_archives(self):
        for relative in ["A素材库/cg-animations/a.mp4", "contributions/whale-girl-live2d-base/a.moc3", "art-candidates/unapproved.png", "plugins/builtin/fake/secrets.json", "plugins/builtin/fake/a.webm", "config.yaml"]:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"not-for-release")
        plan = builder.payload_plan(self.root, self.game)
        self.assertIn(f"galLingS/{builder.GAME_NAME}/assets/real.webp", plan)
        self.assertTrue(all(builder.allowed_path(PurePosixPath(name)) for name in plan))
        self.assertFalse(any("unapproved" in name or "secrets" in name or "live2d" in name for name in plan))

    def test_current_game_bytes_not_rewritten(self):
        plan = builder.payload_plan(self.root, self.game)
        self.assertEqual(plan[f"galLingS/{builder.GAME_NAME}/game.js"].read_bytes(), (self.game / "game.js").read_bytes())

    def test_local_install_origin_removed_without_changing_package(self):
        python = self.root / "python"
        site = python / "Lib/site-packages"
        info = site / "example-1.0.dist-info"
        info.mkdir(parents=True)
        origin = info / "direct_url.json"
        origin.write_text(json.dumps({"url": "file:///C:/Users/build-user/wheels/example.whl"}))
        metadata = info / "METADATA"
        metadata.write_bytes(b"Name: example\nVersion: 1.0\n")
        record = info / "RECORD"
        with record.open("w", encoding="utf-8", newline="") as handle:
            csv.writer(handle).writerows([
                ["example-1.0.dist-info/direct_url.json", "sha256=origin", "80"],
                ["example/data,with-comma.txt", "sha256=content", "10"],
            ])
        self.assertEqual(builder.remove_local_install_sources(python), 1)
        self.assertFalse(origin.exists())
        self.assertEqual(metadata.read_bytes(), b"Name: example\nVersion: 1.0\n")
        with record.open(encoding="utf-8", newline="") as handle:
            self.assertEqual(list(csv.reader(handle)), [["example/data,with-comma.txt", "sha256=content", "10"]])

    def test_public_install_origin_is_preserved(self):
        python = self.root / "python"
        info = python / "Lib/site-packages/example-1.0.dist-info"
        info.mkdir(parents=True)
        origin = info / "direct_url.json"
        original = json.dumps({"url": "https://packages.example.org/example.whl"}).encode()
        origin.write_bytes(original)
        self.assertEqual(builder.remove_local_install_sources(python), 0)
        self.assertEqual(origin.read_bytes(), original)

    def test_forbidden_media_reference_is_reported(self):
        (self.game / "game.js").write_text('window.VN_GAME=' + json.dumps({"assets": {"video": {"src": "assets/a.mp4"}}, "lines": []}) + ';')
        with self.assertRaisesRegex(ValueError, "已排除"):
            builder.game_files(self.game)

    def test_parent_paths_are_rejected(self):
        for path in ["../outside.png", "assets/../../outside.png", "C:/secret.png", "/outside.png"]:
            with self.assertRaises(ValueError):
                builder.local_ref(path)

    def test_existing_output_not_modified(self):
        out = self.root / "already-there"
        out.mkdir()
        sentinel = out / "keep.txt"
        sentinel.write_text("keep")
        exe = self.root / "game.exe"
        exe.write_bytes(b"MZ-fixture")
        with self.assertRaisesRegex(ValueError, "输出目录已存在"):
            builder.main(["--source", str(self.root), "--exe", str(exe), "--python-dir", "prepared", "--out", str(out)])
        self.assertEqual(sentinel.read_text(), "keep")

    def test_assembly_copies_only_manifest_entries_and_retains_host(self):
        exe = self.root / "game.exe"
        exe.write_bytes(b"MZ-fixture")
        out = self.root / "portable"
        with patch.object(builder, "install_python") as install:
            self.assertEqual(builder.main(["--source", str(self.root), "--exe", str(exe), "--python-dir", "prepared", "--out", str(out)]), 0)
            install.assert_called_once()
        self.assertEqual((out / f"{builder.GAME_NAME}.exe").read_bytes(), exe.read_bytes())
        self.assertEqual((out / "galLingS" / builder.GAME_NAME / "game.js").read_bytes(), (self.game / "game.js").read_bytes())
        report = json.loads((out / "运行资源清单.json").read_text(encoding="utf-8"))
        self.assertFalse(report["nnnVideosIncluded"])
        self.assertFalse(report["nnnLive2DIncluded"])
        self.assertFalse(report["rebuildIncluded"])


if __name__ == "__main__":
    unittest.main()
