#!/usr/bin/env python3
"""Create encoded-frame QA contacts and a contextual L01-L03 walkthrough."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "artifacts/accelerated-overlay-normalization-2026-11-14"
FONT = Path("/System/Library/Fonts/Avenir Next.ttc")


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract(video: Path, second: float, output: Path) -> None:
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{second:.3f}", "-i", str(video), "-frames:v", "1", str(output)])


def contact(paths: list[tuple[Path, str]], output: Path, portrait: bool) -> None:
    thumb_size = (240, 519) if portrait else (480, 270)
    columns = 3 if portrait else 2
    label_height = 44
    rows = (len(paths) + columns - 1) // columns
    sheet = Image.new("RGB", (thumb_size[0] * columns, (thumb_size[1] + label_height) * rows), "#081d26")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(FONT), 16, index=0)
    for index, (path, label) in enumerate(paths):
        image = Image.open(path).convert("RGB").resize(thumb_size, Image.Resampling.LANCZOS)
        x = index % columns * thumb_size[0]
        y = index // columns * (thumb_size[1] + label_height)
        sheet.paste(image, (x, y))
        draw.text((x + 8, y + thumb_size[1] + 10), label, font=font, fill="#f5ebdd")
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=91)


def make_contacts(receipt: dict) -> list[dict]:
    results: list[dict] = []
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        for lesson in ("l01", "l02", "l03"):
            plan = json.loads((PACKAGE / f"{lesson}-teaching-overlay-plan.json").read_text())
            for variant_info in receipt["lessons"][lesson.upper()]:
                if variant_info["status"] != "pass":
                    continue
                variant = variant_info["variant"]
                video = ROOT / variant_info["output"]
                frames: list[tuple[Path, str]] = []
                for index, event in enumerate(plan["events"]):
                    second = (event["start"] + event["end"]) / 2
                    frame = temp / f"{lesson}-{variant}-{index}.png"
                    extract(video, second, frame)
                    frames.append((frame, f"{event['id']} @ {second:.2f}s"))
                output = PACKAGE / lesson / "motion" / f"{lesson}-{variant}-encoded-contact.jpg"
                contact(frames, output, variant == "portrait")
                results.append({
                    "lesson": lesson.upper(), "variant": variant,
                    "contact": str(output.relative_to(ROOT)), "sha256": sha256(output),
                    "sample_count": len(frames),
                })
    return results


def title(path: Path, label: str, frames: int = 50) -> None:
    image_path = path.with_suffix(".png")
    image = Image.new("RGB", (1920, 1080), "#0a2732")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(FONT), 58, index=2)
    box = draw.textbbox((0, 0), label, font=font)
    draw.text(
        ((1920 - (box[2] - box[0])) // 2, (1080 - (box[3] - box[1])) // 2),
        label, font=font, fill="#f9f1db",
    )
    image.save(image_path)
    run([
        "ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "25", "-i", str(image_path),
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", str(path),
    ])


def clip(source: Path, start: float, end: float, output: Path, portrait: bool) -> None:
    if portrait:
        vf = "scale=493:1068:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#0a2732,setsar=1"
    else:
        vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#0a2732,setsar=1"
    run([
        "ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(source),
        "-map", "0:v:0", "-map", "0:a:0", "-vf", vf, "-r", "25",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "1", str(output),
    ])


def walkthrough(receipt: dict) -> Path:
    sources = {}
    for lesson, variants in receipt["lessons"].items():
        for info in variants:
            if info["status"] == "pass":
                sources[(lesson, info["variant"])] = ROOT / info["output"]
    sequence = [
        ("L01 · landscape master · decision path", sources[("L01", "desktop")], 97.5, 111.5, False),
        ("L02 · desktop · economic-fit questions", sources[("L02", "desktop")], 254.5, 271.0, False),
        ("L02 · portrait · same single illustration layer", sources[("L02", "portrait")], 254.5, 271.0, True),
        ("L03 · desktop · evidence rehearsal", sources[("L03", "desktop")], 208.5, 225.0, False),
        ("L03 · portrait · same single illustration layer", sources[("L03", "portrait")], 208.5, 225.0, True),
    ]
    output_dir = PACKAGE / "human-qa"
    output_dir.mkdir(parents=True, exist_ok=True)
    parts: list[Path] = []
    for index, (label, source, start, end, portrait) in enumerate(sequence):
        card = output_dir / f"{index:02d}-title.mp4"
        segment = output_dir / f"{index:02d}-segment.mp4"
        title(card, label)
        clip(source, start, end, segment, portrait)
        parts.extend((card, segment))
    concat = output_dir / "parts.ffconcat"
    concat.write_text("".join(f"file '{path.resolve()}'\n" for path in parts), encoding="utf-8")
    output = output_dir / "l01-l03-overlay-normalization-contextual-walkthrough.mp4"
    if output.exists():
        raise SystemExit(f"refusing to overwrite {output}")
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(output)])
    run(["ffmpeg", "-v", "error", "-i", str(output), "-f", "null", "-"])
    return output


def main() -> None:
    receipt_path = PACKAGE / "normalization-motion-receipt.json"
    receipt = json.loads(receipt_path.read_text())
    contacts = make_contacts(receipt)
    video = walkthrough(receipt)
    qa = {
        "motion_receipt": str(receipt_path.relative_to(ROOT)),
        "motion_receipt_sha256": sha256(receipt_path),
        "encoded_contacts": contacts,
        "walkthrough": str(video.relative_to(ROOT)),
        "walkthrough_sha256": sha256(video),
        "walkthrough_full_decode": "pass",
        "scope": "contextual review of the shared teaching-plate treatment; no provider or learner-media change",
    }
    output = PACKAGE / "normalization-motion-qa-receipt.json"
    output.write_text(json.dumps(qa, indent=2) + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
