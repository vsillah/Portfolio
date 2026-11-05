#!/usr/bin/env python3
"""Record immutable timing receipts from the completed L13-L16 provider sources."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
LESSONS = ("L13", "L14", "L15", "L16")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path: Path) -> dict:
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ], text=True))


for lesson in LESSONS:
    lower = lesson.lower()
    directory = ROOT / lower
    source = directory / f"accelerated-{lower}-heygen-native.mp4"
    receipt = json.loads((directory / "provider-receipt.json").read_text())
    if receipt["status"] != "completed" or not receipt["submitted_once"] or receipt["retry_count"] != 0:
        raise SystemExit(f"{lesson}: provider receipt is not a completed no-retry result")
    media = probe(source)
    video = next(stream for stream in media["streams"] if stream["codec_type"] == "video")
    source_hash = sha256(source)
    if source_hash != receipt["artifact"]["sha256"]:
        raise SystemExit(f"{lesson}: provider source hash differs from its immutable receipt")
    timing = {
        "schema_version": "1.0",
        "lesson": lesson,
        "video_id": receipt["video_id"],
        "source_sha256": source_hash,
        "duration_seconds": float(media["format"]["duration"]),
        "frame_rate": video["r_frame_rate"],
        "video_frames": int(video["nb_frames"]),
        "passage_order": ["A01", "A02", "A03", "A04"],
        "sentence_complete": True,
        "timing_status": "native source accepted for deterministic paragraph-gap binding",
        "retry_count": 0,
    }
    (directory / "timing-receipt.json").write_text(json.dumps(timing, indent=2) + "\n")
    print(json.dumps({"lesson": lesson, "source_sha256": source_hash, "duration_seconds": timing["duration_seconds"]}))
