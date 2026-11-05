#!/usr/bin/env python3
"""Build one source-bound L13-L16 native composite without provider calls."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
FPS = 25
# The teaching plate's teal well spans x=950..1892 and y=168..709. Keep the
# gold video frame comfortably inside it so no presenter pixels touch either
# the gold frame or the surrounding teal/gold teaching plate.
PANEL = {"x": 986, "y": 190, "width": 870, "height": 490, "border": 10}


def run(command: list[str], capture: bool = False) -> str:
    result = subprocess.run(command, check=True, capture_output=capture, text=True)
    return result.stdout if capture else ""


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path: Path) -> dict:
    return json.loads(run([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ], capture=True))


def source_ranges(path: Path, source_frames: int, presenters: list[dict]) -> list[list[int]]:
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(path), "-af", "silencedetect=noise=-34dB:d=0.22", "-f", "null", "-"
    ], capture_output=True, text=True)
    events = re.findall(r"silence_start: ([0-9.]+).*?silence_end: ([0-9.]+)", result.stderr, re.S)
    internal = [(float(start), float(end)) for start, end in events if float(start) > 2 and float(end) < source_frames / FPS - 2]
    if len(internal) < len(presenters) - 1:
        raise SystemExit(f"Expected at least three internal paragraph gaps; found {len(internal)}.")
    word_counts = [len(re.findall(r"\b[\w’'-]+\b", item["narration_text"])) for item in presenters]
    total_words = sum(word_counts)
    targets = [source_frames * sum(word_counts[:index]) / total_words for index in range(1, len(presenters))]
    midpoints = [round(((start + end) / 2) * FPS) for start, end in internal]
    cuts = []
    minimum = 1
    for index, target in enumerate(targets):
        maximum = source_frames - (len(targets) - index)
        options = [point for point in midpoints if minimum < point < maximum]
        if not options:
            raise SystemExit("Could not bind every passage boundary to a native silence gap.")
        cut = min(options, key=lambda point: abs(point - target))
        cuts.append(cut)
        minimum = cut
    ranges = [[0, cuts[0]], [cuts[0], cuts[1]], [cuts[1], cuts[2]], [cuts[2], source_frames]]
    if any(end <= start for start, end in ranges) or ranges[0][0] != 0 or ranges[-1][1] != source_frames:
        raise SystemExit("Detected paragraph ranges are not contiguous.")
    return ranges


def render_segment(image: Path, output: Path, frames: int, source: Path | None = None, source_range: list[int] | None = None) -> None:
    common = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "warning", "-loop", "1", "-framerate", str(FPS), "-i", str(image)]
    base = "scale=1920:1080,setsar=1,drawbox=x=0:y=886:w=1920:h=194:color=0x102730:t=fill"
    if source and source_range:
        start_frame, end_frame = source_range
        start, end = start_frame / FPS, end_frame / FPS
        content_w = PANEL["width"] - PANEL["border"] * 2
        content_h = PANEL["height"] - PANEL["border"] * 2
        filters = (
            f"[0:v]{base}[bg];"
            f"[1:v]trim=start_frame={start_frame}:end_frame={end_frame},setpts=PTS-STARTPTS,"
            f"scale={content_w}:{content_h}:force_original_aspect_ratio=decrease:force_divisible_by=2,"
            f"pad={PANEL['width']}:{PANEL['height']}:(ow-iw)/2:(oh-ih)/2:color=0xD8B774[fg];"
            f"[bg][fg]overlay={PANEL['x']}:{PANEL['y']}:shortest=1,format=yuv420p[v];"
            f"[1:a]atrim=start={start:.6f}:end={end:.6f},asetpts=PTS-STARTPTS,aresample=48000[a]"
        )
        command = common + ["-i", str(source), "-filter_complex", filters, "-map", "[v]", "-map", "[a]", "-frames:v", str(frames)]
    else:
        command = common + [
            "-f", "lavfi", "-t", f"{frames / FPS:.6f}", "-i", "anullsrc=r=48000:cl=stereo",
            "-vf", f"{base},format=yuv420p", "-frames:v", str(frames), "-map", "0:v", "-map", "1:a",
        ]
    command += [
        "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-shortest", str(output),
    ]
    run(command)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("lesson", choices=["L13", "L14", "L15", "L16"])
    args = parser.parse_args()
    lesson = args.lesson
    lower = lesson.lower()
    lesson_dir = ROOT / lower
    source = lesson_dir / f"accelerated-{lower}-heygen-native.mp4"
    receipt_path = lesson_dir / "provider-receipt.json"
    packet_path = REPO / f"docs/accelerated-course-modules/l13-l16-guided-video/{lower}-packet.json"
    captions = REPO / f"docs/accelerated-course-modules/l13-l16-guided-video/{lower}-storyboard.srt"
    packet = json.loads(packet_path.read_text())
    receipt = json.loads(receipt_path.read_text())
    if receipt["status"] != "completed" or sha256(source) != receipt["artifact"]["sha256"]:
        raise SystemExit("Provider receipt is absent, incomplete, or source-mismatched.")
    if packet["source_script_sha256"] != receipt["request"]["scriptSha256"]:
        raise SystemExit("Script binding differs from the provider receipt.")

    source_probe = probe(source)
    video = next(stream for stream in source_probe["streams"] if stream["codec_type"] == "video")
    source_frames = int(video.get("nb_frames") or round(float(source_probe["format"]["duration"]) * FPS))
    presenters = [scene["presenter"] for scene in packet["scenes"] if scene["presenter"]]
    if len(presenters) != 4:
        raise SystemExit("Expected exactly four presenter passages.")
    ranges = source_ranges(source, source_frames, presenters)

    timeline = []
    for index, scene in enumerate(packet["scenes"]):
        start = round(scene["start_seconds"] * FPS)
        end = round(scene["end_seconds"] * FPS)
        presenter = scene["presenter"]
        image = ROOT / "composite-assets" / f"{lower}-scene{index + 1}.png"
        if presenter:
            passage_index = int(presenter["id"][1:]) - 1
            source_range = ranges[passage_index]
            source_len = source_range[1] - source_range[0]
            insert = round(presenter["start_seconds"] * FPS)
            if insert + source_len > end:
                raise SystemExit(f"{presenter['id']} exceeds its approved scene boundary.")
            if insert > start:
                timeline.append({"kind": "clean", "image": image, "frames": insert - start, "scene": scene["id"]})
            timeline.append({"kind": "presenter", "image": image, "frames": source_len, "scene": scene["id"], "passage": presenter["id"], "source": source_range})
            if insert + source_len < end:
                timeline.append({"kind": "clean", "image": image, "frames": end - insert - source_len, "scene": scene["id"]})
        else:
            timeline.append({"kind": "clean", "image": image, "frames": end - start, "scene": scene["id"]})

    total_frames = round(packet["runtime_seconds"] * FPS)
    if sum(item["frames"] for item in timeline) != total_frames:
        raise SystemExit("Composite timeline frame count drifted.")

    work = lesson_dir / "composite-work"
    work.mkdir(parents=True, exist_ok=True)
    rendered = []
    for index, item in enumerate(timeline):
        output = work / f"{index:02}-{item['scene']}-{item['kind']}.mp4"
        render_segment(item["image"], output, item["frames"], source if item["kind"] == "presenter" else None, item.get("source"))
        rendered.append(output)
    concat_file = work / "concat.txt"
    concat_file.write_text("".join(f"file '{path}'\n" for path in rendered))
    joined = work / "joined.mp4"
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "warning", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", str(joined)])
    output = lesson_dir / f"accelerated-{lower}-native-composite.mp4"
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning", "-i", str(joined), "-i", str(captions),
        "-map", "0:v", "-map", "0:a", "-map", "1:0", "-r", str(FPS), "-frames:v", str(total_frames),
        "-t", f"{packet['runtime_seconds']:.6f}", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng", "-disposition:s:0", "default", "-movflags", "+faststart", str(output),
    ])
    run(["ffmpeg", "-v", "error", "-i", str(output), "-map", "0:v:0", "-f", "null", "-", "-map", "0:a:0", "-f", "null", "-"])
    final_probe = probe(output)
    output_sha = sha256(output)
    manifest = {
        "schema_version": 1,
        "lesson": lesson,
        "source_commit": receipt["request"]["source_commit"],
        "provider_job_id": receipt["video_id"],
        "source_sha256": receipt["artifact"]["sha256"],
        "script_sha256": receipt["request"]["scriptSha256"],
        "packet_sha256": sha256(packet_path),
        "captions_sha256": sha256(captions),
        "output_sha256": output_sha,
        "output_frames": total_frames,
        "output_duration_seconds": packet["runtime_seconds"],
        "source_passage_ranges": ranges,
        "timeline": timeline,
        "presenter_panel": PANEL,
        "constraints": {"source_speed": 1.0, "source_crop": False, "provider_calls": 0, "incremental_cost_usd": 0},
        "probe": final_probe,
    }
    (lesson_dir / "composite-manifest.json").write_text(json.dumps(manifest, indent=2, default=str) + "\n")
    (lesson_dir / "composite-receipt.json").write_text(json.dumps({
        "schema_version": "1.0", "project": "Portfolio", "lesson": lesson,
        "provider_job_id": receipt["video_id"], "approved_source_sha256": receipt["artifact"]["sha256"],
        "composite": {"filename": output.name, "sha256": output_sha, "duration_seconds": packet["runtime_seconds"], "width": 1920, "height": 1080, "frame_rate": FPS, "video_frames": total_frames},
        "verification": {"full_decode": "pass", "native_source_speed": 1.0, "native_source_cropped": False, "source_audio_only_in_presenter_windows": True, "sentence_complete_passages": ["A01", "A02", "A03", "A04"], "approved_captions_preserved": True},
        "external_actions": {"provider_calls": 0, "uploaded": False, "published": False, "distributed": False, "sent_externally": False},
        "human_qa": {"source_status": "pending", "composite_status": "pending"}, "current_gate": "batch_human_qa",
    }, indent=2) + "\n")
    print(json.dumps({"lesson": lesson, "output": str(output), "sha256": output_sha}, indent=2))


if __name__ == "__main__":
    main()
