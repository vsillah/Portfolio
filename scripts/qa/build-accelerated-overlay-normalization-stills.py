#!/usr/bin/env python3
"""Build local still-only overlay normalization proofs for Accelerated L01-L03."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from accelerated_overlay_style import audit_plan, render_teaching_plate


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "artifacts/accelerated-overlay-normalization-2026-11-14"
FONT = Path("/System/Library/Fonts/Avenir Next.ttc")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def timestamp(value: str) -> float:
    fields = value.split(":")
    return int(fields[0]) * 3600 + int(fields[1]) * 60 + float(fields[2])


def captions(path: Path) -> list[tuple[float, float, str]]:
    output: list[tuple[float, float, str]] = []
    blocks = re.split(r"\n\s*\n", path.read_text(encoding="utf-8").strip())
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        timing_index = next((index for index, line in enumerate(lines) if "-->" in line), None)
        if timing_index is None:
            continue
        left, right = lines[timing_index].split("-->", 1)
        start = timestamp(left.strip().split()[0])
        end = timestamp(right.strip().split()[0])
        text = " ".join(lines[timing_index + 1 :])
        output.append((start, end, text))
    return output


def cue_at(items: list[tuple[float, float, str]], second: float) -> str:
    for start, end, text in items:
        if start <= second <= end:
            return text
    return ""


def extract(video: Path, second: float, path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y", "-ss", f"{second:.3f}", "-i", str(video),
            "-frames:v", "1", str(path),
        ],
        check=True,
    )


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_width, target_height = size
    scale = max(target_width / image.width, target_height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_width) // 2)
    top = max(0, (resized.height - target_height) // 2)
    return resized.crop((left, top, left + target_width, top + target_height))


def add_caption_and_controls(image: Image.Image, cue: str) -> None:
    width, height = image.size
    draw = ImageDraw.Draw(image, "RGBA")
    control_height = max(38, round(height * 0.085))
    caption_y = height - control_height - max(78, round(height * 0.10))
    if cue:
        caption_font = ImageFont.truetype(str(FONT), max(15, round(width * 0.019)), index=0)
        max_chars = 76 if width > 800 else 34
        words = cue.split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if current and len(candidate) > max_chars:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        lines = lines[:2]
        text = "\n".join(lines)
        box = draw.multiline_textbbox((0, 0), text, font=caption_font, spacing=3, align="center")
        text_width = box[2] - box[0]
        text_height = box[3] - box[1]
        x = (width - text_width) // 2
        draw.rounded_rectangle(
            (x - 14, caption_y - 10, x + text_width + 14, caption_y + text_height + 10),
            radius=5,
            fill=(0, 0, 0, 205),
        )
        draw.multiline_text((x, caption_y), text, font=caption_font, fill=(255, 255, 255, 255), spacing=3, align="center")
    draw.rectangle((0, height - control_height, width, height), fill=(0, 0, 0, 220))
    draw.line((20, height - 12, width - 20, height - 12), fill=(224, 224, 224, 255), width=max(2, width // 500))


def fit_plate(frame: Image.Image, plate: Image.Image, x: int, y: int) -> tuple[Image.Image, int, int]:
    max_width = frame.width - x - 18
    max_height = frame.height - y - round(frame.height * 0.20)
    scale = min(1.0, max_width / plate.width, max_height / plate.height)
    if scale < 1.0:
        plate = plate.resize((round(plate.width * scale), round(plate.height * scale)), Image.Resampling.LANCZOS)
    return plate, x, y


def contact_sheet(images: list[Path], path: Path) -> None:
    opened = [Image.open(item).convert("RGB") for item in images]
    thumb_width = 480
    thumbs = [image.resize((thumb_width, round(image.height * thumb_width / image.width)), Image.Resampling.LANCZOS) for image in opened]
    cell_height = max(image.height for image in thumbs) + 42
    columns = 2
    rows = (len(thumbs) + columns - 1) // columns
    sheet = Image.new("RGB", (thumb_width * columns, cell_height * rows), "#081d26")
    draw = ImageDraw.Draw(sheet)
    label_font = ImageFont.truetype(str(FONT), 18, index=0)
    for index, (thumb, source) in enumerate(zip(thumbs, images)):
        x = (index % columns) * thumb_width
        y = (index // columns) * cell_height
        sheet.paste(thumb, (x, y))
        draw.text((x + 10, y + thumb.height + 10), source.stem, font=label_font, fill="#f5ebdd")
    sheet.save(path, quality=91)


def main() -> None:
    PACKAGE.mkdir(parents=True, exist_ok=True)
    receipt: dict[str, object] = {"contract": "accelerated-editorial-teaching-plate-v1", "lessons": {}}
    for lesson in ("l01", "l02", "l03"):
        plan_path = PACKAGE / f"{lesson}-teaching-overlay-plan.json"
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        issues = audit_plan(plan, str(plan_path.relative_to(ROOT)))
        if issues:
            raise SystemExit("\n".join(issues))
        lesson_dir = PACKAGE / lesson
        lesson_dir.mkdir(exist_ok=True)
        caption_items = captions(ROOT / plan["source"]["captions"])
        outputs: list[dict[str, object]] = []
        sheet_paths: dict[str, str] = {}
        for variant in ("desktop", "portrait"):
            video = ROOT / plan["source"][f"{variant}_video"]
            variant_images: list[Path] = []
            for event in plan["events"]:
                second = (event["start"] + event["end"]) / 2
                clean_path = lesson_dir / f"{event['id']}-{variant}-clean.jpg"
                caption_path = lesson_dir / f"{event['id']}-{variant}-caption-on.jpg"
                with tempfile.TemporaryDirectory() as temp_dir:
                    frame_path = Path(temp_dir) / "frame.png"
                    plate_path = Path(temp_dir) / "plate.png"
                    if video.exists():
                        extract(video, second, frame_path)
                        frame = Image.open(frame_path).convert("RGBA")
                    else:
                        source_visual = event.get("source_visual")
                        if not source_visual:
                            raise SystemExit(f"missing review video and source_visual for {lesson}:{event['id']}")
                        frame = Image.open(ROOT / source_visual).convert("RGBA")
                    target_size = (1920, 1080) if variant == "desktop" else (390, 844)
                    if frame.size != target_size:
                        frame = cover(frame, target_size)
                    replacement = event.get(f"{variant}_replace")
                    if replacement:
                        source_box = tuple(replacement["source"])
                        target_box = tuple(replacement["target"])
                        patch = frame.crop(source_box)
                        target_size_for_patch = (target_box[2] - target_box[0], target_box[3] - target_box[1])
                        if patch.size != target_size_for_patch:
                            patch = patch.resize(target_size_for_patch, Image.Resampling.LANCZOS)
                        frame.paste(patch, (target_box[0], target_box[1]))
                    mask = event.get(f"{variant}_mask")
                    if mask:
                        ImageDraw.Draw(frame).rectangle(tuple(mask), fill=(12, 37, 49, 255))
                    render_teaching_plate(event.get(f"{variant}_text", event["text"]), event[variant], plate_path)
                    plate = Image.open(plate_path).convert("RGBA")
                    plate, x, y = fit_plate(frame, plate, int(event[variant]["x"]), int(event[variant]["y"]))
                    frame.alpha_composite(plate, (x, y))
                    frame.convert("RGB").save(clean_path, quality=92)
                    caption_frame = frame.convert("RGB")
                    cue = cue_at(caption_items, second)
                    add_caption_and_controls(caption_frame, cue)
                    caption_frame.save(caption_path, quality=92)
                variant_images.extend((clean_path, caption_path))
                outputs.append({
                    "event": event["id"], "variant": variant, "second": round(second, 3),
                    "clean": str(clean_path.relative_to(ROOT)), "clean_sha256": sha256(clean_path),
                    "caption_on": str(caption_path.relative_to(ROOT)), "caption_on_sha256": sha256(caption_path),
                })
            sheet = lesson_dir / f"{lesson}-{variant}-contact.jpg"
            contact_sheet(variant_images, sheet)
            sheet_paths[variant] = str(sheet.relative_to(ROOT))
        receipt["lessons"][lesson.upper()] = {
            "plan": str(plan_path.relative_to(ROOT)),
            "plan_sha256": sha256(plan_path),
            "desktop_video_sha256": sha256(ROOT / plan["source"]["desktop_video"]) if (ROOT / plan["source"]["desktop_video"]).exists() else "source-visual-fallback",
            "portrait_video_sha256": sha256(ROOT / plan["source"]["portrait_video"]) if (ROOT / plan["source"]["portrait_video"]).exists() else "source-visual-fallback",
            "caption_sha256": sha256(ROOT / plan["source"]["captions"]),
            "contact_sheets": sheet_paths,
            "outputs": outputs,
        }
    receipt["scope"] = "local still-only normalization; source video, audio, captions, timing, and learner media unchanged"
    receipt["excluded"] = ["provider call", "spend", "video render", "learner-media change", "merge", "deploy", "publish", "release"]
    receipt_path = PACKAGE / "normalization-still-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(receipt_path)


if __name__ == "__main__":
    main()
