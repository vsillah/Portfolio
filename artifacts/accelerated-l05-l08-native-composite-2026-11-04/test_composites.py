#!/usr/bin/env python3
"""Fail-closed verification for the L05-L08 native composite batch."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
LESSONS = ("L05", "L06", "L07", "L08")
EXPECTED = {
    "L05": {"script": "48fdf9358e855fd4abd31ed925e9d67fe03747bf37f11eea8af329dfa33638ab", "request": "f733620121d9fd740683c5f692516a68a609f341e4f77a51ae72d60adfc72a85", "packet": "6c4c12c0a1d5e50e8865f630b5e41ec608f4f6552afaddf23ed34cee6cc19a7c", "asset": "922bd48c12ae9b74b634a0d4bbc87ea18f940be4e12b5026429870af6fde896a", "audio": "e99e87f7ab15ab76a3a31ed188fa6df4ef2daac16ee20d3094a993729bbd9b5b"},
    "L06": {"script": "f4708e088f65d17168fd7951b7b9e785b3f10b0673d9d6a1bceb423008d28dd6", "request": "71a94054fcef4f367cfc346f3a08aac4ede86973f71f21e82fac771a6af7287e", "packet": "04c92134c1796a39aa032dbae461b7dae773da437eff2f7b4f622c9fd4cf8b80", "asset": "1d53bf794301911fa0301f2f876ec3213bdc8f2ac138e2c4b2d1e0f9e6e53d36", "audio": "e8d93e6b76145f0cd2122907724a5c2e3706a9a8fb6810dc32d7b55ff13d5844"},
    "L07": {"script": "394d030424d8d190af6043f581d119c33c1b79b98061b1785909d82247b59d03", "request": "945828c55e643e4f6bac4658ad4262f4c137e8a994ac3c00c9d1103cf08a600e", "packet": "282edc62956b400505394424b46a63daaa9026b6dcad2630f45a067f28966eaa", "asset": "b97647d9cca7670e5489b8c4f84a37d7d34e6a11be433d62e5c33828a8f23560", "audio": "89dfe20ef8b5e794e6a7fdb28f404bd48425d52bf796c2857f661d7c6f88f4bb"},
    "L08": {"script": "e4647b07ebafffc74bae335804247be2137fec75e5da7bec39462201246cb58b", "request": "915a2c515acd3e6a1727d914b1fc14601a2e71af8d829bf36279bb73f211063b", "packet": "edef34ec3796d5376e011f3ecfdef355cb0454600b2a8b15c7ceea3f1dac64eb", "asset": "33c002c2c94c3b0f747a283f9bc50e55b382a1775d65197cb9d16627dddc5b08", "audio": "074164c095dc0198ce1d3fe8d1cdc5e244b269db1aca0082a74f4e6e59410c82"},
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
    packet = REPO / f"docs/accelerated-course-modules/l05-l08-guided-video/{lower}-packet.json"
    asset_map = REPO / f"docs/accelerated-course-modules/l05-l08-guided-video/{lower}-asset-map.json"
    audio_map = REPO / f"docs/accelerated-course-modules/l05-l08-guided-video/{lower}-audio-map.json"
    captions = REPO / f"docs/accelerated-course-modules/l05-l08-guided-video/{lower}-storyboard.srt"
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
    preflight = json.loads((ROOT.parent / "accelerated-l05-l08-provider-preflight-2026-11-04" / "preflight-receipt.json").read_text())
    assert preflight["status"] == "provider_batch_completed"
    assert preflight["provider"]["auto_reload_state"] == "off"
    assert preflight["aggregate"]["actual_cost_usd"] < preflight["aggregate"]["authorized_cap_usd"]
    assert preflight["validation"]["provider_jobs_completed"] == 4
    print(json.dumps({"status": "pass", "lessons": results}, indent=2))


if __name__ == "__main__":
    main()
