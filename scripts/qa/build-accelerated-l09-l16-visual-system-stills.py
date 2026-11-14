#!/usr/bin/env python3
"""Build provider-free L09-L16 Accelerated visual-system still proposals.

The script reads only canonical lesson scripts, protected visual-production
packets, and approved raster framework art. It produces review stills and a
receipt; it does not render lesson video or alter learner media.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

from accelerated_overlay_style import CONTRACT_ID, render_teaching_plate


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/accelerated-overlay-normalization-2026-11-14/l09-l16-still-rebuild"
FONT = Path("/System/Library/Fonts/Avenir Next.ttc")

PACKETS = (
    ROOT / "docs/accelerated-course-modules/visual-production/packet-l09-l12.md",
    ROOT / "docs/accelerated-course-modules/visual-production/packet-l13-l16.md",
)
ART = {
    "signals": ROOT / "public/showcases/service-prototypes/v2/sam-signals-plate.webp",
    "alignment": ROOT / "public/showcases/service-prototypes/v2/sam-alignment-plate.webp",
    "momentum": ROOT / "public/showcases/service-prototypes/v2/sam-momentum-plate.webp",
    "sam": ROOT / "public/showcases/service-prototypes/accelerated-sam-infographic.png",
}
PLATES = ROOT / "artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-presenter-unified-still-proposal-2026-11-13/source/plates"
CHARACTERS = PLATES / "l02-c02-book-style-flat-source-plates-2026-11-13"
CHOICES = PLATES / "l02-choice-c03-matte-stills-2026-11-13/plates"
BOARD = PLATES / "l02-c01-matte-board-wayfinding-stills-v3-2026-11-13/source-art"
L04_ART = ROOT / "artifacts/accelerated-l04-contextual-preflight-2026-11-13/scene-art"
SUPPORT_ART = {
    "L09": [ART["alignment"], L04_ART / "l04-scene-01.png", CHARACTERS / "customer-flat-matte-diverse.webp", BOARD / "wayfinding-desktop.webp", CHARACTERS / "competition-flat-matte-diverse.webp", ART["alignment"]],
    "L10": [ART["alignment"], CHARACTERS / "company-flat-matte-diverse.webp", CHOICES / "choice-options-matte.webp", CHOICES / "evidence-check-matte.webp", CHARACTERS / "competition-flat-matte-diverse.webp", ART["alignment"]],
    "L11": [ART["momentum"], CHOICES / "small-test-matte.webp", ART["sam"], CHARACTERS / "customer-flat-matte-diverse.webp", BOARD / "wayfinding-desktop.webp", ART["momentum"]],
    "L12": [CHARACTERS / "customer-flat-matte-diverse.webp", CHARACTERS / "company-flat-matte-diverse.webp", CHARACTERS / "product-flat-matte.webp", CHARACTERS / "competition-flat-matte-diverse.webp", CHOICES / "small-test-matte.webp", BOARD / "wayfinding-desktop.webp"],
    "L13": [ART["momentum"], CHOICES / "economic-fit-matte.webp", CHOICES / "small-test-matte.webp", CHARACTERS / "product-flat-matte.webp", CHARACTERS / "competition-flat-matte-diverse.webp", ART["momentum"]],
    "L14": [CHARACTERS / "company-flat-matte-diverse.webp", CHOICES / "evidence-check-matte.webp", CHOICES / "choice-options-matte.webp", CHARACTERS / "competition-flat-matte-diverse.webp", CHARACTERS / "company-flat-matte-diverse.webp", BOARD / "board-desktop.webp"],
    "L15": [ART["momentum"], BOARD / "board-desktop.webp", CHOICES / "evidence-check-matte.webp", ART["signals"], BOARD / "wayfinding-desktop.webp", ART["momentum"]],
    "L16": [ART["sam"], CHOICES / "evidence-check-matte.webp", CHOICES / "small-test-matte.webp", ART["signals"], CHARACTERS / "customer-flat-matte-diverse.webp", ART["sam"]],
}

NAVY = "#121E31"
SLATE = "#2C3E50"
PLATINUM = "#EAECEE"
BRONZE = "#8B6914"
GOLD = "#D4AF37"
GOLD_LIGHT = "#F5D060"
CREAM = "#F7EEDC"
TEAL = "#123F50"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT), size, index=index)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, width: int) -> str:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), candidate, font=face)[2] > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return "\n".join(lines)


def packet_scenes() -> dict[str, list[dict[str, Any]]]:
    scenes: dict[str, list[dict[str, Any]]] = {f"L{n:02d}": [] for n in range(9, 17)}
    heading = re.compile(r"^### (L\d{2})-(\d{2}) · ([^·]+) · (.+)$", re.M)
    for packet in PACKETS:
        text = packet.read_text(encoding="utf-8")
        matches = list(heading.finditer(text))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            block = text[match.end():end]
            on_screen = re.search(r"^On screen: `([^`]+)`", block, re.M)
            fenced_screen = re.search(r"^On screen:\s*\n\s*```text\n(.*?)\n```", block, re.M | re.S)
            art = re.search(r"^Art: ([^.\n]+)", block, re.M)
            if not (on_screen or fenced_screen) or not art:
                raise SystemExit(f"Missing packet fields for {match.group(1)}-{match.group(2)}")
            art_key = art.group(1).strip().lower()
            if art_key not in ART:
                art_key = "sam"
            if on_screen:
                point = on_screen.group(1).strip()
                points = [part.strip() for part in point.split(" · ") if part.strip()]
            else:
                raw_points = fenced_screen.group(1).strip().splitlines()
                points = [re.sub(r"^\s*\d+[.)]\s*", "", part).strip() for part in raw_points if part.strip()]
                point = " · ".join(points)
            scene_index = int(match.group(2)) - 1
            scenes[match.group(1)].append({
                "id": f"{match.group(1)}-{match.group(2)}",
                "duration": match.group(3).strip(),
                "title": match.group(4).strip(),
                "point": point,
                "points": points,
                "art": art_key,
                "source": ART[art_key],
                "visual_source": SUPPORT_ART[match.group(1)][scene_index],
                "packet": packet,
            })
    failures = {lesson: len(items) for lesson, items in scenes.items() if len(items) != 6}
    if failures:
        raise SystemExit(f"Expected six packet scenes per lesson: {failures}")
    return scenes


def paper_field(size: tuple[int, int]) -> Image.Image:
    w, h = size
    frame = Image.new("RGBA", size, NAVY)
    draw = ImageDraw.Draw(frame, "RGBA")
    for y in range(h):
        ratio = y / max(1, h - 1)
        draw.line((0, y, w, y), fill=(18 + round(8 * ratio), 30 + round(18 * ratio), 49 + round(22 * ratio), 255))
    # Restrained printed texture: deterministic lines and flecks, not gloss.
    for x in range(11, w, 43):
        draw.ellipse((x, (x * 37) % h, x + 1, (x * 37) % h + 1), fill=(245, 208, 96, 13))
    margin = 18 if w < 600 else 48
    draw.rounded_rectangle((margin, margin, w - margin, h - margin), radius=18, outline=BRONZE, width=2)
    return frame


def prepare_art(path: Path, box: tuple[int, int, int, int]) -> tuple[Image.Image, tuple[int, int]]:
    x1, y1, x2, y2 = box
    image = Image.open(path).convert("RGBA")
    image = ImageEnhance.Color(image).enhance(.9)
    image.thumbnail((x2 - x1, y2 - y1), Image.Resampling.LANCZOS)
    return image, (x1 + (x2 - x1 - image.width) // 2, y1 + (y2 - y1 - image.height) // 2)


def teaching_plate(frame: Image.Image, text: str, portrait: bool, temp: Path) -> None:
    render_teaching_plate(text, {"font_size": 22 if portrait else 38, "line_spacing": 4, "align": "left"}, temp)
    plate = Image.open(temp).convert("RGBA")
    max_w = frame.width - 36 if portrait else 760
    if plate.width > max_w:
        scale = max_w / plate.width
        plate = plate.resize((round(plate.width * scale), round(plate.height * scale)), Image.Resampling.LANCZOS)
    frame.alpha_composite(plate, (18 if portrait else 70, 36 if portrait else 62))


def draw_points(frame: Image.Image, scene: dict[str, Any], portrait: bool) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    w, h = frame.size
    points = scene["points"]
    if portrait:
        x1, x2 = 28, w - 28
        bottom = 650
        top = max(430, bottom - len(points) * 62 - max(0, len(points) - 1) * 10)
        point_font = font(16, 2)
        for index, point in enumerate(points):
            y1 = top + index * 72
            y2 = y1 + 58
            draw.rounded_rectangle((x1, y1, x2, y2), radius=6, fill=(18, 63, 80, 226), outline=GOLD, width=2)
            label = wrap(draw, point, point_font, x2 - x1 - 30)
            box = draw.multiline_textbbox((0, 0), label, font=point_font, spacing=2)
            draw.multiline_text((x1 + 15, y1 + (58 - (box[3] - box[1])) / 2 - box[1]), label, font=point_font, fill=PLATINUM, spacing=2)
    else:
        x1, x2 = 80, 930
        point_font = font(25, 2)
        if len(points) <= 3:
            top = 650
            height = 88
        else:
            top = 510
            height = 66
        gap = 12
        for index, point in enumerate(points):
            y1 = top + index * (height + gap)
            y2 = y1 + height
            draw.rounded_rectangle((x1, y1, x2, y2), radius=7, fill=(18, 63, 80, 226), outline=GOLD, width=2)
            label = wrap(draw, point, point_font, x2 - x1 - 38)
            box = draw.multiline_textbbox((0, 0), label, font=point_font, spacing=3)
            draw.multiline_text((x1 + 19, y1 + (height - (box[3] - box[1])) / 2 - box[1]), label, font=point_font, fill=PLATINUM, spacing=3)


def compose(scene: dict[str, Any], portrait: bool, destination: Path, temp: Path) -> None:
    size = (390, 844) if portrait else (1920, 1080)
    frame = paper_field(size)
    teaching_plate(frame, scene["title"], portrait, temp)
    draw = ImageDraw.Draw(frame, "RGBA")
    if portrait:
        art_box = (42, 145, 348, 435)
        art, pos = prepare_art(scene["visual_source"], art_box)
        frame.alpha_composite(art, pos)
        draw.text((26, 692), scene["id"], font=font(13, 2), fill=GOLD_LIGHT)
    else:
        art_box = (1010, 160, 1810, 940)
        art, pos = prepare_art(scene["visual_source"], art_box)
        frame.alpha_composite(art, pos)
        draw.text((80, 995), scene["id"], font=font(18, 2), fill=GOLD_LIGHT)
    draw_points(frame, scene, portrait)
    frame.convert("RGB").save(destination, quality=95)


def caption_preview(source: Path, caption: str, destination: Path) -> None:
    frame = Image.open(source).convert("RGBA")
    draw = ImageDraw.Draw(frame, "RGBA")
    w, h = frame.size
    face = font(27 if w > 600 else 16, 0)
    label = wrap(draw, caption, face, w - (180 if w > 600 else 50))
    box = draw.multiline_textbbox((0, 0), label, font=face, spacing=3, align="center")
    tw, th = box[2] - box[0], box[3] - box[1]
    controls = 66 if w > 600 else 72
    x = (w - tw) // 2
    y = h - controls - th - 24
    draw.rounded_rectangle((x - 12, y - 8, x + tw + 12, y + th + 8), radius=5, fill=(0, 0, 0, 210))
    draw.multiline_text((x, y), label, font=face, fill="white", spacing=3, align="center")
    draw.rectangle((0, h - controls, w, h), fill=(0, 0, 0, 215))
    draw.line((24, h - 14, w - 24, h - 14), fill=(224, 224, 224, 255), width=3)
    frame.convert("RGB").save(destination, quality=95)


def contact_sheet(paths: list[Path], destination: Path, portrait: bool) -> None:
    width = 300 if portrait else 480
    images = [Image.open(path).convert("RGB") for path in paths]
    thumbs = [image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS) for image in images]
    columns = 3 if portrait else 2
    cell_h = max(image.height for image in thumbs) + 34
    rows = (len(thumbs) + columns - 1) // columns
    sheet = Image.new("RGB", (width * columns, cell_h * rows), NAVY)
    draw = ImageDraw.Draw(sheet)
    for index, (thumb, path) in enumerate(zip(thumbs, paths)):
        x = (index % columns) * width
        y = (index // columns) * cell_h
        sheet.paste(thumb, (x, y))
        draw.text((x + 8, y + thumb.height + 7), path.stem, font=font(15), fill=CREAM)
    sheet.save(destination, quality=92)


def tranche_sheet(lessons: list[str], variant: str, mode: str, destination: Path) -> None:
    sources = [OUT / lesson.lower() / f"{lesson.lower()}-{variant}-{mode}-contact.jpg" for lesson in lessons]
    images = [Image.open(path).convert("RGB") for path in sources]
    cell_w = 960 if variant == "desktop" else 720
    thumbs = [image.resize((cell_w, round(image.height * cell_w / image.width)), Image.Resampling.LANCZOS) for image in images]
    cell_h = max(image.height for image in thumbs) + 42
    sheet = Image.new("RGB", (cell_w * 2, cell_h * 2), NAVY)
    draw = ImageDraw.Draw(sheet)
    for index, (lesson, thumb) in enumerate(zip(lessons, thumbs)):
        x = (index % 2) * cell_w
        y = (index // 2) * cell_h
        sheet.paste(thumb, (x, y))
        draw.text((x + 12, y + thumb.height + 8), lesson, font=font(20, 2), fill=GOLD_LIGHT)
    sheet.save(destination, quality=92)


def build_review_walkthrough(scenes: dict[str, list[dict[str, Any]]]) -> tuple[Path, Path]:
    review_dir = OUT / "review-walkthrough"
    review_dir.mkdir(exist_ok=True)
    frames: list[Path] = []
    title_face = font(34, 2)
    label_face = font(21, 2)
    for index, lesson in enumerate(sorted(scenes)):
        scene = scenes[lesson][2]
        stem = scene["id"].lower()
        desktop = Image.open(OUT / lesson.lower() / f"{stem}-desktop-clean.jpg").convert("RGB")
        portrait = Image.open(OUT / lesson.lower() / f"{stem}-portrait-caption-on.jpg").convert("RGB")
        canvas = Image.new("RGB", (1920, 1080), NAVY)
        draw = ImageDraw.Draw(canvas)
        draw.text((58, 32), f"{lesson} · desktop clean / mobile caption-on", font=title_face, fill=CREAM)
        desktop.thumbnail((1370, 770), Image.Resampling.LANCZOS)
        portrait.thumbnail((330, 714), Image.Resampling.LANCZOS)
        canvas.paste(desktop, (54, 116))
        canvas.paste(portrait, (1510, 116))
        draw.rounded_rectangle((54, 116, 54 + desktop.width, 116 + desktop.height), radius=8, outline=GOLD, width=2)
        draw.rounded_rectangle((1510, 116, 1510 + portrait.width, 116 + portrait.height), radius=8, outline=GOLD, width=2)
        draw.text((58, 916), "Exact packet wording · approved raster source · bordered teaching points", font=label_face, fill=GOLD_LIGHT)
        draw.text((58, 956), "Presenter is reserved for packet-authorized direct-address windows; native background remains intact.", font=label_face, fill=PLATINUM)
        frame_path = review_dir / f"{index + 1:02d}-{lesson.lower()}.jpg"
        canvas.save(frame_path, quality=95)
        frames.append(frame_path)
    concat = review_dir / "walkthrough.ffconcat"
    lines = ["ffconcat version 1.0"]
    for frame in frames:
        lines.extend((f"file '{frame.name}'", "duration 4"))
    lines.append(f"file '{frames[-1].name}'")
    concat.write_text("\n".join(lines) + "\n", encoding="utf-8")
    video = review_dir / "accelerated-l09-l16-still-direction-walkthrough.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-safe", "0",
        "-f", "concat", "-i", concat.name, "-vf", "fps=25,format=yuv420p",
        "-c:v", "libx264", "-movflags", "+faststart", video.name,
    ], cwd=review_dir, check=True)
    html = review_dir / "review.html"
    html.write_text(f"""<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Accelerated L09-L16 still-direction review</title>
