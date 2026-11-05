#!/usr/bin/env python3
"""Fail-closed verification for the L09-L12 native composite batch."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
LESSONS = ("L09", "L10", "L11", "L12")
EXPECTED = {
    "L09": {"script": "72f88ce4aa6cb4f1276c7982a1a1f9672c1d041da0dc6d47303cbef2f8b3c4a8", "request": "7b86aebc740067ab89fb1af2d58870529762e4fe2a17e4328bad055bb4341ce2", "packet": "34c8b3522d7a9b111c6a76ccf9e9c2ddf1e4ec8ca7757d7618d87d518d390f6c", "asset": "8ed406a1c9c9253707175a955ef16260ad210d16b55c27a31a28fb3429603ce8", "audio": "2d9e603d8688f4f104d0d85f9b35f56f4f7c844ac89f2385d910feac0976cebc", "cost": 6.05, "cap": 7.80},
    "L10": {"script": "582238a183ab7171589533431d06ebbf641c4db83ecf94d42527670d305698a5", "request": "33a0922c7a08430260638869ad593494cab25c9d4502fb54a1fce56019cad179", "packet": "91b87f1dd127bc1a36985c7ff6ef2e2a98c9bbc2ae9711734384651f1bee9a67", "asset": "b75cd42fe3af11d3c95912a9138201627a8b8293ae103c684b2973a904118197", "audio": "7769633beb19a495bc20c72f20b2cea219d8d77be8d14bb152ad2da021deac6c", "cost": 7.10, "cap": 8.21},
    "L11": {"script": "705152fdd1f3654e1559bc09daf7a8056a87266b821d475a8c659ff6cffe35a5", "request": "04e48d46f8cab797a0db40d22e3666e69ee5f89f41a3c5e1d33223cd2a464092", "packet": "27b799ec18952b2e570e21e973eca38831e25106a5cea4eb61d9774a97962bf6", "asset": "6e08b1b813876ada813ea5e442e86e86e11224ea17497c1024d70559a13cf0dd", "audio": "aaddd7493a791e22c469f8ce6b85cb29526e2e937da159ed409f7078e9b4612e", "cost": 6.68, "cap": 8.80},
    "L12": {"script": "e8eaeb962881100288c95cffd40111940ae274a76520a13613cf04e056a06a36", "request": "68b54ad3bd072dd51700f0d11b6b86029b0bc6da7f0f59c97f78499c6a0450a3", "packet": "f2332ca0e4aa797c03ac93fe0ab9c35c7fe339df7ecf3cec2441fa23e0b67f0a", "asset": "ad7f13c8c148af9d3724a0341acf1c1891bf2ac3cc74866e0a32e560be2aab81", "audio": "25b6a874e65f1b6def56d8f37eab10edcfe1df6899d4ede625a4ba7066032eeb", "cost": 7.17, "cap": 9.51},
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
    packet = REPO / f"docs/accelerated-course-modules/l09-l12-guided-video/{lower}-packet.json"
    asset_map = REPO / f"docs/accelerated-course-modules/l09-l12-guided-video/{lower}-asset-map.json"
    audio_map = REPO / f"docs/accelerated-course-modules/l09-l12-guided-video/{lower}-audio-map.json"
    captions = REPO / f"docs/accelerated-course-modules/l09-l12-guided-video/{lower}-storyboard.srt"
    expected = EXPECTED[lesson]

    assert receipt["status"] == "completed"
    assert receipt["submitted_once"] and receipt["retry_count"] == 0
    assert receipt["request"]["passages"] == ["A01", "A02", "A03", "A04"]
    assert receipt["request"]["look_id"] == "329ae68b92d342f6a4362cc656d486a0"
    assert receipt["request"]["voice_id"] == "14b592b937744404a4fa7c01aafd7dbe"
    assert receipt["request"]["script_sha256"] == expected["script"]
    assert receipt["request"]["request_sha256"] == expected["request"]
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
    assert authorization["status"] == "approved"
    assert authorization["billing"]["auto_reload"] == "off"
    assert authorization["billing"]["cash_charge_usd"] <= 25.00
    assert authorization["billing"]["wallet_after_top_up_usd"] <= 35.60
    assert sum(item["billing"]["cost_usd"] for item in receipts) == 27.00
    assert sum(item["billing"]["cost_usd"] for item in receipts) < authorization["billing"]["aggregate_provider_cap_usd"]
    assert all(item["status"] == "completed" and item["retry_count"] == 0 for item in receipts)
    learner_plan = (REPO / "app/service-prototypes/[slug]/AcceleratedLearningPlan.tsx").read_text()
    assert "const locked = (id: string) => Number(id.slice(1)) >= 9" in learner_plan
    print(json.dumps({"status": "pass", "aggregate_cost_usd": 27.00, "lessons": results}, indent=2))


if __name__ == "__main__":
    main()
