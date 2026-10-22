"""Create MP3 playback variants for every archived WAV, preserving the masters."""
from __future__ import annotations

import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "素材库/audio"
DEST = AUDIO / "mp3"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path: Path) -> dict:
    result = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                            capture_output=True, check=True, encoding="utf-8")
    report = json.loads(result.stdout)
    stream = next(s for s in report["streams"] if s["codec_type"] == "audio")
    return {"codec":stream["codec_name"], "sample_rate":int(stream["sample_rate"]),
            "channels":stream["channels"], "duration":float(report["format"]["duration"])}


def convert(source: Path) -> dict:
    relative = source.relative_to(AUDIO)
    target = (DEST / relative).with_suffix(".mp3")
    target.parent.mkdir(parents=True, exist_ok=True)
    original_hash, original_info = sha(source), probe(source)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                    "-map", "0:a:0", "-vn", "-codec:a", "libmp3lame", "-q:a", "2",
                    "-ar", str(min(original_info["sample_rate"], 48000)), "-map_metadata", "-1",
                    "-id3v2_version", "3", "-write_xing", "1", str(target)], check=True)
    compressed_info = probe(target)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-xerror", "-i", str(target),
                    "-f", "null", "-"], check=True)
    assert sha(source) == original_hash, "WAV master changed"
    assert compressed_info["codec"] == "mp3"
    assert compressed_info["channels"] == original_info["channels"]
    assert abs(compressed_info["duration"] - original_info["duration"]) < .15
    return {"source":source.relative_to(ROOT / "素材库").as_posix(),
            "path":target.relative_to(ROOT / "素材库").as_posix(),
            "source_sha256":original_hash, "sha256":sha(target),
            "source_bytes":source.stat().st_size, "bytes":target.stat().st_size,
            "source_audio":original_info, "audio":compressed_info,
            "full_decode_verified":True, "master_preserved":True}


def main() -> dict:
    sources = sorted(f for f in AUDIO.rglob("*") if f.suffix.lower() == ".wav")
    with ThreadPoolExecutor(max_workers=4) as pool:
        variants = list(pool.map(convert, sources))
    report = {"scope":"All WAV masters in 素材库/audio; original bytes preserved. Current game already uses MP3/OGG.",
              "encoding":{"codec":"libmp3lame", "quality_vbr":2, "max_sample_rate":48000,
                          "channels":"preserved", "trimmed":False, "gain_changed":False},
              "wav_count":len(sources), "source_bytes":sum(v["source_bytes"] for v in variants),
              "mp3_bytes":sum(v["bytes"] for v in variants), "variants":variants}
    DEST.mkdir(exist_ok=True)
    (DEST / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest_path = ROOT / "素材库/manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    indexed = {v["source"]:v for v in variants}
    indexed_count = 0
    for asset in manifest["assets"]:
        variant = indexed.get(asset.get("path"))
        if not variant:
            continue
        entry = {"format":"mp3", "path":variant["path"], "bytes":variant["bytes"],
                 "sha256":variant["sha256"], "audio":variant["audio"], "purpose":"compressed playback copy"}
        asset["playback_variants"] = [v for v in asset.get("playback_variants", []) if v.get("path") != entry["path"]] + [entry]
        indexed_count += 1
    assert indexed_count == len(variants), "A compressed WAV was not linked in the source catalog"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {k:report[k] for k in ["wav_count", "source_bytes", "mp3_bytes"]}


if __name__ == "__main__":
    print(json.dumps(main()))
