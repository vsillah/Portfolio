"""Render source-audio/VTT-bound, review-only L06-03 desktop and mobile clips."""

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = HERE / "l06-03-responsive-study"
FRAME_RECEIPT = OUT / "frame-receipt.json"
START = 65.532
DURATION = 31.950


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


frame_receipt = json.loads(FRAME_RECEIPT.read_text())
assert frame_receipt["status"] == "review_only_unbound"
for frame in frame_receipt["frames"]:
    assert sha(ROOT / frame["path"]) == frame["sha256"]

source_map = json.loads((ROOT / "docs/agentified-distribution-readiness/phase-3b/source-map-v1.json").read_text())
record = next(item for item in source_map["records"] if item["lessonId"] == "L06")
video = ROOT / record["currentVideo"]["path"]
captions = ROOT / record["currentCaption"]["path"]
assert sha(video) == record["currentVideo"]["sha256"] == "163e01e6eb8f1a014b7155b40063bc2b6fa3546fc6bc4329579775581e6f9ef3"
assert sha(captions) == record["currentCaption"]["sha256"] == "018418cc1d4bf2333ed6525f1926b8b052f57677a136976e42c80c8f703c69ba"
vtt = OUT / "L06-03-source-trim.vtt"
run("python3", str(ROOT / "docs/agentified-distribution-readiness/phase-3b/trim_vtt.py"), str(captions), str(vtt), str(START), str(DURATION))
assert vtt.read_text().count(" --> ") == 6

frames = {Path(frame["path"]).name: ROOT / frame["path"] for frame in frame_receipt["frames"]}
overview = frames["overview-wide.png"]
prepare = frames["focus-01-prepare.png"]
recommend = frames["focus-02-recommend.png"]
route = frames["focus-03-route.png"]
stage = frames["focus-04-stage.png"]
execute = frames["focus-05-execute.png"]
timelines = {
    "desktop": [(overview, DURATION)],
    # The first source cue lists all five rungs (0–7.360 s); the next cue
    # places this role at Prepare (7.552 s), where the image then holds.
    "mobile": [
        (overview, 1.20),
        (prepare, 1.25),
        (recommend, 1.25),
        (route, 1.25),
        (stage, 1.25),
        (execute, 1.35),
        (prepare, 24.40),
    ],
}

clips = []
for layout, timeline in timelines.items():
    assert abs(sum(duration for _, duration in timeline) - DURATION) < 0.000001
    concat = OUT / f"L06-03-{layout}-timeline.txt"
    lines = []
    for frame, duration in timeline:
        lines.extend((f"file '{frame}'", f"duration {duration:.3f}"))
    lines.append(f"file '{timeline[-1][0]}'")
    concat.write_text("\n".join(lines) + "\n")
    output = OUT / f"L06-03-{layout}-review.mp4"
    # H.264/yuv420p needs even dimensions. Half-size display is 390×219.
    width, height = (1280, 720) if layout == "desktop" else (780, 438)
    run(
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", str(concat),
        "-ss", str(START), "-t", str(DURATION), "-i", str(video),
        "-i", str(vtt), "-t", str(DURATION),
        "-map", "0:v:0", "-map", "1:a:0", "-map", "2:0",
        "-vf", f"fps=25,scale={width}:{height}:flags=lanczos,format=yuv420p",
        "-r", "25", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
        "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng", "-disposition:s:0", "default",
        "-movflags", "+faststart", str(output),
    )
    run("ffmpeg", "-v", "error", "-i", str(output), "-f", "null", "-")
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,nb_frames", "-of", "json", str(output)
    ]))
    clips.append({
        "layout": layout,
        "path": str(output.relative_to(ROOT)),
        "sha256": sha(output),
        "timeline": [{"frame": str(path.relative_to(ROOT)), "durationSeconds": duration} for path, duration in timeline],
        "probe": probe,
    })

receipt = {
    "status": "review_only_unbound",
    "paddingHead": "5a0f156b0a9b8cdd8286bf0d37365b558f858bc5",
    "captionHead": "af647b6adc101cafade371d5ca53047670d53213",
    "playerHead": "7bb6267c9fb98172679e161aafa208dfc7a276c3",
    "scene": "L06-03",
    "lessonStartSeconds": START,
    "durationSeconds": DURATION,
    "sourceVideoSha256": record["currentVideo"]["sha256"],
    "sourceCaptionSha256": record["currentCaption"]["sha256"],
    "trimmedCaptionPath": str(vtt.relative_to(ROOT)),
    "trimmedCaptionSha256": sha(vtt),
    "frameReceiptPath": str(FRAME_RECEIPT.relative_to(ROOT)),
    "frameReceiptSha256": sha(FRAME_RECEIPT),
    "clips": clips,
}
(OUT / "clip-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(f"Rendered {len(clips)} review-only L06-03 clips with exact mapped source audio and six VTT cues")
