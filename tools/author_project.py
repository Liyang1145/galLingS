"""Read-only projection of the chapter author source for retained legacy tools.

This module assembles data only. It never evaluates conditions, runs a story,
writes chapter files, or persists a second game.js author source.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content/story"
LEGACY_FILE = ROOT / "海风与布丁/game.js"
RESOURCE_FILES = ("resources/backgrounds.json", "resources/characters.json",
                  "resources/music.json", "resources/sounds.json", "resources/voices.json")
FIXED_FILES = ("project.json", "variables.json", "settings.json", "origins.json",
               "resources/index.json", *RESOURCE_FILES)
MAX_BYTES = 16 * 1024 * 1024


def is_current_source(path: Path) -> bool:
    return Path(path).resolve() == LEGACY_FILE.resolve()


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("作者 JSON 含重复对象键")
        result[key] = value
    return result


def _constant(_value):
    raise ValueError("作者 JSON 不能含 NaN 或 Infinity")


def _read_snapshot() -> tuple[dict, dict[str, bytes]]:
    lock = SOURCE / ".author-lock"
    if lock.exists() or lock.is_symlink():
        raise ValueError("作者源正在写入或有未完成事务；先处理 content/story/.author-lock")
    files = {}
    total = 0

    def read(file):
        nonlocal total
        path = SOURCE / file
        if path.resolve() != ROOT.resolve() / "content/story" / file or not path.is_file():
            raise ValueError(f"作者文件缺失或不在原目录：content/story/{file}")
        if path.stat().st_size + total > MAX_BYTES:
            raise ValueError("作者源超过 16 MiB")
        data = path.read_bytes()
        total += len(data)
        if total > MAX_BYTES:
            raise ValueError("作者源超过 16 MiB")
        files[file] = data
        return json.loads(data.decode("utf-8-sig"), object_pairs_hook=_pairs, parse_constant=_constant)

    project = read("project.json")
    if set(project) != {"format", "workId", "title", "entryNodeId", "chapters"} or project["format"] != "haifeng.author-project/1":
        raise ValueError("不是分章作者作品清单")
    chapters = project["chapters"]
    if not isinstance(chapters, list) or not 1 <= len(chapters) <= 1000:
        raise ValueError("章节数量无效")
    seen_ids, seen_files = set(), set()
    for chapter in chapters:
        if set(chapter) != {"id", "file"} or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", chapter["id"]) \
                or not re.fullmatch(r"chapters/[a-z0-9][a-z0-9-]*\.json", chapter["file"]) \
                or chapter["id"] in seen_ids or chapter["file"] in seen_files:
            raise ValueError("章节身份或文件无效/重复")
        seen_ids.add(chapter["id"])
        seen_files.add(chapter["file"])
    for file in (*FIXED_FILES[1:], *(chapter["file"] for chapter in chapters)):
        read(file)
    for file, data in files.items():
        path = SOURCE / file
        if path.resolve() != ROOT.resolve() / "content/story" / file or path.read_bytes() != data:
            raise ValueError("读取期间作者源改变，请重读")
    if lock.exists() or lock.is_symlink():
        raise ValueError("作者源事务尚未完成")
    return project, files


def _digest(files: dict[str, bytes]) -> str:
    entries = [{"file": file, "sha256": hashlib.sha256(data).hexdigest()} for file, data in sorted(files.items())]
    return hashlib.sha256(json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def current_digest() -> str:
    """Aggregate raw author hash, including direct edits to any registered chapter."""
    return _digest(_read_snapshot()[1])


def current_project() -> dict:
    project, files = _read_snapshot()

    def value(file):
        return json.loads(files[file].decode("utf-8-sig"), object_pairs_hook=_pairs, parse_constant=_constant)

    origins = value("origins.json")
    if origins["format"] != "haifeng.author-origins/1":
        raise ValueError("作者来源格式无效")
    result = copy.deepcopy(origins["metadata"])
    result.update(id=project["workId"], title=project["title"], settings=value("settings.json"))
    assets = {}
    for kind, file in zip(("bg", "ch", "bgm", "se", "vo"), RESOURCE_FILES):
        for key, asset in value(file).items():
            if key in assets or asset.get("id") != key or asset.get("type") != kind:
                raise ValueError("资源身份或分类无效")
            assets[key] = asset
    order = value("resources/index.json")
    if not isinstance(order, list) or len(order) != len(assets) or len(set(order)) != len(order) or set(order) != set(assets):
        raise ValueError("资源顺序清单不完整或重复")
    result["assets"] = {key: assets[key] for key in order}
    nodes, node_ids, choice_ids, labels = [], set(), set(), set()
    for entry in project["chapters"]:
        chapter = value(entry["file"])
        if set(chapter) != {"format", "id", "title", "nodes"} or chapter["format"] != "haifeng.author-chapter/1" \
                or chapter["id"] != entry["id"] or not isinstance(chapter["title"], str) or not chapter["nodes"]:
            raise ValueError("章节格式或身份无效")
        for index, raw in enumerate(chapter["nodes"]):
            node = copy.deepcopy(raw)
            if "chapter" in node or not isinstance(node.get("id"), str) or not node["id"] or node["id"] in node_ids:
                raise ValueError("节点身份无效或重复")
            node_ids.add(node["id"])
            node["chapter"] = chapter["title"] if index == 0 else ""
            if node.get("label"):
                if node["label"] in labels:
                    raise ValueError("节点标签重复")
                labels.add(node["label"])
            for choice in node["choices"]:
                cid = choice.get("id")
                if not isinstance(cid, str) or not cid or cid in choice_ids:
                    raise ValueError("选项身份无效或重复")
                choice_ids.add(cid)
            nodes.append(node)
    if project["entryNodeId"] not in node_ids:
        raise ValueError("正式起点不存在")
    # Existing targets retain their old labels; new unlabeled targets get an isolated projection label.
    by_id = {node["id"]: node for node in nodes}
    def target(node_id):
        if node_id not in by_id:
            raise ValueError("跳转节点不存在")
        node = by_id[node_id]
        if not node.get("label"):
            label = "__author_node_" + node_id
            if label in labels:
                raise ValueError("旧制作投影标签冲突")
            labels.add(label)
            node["label"] = label
        return node["label"]
    for node in nodes:
        default = node.get("cdef", "")
        if default:
            matches = [c for c in node["choices"] if c["id"] == default]
            if len(matches) != 1 or not matches[0].get("target"):
                raise ValueError("旧制作投影不能表示这个限时默认项")
            node["cdef"] = target(matches[0]["target"])
        for choice in node["choices"]:
            choice.pop("id")
            if choice.get("target"):
                choice["target"] = target(choice["target"])
        if node.get("jump"):
            node["jump"] = target(node["jump"])
    variables = []
    for variable in value("variables.json"):
        if set(variable) != {"name", "type", "initial"}:
            raise ValueError("变量声明含未知字段")
        initial = variable["initial"]
        kind = "boolean" if isinstance(initial, bool) else "number" if isinstance(initial, (float, int)) else "string" if isinstance(initial, str) else None
        if variable["type"] != kind:
            raise ValueError("变量初值与类型不符")
        text = str(initial).lower() if isinstance(initial, bool) else str(initial)
        variables.append({"name": variable["name"], "init": text})
    result.update(lines=nodes, vars=variables)
    return result
