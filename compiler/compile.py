"""Markdown 剧本 → Chapter JSON。

产物是一段**扁平 OP 程序**：``program[pc]`` 顺序执行，``JUMP`` / ``CHOICE`` 的目标是 pc。
这样 Rust 核心只需要一个 pc 和一张 OP 表，就能确定性地跑完整章（PLAN §6.5）。

确定性：同一输入两次编译字节一致（键排序、无时间戳）；``content_hash`` 取产物哈希。
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

COMPILER_VERSION = "0.1.0"


class CompileError(Exception):
    def __init__(self, msg: str, line: int | None = None) -> None:
        super().__init__(f"第 {line} 行：{msg}" if line else msg)
        self.line = line


def line_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


RE_RULE = re.compile(r"^━{3,}")
RE_TAG = re.compile(r"^【(场景|BGM|立绘|CG预留|事件)】(.*)$")
RE_NARR = re.compile(r"^旁白：(.*)$")
RE_PLAYER = re.compile(r"^我：「(.*)」$")
RE_OPTION = re.compile(r"^([A-Z])\s*(?:「(.*)」|（(.*)）)$")
RE_BRANCH = re.compile(r"^——([A-Z])线(?:（(.*)）)?——$")
RE_MERGE = re.compile(r"^——(.*)汇合——$")
RE_AFFECT = re.compile(r"^◆好感度([+\-]\d+)(?:（(.*)）)?$")
RE_TAIL = re.compile(r"^※(.*)$")
RE_GOTO = re.compile(r"^（→\s*(.*)）$")
RE_PAREN = re.compile(r"^（(.*)）$")
RE_SAVE = re.compile(r"^存档点：(.*)$")
RE_END = re.compile(r"^【第.+话完】$")
RE_COUNT = re.compile(r"×(\d+)")


@dataclass
class _Branch:
    choice_id: str
    letters: list[str]
    open_letter: str | None = None
    pending_jumps: list[int] = field(default_factory=list)


class _Builder:
    def __init__(self, meta: dict[str, Any], src_name: str, ids: dict[str, Any]) -> None:
        self.meta = meta
        self.src = src_name
        self.ids = ids
        self.heroine = meta["heroine_name_in_script"]
        self.program: list[dict[str, Any]] = []
        self.labels: dict[str, int] = {}
        self.fixups: list[tuple[int, str, str]] = []  # (pc, key path, label)
        self.choice_meta = list(meta.get("choices") or [])
        self.choice_idx = 0
        self.branch: _Branch | None = None
        self.pending_choice: dict[str, Any] | None = None
        self.scene: dict[str, Any] = {}
        self.in_header = False
        self.cg_pending: list[str] = []
        self.last_heroine_line: str = ""
        self.warnings: list[str] = []
        self.slot_hits: dict[str, int] = {}
        self.cg_seq = 0
        self.ended = False

    # -------------------------------------------------- helpers
    def emit(self, op: dict[str, Any], line: int) -> int:
        op = {**op, "src": f"{self.src}:{line}"}
        self.program.append(op)
        return len(self.program) - 1

    def say(self, speaker: str, text: str, layer: str, line: int) -> None:
        text = text.strip()
        if not text:
            return
        op: dict[str, Any] = {"op": "SAY", "speaker": speaker, "text": text, "layer": layer,
                              "origin": "locked" if speaker == "heroine" else "script",
                              "voice": None}  # voice：TTS 预留（PLAN §16）
        if speaker == "heroine":
            op["hash"] = line_hash(text)
            self.last_heroine_line = text
        slots = sorted({s["slot"] for s in self.meta.get("slots") or [] if s["literal"] in text})
        if slots:
            op["slots"] = slots
            for s in slots:
                self.slot_hits[s] = self.slot_hits.get(s, 0) + 1
        self.emit(op, line)

    def close_branches(self, line: int) -> None:
        """当前选项分支全部结束：未收尾的分支跳到这里的汇合点。"""
        b = self.branch
        if b is None:
            return
        label = f"merge:{b.choice_id}"
        self.labels[label] = len(self.program)
        for pc in b.pending_jumps:
            self.program[pc]["target"] = label
            self.fixups.append((pc, "target", label))
        self.emit({"op": "MERGE", "id": label}, line)
        self.branch = None

    def flush_choice(self, line: int) -> None:
        pc = self.pending_choice
        if pc is None:
            return
        self.pending_choice = None
        if self.choice_idx >= len(self.choice_meta):
            raise CompileError("剧本里的选项点多于 beats.yaml 的 choices", line)
        cm = self.choice_meta[self.choice_idx]
        self.choice_idx += 1
        natures = cm.get("natures") or {}
        options = [{"id": f"{cm['id']}.{o['letter']}", "label": o["label"],
                    "nature": natures.get(o["letter"], "诚实笨拙"),
                    "target": f"branch:{cm['id']}.{o['letter']}"} for o in pc["options"]]
        self.emit({"op": "BEAT", "beat_id": cm["beat"], "purpose": cm.get("purpose", ""),
                   "emotion_target": cm.get("emotion_target", "")}, pc["line"])
        at = self.emit({"op": "CHOICE", "id": cm["id"], "beat_id": cm["beat"], "options": options,
                        "default_line": self.last_heroine_line}, pc["line"])
        for i, o in enumerate(options):
            self.fixups.append((at, f"options.{i}.target", o["target"]))
        self.branch = _Branch(cm["id"], [o["letter"] for o in pc["options"]])

    def tail(self, desc: str, line: int) -> None:
        sig = None
        for t in self.meta.get("tail_signals") or []:
            if t["match"] in desc:
                sig = t["signal"]
                break
        if sig is None:
            self.warnings.append(f"{self.src}:{line} 尾鳍标记无法映射信号：{desc}")
            sig = "heart"
        m = RE_COUNT.search(desc)
        self.emit({"op": "TAIL", "signal_id": sig, "count": int(m.group(1)) if m else 1,
                   "desc": desc.strip(), "noticed": False, "source": "script"}, line)

    # -------------------------------------------------- 主循环
    def run(self, text: str) -> None:
        lines = text.splitlines()
        header_buf: dict[str, str] = {}
        last_tag = None
        for i, raw in enumerate(lines, start=1):
            s = raw.strip()
            if self.ended and not RE_SAVE.match(s) and not s.startswith("本章收集"):
                continue
            if not s or s.startswith(">") or s.startswith("#") or s == "---":
                continue
            if RE_RULE.match(s):
                if self.in_header:
                    self.end_header(header_buf, i)
                    header_buf, last_tag = {}, None
                    self.in_header = False
                else:
                    self.flush_choice(i)
                    self.in_header = True
                continue
            if self.in_header:
                if RE_END.match(s):  # 「【第一话完】」写在横线块里，块不闭合
                    self.close_branches(i)
                    self.ended = True
                    self.in_header = False
                    continue
                m = RE_TAG.match(s)
                if m:
                    last_tag = m.group(1)
                    header_buf[last_tag] = m.group(2).strip()
                elif last_tag:
                    header_buf[last_tag] += s
                continue
            # 正文
            if self.pending_choice is not None:
                mo = RE_OPTION.match(s)
                if mo:
                    self.pending_choice["options"].append(
                        {"letter": mo.group(1), "label": (mo.group(2) or f"（{mo.group(3)}）").strip()})
                    continue
                self.flush_choice(i)
            if s == "（选项）":
                self.pending_choice = {"line": i, "options": []}
                continue
            m = RE_BRANCH.match(s)
            if m:
                self.open_branch(m.group(1), i)
                continue
            m = RE_MERGE.match(s)
            if m:
                self.close_branches(i)
                continue
            if RE_END.match(s):
                self.close_branches(i)
                self.ended = True
                continue
            m = RE_SAVE.match(s)
            if m:
                name = m.group(1).strip()
                sid = self.ids.get("savepoints", {}).get(name)
                if sid is None:
                    self.warnings.append(f"存档点「{name}」未在附录 E 登记")
                    sid = "ch01.save.1"
                self.emit({"op": "SAVEPOINT", "id": sid, "name": name}, i)
                self.emit({"op": "END", "ending_id": f"{self.meta['chapter_id']}.end", "kind": "chapter"}, i)
                continue
            if s.startswith("本章收集"):
                continue
            m = RE_NARR.match(s)
            if m:
                self.say("narrator", m.group(1), "narration", i)
                continue
            m = RE_PLAYER.match(s)
            if m:
                self.say("player", m.group(1), "line", i)
                continue
            if s.startswith(self.heroine):
                rest = s[len(self.heroine):]
                mm = re.match(r"^「(.*)」$", rest)
                if not mm:
                    raise CompileError(f"女主台词格式不对：{s}", i)
                self.say("heroine", mm.group(1), "line", i)
                continue
            m = RE_AFFECT.match(s)
            if m:
                self.emit({"op": "AFFECT", "surface": int(m.group(1)), "inner": None,
                           "reason": (m.group(2) or "").strip(), "source": "script"}, i)
                continue
            m = RE_TAIL.match(s)
            if m:
                self.tail(m.group(1), i)
                continue
            m = RE_GOTO.match(s)
            if m:
                # 「（→ 进"糍粑事件"）」：分支收尾，跳到选项结束后的汇合处
                self.end_branch_jump(i)
                continue
            m = RE_PAREN.match(s)
            if m:
                self.say("narrator", s, "action", i)  # 括号动作描写，作为旁白的动作层
                continue
            raise CompileError(f"未识别的写法：{s}", i)
        self.close_branches(len(lines))

    def open_branch(self, letter: str, line: int) -> None:
        b = self.branch
        if b is None:
            raise CompileError(f"——{letter}线—— 前面没有选项", line)
        if b.open_letter is not None:
            self.end_branch_jump(line)
        if letter not in b.letters:
            raise CompileError(f"选项里没有 {letter}", line)
        self.labels[f"branch:{b.choice_id}.{letter}"] = len(self.program)
        b.open_letter = letter

    def end_branch_jump(self, line: int) -> None:
        b = self.branch
        if b is None or b.open_letter is None:
            return
        pc = self.emit({"op": "JUMP", "target": None}, line)
        b.pending_jumps.append(pc)
        b.open_letter = None

    def end_header(self, h: dict[str, str], line: int) -> None:
        if "场景" in h:
            self.close_branches(line)
            parts = [p.strip() for p in re.split(r"[·・]", h["场景"])]
            place, time = (parts + [""])[:2]
            self.emit({"op": "SCENE", "id": f"{place}·{time}", "bg": place, "time": time}, line)
        if "事件" in h:
            # 事件块（如糍粑事件）是分支后的公共段落：先收拢分支
            self.close_branches(line)
            self.emit({"op": "SCENE", "id": h["事件"], "bg": "", "time": "", "event": h["事件"]}, line)
        if "BGM" in h:
            self.emit({"op": "BGM", "id": h["BGM"], "fade_in": 1000, "fade_out": 1000}, line)
        if "立绘" in h:
            v = h["立绘"]
            if v.startswith("——") or not v:
                self.emit({"op": "SPRITE", "card": "heroine", "expr": None, "pos": "center",
                           "kind": "static"}, line)
            else:
                m = re.search(r"（(.*?)）", v)
                expr = m.group(1) if m else "默认"
                self.emit({"op": "SPRITE", "card": "heroine", "expr": expr, "pos": "center",
                           "kind": "static"}, line)  # kind: static|live2d（Live2D 预留）
        if "CG预留" in h:
            self.cg_seq += 1
            cg = self.ids.get("cgs_by_chapter", [])
            if self.cg_seq <= len(cg):
                cid = cg[self.cg_seq - 1]
            else:
                cid = f"{self.meta['chapter_id']}.cg.{self.cg_seq}"
                self.warnings.append(f"{self.src}:{line} CG预留「{h['CG预留'][:20]}…」未在附录 E 登记，临时编号 {cid}")
            self.emit({"op": "CG", "id": cid, "desc": h["CG预留"]}, line)


def _resolve(program: list[dict[str, Any]], labels: dict[str, int], fixups: list[tuple[int, str, str]]) -> None:
    for pc, path, label in fixups:
        if label not in labels:
            raise CompileError(f"标签未定义：{label}")
        node: Any = program[pc]
        keys = path.split(".")
        for k in keys[:-1]:
            node = node[int(k)] if k.isdigit() else node[k]
        node[keys[-1]] = labels[label]


def _successors(program: list[dict[str, Any]], pc: int) -> list[int]:
    op = program[pc]
    if op["op"] == "END":
        return []
    if op["op"] == "JUMP":
        return [op["target"]]
    if op["op"] == "CHOICE":
        return [o["target"] for o in op["options"]]
    return [pc + 1] if pc + 1 < len(program) else []


def analyze(program: list[dict[str, Any]]) -> dict[str, Any]:
    """动态规划：每个 pc 之后剧本还能给出的好感 / 尾鳍最小最大值（PLAN §6.6、§8.2）。"""
    n = len(program)
    memo: dict[int, tuple[int, int, int, int]] = {}
    reach_end: dict[int, bool] = {}

    import sys
    sys.setrecursionlimit(max(10000, n * 4))

    def visit(pc: int, stack: set[int]) -> tuple[int, int, int, int]:
        if pc in memo:
            return memo[pc]
        if pc in stack:
            raise CompileError(f"剧情图有环（pc={pc}，{program[pc]['src']}）")
        stack.add(pc)
        op = program[pc]
        da = op["surface"] if op["op"] == "AFFECT" else 0
        dt = op["count"] if op["op"] == "TAIL" else 0
        dt = 1 if dt else 0  # 一个 TAIL 标记算一次"出卖"（×N 是拍水次数，不是出卖次数）
        succ = _successors(program, pc)
        if not succ:
            r = (da, da, dt, dt)
            reach_end[pc] = op["op"] == "END"
        else:
            rs = [visit(s, stack) for s in succ]
            r = (da + min(x[0] for x in rs), da + max(x[1] for x in rs),
                 dt + min(x[2] for x in rs), dt + max(x[3] for x in rs))
            reach_end[pc] = any(reach_end[s] for s in succ)
        stack.discard(pc)
        memo[pc] = r
        return r

    total = visit(0, set())
    reachable = set(memo)
    unreachable = [p for p in range(n) if p not in reachable]
    dead = [p for p in reachable if not reach_end.get(p)]
    rem = {str(p): [memo[p][0], memo[p][1]] for p in range(n) if program[p]["op"] in ("CHOICE", "MERGE")}
    return {"affection": [total[0], total[1]], "tails": [total[2], total[3]], "rem": rem,
            "unreachable": unreachable, "dead_ends": sorted(dead)}


def load_ids(appendix_text: str | None) -> dict[str, Any]:
    """从附录 E 文本取存档点与 CG 编号（附录 E 是制作 ID 唯一数据源）。"""
    ids: dict[str, Any] = {"savepoints": {}, "cgs_by_chapter": []}
    if not appendix_text:
        return ids
    for m in re.finditer(r"\|\s*(SP-\d+)\s*\|\s*[^|]*\|\s*([^|]+?)\s*\|", appendix_text):
        ids["savepoints"].setdefault(m.group(2), m.group(1))
    for m in re.finditer(r"\|\s*(CG-\d+)\s*\|\s*一\s*\|", appendix_text):
        ids["cgs_by_chapter"].append(m.group(1))
    return ids


def compile_chapter(script_path: Path, beats_path: Path, appendix_path: Path | None = None) -> tuple[dict[str, Any], str]:
    script_path, beats_path = Path(script_path), Path(beats_path)
    meta = yaml.safe_load(beats_path.read_text(encoding="utf-8"))
    appendix = appendix_path.read_text(encoding="utf-8") if appendix_path and Path(appendix_path).is_file() else None
    ids = load_ids(appendix)
    b = _Builder(meta, script_path.name, ids)
    b.run(script_path.read_text(encoding="utf-8"))
    if b.choice_idx != len(b.choice_meta):
        raise CompileError(f"beats.yaml 声明 {len(b.choice_meta)} 个选项点，剧本里只有 {b.choice_idx} 个")
    _resolve(b.program, b.labels, b.fixups)
    an = analyze(b.program)
    lo, hi = meta["declared_affection_range"]
    warnings = list(b.warnings)
    if an["affection"] != [lo, hi]:
        warnings.append(f"好感可达区间 {an['affection']} 与剧本声明 [{lo}, {hi}] 不一致")
    if an["unreachable"]:
        warnings.append(f"不可达 OP：{[b.program[p]['src'] for p in an['unreachable']]}")
    if an["dead_ends"]:
        warnings.append(f"走不到结尾的 OP：{[b.program[p]['src'] for p in an['dead_ends']][:5]}")
    chapter = {
        "schema_version": 1,
        "compiler_version": COMPILER_VERSION,
        "chapter_id": meta["chapter_id"],
        "title": meta["title"],
        "program": b.program,
        "rules": {"affection_range": [lo, hi], "ai_tail_max": meta.get("ai_tail_max", 1),
                  "tail_total_max": meta.get("tail_total_max", 5),
                  "step_clamp": 5, "excursion_net_max": 3, "ai_rounds_max": 3},
        "analysis": an,
        "slots": [{**s, "uses": b.slot_hits.get(s["slot"], 0)} for s in meta.get("slots") or []],
        "scene_tags": meta.get("scene_tags") or [],
        "warnings": warnings,
    }
    chapter["content_hash"] = hashlib.sha256(canonical(chapter).encode("utf-8")).hexdigest()[:16]
    return chapter, render_report(chapter)


def render_report(ch: dict[str, Any]) -> str:
    an = ch["analysis"]
    ops = ch["program"]
    count = lambda k: sum(1 for o in ops if o["op"] == k)  # noqa: E731
    lines = [f"# 编译报告 · {ch['chapter_id']} {ch['title']}", "",
             f"- content_hash：`{ch['content_hash']}`",
             f"- OP 总数：{len(ops)}；选项点 {count('CHOICE')}；好感标记 {count('AFFECT')}；尾鳍标记 {count('TAIL')}；"
             f"存档点 {count('SAVEPOINT')}；CG {count('CG')}",
             f"- 好感可达区间：{an['affection'][0]} ~ {an['affection'][1]}（剧本声明 "
             f"{ch['rules']['affection_range'][0]} ~ {ch['rules']['affection_range'][1]}）",
             f"- 单条路径尾鳍出卖次数：{an['tails'][0]} ~ {an['tails'][1]}",
             f"- 不可达 OP：{len(an['unreachable'])}；死路：{len(an['dead_ends'])}", "",
             "## 槽位清单（建卡校验用）", ""]
    for s in ch["slots"]:
        lines.append(f"- `{s['slot']}`（{s['type']}）= {s['literal']}，用到 {s['uses']} 处")
    lines += ["", "## 警告", ""]
    lines += [f"- {w}" for w in ch["warnings"]] or ["- 无"]
    return "\n".join(lines) + "\n"
