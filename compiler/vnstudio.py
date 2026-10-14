"""VN Studio 导出（game.js 里的 ``window.VN_GAME``）→ galLingS 章节 JSON（OP 程序）。

PLAN §6 / §16.1：剧情是数据，由 galcore 跑；VN Studio 作品经这个导入器变成 OP 程序，
画面仍由作品自己的播放器按 ``SAY.id``（= VN Studio 句子 ID）渲染。

映射（每句一组 OP，句子 ID 原样保留，存档 / 素材 / 剧本定位不重编号，见台账 C05）：

- ``chapter``  → ``CHAPTER``（只渲染）
- ``bg`` 变化   → ``SCENE``（换场：结算傲娇缓冲、心情回落）
- ``bgm`` 变化  → ``BGM``（只渲染）
- ``set``      → ``SET``；``好感`` → 通道 ``affection``，``尾鳍`` → ``tails``，其余进 ``vars``
- 说话 / 空句   → ``SAY``（空句 ``pause: true``，鲸鱼小姐的台词按原作锁定并带哈希）
- ``choices``  → ``CHOICE``（选项 ``set`` / ``cond`` 由引擎执行；限时写进 ``timeout``）
- ``ending``   → ``END``
- ``jump``     → ``JUMP`` / ``JUMP_IF``
- 文件末尾      → ``END``（``script_end``）

确定性：同一输入两次导入字节一致（``canonical``）。
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from .compile import CompileError, canonical, line_hash

#: VN Studio 变量名 → 引擎通道
VAR_MAP = {"好感": "affection", "尾鳍": "tails"}
#: VN Studio 说话人 → 引擎说话人（女主角名取作品设置 settings.soul.char，缺省取角色表第一个）
SPEAKER_MAP = {"我": "player", "": "narrator"}

_SET_RE = re.compile(r"^\s*([^\s=+\-<>!&;]+)\s*(\+=|-=|=)\s*(-?\d+)\s*$")
_COND_RE = re.compile(r"^\s*([^\s=<>!&]+)\s*(<=|>=|==|!=|<|>)\s*(-?\d+)\s*$")


def read_game_js(path: Path) -> dict[str, Any]:
    """读 ``window.VN_GAME = {...};``。"""
    s = Path(path).read_text(encoding="utf-8")
    i = s.find("{")
    if i < 0:
        raise CompileError(f"{path} 里找不到 VN_GAME 数据")
    data, end = json.JSONDecoder().raw_decode(s, i)
    if s[end:].strip() not in ("", ";"):
        raise CompileError(f"{path} 在 VN_GAME 之后还有代码，导入器只接受纯数据导出")
    return data


def _var(name: str) -> str:
    return VAR_MAP.get(name, name)


def parse_set(text: str, where: str) -> list[dict[str, Any]]:
    out = []
    for part in (text or "").split(";"):
        if not part.strip():
            continue
        m = _SET_RE.match(part)
        if not m:
            raise CompileError(f"{where}：看不懂的变量修改「{part.strip()}」")
        out.append({"var": _var(m.group(1)), "op": m.group(2), "value": int(m.group(3))})
    return out


def parse_cond(text: str, where: str) -> list[dict[str, Any]] | None:
    if not (text or "").strip():
        return None
    out = []
    for part in text.split("&&"):
        m = _COND_RE.match(part)
        if not m:
            raise CompileError(f"{where}：看不懂的条件「{part.strip()}」")
        out.append({"var": _var(m.group(1)), "cmp": m.group(2), "value": int(m.group(3))})
    return out


def import_vnstudio(game: dict[str, Any], *, game_dir_name: str = "") -> tuple[dict[str, Any], str]:
    lines: list[dict[str, Any]] = game.get("lines") or []
    assets: dict[str, Any] = game.get("assets") or {}
    if not lines:
        raise CompileError("VN_GAME.lines 为空")
    heroine = ((game.get("settings") or {}).get("soul") or {}).get("char") or \
        next((c.get("name") for c in game.get("chars") or [] if c.get("name") != "我"), "")
    speakers = {**SPEAKER_MAP, heroine: "heroine"} if heroine else dict(SPEAKER_MAP)

    program: list[dict[str, Any]] = []
    labels: dict[str, int] = {}
    line_start: list[int] = []
    fixups: list[tuple[dict[str, Any], str, str, int]] = []  # (对象, 字段, 标签, 缺省目标行)
    problems: list[str] = []
    prev_bg: str | None = None
    prev_bgm: Any = object()

    def emit(op: dict[str, Any]) -> int:
        program.append(op)
        return len(program) - 1

    def src_of(aid: Any) -> str:
        a = assets.get(aid) if isinstance(aid, str) else None
        return (a or {}).get("src", "")

    for k, ln in enumerate(lines):
        lid = ln.get("id") or f"line{k}"
        where = f"第 {k + 1} 句（{lid}）"
        line_start.append(len(program))
        if ln.get("label"):
            if ln["label"] in labels:
                problems.append(f"{where}：标签「{ln['label']}」重复，沿用第一次出现的位置")
            else:
                labels[ln["label"]] = len(program)
        if ln.get("chapter"):
            emit({"op": "CHAPTER", "id": ln.get("label") or ln["chapter"], "title": ln["chapter"], "src": f"vn:{lid}"})
        bg = ln.get("bg")
        if bg and bg != prev_bg:
            if bg not in assets:
                problems.append(f"{where}：背景素材 {bg} 不在素材表")
            emit({"op": "SCENE", "id": bg, "bg": src_of(bg), "name": (assets.get(bg) or {}).get("name", ""),
                  "src": f"vn:{lid}"})
            prev_bg = bg
        bgm = ln.get("bgm")
        if bgm != prev_bgm:
            emit({"op": "BGM", "id": bgm, "file": src_of(bgm) if bgm else "", "src": f"vn:{lid}"})
            prev_bgm = bgm
        if ln.get("set"):
            emit({"op": "SET", "set": parse_set(ln["set"], where), "src": f"vn:{lid}"})

        name = ln.get("speaker") or ""
        speaker = speakers.get(name, name)
        text = ln.get("text") or ""
        say: dict[str, Any] = {"op": "SAY", "id": lid, "speaker": speaker, "name": name, "text": text,
                               "layer": "line", "origin": "script", "voice": None, "src": f"vn:{lid}"}
        if speaker == "heroine" and text:
            say["origin"] = "locked"
            say["hash"] = line_hash(text)
        if not text:
            say["pause"] = True
        emit(say)

        choices = ln.get("choices") or []
        if choices:
            opts = []
            for j, c in enumerate(choices):
                o: dict[str, Any] = {"id": f"{lid}.{j}", "label": c.get("text", ""), "target": None}
                st = parse_set(c.get("set", ""), f"{where} 选项 {j + 1}")
                if st:
                    o["set"] = st
                cd = parse_cond(c.get("cond", ""), f"{where} 选项 {j + 1}")
                if cd:
                    o["cond"] = cd
                fixups.append((o, "target", c.get("target") or "", k + 1))
                opts.append(o)
            ch: dict[str, Any] = {"op": "CHOICE", "id": f"c:{lid}", "line_id": lid, "beat_id": "", "options": opts,
                                  "src": f"vn:{lid}"}
            if ln.get("ctime"):
                default = next((o["id"] for o, c in zip(opts, choices) if c.get("target") == ln.get("cdef")), opts[-1]["id"])
                ch["timeout"] = {"seconds": int(ln["ctime"]), "default_option": default}
            emit(ch)
        elif ln.get("ending"):
            emit({"op": "END", "ending_id": ln["ending"], "kind": "ending", "src": f"vn:{lid}"})
        elif ln.get("jump"):
            cond = parse_cond(ln.get("jumpIf", ""), where)
            op = {"op": "JUMP_IF", "cond": cond, "target": None} if cond else {"op": "JUMP", "target": None}
            op["src"] = f"vn:{lid}"
            fixups.append((op, "target", ln["jump"], k + 1))
            emit(op)

    end_pc = emit({"op": "END", "ending_id": "script_end", "kind": "script_end", "src": "vn:<eof>"})
    line_start.append(end_pc)

    for obj, field, label, fallback in fixups:
        if not label:
            obj[field] = line_start[fallback]
        elif label in labels:
            obj[field] = labels[label]
        else:
            raise CompileError(f"跳转目标标签「{label}」不存在")

    rem, lo, hi, cyclic = _analyse(program)
    ch = {
        "format": "gallings.chapter/1",
        "chapter_id": game.get("id") or "vnstudio",
        "title": game.get("title") or "",
        "source": {"kind": "vnstudio", "game": game_dir_name, "vn_version": game.get("v"),
                   "lines": len(lines), "heroine": heroine},
        "asset_base": f"/vn/{game_dir_name}/" if game_dir_name else "",
        "program": program,
        "labels": labels,
        "slots": [],
        "vars": [{"name": v.get("name"), "var": _var(v.get("name", "")), "init": int(v.get("init") or 0)}
                 for v in game.get("vars") or []],
        "rules": {"affection_range": [lo, hi]},
        "analysis": {"rem": rem},
    }
    ch["content_hash"] = hashlib.sha256(canonical(ch).encode("utf-8")).hexdigest()[:16]
    report = _report(ch, lines, problems, cyclic)
    return ch, report


def _delta(op: dict[str, Any]) -> tuple[int, bool]:
    """(本 OP 的好感增量, 是否为重置)。"""
    d = 0
    for m in op.get("set") or []:
        if m["var"] == "affection":
            if m["op"] == "=":
                return 0, True
            d += m["value"] if m["op"] == "+=" else -m["value"]
    return d, False


def _analyse(program: list[dict[str, Any]]) -> tuple[dict[str, list[int]], int, int, bool]:
    """每个选项点之后剧本还会给多少好感（最少 / 最多，到结尾或重置为止），以及全程可达区间。"""
    n = len(program)
    memo: dict[int, tuple[int, int]] = {}
    cyclic = False

    def succ(pc: int) -> list[tuple[int, int, bool]]:
        op = program[pc]
        k = op["op"]
        if k == "END":
            return []
        if k == "JUMP":
            return [(op["target"], 0, False)]
        if k == "JUMP_IF":
            return [(op["target"], 0, False), (pc + 1, 0, False)]
        if k == "CHOICE":
            out = []
            for o in op["options"]:
                d, r = _delta(o)
                out.append((o["target"], d, r))
            return out
        return [(pc + 1, 0, False)]

    # 迭代式后序 DFS，避免 3000 多句递归过深
    state: dict[int, int] = {}
    for root in range(n):
        if root in memo:
            continue
        stack = [(root, 0)]
        while stack:
            pc, i = stack.pop()
            if i == 0:
                if pc in memo:
                    continue
                state[pc] = 1
            edges = succ(pc)
            if i < len(edges):
                stack.append((pc, i + 1))
                nxt = edges[i][0]
                if nxt not in memo and state.get(nxt) != 1:
                    stack.append((nxt, 0))
                elif state.get(nxt) == 1 and nxt not in memo:
                    cyclic = True
                continue
            own, reset = _delta(program[pc]) if program[pc]["op"] == "SET" else (0, False)
            if reset:
                memo[pc] = (0, 0)
            elif not edges:
                memo[pc] = (own, own)
            else:
                vals = []
                for nxt, d, r in edges:
                    if r:
                        vals.append((own + d, own + d))
                    else:
                        a, b = memo.get(nxt, (0, 0))
                        vals.append((own + d + a, own + d + b))
                memo[pc] = (min(v[0] for v in vals), max(v[1] for v in vals))
            state[pc] = 2

    rem = {str(p): [memo[p][0], memo[p][1]] for p in range(n) if program[p]["op"] == "CHOICE"}
    lo, hi = memo[0]
    lo, hi = min(lo, 0), max(hi, 0)
    # 重置之后从重置值重新累计
    for p, op in enumerate(program):
        if op["op"] == "SET":
            for m in op["set"]:
                if m["var"] == "affection" and m["op"] == "=" and p + 1 < n:
                    a, b = memo[p + 1]
                    lo, hi = min(lo, m["value"] + a, m["value"]), max(hi, m["value"] + b, m["value"])
    return rem, lo, hi, cyclic


def _report(ch: dict[str, Any], lines: list[dict[str, Any]], problems: list[str], cyclic: bool) -> str:
    prog = ch["program"]
    count = lambda k: sum(1 for o in prog if o["op"] == k)  # noqa: E731
    endings = [o["ending_id"] for o in prog if o["op"] == "END" and o.get("kind") == "ending"]
    chapters = [o["title"] for o in prog if o["op"] == "CHAPTER"]
    lo, hi = ch["rules"]["affection_range"]
    out = [f"# 导入报告：{ch['title']}（VN Studio → OP）", "",
           f"- 句子 {len(lines)}，OP {len(prog)}，content_hash `{ch['content_hash']}`",
           f"- 章节 {len(chapters)}：{'、'.join(chapters)}",
           f"- 选项点 {count('CHOICE')}，条件跳转 {count('JUMP_IF')}，跳转 {count('JUMP')}，变量修改 {count('SET')}",
           f"- 结局 {len(endings)}：{'、'.join(endings)}",
           f"- 剧本好感可达区间 [{lo}, {hi}]（AI 好感预算按此裁剪）",
           f"- 图结构：{'有环（预算按无环近似）' if cyclic else '无环'}", ""]
    if problems:
        out += ["## 提示", ""] + [f"- {p}" for p in problems] + [""]
    return "\n".join(out)


def import_dir(game_dir: Path) -> tuple[dict[str, Any], str]:
    game_dir = Path(game_dir)
    return import_vnstudio(read_game_js(game_dir / "game.js"), game_dir_name=game_dir.name)


def ensure_imported(game_dir: Path, cache_dir: Path) -> Path:
    """导入结果缓存到 cache_dir；game.js 比缓存新就重导。"""
    game_dir = Path(game_dir)
    src = game_dir / "game.js"
    cache_dir.mkdir(parents=True, exist_ok=True)
    out = cache_dir / f"{game_dir.name}.chapter.json"
    if not out.exists() or src.stat().st_mtime > out.stat().st_mtime:
        ch, report = import_dir(game_dir)
        out.write_text(canonical(ch) + "\n", encoding="utf-8", newline="\n")
        (cache_dir / f"{game_dir.name}.report.md").write_text(report, encoding="utf-8", newline="\n")
    return out
