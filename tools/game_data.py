"""作品数据 game.js 的读写（统一的序列化格式）。

格式约定（2026-10-22 起固定）：

    window.VN_GAME = {
      "v": 3,
      "assets": {
        "md2p8m90": {"id":"md2p8m90","type":"bg",...},
        ...
      },
      "lines": [
        {"label":"","chapter":"第一话 · 浅滩上的偶遇",...},
        ...
      ],
      ...
    };

- 顶层键缩进 2 空格；
- `assets` / `lines` / `chars` 属于「容器键」：每个元素独立一行，元素内部紧凑无空格；
- 其余键用标准 indent=2。

这样做的好处：改一句台词只影响一行，git diff 可读；文件体积只比单行多约 1%。
**所有写回 game.js 的脚本都必须走这里**，不要各自用 json.dumps 另设参数，
否则格式会被改来改去、diff 全废。

为什么扩展名仍是 .js 而不是 .json：作品要支持 `file://` 双击直开，
fetch 本地 .json 会被同源策略拦掉，纯 JSON 塞进 <script> 又会被当 JS 解析报错。
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
    pathlib.Path(path).write_text(dumps(data), encoding='utf-8')
