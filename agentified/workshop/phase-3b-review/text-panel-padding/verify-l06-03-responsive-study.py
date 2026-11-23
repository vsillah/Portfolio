"""Verify exact-source binding and complete-plate L06-03 review artifacts."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent / "l06-03-responsive-study"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inset(box, text):
    x, y, width, height = text["glyphPx"]
    return min(x - box[0], y - box[1], box[2] - x - width, box[3] - y - height)


frames = json.loads((OUT / "frame-receipt.json").read_text())
clips = json.loads((OUT / "clip-receipt.json").read_text())
source = ROOT / frames["sourcePath"]
assert frames["status"] == clips["status"] == "review_only_unbound"
assert sha(source) == frames["sourceSha256"] == "073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b"
assert Image.open(source).size == tuple(frames["sourcePx"]) == (3000, 4700)
assert frames["frameworkOrderBottomToTop"] == ["Prepare", "Recommend", "Route", "Stage", "Execute"]
assert frames["gateByRung"] == {
    "Recommend": "Rollback path required",
    "Route": "Human gate required",
    "Stage": "Source check required",
    "Execute": "Receipt required",
}
assert len(frames["frames"]) == 6
plate = Image.open(source).convert("RGB")
for item in frames["frames"]:
    path = ROOT / item["path"]
    preview = ROOT / item["mobilePreviewPath"]
    assert sha(path) == item["sha256"] and sha(preview) == item["mobilePreviewSha256"]
    image = Image.open(path).convert("RGB")
    assert image.size == (1920, 1080) and Image.open(preview).size == (390, 219)
    geometry = item["geometry"]
    x, y, width, height = geometry["platePx"]
    assert width == round(plate.width * height / plate.height)
    expected = plate.resize((width, height), Image.Resampling.LANCZOS)
    actual = image.crop((x, y, x + width, y + height))
    if item["kind"] == "overview":
        assert ImageChops.difference(actual, expected).getbbox() is None
        h = geometry["headline"]
        assert inset(h["boxPx"], h) == 28
        for panel in geometry["panels"]:
            assert inset(panel["stageBoxPx"], panel["stageTitle"]) >= 28
            assert inset(panel["stageBoxPx"], panel["stageDetail"]) >= 28
            if panel["gate"]:
                assert inset(panel["gateBoxPx"], panel["gateText"]) >= 28
    else:
        # The focused study adds only an outline around the active rung.
        mask = Image.new("L", (width, height))
        m = ImageDraw.Draw(mask)
        center = geometry["highlightCenterYPx"] - y
        m.rectangle((108, center - 22, 254, center + 22), fill=255)
        assert ImageChops.difference(expected, Image.composite(expected, actual, mask)).getbbox() is None
        assert inset(geometry["stageBoxPx"], geometry["stageTitle"]) >= 28
        assert inset(geometry["stageBoxPx"], geometry["stageDetail"]) >= 28
        if geometry["gate"]:
            assert inset(geometry["gateBoxPx"], geometry["gateText"]) >= 28

assert sha(ROOT / frames["mobileContactPath"]) == frames["mobileContactSha256"]
assert Image.open(ROOT / frames["mobileContactPath"]).size == (1170, 438)
assert sha(OUT / "frame-receipt.json") == clips["frameReceiptSha256"]
source_map = json.loads((ROOT / "docs/agentified-distribution-readiness/phase-3b/source-map-v1.json").read_text())
record = next(item for item in source_map["records"] if item["lessonId"] == "L06")
assert sha(ROOT / record["currentVideo"]["path"]) == clips["sourceVideoSha256"] == record["currentVideo"]["sha256"]
assert sha(ROOT / record["currentCaption"]["path"]) == clips["sourceCaptionSha256"] == record["currentCaption"]["sha256"]
assert sha(ROOT / clips["trimmedCaptionPath"]) == clips["trimmedCaptionSha256"]
assert (ROOT / clips["trimmedCaptionPath"]).read_text().count(" --> ") == 6
assert clips["lessonStartSeconds"] == 65.532 and clips["durationSeconds"] == 31.95
assert len(clips["clips"]) == 2
for clip in clips["clips"]:
    path = ROOT / clip["path"]
    assert sha(path) == clip["sha256"]
    assert abs(sum(part["durationSeconds"] for part in clip["timeline"]) - 31.95) < 0.000001
    streams = {stream["codec_type"]: stream for stream in clip["probe"]["streams"]}
    assert set(streams) == {"video", "audio", "subtitle"}
    assert streams["video"]["nb_frames"] == "799"
    assert (streams["video"]["width"], streams["video"]["height"]) == ((1280, 720) if clip["layout"] == "desktop" else (780, 438))
    assert abs(float(clip["probe"]["format"]["duration"]) - 31.95) < 0.02
    subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"], check=True)
print("PASS six complete-plate frames, 28px text insets, source hashes, six cues, and two 799-frame clips")
