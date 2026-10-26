"""旧制作导出的序列化与只读作者投影。

唯一作者源是 content/story/project.json 及其登记文件。
读取本仓库原 game.js 地址时只在内存组装旧制作数据；禁止写回该地址
或新作者目录。外部独立历史导出仍可使用原来的 JS 序列化格式。
此模块不执行条件、动作或剧情流转，不维护第二套可写作者数据。
"""

from __future__ import annotations

import json
import pathlib

HEADER = 'window.VN_GAME = {'
TRAILER = '};'
# 这些键的每个子元素独占一行
LINE_KEYS = ('assets', 'lines', 'chars')
_COMPACT = (',', ':')


def loads(text: str) -> dict:
    """从 game.js 的完整文本里取出数据字典。"""
    body = text.strip()
    if body.startswith('window.VN_GAME'):
        body = body.split('=', 1)[1].strip()
    if body.endswith(';'):
        body = body[:-1]
    return json.loads(body)


def load(path) -> dict:
    try:
        from .author_project import current_project, is_current_source
    except ImportError:
        from author_project import current_project, is_current_source
    if is_current_source(pathlib.Path(path)):
        return current_project()
    return loads(pathlib.Path(path).read_text(encoding='utf-8'))


def _container(value, indent: int) -> str:
    """容器键的渲染：每个元素一行，元素内部紧凑。"""
    pad = ' ' * indent
    if isinstance(value, dict):
        if not value:
            return '{}'
        rows = [
            pad + '  ' + json.dumps(k, ensure_ascii=False) + ': '
            + json.dumps(v, ensure_ascii=False, separators=_COMPACT)
            for k, v in value.items()
        ]
        return '{\n' + ',\n'.join(rows) + '\n' + pad + '}'
    if not value:
        return '[]'
    rows = [pad + '  ' + json.dumps(v, ensure_ascii=False, separators=_COMPACT) for v in value]
    return '[\n' + ',\n'.join(rows) + '\n' + pad + ']'


def dumps(data: dict) -> str:
    """按约定格式输出完整 game.js 文本。"""
    rows = [HEADER]
    keys = list(data.keys())
    for index, key in enumerate(keys):
        value = data[key]
        comma = ',' if index < len(keys) - 1 else ''
        name = json.dumps(key, ensure_ascii=False)
        if key in LINE_KEYS and isinstance(value, (dict, list)):
            rows.append('  ' + name + ': ' + _container(value, 2) + comma)
        else:
            body = json.dumps(value, ensure_ascii=False, indent=2).replace('\n', '\n  ')
            rows.append('  ' + name + ': ' + body + comma)
    rows.append(TRAILER)
    return '\n'.join(rows) + '\n'


def save(path, data: dict) -> None:
    """写回 game.js。

    行尾交给平台默认处理（Windows 上为 CRLF，与 git checkout 的结果一致），
    这样脚本写回后工作区字节不变，git status 保持干净。
    """
    try:
        from .author_project import is_current_source
    except ImportError:
        from author_project import is_current_source
    target = pathlib.Path(path).resolve()
    author_root = pathlib.Path(__file__).resolve().parents[1] / "content/story"
    if is_current_source(target) or target == author_root or author_root in target.parents:
        raise ValueError("旧制作工具不能写回作者源；请编辑 content/story 的章节文件或使用独立对白编辑入口")
    pathlib.Path(path).write_text(dumps(data), encoding='utf-8')
