"""Explicit musical cues for Atri's named tracks; preserve original story and masters."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "content/vn/海风与布丁"
DELIVERY = ROOT / "docs/deliveries/atri-music"
TRACKS = [
    ("E1.mp3", "bgm_atri_e1_comedy", "Atri · 傲娇互动（E1）", False, 0),
    ("E2.mp3", "bgm_atri_e2_deepsea", "Atri · 深海之光（E2）", False, -3),
    ("E7.mp3", "bgm_atri_e7_reflection", "Atri · 独白与思考（E7）", False, -2),
    ("E6或E5.mp3", "bgm_atri_e5_e6_candidate", "Atri · E5 / E6 用途待定", True, -1),
    ("M6？.mp3", "bgm_atri_m6_candidate", "Atri · 居家曲 M6？候选", True, 0),
]
# Half-open intervals refer to existing nodes; the report also records stable IDs.
CUES = [
    (3, 13, "bgm_atri_e7_reflection", "第一话：醒来、笔记本与未知世界；尾击前结束"),
    (166, 193, "bgm_atri_e1_comedy", "第二话：礁石后躲藏、酸梅汤与销毁证据；认真谈暗号前结束"),
    (384, 454, "bgm_atri_e2_deepsea", "第三话：下潜、蓝色珊瑚与第一次深海之光"),
    (454, 467, "bgm_atri_e7_reflection", "第三话：旧对话碎片与身份验证"),
    (467, 498, "bgm_atri_e2_deepsea", "第三话：拨开长发、牵手、上岸后的余韵"),
    (498, 509, "bgm_atri_e7_reflection", "第三话：帐篷中替她记录的验证独白"),
    (530, 574, "bgm_atri_e1_comedy", "第四话：手链摊与我妻子的喜剧情境；回程恢复原曲"),
    (786, 825, "bgm_atri_e7_reflection", "第六话：十五天对话伙伴的来历与身份回溯"),
]


def probe(path: Path) -> dict:
    data = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))
    stream = next(s for s in data["streams"] if s["codec_type"] == "audio")
    return {"codec":stream["codec_name"], "duration":float(data["format"]["duration"]),
            "channels":stream["channels"], "sample_rate":int(stream["sample_rate"])}


def loudness(path: Path) -> float:
    result = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af",
                             "loudnorm=I=-23:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                            capture_output=True, check=True)
    text = result.stderr.decode("utf-8", errors="replace")
    return float(json.JSONDecoder().raw_decode(text[text.rfind("{"):])[0]["input_i"])


def run(source_root: Path) -> dict:
    text = (GAME / "game.js").read_text(encoding="utf-8-sig")
    project = json.loads(text[text.index("=") + 1:].strip().removesuffix(";"))
    if project.get("atriMusicIntegration"):
        raise ValueError("Already integrated: review cue changes instead of silently applying again")
    before = copy.deepcopy(project)
    reference_i = loudness(GAME / project["assets"]["bgm_emerald_dream_main_v01"]["src"])
    main_sha = hashlib.sha256((GAME / project["assets"]["bgm_emerald_dream_main_v01"]["src"]).read_bytes()).hexdigest()
    target_dir = GAME / "assets/bgm/atri"
    target_dir.mkdir(parents=True, exist_ok=True)
    source_manifest = json.loads((source_root / "source-manifest.json").read_text(encoding="utf-8"))
    rows = []
    for filename, asset_id, name, candidate, offset in TRACKS:
        source = source_root / "music/mp3" / filename
        info = probe(source)
        subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(source), "-f", "null", "-"], check=True)
        measured_i = loudness(source)
        gain = round(min(1.0, 10 ** ((reference_i + offset - measured_i)/20)), 5)
        target = target_dir / (asset_id + ".mp3")
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        duplicate = filename == "M6？.mp3" and digest == main_sha
        if duplicate:
            asset_id = "bgm_emerald_dream_main_v01"
            candidate = False
            project["assets"][asset_id]["sourceAliases"] = [{"sourceAuthor":"Atri-Lobato",
                "sourcePath":"music/mp3/"+filename,"sourceCommit":source_manifest["commit"],
                "sourceSha256":digest,"roles":["M6","E3","M7"],"identity":"SHA-256 identical"}]
        else:
            shutil.copy2(source, target)
            assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
            project["assets"][asset_id] = {"id":asset_id, "type":"bgm", "name":name,
                "src":target.relative_to(GAME).as_posix(), "dur":info["duration"], "audioCategory":"music",
                "auditionOnly":candidate, "playbackGain":gain, "sourceAuthor":"Atri-Lobato",
                "sourcePath":"music/mp3/" + filename, "sourceCommit":source_manifest["commit"],
                "sourceSha256":digest, "purposeStatus":"candidate" if candidate else "scene-mapped"}
        rows.append({"assetId":asset_id,"filename":filename,"name":name,"candidate":candidate,"deduplicated":duplicate,
                     "sha256":digest,"bytes":source.stat().st_size,"audio":info,
                     "measuredLUFS":measured_i,"playbackGain":gain,"targetReferenceLUFS":reference_i+offset,
                     "loopPoint":"待人工微调；原MP3不裁剪或重编码"})
    cues = []
    for start, end, asset_id, note in CUES:
        for i in range(start, end):
            project["lines"][i]["bgm"] = asset_id
        cues.append({"assetId":asset_id,"startIndex":start,"endExclusive":end,
                     "startLineId":project["lines"][start]["id"], "lastLineId":project["lines"][end-1]["id"], "note":note})
    changes = []
    for i, (old, new) in enumerate(zip(before["lines"], project["lines"])):
        assert {k:v for k,v in old.items() if k not in {"bgm","_musicFadeOutMs"}} == {k:v for k,v in new.items() if k not in {"bgm","_musicFadeOutMs"}}, i
        if old["bgm"] != new["bgm"]:
            changes.append({"index":i,"lineId":new["id"],"before":old["bgm"],"after":new["bgm"]})
    for i in range(1490,1803):
        assert project["lines"][i]["bgm"] == before["lines"][i]["bgm"], "Conflict silence changed"
    # The covered cue switches end the old song promptly rather than mixing two themes.
    for i in sorted({x for start,end,_,_ in CUES for x in [start,end]}):
        if i and project["lines"][i]["bgm"] != project["lines"][i-1]["bgm"]:
            project["lines"][i]["_musicFadeOutMs"] = 120
    report = {"sourceCommit":source_manifest["commit"],"sourceAuthor":"Atri-Lobato",
              "tracks":rows,"cues":cues,"changedNodes":len(changes),"nodeChanges":changes,
              "emeraldDreamPreserved":True,"conflictSilencePreserved":True,
              "pending":["E6或E5需要作者/音乐负责人确定用途", "M1/M2/M3/E4与明确E5/E6仍缺；循环点待人工编辑"]}
    project["atriMusicIntegration"] = {"sourceCommit":source_manifest["commit"],"tracks":[r["assetId"] for r in rows],"cueReport":"docs/deliveries/atri-music/接入清单.json"}
    DELIVERY.mkdir(parents=True,exist_ok=True)
    (DELIVERY / "接入清单.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (GAME / "game.js").write_text("window.VN_GAME =" + json.dumps(project,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    return {"tracks":len(rows),"cues":len(cues),"changedNodes":len(changes),"referenceLUFS":reference_i}


if __name__ == "__main__":
    ap=argparse.ArgumentParser();ap.add_argument("--sources",type=Path,required=True)
    args=ap.parse_args();print(json.dumps(run(args.sources)))
