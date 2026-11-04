#!/usr/bin/env python3
"""Build the approved Accelerated L01 native-source composite.

The HeyGen MP4 remains at native speed, aspect ratio, frame rate, and audio timing.
Only the four approved presenter passages are composited over the reserved windows.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WORK = ROOT / "composite-work-v4"
SOURCE = ROOT / "accelerated-l01-heygen-corrected-native-source.mp4"
CAPTIONS = ROOT / "l01-approved-captions.srt"
OUTPUT = ROOT / "accelerated-l01-native-composite.mp4"
MANIFEST = ROOT / "composite-manifest.json"
EXPECTED_SOURCE_SHA = "2c502e0e9fc03b93fb71f85abae1ce936c2c33a43e01307620a845424f233626"
EVIDENCE_CARD_SVG = ROOT / "composite-assets" / "a02-evidence-card.svg"
EVIDENCE_CARD_PNG = ROOT / "composite-assets" / "a02-evidence-card.png"
FPS = 25

# Frame-exact timeline. Source frame ranges are half-open and remain at 1.0x.
SEGMENTS = [
    {"name": "01-a01", "image": "scene1-clean.png", "frames": 788, "source": [0, 788], "sequence_start": 0.0, "overlay": [1420, 260]},
    {"name": "02-scene1", "image": "scene1-clean.png", "frames": 1087},
    {"name": "03-scene2", "image": "scene2-clean.png", "frames": 2250},
    {"name": "04-scene3", "image": "scene3-clean.png", "frames": 1750},
    {"name": "05-a02", "image": "scene3-clean.png", "frames": 330, "source": [788, 1118], "sequence_start": 235.0, "overlay": [1420, 790]},
    {
        "name": "06-a02-boundary",
        "image": "scene3-clean.png",
        "frames": 170,
        "evidence_card": True,
        "overlay": [1420, 790],
    },
    {"name": "07-scene4", "image": "scene4-clean.png", "frames": 2250},
    {"name": "08-a03", "image": "scene5-clean.png", "frames": 349, "source": [1118, 1467], "sequence_start": 345.0, "overlay": [1420, 790]},
    {"name": "09-scene5", "image": "scene5-clean.png", "frames": 2026},
    {"name": "10-scene6", "image": "scene6-clean.png", "frames": 1875},
    {"name": "11-a04", "image": "scene6-clean.png", "frames": 362, "source": [1467, 1829], "sequence_start": 515.0, "overlay": [60, 790]},
    {"name": "12-scene6", "image": "scene6-clean.png", "frames": 263},
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


def render_segment(segment: dict[str, object], output: Path) -> None:
    frames = int(segment["frames"])
    image = ROOT / "composite-assets" / str(segment["image"])
    common = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-loop", "1", "-framerate", str(FPS), "-i", str(image),
    ]
    if "source" in segment:
        start_frame, end_frame = segment["source"]
        overlay_x, overlay_y = segment["overlay"]
        start = int(start_frame) / FPS
        end = int(end_frame) / FPS
        filters = (
            f"[0:v]scale=1920:1080,setsar=1[bg];"
            f"[1:v]trim=start_frame={start_frame}:end_frame={end_frame},"
            "setpts=PTS-STARTPTS,"
            "scale=440:248:force_original_aspect_ratio=decrease,"
            "pad=448:256:4:4:color=0xF1C84B[fg];"
            f"[bg][fg]overlay={overlay_x}:{overlay_y}:shortest=1,format=yuv420p[v];"
            f"[1:a]atrim=start={start:.6f}:end={end:.6f},"
            "asetpts=PTS-STARTPTS,aresample=48000[a]"
        )
        command = common + [
            "-i", str(SOURCE), "-filter_complex", filters,
            "-map", "[v]", "-map", "[a]", "-frames:v", str(frames),
        ]
    elif segment.get("evidence_card"):
        duration = frames / FPS
        overlay_x, overlay_y = segment["overlay"]
        card = EVIDENCE_CARD_PNG
        filters = (
            "[0:v]scale=1920:1080,setsar=1[bg];"
            "[1:v]scale=448:256,setsar=1[card];"
            f"[bg][card]overlay={overlay_x}:{overlay_y}:shortest=1,format=yuv420p[v]"
        )
        command = common + [
            "-loop", "1", "-framerate", str(FPS), "-i", str(card),
            "-f", "lavfi", "-t", f"{duration:.6f}",
            "-i", "anullsrc=r=48000:cl=stereo",
            "-filter_complex", filters,
            "-frames:v", str(frames), "-map", "[v]", "-map", "2:a",
        ]
    else:
        duration = frames / FPS
        command = common + [
            "-f", "lavfi", "-t", f"{duration:.6f}",
            "-i", "anullsrc=r=48000:cl=stereo",
            "-vf", "scale=1920:1080,setsar=1,format=yuv420p",
            "-frames:v", str(frames), "-map", "0:v", "-map", "1:a",
        ]
    command += [
        "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-shortest", str(output),
    ]
    run(command)


def main() -> None:
    if sha256(SOURCE) != EXPECTED_SOURCE_SHA:
        raise SystemExit("Approved source SHA-256 mismatch; refusing to render.")
    if not EVIDENCE_CARD_PNG.exists():
        run(["sips", "-s", "format", "png", str(EVIDENCE_CARD_SVG), "--out", str(EVIDENCE_CARD_PNG)])
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
        "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-c", "copy", str(joined),
    ])

    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(joined),
        "-i", str(CAPTIONS),
        "-map", "0:v", "-map", "0:a", "-map", "1:0",
        "-r", str(FPS), "-frames:v", "13500", "-t", "540.000000",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-disposition:s:0", "default",
        "-movflags", "+faststart", str(OUTPUT),
    ])

    cursor = 0
    timeline = []
    for segment in SEGMENTS:
        frames = int(segment["frames"])
        item = {
            **segment,
            "timeline_start_seconds": cursor / FPS,
            "timeline_end_seconds": (cursor + frames) / FPS,
        }
        timeline.append(item)
        cursor += frames

    manifest = {
        "schema_version": 1,
        "lesson": "Accelerated L01",
        "source_commit": "ccb0e108cc96e2903722901e66a85114f13dcc6f",
        "provider_job_id": "c5639a0b76144ae5bcd76b1f2de85ed5",
        "source_sha256": EXPECTED_SOURCE_SHA,
        "output_sha256": sha256(OUTPUT),
        "fps": FPS,
        "output_frames": cursor,
        "output_duration_seconds": cursor / FPS,
        "overlay": {"content_width": 440, "content_height": 248, "frame_width": 448, "frame_height": 256, "fit": "contain", "style": "solid gold", "placement": "scene-specific negative space"},
        "captions": {"path": CAPTIONS.name, "sha256": sha256(CAPTIONS), "embedded": "mov_text default"},
        "timeline": timeline,
        "constraints": {
            "source_speed": 1.0,
            "source_crop": False,
            "source_audio_owner_in_avatar_windows": True,
            "provider_calls": 0,
            "external_actions": 0,
        },
        "a02_handoff": {
            "source_window_end_seconds": 248.2,
            "evidence_card_end_seconds": 255.0,
            "purpose": "Replace the abrupt presenter disappearance with a content-aligned evidence boundary.",
            "repeated_presenter_frames": False,
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"output": str(OUTPUT), "sha256": manifest["output_sha256"]}, indent=2))


if __name__ == "__main__":
    main()
