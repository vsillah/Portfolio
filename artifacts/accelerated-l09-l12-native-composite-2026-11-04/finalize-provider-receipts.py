#!/usr/bin/env python3
"""Record immutable provider and timing receipts for the authorized L09-L12 batch."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE_COMMIT = "8ffffb1f762f51d1dcce8529bf9f213d79e6f164"
SCRIPT_COMMIT = "66168a8c18f0e570df50d9a549f299db511b3524"
REQUEST_COMMIT = "4afab5daaa34c12d12682689bb9e02e962ea880d"
LOOK_ID = "329ae68b92d342f6a4362cc656d486a0"
VOICE_ID = "14b592b937744404a4fa7c01aafd7dbe"
LESSONS = {
    "L09": {"video_id": "3e999cf3fdceaee7727283bc90f1546a", "script": "72f88ce4aa6cb4f1276c7982a1a1f9672c1d041da0dc6d47303cbef2f8b3c4a8", "request": "7b86aebc740067ab89fb1af2d58870529762e4fe2a17e4328bad055bb4341ce2", "cost": 6.05, "cap": 7.80},
    "L10": {"video_id": "2d8460a0f0f6f0c94d03363d9506ae30", "script": "582238a183ab7171589533431d06ebbf641c4db83ecf94d42527670d305698a5", "request": "33a0922c7a08430260638869ad593494cab25c9d4502fb54a1fce56019cad179", "cost": 7.10, "cap": 8.21},
    "L11": {"video_id": "39480237b9ec263534ca428fb67f792e", "script": "705152fdd1f3654e1559bc09daf7a8056a87266b821d475a8c659ff6cffe35a5", "request": "04e48d46f8cab797a0db40d22e3666e69ee5f89f41a3c5e1d33223cd2a464092", "cost": 6.68, "cap": 8.80},
    "L12": {"video_id": "68ce3d4f2676158f91f1efd6c5a95b7e", "script": "e8eaeb962881100288c95cffd40111940ae274a76520a13613cf04e056a06a36", "request": "68b54ad3bd072dd51700f0d11b6b86029b0bc6da7f0f59c97f78499c6a0450a3", "cost": 7.17, "cap": 9.51},
}


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


for lesson, binding in LESSONS.items():
    lower = lesson.lower()
    directory = ROOT / lower
    source = directory / f"accelerated-{lower}-heygen-native.mp4"
    provider_status = json.loads((directory / "provider-status.json").read_text())["data"]
    if provider_status["status"] != "completed" or provider_status["id"] != binding["video_id"]:
        raise SystemExit(f"{lesson}: provider identity or completion state mismatch")
    media = probe(source)
    video = next(stream for stream in media["streams"] if stream["codec_type"] == "video")
    audio = next(stream for stream in media["streams"] if stream["codec_type"] == "audio")
    duration = float(media["format"]["duration"])
    frames = int(video["nb_frames"])
    source_hash = sha256(source)
    receipt = {
        "schema_version": "1.0",
        "lesson": lesson,
        "video_id": binding["video_id"],
        "title": f"Accelerated {lesson} review-only source",
        "status": "completed",
        "submitted_once": True,
        "retry_count": 0,
        "request": {
            "source_commit": SOURCE_COMMIT,
            "script_source_commit": SCRIPT_COMMIT,
            "request_source_commit": REQUEST_COMMIT,
            "script_sha256": binding["script"],
            "request_sha256": binding["request"],
            "passages": ["A01", "A02", "A03", "A04"],
            "look_id": LOOK_ID,
            "voice_id": VOICE_ID,
            "engine": "avatar_iv",
            "resolution": "1080p",
            "aspect_ratio": "16:9",
            "output_format": "mp4",
        },
        "billing": {
            "cost_usd": binding["cost"],
            "per_job_cap_usd": binding["cap"],
            "cap_result": "pass",
            "auto_reload": "off",
            "purchase_made_for_job": False,
        },
        "artifact": {
            "filename": source.name,
            "sha256": source_hash,
            "duration_seconds": duration,
            "width": int(video["width"]),
            "height": int(video["height"]),
            "frame_rate": video["r_frame_rate"],
            "video_frames": frames,
            "video_codec": video["codec_name"],
            "audio_codec": audio["codec_name"],
            "audio_sample_rate_hz": int(audio["sample_rate"]),
            "audio_channels": int(audio["channels"]),
        },
        "external_actions": {"uploaded": False, "published": False, "distributed": False, "sent_externally": False},
        "human_qa": "pending",
    }
    timing = {
        "schema_version": "1.0",
        "lesson": lesson,
        "video_id": binding["video_id"],
        "source_sha256": source_hash,
        "duration_seconds": duration,
        "frame_rate": video["r_frame_rate"],
        "video_frames": frames,
        "passage_order": ["A01", "A02", "A03", "A04"],
        "sentence_complete": True,
        "timing_status": "native source accepted for deterministic paragraph-gap binding",
        "retry_count": 0,
    }
    (directory / "provider-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    (directory / "timing-receipt.json").write_text(json.dumps(timing, indent=2) + "\n")
    print(json.dumps({"lesson": lesson, "source_sha256": source_hash, "duration_seconds": duration}))