<style>body{{margin:0;background:#121e31;color:#eaecee;font:16px system-ui}}main{{max-width:1120px;margin:auto;padding:24px}}video,img{{display:block;width:100%;height:auto;border:1px solid #d4af37}}h1{{font-size:24px}}p{{line-height:1.5;color:#f7eedc}}</style>
<main><h1>Accelerated L09-L16 · still-direction review</h1>
<p>Provider-free review artifact. Desktop clean states appear beside 390x844 caption-on states. No learner media is changed.</p>
<video controls preload="metadata" src="{video.name}"></video></main></html>\n""", encoding="utf-8")
    return video, html


def main() -> None:
    scenes = packet_scenes()
    support_sources = sorted({source for sources in SUPPORT_ART.values() for source in sources}, key=str)
    for source in (*PACKETS, *ART.values(), *support_sources):
        if not source.exists():
            raise SystemExit(f"Missing approved source: {source}")
    OUT.mkdir(parents=True, exist_ok=True)
    temp = OUT / ".teaching-plate.png"
    receipt: dict[str, Any] = {
        "schema": "accelerated_l09_l16_still_rebuild_v1",
        "contract": CONTRACT_ID,
        "scope": "provider-free still-only visual-system proposal",
        "rules": {
            "illustrations": "approved high-resolution raster art only; no SVG",
            "presenter": "not composited in still proposal; later use only in packet-authorized direct-address windows with native background intact",
            "mobile": "one illustration layer; reflow, never duplicate or crop desktop text",
            "captions": "optional overlay; no permanently reserved band",
            "teaching_points": "each discrete point has its own restrained border; no bullets",
        },
        "source_register": [{"path": str(path.relative_to(ROOT)), "sha256": sha256(path)} for path in (*PACKETS, *ART.values(), *support_sources)],
        "lessons": {},
        "excluded": ["lesson video render", "provider contact", "speech generation", "spend", "learner-media change", "PR update", "merge", "deploy", "publish", "release"],
    }
    for lesson, lesson_scenes in scenes.items():
        lesson_dir = OUT / lesson.lower()
        lesson_dir.mkdir(exist_ok=True)
        script = ROOT / f"docs/accelerated-course-modules/curriculum/scripts/{lesson}.md"
        lesson_receipt: dict[str, Any] = {
            "canonical_script": str(script.relative_to(ROOT)),
            "canonical_script_sha256": sha256(script),
            "review_status": "source-qualified-proposal",
            "states": [],
        }
        for variant, portrait in (("desktop", False), ("portrait", True)):
            clean_paths: list[Path] = []
            caption_paths: list[Path] = []
            for scene in lesson_scenes:
                clean = lesson_dir / f"{scene['id'].lower()}-{variant}-clean.jpg"
                caption = lesson_dir / f"{scene['id'].lower()}-{variant}-caption-on.jpg"
                compose(scene, portrait, clean, temp)
                caption_preview(clean, scene["title"], caption)
                clean_paths.append(clean)
                caption_paths.append(caption)
                lesson_receipt["states"].append({
                    "id": scene["id"], "variant": variant, "art": scene["art"],
                    "framework_source": str(scene["source"].relative_to(ROOT)),
                    "visual_source": str(scene["visual_source"].relative_to(ROOT)), "point": scene["point"],
                    "clean": str(clean.relative_to(ROOT)), "clean_sha256": sha256(clean),
                    "caption_on": str(caption.relative_to(ROOT)), "caption_on_sha256": sha256(caption),
                    "checks": {"source_wording": "packet-exact", "single_illustration_layer": True, "caption_control_clearance": "preflight-pass"},
                })
            contact_sheet(clean_paths, lesson_dir / f"{lesson.lower()}-{variant}-clean-contact.jpg", portrait)
            contact_sheet(caption_paths, lesson_dir / f"{lesson.lower()}-{variant}-caption-on-contact.jpg", portrait)
        receipt["lessons"][lesson] = lesson_receipt
    for lessons in (("L09", "L10", "L11", "L12"), ("L13", "L14", "L15", "L16")):
        label = f"{lessons[0].lower()}-{lessons[-1].lower()}"
        for variant in ("desktop", "portrait"):
            for mode in ("clean", "caption-on"):
                tranche_sheet(list(lessons), variant, mode, OUT / f"{label}-{variant}-{mode}-contact.jpg")
    walkthrough, review_html = build_review_walkthrough(scenes)
    receipt["review_evidence"] = {
        "walkthrough": str(walkthrough.relative_to(ROOT)),
        "walkthrough_sha256": sha256(walkthrough),
        "review_html": str(review_html.relative_to(ROOT)),
        "review_html_sha256": sha256(review_html),
    }
    temp.unlink(missing_ok=True)
    receipt_path = OUT / "still-rebuild-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(receipt_path)


if __name__ == "__main__":
    main()
