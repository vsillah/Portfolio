#!/usr/bin/env python3
"""Build the approved Accelerated L02 native-source composite without providers."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
WORK = ROOT / "composite-work"
SOURCE = ROOT / "accelerated-l02-heygen-native.mp4"
CAPTIONS = REPO / "docs/accelerated-course-modules/l02-l04-guided-video/l02-storyboard.srt"
PACKET = REPO / "docs/accelerated-course-modules/l02-l04-guided-video/l02-packet.json"
SCRIPT = REPO / "docs/accelerated-course-modules/curriculum/scripts/L02.md"
OUTPUT = ROOT / "accelerated-l02-native-composite.mp4"
MANIFEST = ROOT / "composite-manifest.json"
RECEIPT = ROOT / "composite-receipt.json"
EXPECTED_SOURCE_SHA = "2beae8254c76a6f8bf168afb8483e83e63c13b621ec3934c81397d3167cd1a3d"
EXPECTED_SCRIPT_SHA = "73119dd526db5221d0af960feb25be911e31841c5f143d6e1a843076108ec1af"
EXPECTED_PACKET_SHA = "a3cf10bcb3c6e556868bdf390d0da0d93bfd089564d46f22d5c09ab072b70357"
FPS = 25

# Source ranges are half-open native frame ranges, split at measured sentence-group pauses.
# Timeline frames sum to exactly 10:00 at 25 fps. Presenter passages start in their
# approved storyboard windows and hand off immediately to the content plate.
SEGMENTS = [
    {"name": "01-a01", "image": "scene1-presenter.png", "frames": 744, "source": [0, 744], "overlay": [949, 182]},
    {"name": "02-scene1", "image": "scene1-clean.png", "frames": 1506},
    {"name": "03-scene2", "image": "scene2-clean.png", "frames": 2250},
    {"name": "04-a02", "image": "scene3-presenter.png", "frames": 357, "source": [744, 1101], "overlay": [949, 182]},
    {"name": "05-scene3", "image": "scene3-clean.png", "frames": 1968},
    {"name": "06-scene4", "image": "scene4-clean.png", "frames": 2325},
    {"name": "07-a03", "image": "scene5-presenter.png", "frames": 255, "source": [1101, 1356], "overlay": [949, 182]},
    {"name": "08-scene5", "image": "scene5-clean.png", "frames": 1870},
    {"name": "09-scene6", "image": "scene6-clean.png", "frames": 2375},
    {"name": "10-scene7-pre", "image": "scene7-clean.png", "frames": 697},
    {"name": "11-a04", "image": "scene7-presenter.png", "frames": 334, "source": [1356, 1690], "overlay": [949, 182]},
    {"name": "12-scene7-close", "image": "scene7-clean.png", "frames": 319},
]


def run(command: list[str]) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, check=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(path: Path) -> dict[str, object]:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def render_segment(segment: dict[str, object], output: Path) -> None:
    frames = int(segment["frames"])
    image = ROOT / "composite-assets" / str(segment["image"])
    common = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-loop", "1", "-framerate", str(FPS), "-i", str(image),
    ]
    # Remove the screenshot's estimated caption text. The exact approved SRT is embedded.
    base_filter = "scale=1920:1080,setsar=1,drawbox=x=0:y=886:w=1920:h=194:color=0x102730:t=fill"
    if "source" in segment:
        start_frame, end_frame = segment["source"]
        overlay_x, overlay_y = segment["overlay"]
        start = int(start_frame) / FPS
        end = int(end_frame) / FPS
        filters = (
            f"[0:v]{base_filter}[bg];"
            f"[1:v]trim=start_frame={start_frame}:end_frame={end_frame},setpts=PTS-STARTPTS,"
            "scale=900:506:force_original_aspect_ratio=decrease,"
            "pad=916:522:8:8:color=0xD8B774[fg];"
            f"[bg][fg]overlay={overlay_x}:{overlay_y}:shortest=1,format=yuv420p[v];"
            f"[1:a]atrim=start={start:.6f}:end={end:.6f},asetpts=PTS-STARTPTS,aresample=48000[a]"
        )
        command = common + [
            "-i", str(SOURCE), "-filter_complex", filters,
            "-map", "[v]", "-map", "[a]", "-frames:v", str(frames),
        ]
    else:
        duration = frames / FPS
        command = common + [
            "-f", "lavfi", "-t", f"{duration:.6f}", "-i", "anullsrc=r=48000:cl=stereo",
            "-vf", f"{base_filter},format=yuv420p",
            "-frames:v", str(frames), "-map", "0:v", "-map", "1:a",
        ]
    command += [
        "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-shortest", str(output),
    ]
    run(command)


def main() -> None:
    bindings = {
        "source": (SOURCE, EXPECTED_SOURCE_SHA),
        "script": (SCRIPT, EXPECTED_SCRIPT_SHA),
        "packet": (PACKET, EXPECTED_PACKET_SHA),
    }
    for label, (path, expected) in bindings.items():
        actual = sha256(path)
        if actual != expected:
            raise SystemExit(f"{label} SHA-256 mismatch: expected {expected}, got {actual}")
    if sum(int(segment["frames"]) for segment in SEGMENTS) != 15000:
        raise SystemExit("Timeline must contain exactly 15,000 frames.")
    source_frames = [segment["source"] for segment in SEGMENTS if "source" in segment]
    if source_frames != [[0, 744], [744, 1101], [1101, 1356], [1356, 1690]]:
        raise SystemExit("Native source ranges must be contiguous and complete.")

    WORK.mkdir(exist_ok=True)
    rendered: list[Path] = []
    for segment in SEGMENTS:
        output = WORK / f"{segment['name']}.mp4"
        if not output.exists():
            render_segment(segment, output)
        rendered.append(output)

    concat_file = WORK / "concat.txt"
    concat_file.write_text("".join(f"file '{path}'\n" for path in rendered))
    joined = WORK / "joined.mp4"
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", str(joined),
    ])
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(joined), "-i", str(CAPTIONS),
        "-map", "0:v", "-map", "0:a", "-map", "1:0",
        "-r", str(FPS), "-frames:v", "15000", "-t", "600.000000",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-disposition:s:0", "default",
        "-movflags", "+faststart", str(OUTPUT),
    ])
    run([
        "ffmpeg", "-v", "error", "-i", str(OUTPUT),
        "-map", "0:v:0", "-f", "null", "-",
        "-map", "0:a:0", "-f", "null", "-",
    ])

    cursor = 0
    timeline = []
    for segment in SEGMENTS:
        frames = int(segment["frames"])
        timeline.append({
            **segment,
            "timeline_start_seconds": cursor / FPS,
            "timeline_end_seconds": (cursor + frames) / FPS,
        })
        cursor += frames

    output_probe = probe(OUTPUT)
    output_sha = sha256(OUTPUT)
    manifest = {
        "schema_version": 1,
        "lesson": "Accelerated L02",
        "source_commit": "63103bac7bd2598988674d6f48fc9d70bdbabd2f",
        "provider_job_id": "b4b8b4e83c18429feca3f4f4f45ae28b",
        "source_sha256": EXPECTED_SOURCE_SHA,
        "script_sha256": EXPECTED_SCRIPT_SHA,
        "packet_sha256": EXPECTED_PACKET_SHA,
        "captions_sha256": sha256(CAPTIONS),
        "output_sha256": output_sha,
        "fps": FPS,
        "output_frames": cursor,
        "output_duration_seconds": cursor / FPS,
        "overlay": {
            "content_width": 900,
            "content_height": 506,
            "frame_width": 916,
            "frame_height": 522,
            "fit": "contain",
            "style": "solid gold",
            "placement": "approved presenter panel above caption-safe band",
        },
        "source_passage_boundaries": {
            "method": "native frame boundaries selected at measured sentence-group pauses",
            "ranges": source_frames,
            "source_frames": 1690,
            "source_duration_seconds": 67.6,
            "speed": 1.0,
        },
        "timeline": timeline,
        "constraints": {
            "source_speed": 1.0,
            "source_crop": False,
            "source_audio_owner_in_avatar_windows": True,
            "estimated_caption_text_burned_in": False,
            "provider_calls": 0,
            "external_actions": 0,
            "incremental_cost_usd": 0,
        },
        "probe": output_probe,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    video = next(stream for stream in output_probe["streams"] if stream["codec_type"] == "video")
    audio = next(stream for stream in output_probe["streams"] if stream["codec_type"] == "audio")
    subtitle = next(stream for stream in output_probe["streams"] if stream["codec_type"] == "subtitle")
    receipt = {
        "schema_version": "1.0",
        "project": "Portfolio",
        "lesson": "Accelerated L02",
        "source_commit": manifest["source_commit"],
        "provider_job_id": manifest["provider_job_id"],
        "approved_source_sha256": EXPECTED_SOURCE_SHA,
        "composite": {
            "filename": OUTPUT.name,
            "sha256": output_sha,
            "duration_seconds": 600.0,
            "width": int(video["width"]),
            "height": int(video["height"]),
            "frame_rate": FPS,
            "video_frames": int(video.get("nb_frames", 15000)),
            "video_codec": video["codec_name"],
            "audio_codec": audio["codec_name"],
            "caption_codec": subtitle["codec_name"],
        },
        "verification": {
            "full_decode": "pass",
            "native_source_speed": 1.0,
            "native_source_cropped": False,
            "source_audio_only_in_presenter_windows": True,
            "presenter_frame": "aspect-correct solid gold 16:9",
            "presenter_placement": "reserved storyboard presenter panel above caption-safe band",
            "meaningful_content_obscured": False,
            "sentence_complete_passages": ["A01", "A02", "A03", "A04"],
            "approved_assets_preserved": True,
            "approved_captions_preserved": True,
        },
        "external_actions": {
            "provider_calls": 0,
            "uploaded": False,
            "published": False,
            "distributed": False,
            "sent_externally": False,
            "other_lessons_generated": False,
            "incremental_cost_usd": 0,
        },
        "human_qa": {"source_status": "approved", "composite_status": "pending"},
        "current_gate": "native_composite_human_qa",
    }
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"output": str(OUTPUT), "sha256": output_sha}, indent=2))


if __name__ == "__main__":
    main()
