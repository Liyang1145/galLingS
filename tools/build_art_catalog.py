"""Index production art (not review screenshots) without changing the playable project."""
from __future__ import annotations

import hashlib
import json
import csv
import subprocess
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "content/imports/vnstudio/海风与布丁"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def build() -> dict:
    text = (GAME / "game.js").read_text(encoding="utf-8-sig")
    project = json.loads(text[text.index("=") + 1:].strip().removesuffix(";"))
    scenes = json.loads((ROOT / "content/assets/scene-backgrounds/场景素材台账.json").read_text(encoding="utf-8-sig"))["items"]
    scene_paths = {str(v["path"]).replace("\\", "/"): (k, v["name"]) for k, v in scenes.items()}
    roots = [GAME / "assets/bg", GAME / "assets/ch", ROOT / "content/assets/backgrounds",
             ROOT / "content/assets/scene-backgrounds/originals", ROOT / "content/assets/scene-backgrounds/records",
             ROOT / "content/assets/image-trials", GAME / "assets/art-upgrade",
             ROOT / "content/assets/art-upgrade/originals", ROOT / "content/assets/art-upgrade/runtime"]
    upgrade_dir=ROOT / 'content/assets/art-upgrade'
    upgrade=json.loads((upgrade_dir/'production.json').read_text(encoding='utf-8'))['items'] if (upgrade_dir/'production.json').exists() else {}
    reviews=json.loads((upgrade_dir/'reviews.json').read_text(encoding='utf-8')) if (upgrade_dir/'reviews.json').exists() else {}
    paths = sorted({f for d in roots for f in d.rglob("*") if f.suffix.lower() in IMAGE_EXTENSIONS})
    by_hash = defaultdict(list)
    for f in paths:
        by_hash[hashlib.sha256(f.read_bytes()).hexdigest()].append(f)
    runtime = defaultdict(list)
    for a in project["assets"].values():
        if a["type"] in {"bg", "ch"}:
            runtime[(GAME / a["src"]).resolve()].append(a)
    usage = defaultdict(list)
    for i, line in enumerate(project["lines"]):
        if line.get("bg"):
            usage[line["bg"]].append(i)
        for sprite in line.get("sprites", []):
            usage[sprite["asset"]].append(i)
    cover_id = project.get("settings", {}).get("cover", {}).get("img")
    thumb_dir = GAME / "assets/editor-thumbs"
    thumb_dir.mkdir(exist_ok=True)
    items = []
    for digest, files in by_hash.items():
        # Runtime variant first. Exact source duplicates remain available as file variants.
        files.sort(key=lambda f: (not bool(runtime.get(f.resolve())), "records" in f.parts, f.as_posix()))
        file = files[0]
        refs = [a for f in files for a in runtime.get(f.resolve(), [])]
        refs.sort(key=lambda a: (-len(usage[a["id"]]), a["id"]))
        asset = refs[0] if refs else None
        upgraded=any('art-upgrade' in f.parts for f in files)
        art_key=file.stem.split('_')[0] if upgraded else None
        art_item=upgrade.get(art_key,{})
        paths_rel = [f.relative_to(ROOT).as_posix() for f in files]
        scene = next((scene_paths[p] for p in paths_rel if p in scene_paths), None)
        if not scene and file.parent.name == "scenes":
            scene = (file.stem, scenes.get(file.stem, {}).get("name", file.stem))
        generation = None
        if scene and not upgraded:
            record = ROOT / "content/assets/scene-backgrounds/originals" / (scene[0] + ".generation.json")
            if record.is_file():
                generation = json.loads(record.read_text(encoding="utf-8-sig"))
        if not generation:
            record = file.with_suffix(".generation.json")
            if upgraded and not record.exists():
                record=upgrade_dir/'originals'/f'{file.stem}.generation.json'
                if not record.exists() and art_key=='L01':record=upgrade_dir/'originals/R01_clean.generation.json'
            if record.is_file():
                generation = json.loads(record.read_text(encoding="utf-8-sig"))
        if generation and generation.get('workflow')=='user-supplied-refinement':
            provenance = {"creator":"用户转交的队友精修图", "tool":"精修工具未登记",
                "requestedModel":"", "reportedModel":"", "requestedQuality":"", "reportedQuality":"",
                "routeVerified":False, "label":"队友精修成品；模型与提示词未随包提供",
                "evidence":"archive/deliveries/refined-cg-20261016/manifest.json",
                "action":"保留精修原件；按剧情和结构逐项审核，不继承旧图生成参数"}
        elif generation:
            provenance = {"creator":"Codex 图像请求", "tool":"Codex OAuth 图像桥",
                "requestedModel":generation.get("requested_model", ""),
                "reportedModel":generation.get("backend_reported_model") or "",
                "requestedQuality":generation.get("requested_quality") or '',
                "reportedQuality":generation.get("backend_reported_quality") or '',
                "routeVerified":generation.get("model_selection_verified") is True,
                "label":"已请求 Image2.5；后端未确认路由" if not generation.get("model_selection_verified") else "后端已确认路由",
                "evidence":record.relative_to(ROOT).as_posix(), "action":"保留已审核图；路线信息待核实"}
        elif scene or any("/backgrounds/" in p for p in paths_rel):
            provenance = {"creator":"用户提供", "tool":"网页端生成", "requestedModel":"用户称 Image2.5",
                "reportedModel":"", "routeVerified":False, "label":"用户网页端原件；路线未核实",
                "evidence":"content/assets/scene-backgrounds/场景素材台账.json", "action":"保留用户已采用图；来源待补登记"}
        else:
            provenance = {"creator":"LarryE135 完整作品", "tool":"未登记", "requestedModel":"",
                "reportedModel":"", "routeVerified":False, "label":"队友原件；生成模型未登记",
                "evidence":"archive/deliveries/larry-vn/manifest.json", "action":"使用中的人物/CG/封面待统一重制；旧背景留档"}
        category = "ch" if (asset and asset["type"] == "ch") or "/ch/" in paths_rel[0] or file.name.startswith("R01_") else "cg" if file.stem.upper().startswith("CG_") else "bg"
        if upgraded:
            kind=art_item.get('kind')
            category='ch' if kind=='sprite' or file.stem.startswith('R01') else 'cg' if kind=='cg' else 'bg'
        indices = sorted({i for a in refs for i in usage[a["id"]]})
        if indices or any(a["id"] == cover_id for a in refs):
            status = "adopted"
        elif any(a.get("previewExcluded") for a in refs):
            status = "rework"
        elif any("/records/" in p for p in paths_rel):
            status = "rejected"
        elif any("/image-trials/" in p for p in paths_rel):
            status = "candidate"
        elif scene and not refs:
            status = "source"
        elif refs:
            status = "reserve"
        else:
            status = "replaced"
        if upgraded and not indices and not any(a['id']==cover_id for a in refs):
            review=reviews.get(art_key,{})
            current=review.get('status') if review.get('sha256')==art_item.get('sha256') else art_item.get('review')
            archived=file.stem not in upgrade and not file.stem.startswith('R01')
            status='rejected' if archived or current=='rejected' else 'reserve' if current=='approved' else 'rework'
        if upgraded and file.stem in upgrade and art_item.get('gap'):provenance['action']=art_item['gap']
        with Image.open(file) as image:
            width, height = image.size
            thumb_path = thumb_dir / (digest[:16] + ".webp")
            if not thumb_path.exists():
                thumb = image.convert("RGBA")
                thumb.thumbnail((400, 320))
                thumb.save(thumb_path, "WEBP", quality=76, method=6)
        items.append({
            "id": asset["id"] if asset else "art_" + digest[:16],
            "name": asset["name"] if asset else (file.stem+'·'+art_item['name']) if art_item else (scene[0] + "·" + scene[1]) if scene else file.stem,
            "category": category, "status": status, "path": paths_rel[0], "files": paths_rel,
            "sha256": digest, "w": width, "h": height,
            "thumb": thumb_path.relative_to(ROOT).as_posix(),
            "runtimeIds": [a["id"] for a in refs], "usage": len(indices), "firstLine": indices[0] if indices else None,
            "scene": scene[0] if scene else None,
            "productionArtId":art_key,
            "character":'鲸鱼小姐' if upgraded and category=='ch' else (asset or {}).get('character'),
            "sourceMasterPath":asset.get('sourceMasterPath') if asset else None,
            "asset": asset,
            "provenance": provenance,
        })
    items.sort(key=lambda a: (a["category"], a["status"] != "adopted", a["scene"] or "", a["name"]))
    catalog = {"projectId": project["id"], "base": subprocess.check_output(["git", "rev-parse", "HEAD"],cwd=ROOT,text=True).strip(),
               "projectFingerprint":hashlib.sha256((GAME / "game.js").read_bytes()).hexdigest(),
               "physicalFiles": len(paths), "items": items,
               "scope": "全部运行美术、参考重制PNG母版、WebP、试制及退选原件均可调用；同SHA合并为文件变体。用户身份参考、审核截图与缩略图不作生产素材。"}
    out = GAME / "art-catalog.js"
    out.write_text("// Generated by tools/build_art_catalog.py; read-only production art catalog.\nwindow.VN_ART_CATALOG = " + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8",newline='\n')
    audit = ROOT / "docs/content/art-production/美术资产来源与路线登记.csv"
    with audit.open("w",encoding="utf-8-sig",newline="") as stream:
        writer=csv.writer(stream);writer.writerow(["素材ID","名称","类型","采用状态","来源","工具","请求模型","后端确认模型","路由已确认","剧情引用句数","文件","后续处理"])
        for a in items:
            p=a["provenance"];writer.writerow([a["id"],a["name"],a["category"],a["status"],p["creator"],p["tool"],p["requestedModel"],p["reportedModel"],p["routeVerified"],a["usage"],a["path"],p["action"]])
    return catalog


if __name__ == "__main__":
    result = build()
    print(json.dumps({"files": result["physicalFiles"], "items": len(result["items"])}))
