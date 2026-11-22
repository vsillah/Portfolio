#!/usr/bin/env python3
"""Check the L07-01 change boundary and write an immutable review receipt."""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import hashlib
import json
import math
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RECEIPT = json.loads((HERE / "candidate-receipt.json").read_text())
PRIOR = ROOT / RECEIPT["prior"]["path"]
CANDIDATE = ROOT / RECEIPT["candidate"]["path"]
ROUTE = HERE / "route-evidence"


def sha(path):
    with open(path, "rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def run(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{args}: {result.stderr}")
    return result.stdout.strip()


def stream_hash(path, kind):
    return run(["ffmpeg", "-v", "error", "-i", str(path), "-map", f"0:{kind}:0", "-c", "copy", "-f", "hash", "-hash", "sha256", "-"]).split("=", 1)[1]


def frame(path, seconds, output):
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(seconds), "-i", str(path), "-frames:v", "1", str(output)])
    return Image.open(output).convert("RGB")


assert sha(PRIOR) == RECEIPT["prior"]["sha256"]
assert sha(CANDIDATE) == RECEIPT["candidate"]["sha256"]
for state in RECEIPT["states"]:
    assert sha(HERE / state["file"]) == state["sha256"]
assert sha(HERE / "studio-field.png") == RECEIPT["rasterField"]["sha256"]
for key in ("script", "packet", "sourceMap", "vtt", "cleanPresenter"):
    assert sha(ROOT / RECEIPT[key]["path"]) == RECEIPT[key]["sha256"]

audio = (stream_hash(PRIOR, "a"), stream_hash(CANDIDATE, "a"))
subtitle = (stream_hash(PRIOR, "s"), stream_hash(CANDIDATE, "s"))
assert audio[0] == audio[1]
assert subtitle[0] == subtitle[1]
run(["ffmpeg", "-v", "error", "-i", str(CANDIDATE), "-f", "null", "-"])

scenes = []
with tempfile.TemporaryDirectory() as temporary:
    for seconds, scene, threshold in (
        (28.5, "L07-02", 45),
        (188.8, "L07-07", 70),
        (201.0, "L07-07", 70),
        (232.9, "L07-07", 70),
        (234.0, "L07-08", 45),
        (243.0, "L07-08", 45),
        (246.3, "L07-08", 45),
    ):
        before = frame(PRIOR, seconds, Path(temporary) / f"before-{seconds}.png")
        after = frame(CANDIDATE, seconds, Path(temporary) / f"after-{seconds}.png")
        rms = ImageStat.Stat(ImageChops.difference(before, after)).rms
        mse = sum(value * value for value in rms) / len(rms)
        psnr = 10 * math.log10(255 * 255 / mse) if mse else 999.0
        assert psnr > threshold, (seconds, psnr, threshold)
        scenes.append({"seconds": seconds, "scene": scene, "psnrDb": round(psnr, 3), "thresholdDb": threshold})

route = json.loads((ROUTE / "route-capture.json").read_text())
assert route["candidateSha256"] == RECEIPT["candidate"]["sha256"]
assert [result["name"] for result in route["results"]] == ["desktop", "mobile"]
assert [len(result["checks"]) for result in route["results"]] == [23, 25]
for result in route["results"]:
    assert result["source"].endswith("/review-" + RECEIPT["candidate"]["sha256"][:8] + "/L07-01-source-brief-candidate.mp4")
    assert all(check.get("passed") is not False for check in result["checks"])
    assert {check["action"] for check in result["checks"]} >= {"captions-off", "captions-on", "Aa-S", "Aa-M", "Aa-L", "completion", "replay"}

media = []
for name in ("desktop", "mobile"):
    path = ROUTE / f"L07-01-{name}-learner-route.mp4"
    run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"])
    media.append({"path": str(path.relative_to(ROOT)), "sha256": sha(path), "decode": "pass"})

receipt = {
    "status": "source_candidate_pass_review_only_unbound",
    "baseCommit": RECEIPT["baseCommit"],
    "candidateSha256": RECEIPT["candidate"]["sha256"],
    "candidateFrames": RECEIPT["candidate"]["frames"],
    "audioStreamSha256": audio[1],
    "subtitleStreamSha256": subtitle[1],
    "audioSubtitleMatchPrior": True,
    "fullDecode": "pass",
    "postSceneParity": scenes,
    "route": {"playerHead": "7bb6267c9fb98172679e161aafa208dfc7a276c3", "port": 3151, "viewports": ["1280x844", "390x844"], "checks": [23, 25], "captureSha256": sha(ROUTE / "route-capture.json"), "media": media},
    "scope": "L07-01 visual source only; retained caption-free opening presenter; later scenes and L07-08 preserved",
    "binding": "temporary in disposable local checkout; none in PR",
    "gatesRemaining": ["captain full Phase 3B matrix", "human QA if captain review passes", "integration and release gates"],
}
(HERE / "validation-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({"status": receipt["status"], "candidateSha256": receipt["candidateSha256"], "postSceneParity": scenes}, indent=2))
