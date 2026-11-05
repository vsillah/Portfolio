#!/usr/bin/env python3
"""Fail-closed verification for the L13-L16 native composite batch."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
LESSONS = ("L13", "L14", "L15", "L16")
EXPECTED = {
    "L13": {"script": "3acceee930227d5584d97ef236f04265e17cd3722e12836d60ef55ed17f0d63a", "request": "db52f7b8ca79afc37dd80a698b160bc9543111cc2f9fcf5c09077a743e7aa055", "packet": "cdd1168caa00ae43615268158bd2fa9c3e1b86092a4a2ce602880844e96a811e", "asset": "02d147c82162bc9d76065f54eb640b1b28200eac276f2ced975b97249c008c4e", "audio": "02a5f949a5966e68a0abcf3be670404888411d14e425f4e2ec569df4adc59a91", "cost": 7.33, "cap": 9.08},
    "L14": {"script": "5ea7d162d96416f328cc74ad70260065ea874fe4314a4529874fd4d543a39643", "request": "f7677ae063c6641838eec81f644ccc5f6f214c37ccea99d3e9cf3e828ebcc20a", "packet": "7020af28aa300f8ecdf4acea37fef70befc9a72d4b122b46e55bd920b0c9cb9f", "asset": "f8475a00a80a071ba02f77711476793046380f9cf4a3ee2c3b639fbcf58e64c9", "audio": "a70dea06d31233cfbe8026febb8d19f91c6ed9002dd7546ce60ed83ee2696a96", "cost": 7.25, "cap": 8.75},
    "L15": {"script": "64a2691ab3c66962b4c8906c833cd145345ec7f53adc325f18064e421503d6c0", "request": "e8b72fc0535603209ab8c1fa6fa7e060942104199737a10a2b4aac2876aec79f", "packet": "39c9fe61885dea3535308efe1a8ba52087d6fc753c395eef35badf91ffc5ec0f", "asset": "faba0261ba58b48236bb4ffa7a8d93f5823223302a9364db2041d4266500fb5b", "audio": "7e2c7e91aa94883ff674ff15b2590274ba1f754376f8ff31c5fe6cba78ad9570", "cost": 7.98, "cap": 9.15},
    "L16": {"script": "aef51b9f3fce4210afd5f01cb0fdc8001bebd835e27e1ae257958a5b0864135d", "request": "fced240c2e105b21b2feca5648cf41cb6d53dafc0774626663945f31284f8a25", "packet": "2b603f8d02c77884c998c4698c5b610d1535b25621530de3e22a8be19349f6fc", "asset": "9bab7e83437f54776cf028c94cd7bb6af05cd97def46fa6745cda55ff7493a1f", "audio": "34808777d1a90630a294b35d29cd75cf3aa3142d39a50a7a121a8cc7d7e2b332", "cost": 8.30, "cap": 9.58},
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


def check_lesson(lesson: str) -> dict:
    lower = lesson.lower()
    directory = ROOT / lower
    receipt = json.loads((directory / "provider-receipt.json").read_text())
    timing = json.loads((directory / "timing-receipt.json").read_text())
    manifest = json.loads((directory / "composite-manifest.json").read_text())
    composite_receipt = json.loads((directory / "composite-receipt.json").read_text())
    source = directory / f"accelerated-{lower}-heygen-native.mp4"
    composite = directory / f"accelerated-{lower}-native-composite.mp4"
    packet = REPO / f"docs/accelerated-course-modules/l13-l16-guided-video/{lower}-packet.json"
    asset_map = REPO / f"docs/accelerated-course-modules/l13-l16-guided-video/{lower}-asset-map.json"
    audio_map = REPO / f"docs/accelerated-course-modules/l13-l16-guided-video/{lower}-audio-map.json"
    captions = REPO / f"docs/accelerated-course-modules/l13-l16-guided-video/{lower}-storyboard.srt"
    expected = EXPECTED[lesson]

    assert receipt["status"] == "completed"
    assert receipt["submitted_once"] and receipt["retry_count"] == 0
    assert receipt["request"]["passages"] == ["A01", "A02", "A03", "A04"]
    assert receipt["request"]["look_id"] == "329ae68b92d342f6a4362cc656d486a0"
    assert receipt["request"]["voice_id"] == "14b592b937744404a4fa7c01aafd7dbe"
    assert receipt["request"]["scriptSha256"] == expected["script"]
    assert receipt["request"]["requestSha256"] == expected["request"]
    assert sha256(packet) == expected["packet"]
    assert sha256(asset_map) == expected["asset"]
    assert sha256(audio_map) == expected["audio"]
    assert sha256(source) == receipt["artifact"]["sha256"] == timing["source_sha256"]
    assert sha256(composite) == manifest["output_sha256"] == composite_receipt["composite"]["sha256"]
    assert receipt["billing"]["cap_result"] == "pass" and receipt["billing"]["auto_reload"] == "off"
    assert receipt["billing"]["cost_usd"] == expected["cost"]
    assert receipt["billing"]["per_job_cap_usd"] == expected["cap"]
    assert not any(receipt["external_actions"].values())

    source_ranges = manifest["source_passage_ranges"]
    assert len(source_ranges) == 4 and source_ranges[0][0] == 0
    assert all(source_ranges[index][1] == source_ranges[index + 1][0] for index in range(3))
    assert source_ranges[-1][1] == receipt["artifact"]["video_frames"]
    presenter_items = [item for item in manifest["timeline"] if item["kind"] == "presenter"]
    assert [item["passage"] for item in presenter_items] == ["A01", "A02", "A03", "A04"]
    assert sum(item["frames"] for item in manifest["timeline"]) == manifest["output_frames"]
    assert manifest["constraints"]["source_speed"] == 1.0
    assert manifest["constraints"]["source_crop"] is False
    assert captions.exists() and captions.read_text().count("-->") >= 4

    media = probe(composite)
    streams = media["streams"]
    video = next(item for item in streams if item["codec_type"] == "video")
    assert (video["width"], video["height"], video["r_frame_rate"]) == (1920, 1080, "25/1")
    assert int(video["nb_frames"]) == manifest["output_frames"]
    assert any(item["codec_type"] == "audio" for item in streams)
    assert any(item["codec_type"] == "subtitle" for item in streams)
    assert abs(float(media["format"]["duration"]) - manifest["output_duration_seconds"]) < 0.05
    return {"lesson": lesson, "source_sha256": sha256(source), "composite_sha256": sha256(composite)}


def main() -> None:
    results = [check_lesson(lesson) for lesson in LESSONS]
    authorization = json.loads((ROOT / "authorization-receipt.json").read_text())
    receipts = [json.loads((ROOT / lesson.lower() / "provider-receipt.json").read_text()) for lesson in LESSONS]
    assert authorization["status"] == "executed"
    assert authorization["billing"]["auto_reload"] == "off"
    assert authorization["billing"]["cash_charge_usd"] == 29.75
    assert authorization["billing"]["wallet_after_top_up_usd"] == 36.60
    aggregate_cost = round(sum(item["billing"]["cost_usd"] for item in receipts), 2)
    assert aggregate_cost == 30.86
    assert aggregate_cost < authorization["billing"]["aggregate_provider_cap_usd"]
    assert all(item["status"] == "completed" and item["retry_count"] == 0 for item in receipts)
    learner_plan = (REPO / "app/service-prototypes/[slug]/AcceleratedLearningPlan.tsx").read_text()
    assert "const locked = (id: string) => Number(id.slice(1)) >= 13" in learner_plan
    print(json.dumps({"status": "pass", "aggregate_cost_usd": 30.86, "lessons": results}, indent=2))


if __name__ == "__main__":
    main()
