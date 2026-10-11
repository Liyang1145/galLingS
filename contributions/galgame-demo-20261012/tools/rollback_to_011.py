"""One-time, source-preserving rollback requested by the project owner."""
from pathlib import Path
import shutil, zipfile, datetime

root = Path(__file__).resolve().parents[1]
backup = root/'backups'/('before-rollback-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
targets = [root/'海风与布丁_第一季_全卷_v5.0.md', *[root/x for x in ['README.md','HANDOFF.md','NEXT.md','VALIDATION.md','运行游戏.bat','tools/build_chapter.py','tools/source_map.json']], *list((root/'Seabreeze/game').glob('*.rpy*'))]
for src in targets:
    if src.is_file():
        dst=backup/src.relative_to(root)
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)
original=(root/'海风与布丁_第一季_全卷_v5.0.md.bak').read_text(encoding='utf-8-sig')
assert len(original.encode('utf-8')) == 271484
(root/'海风与布丁_第一季_全卷_v5.0.md').write_bytes(original.encode('utf-8'))
with zipfile.ZipFile(root/'dist/SeabreezePudding-0.1.1-win.zip') as z:
    assert z.testzip() is None
    for name in ['chapter01.rpy','core.rpy','options.rpy']:
        data=z.read('SeabreezePudding-0.1.1-win/game/'+name)
        (root/'Seabreeze/game'/name).write_bytes(data)
        # Restore the runnable old release from the archive as well.
        (root/'dist/SeabreezePudding-0.1.1-win/game'/name).write_bytes(data)
(root/'运行游戏.bat').write_bytes(b'@echo off\r\nstart "" /D "%~dp0dist\\SeabreezePudding-0.1.1-win" "%~dp0dist\\SeabreezePudding-0.1.1-win\\SeabreezePudding.exe"\r\n')
print('Backup:', backup)
print('Restored original manuscript and archived 0.1.1 game sources.')
