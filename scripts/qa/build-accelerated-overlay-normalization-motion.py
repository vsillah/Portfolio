#!/usr/bin/env python3
"""Render local L01-L03 review masters with narration-aligned teaching plates."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image

from accelerated_overlay_style import audit_plan, render_teaching_plate


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "artifacts/accelerated-overlay-normalization-2026-11-14"


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(command, check=True, text=True, capture_output=capture)
    return result.stdout.strip() if capture else ""


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path: Path) -> dict[str, Any]:
    return json.loads(run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,nb_frames",
        "-of", "json", str(path),
    ], capture=True))


def primary_video_stream(data: dict[str, Any]) -> dict[str, Any]:
    return next(stream for stream in data["streams"] if stream.get("codec_type") == "video")


def decoded_audio_hash(path: Path) -> str:
    output = run([
        "ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0",
        "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1",
        "-f", "hash", "-hash", "sha256", "-",
    ], capture=True)
    return output.split("=", 1)[1]


def extract_frame(video: Path, second: float, path: Path) -> None:
    run([
        "ffmpeg", "-v", "error", "-y", "-ss", f"{second:.3f}",
        "-i", str(video), "-frames:v", "1", str(path),
    ])


def fit_plate(frame: Image.Image, plate: Image.Image, x: int, y: int) -> tuple[Image.Image, int, int]:
    max_width = frame.width - x - 18
    max_height = frame.height - y - round(frame.height * 0.20)
    scale = min(1.0, max_width / plate.width, max_height / plate.height)
    if scale < 1.0:
        plate = plate.resize(
            (round(plate.width * scale), round(plate.height * scale)),
            Image.Resampling.LANCZOS,
        )
    return plate, x, y


def build_overlay(video: Path, event: dict[str, Any], variant: str, output: Path) -> None:
    video_data = probe(video)
    stream = primary_video_stream(video_data)
    size = (int(stream["width"]), int(stream["height"]))
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    replacement = event.get(f"{variant}_replace")
    if replacement:
        with tempfile.TemporaryDirectory() as temp_dir:
            frame_path = Path(temp_dir) / "frame.png"
            extract_frame(video, (float(event["start"]) + float(event["end"])) / 2, frame_path)
            frame = Image.open(frame_path).convert("RGBA")
            source_box = tuple(replacement["source"])
            target_box = tuple(replacement["target"])
            patch = frame.crop(source_box)
            target_size = (target_box[2] - target_box[0], target_box[3] - target_box[1])
            if patch.size != target_size:
                patch = patch.resize(target_size, Image.Resampling.LANCZOS)
            canvas.alpha_composite(patch, (target_box[0], target_box[1]))
    mask = event.get(f"{variant}_mask")
    if mask:
        from PIL import ImageDraw
        ImageDraw.Draw(canvas).rectangle(tuple(mask), fill=(10, 39, 50, 255))
    with tempfile.TemporaryDirectory() as temp_dir:
        plate_path = Path(temp_dir) / "plate.png"
        render_teaching_plate(event.get(f"{variant}_text", event["text"]), event[variant], plate_path)
        plate = Image.open(plate_path).convert("RGBA")
        plate, x, y = fit_plate(canvas, plate, int(event[variant]["x"]), int(event[variant]["y"]))
        canvas.alpha_composite(plate, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output)


def render_variant(plan: dict[str, Any], plan_path: Path, variant: str) -> dict[str, Any]:
    lesson = plan["lesson"].lower()
    source = ROOT / plan["source"][f"{variant}_video"]
    if not source.exists():
        raise SystemExit(f"missing {lesson} {variant} source: {source}")
    source_probe = probe(source)
    stream = primary_video_stream(source_probe)
    width, height = int(stream["width"]), int(stream["height"])
    if variant == "portrait" and width >= height:
        return {
            "variant": variant,
            "status": "player-reflow-only",
            "reason": "lesson has one landscape master; mobile proof uses the actual player rather than a duplicate portrait encode",
        }
    duration = float(source_probe["format"]["duration"])
    out_dir = PACKAGE / lesson / "motion"
    overlay_dir = out_dir / f"{variant}-overlays"
    output = out_dir / f"{lesson}-{variant}-teaching-overlay-local-review.mp4"
    if output.exists():
        raise SystemExit(f"refusing to overwrite {output}")

    overlays: list[Path] = []
    for event in plan["events"]:
        overlay = overlay_dir / f"{event['id']}.png"
        build_overlay(source, event, variant, overlay)
        overlays.append(overlay)

    command = ["ffmpeg", "-v", "error", "-n", "-i", str(source)]
    for overlay in overlays:
        command.extend(["-loop", "1", "-framerate", "25", "-i", str(overlay)])
    filters: list[str] = []
    prior = "0:v"
    for index, event in enumerate(plan["events"], start=1):
        name = f"v{index}"
        filters.append(
            f"[{prior}][{index}:v]overlay=0:0:enable='between(t,{event['start']},{event['end']})':eof_action=repeat[{name}]"
        )
        prior = name
    command.extend([
        "-filter_complex", ";".join(filters), "-map", f"[{prior}]", "-map", "0:a?", "-map", "0:s?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-c:s", "copy", "-t", f"{duration:.6f}", "-movflags", "+faststart", str(output),
    ])
    run(command)
    run(["ffmpeg", "-v", "error", "-i", str(output), "-f", "null", "-"])
    output_probe = probe(output)
    source_audio = decoded_audio_hash(source)
    output_audio = decoded_audio_hash(output)
    if source_audio != output_audio:
        raise SystemExit(f"decoded audio drift for {lesson} {variant}")
    if abs(float(output_probe["format"]["duration"]) - duration) > 0.05:
        raise SystemExit(f"duration drift for {lesson} {variant}")
    return {
        "variant": variant,
        "status": "pass",
        "source": str(source.relative_to(ROOT)),
        "source_sha256": sha256(source),
        "output": str(output.relative_to(ROOT)),
        "output_sha256": sha256(output),
        "duration_seconds": round(float(output_probe["format"]["duration"]), 3),
        "dimensions": [width, height],
        "decoded_audio_sha256": output_audio,
        "full_decode": "pass",
        "plan": str(plan_path.relative_to(ROOT)),
        "plan_sha256": sha256(plan_path),
    }


def main() -> None:
    receipt: dict[str, Any] = {
        "contract": "accelerated-editorial-teaching-plate-v1",
        "scope": "local review-only L01-L03 motion normalization; source audio, timing, captions, and learner media unchanged",
        "lessons": {},
        "excluded": ["provider call", "spend", "learner-media change", "PR update", "merge", "deploy", "publish", "release"],
    }
    for lesson in ("l01", "l02", "l03"):
        plan_path = PACKAGE / f"{lesson}-teaching-overlay-plan.json"
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        issues = audit_plan(plan, str(plan_path.relative_to(ROOT)))
        if issues:
            raise SystemExit("\n".join(issues))
        receipt["lessons"][lesson.upper()] = [
            render_variant(plan, plan_path, variant) for variant in ("desktop", "portrait")
        ]
    receipt_path = PACKAGE / "normalization-motion-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(receipt_path)


if __name__ == "__main__":
    main()
