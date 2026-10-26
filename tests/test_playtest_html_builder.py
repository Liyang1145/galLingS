"""Exercise the single-file exporter against runtime and archived asset paths."""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

BUILDER = Path(__file__).resolve().parents[1] / 'tools/build_playtest_html.py'


class PlaytestHtmlBuilderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.game = self.root / 'game'
        (self.game / 'assets').mkdir(parents=True)
        Image.new('RGB', (8, 8), '#2895c4').save(self.game / 'assets/current.png')
        (self.game / 'index.html').write_text('<html><head><link rel="stylesheet" href="game-polish.css"></head><body><script src="game.js"></script><script src="player.js"></script></body></html>', encoding='utf-8')
        (self.game / 'player.js').write_text('window.exportedPlayer=true;', encoding='utf-8')
        (self.game / 'game-polish.css').write_text('body{color:white}', encoding='utf-8')
        data = {'assets': {'bg': {'src': 'assets/current.png', 'previousSourcePath': 'assets/archived.png'}}, 'lines': []}
        (self.game / 'game.js').write_text('window.VN_GAME=' + json.dumps(data) + ';', encoding='utf-8')

    def build(self):
        return subprocess.run([sys.executable, '-X', 'utf8', str(BUILDER), str(self.root / 'play.html'), str(self.game)], capture_output=True, text=True, encoding='utf-8')

    def test_runtime_asset_is_embedded_and_history_is_not_required(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('missing 0', result.stdout)
        page = (self.root / 'play.html').read_text(encoding='utf-8')
        self.assertIn('window.exportedPlayer=true;', page)
        self.assertNotIn('<script src="player.js">', page)
        game_script = next(s for s in re.findall(r'<script>(.*?)</script>', page, re.S) if 'window.VN_GAME=' in s)
        code = 'const vm=require("vm");let c={window:{}};vm.createContext(c);vm.runInContext(' + json.dumps(game_script) + ',c);console.log(JSON.stringify(c.window.VN_GAME));'
        executed = subprocess.run(['node', '-e', code], capture_output=True, text=True, encoding='utf-8', check=True)
        exported = json.loads(executed.stdout)['assets']['bg']
        self.assertTrue(exported['src'].startswith('data:image/'))
        self.assertEqual(exported['previousSourcePath'], 'assets/archived.png')

    def test_missing_runtime_asset_stops_export(self):
        (self.game / 'assets/current.png').unlink()
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Missing runtime assets: assets/current.png', result.stderr)
        self.assertFalse((self.root / 'play.html').exists())

    def test_dynamic_local_plugin_is_embedded(self):
        (self.game / 'player.js').write_text("const s=document.createElement('script');s.src = 'galagent.vnplugin.js';document.head.appendChild(s);", encoding='utf-8')
        (self.game / 'galagent.vnplugin.js').write_text('window.localPluginLoaded=true;', encoding='utf-8')
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        page = (self.root / 'play.html').read_text(encoding='utf-8')
        self.assertNotIn("s.src = 'galagent.vnplugin.js';", page)
        self.assertIn('data:text/javascript;base64,', page)

    def test_missing_dynamic_plugin_stops_export(self):
        (self.game / 'player.js').write_text("s.src = 'galagent.vnplugin.js';", encoding='utf-8')
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Missing runtime plugin: galagent.vnplugin.js', result.stderr)
        self.assertFalse((self.root / 'play.html').exists())


if __name__ == '__main__':
    unittest.main()
