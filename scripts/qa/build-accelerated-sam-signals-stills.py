#!/usr/bin/env python3
"""Compose still-only Signals visual-system review frames and source receipt."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/accelerated-sam-signals-stills-2026-11-14"
BOOK = ROOT / "agentified/manuscript/visuals/rendered/print/color-600dpi/figure-0-0-accelerated-sam-loop-print-600dpi.png"
BOOK_SHA = "b7ab226d17f5ae4b421936b0ea541646223f55c0121da328e483941175c39ea3"
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
RASTER_SHA = {
    "signals-column": "9bde3903610af11b086fe5580117992118cdb60ef63a260a1c67397713b6766f",
    "signals-funnel": "f08dc644a0a941649abc76c19995f5ae3d29269bfecfe5c2a516c67cef43e948",
}
LESSON_MEDIA = {
    "L01": ("public/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4", (1424, 262, 1867, 515)),
    "L02": ("public/accelerated/lessons/l02/approved-ded23edb/accelerated-l02-native-composite.mp4", (957, 187, 1853, 698)),
    "L05": ("public/accelerated/lessons/l05/approved-bd1e53b5/accelerated-l05-native-composite.mp4", (951, 168, 1895, 700)),
}
LESSON_SCRIPTS = {
    "L01": "docs/accelerated-course-modules/l01-guided-video/animatic.json",
    "L02": "docs/accelerated-course-modules/l02-l04-guided-video/l02-packet.json",
    "L05": "docs/accelerated-course-modules/l05-l08-guided-video/l05-packet.json",
}
SCENES = (
    ("L01-03", "full-map", "book", "Signals · Alignment · Momentum", "L01", None),
    ("L02-02", "Signals-column", "signals-column", "Choose one. Keep two alternatives.", "L02", (145, 350, 1150, 2370)),
    ("L05-01", "Signals-column", "signals-column", "Decision before theme", "L05", (145, 350, 1150, 2370)),
    ("L05-03", "Signals-component", "signals-funnel", "One complaint can hide several jobs", "L05", (180, 590, 1090, 2000)),
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size)


def speaker(lesson: str, temp: Path) -> tuple[Image.Image, dict]:
    relative, box = LESSON_MEDIA[lesson]
    path = ROOT / relative
    frame = temp / f"{lesson}.png"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-frames:v", "1", str(frame)], check=True)
    return Image.open(frame).convert("RGB").crop(box), {"path": relative, "sha256": sha(path), "native_frame_box": list(box)}


def source_locator(book: Image.Image, focus_box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    thumb = ImageOps.contain(book, size, Image.Resampling.LANCZOS)
    result = Image.new("RGB", size, "#142137")
    ox, oy = (size[0]-thumb.width)//2, (size[1]-thumb.height)//2
    result.paste(thumb, (ox, oy))
    sx, sy = thumb.width/book.width, thumb.height/book.height
    x1, y1, x2, y2 = focus_box
    ImageDraw.Draw(result).rectangle((ox+x1*sx, oy+y1*sy, ox+x2*sx, oy+y2*sy), outline="#fff0a2", width=3)
    return result


def statement(draw: ImageDraw.ImageDraw, text: str, box: tuple[int, int, int, int], size: int) -> None:
    draw.rounded_rectangle(box, radius=9, fill="#123a49", outline="#dbb75d", width=2)
    x1, y1, x2, y2 = box
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), trial, font=font(size))[2] > x2-x1-28:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    line_h = size+7
    y = y1+(y2-y1-len(lines)*line_h)//2
    for i, line in enumerate(lines):
        draw.text((x1+13, y+i*line_h), line, font=font(size), fill="#f5f4ed")


def compose(scene: tuple, portrait: bool, book: Image.Image, presenter: Image.Image) -> dict:
    sid, kind, asset, copy, lesson, focus_box = scene
    size = (390, 844) if portrait else (1280, 720)
    frame = Image.new("RGB", size, "#142137")
    draw = ImageDraw.Draw(frame)
    w, h = size
    draw.rounded_rectangle((10, 10, w-10, h-10), radius=15, outline="#dbb75d", width=2)
    draw.text((24 if portrait else 38, 28), f"ACCELERATED · {lesson}", font=font(17 if portrait else 24), fill="#dbb75d")
    art = book if asset == "book" else Image.open(OUT / f"{asset}-raster.png").convert("RGB")
    art_box = (22, 93, 368, 490) if portrait and asset == "book" else ((36, 74, 286, 514) if portrait else ((345, 115, 795, 665) if asset == "book" else (355, 78, 785, 675)))
    ax1, ay1, ax2, ay2 = art_box
    art = ImageOps.contain(art, (ax2-ax1, ay2-ay1), Image.Resampling.LANCZOS)
    frame.paste(art, (ax1+(ax2-ax1-art.width)//2, ay1+(ay2-ay1-art.height)//2))
    locator_box = None
    if focus_box is not None:
        locator_box = (288, 85, 375, 157) if portrait else (844, 503, 1194, 675)
        lx1, ly1, lx2, ly2 = locator_box
        frame.paste(source_locator(book, focus_box, (lx2-lx1, ly2-ly1)), (lx1, ly1))
        draw.rectangle(locator_box, outline="#dbb75d", width=2)
    copy_box = (20, 520, 370, 589) if portrait else (36, 265, 336, 407)
    statement(draw, copy, copy_box, 18 if portrait else 25)
    presenter_box = (18, 605, 372, 807) if portrait else (809, 193, 1231, 434)
    px1, py1, px2, py2 = presenter_box
    native = ImageOps.contain(presenter, (px2-px1, py2-py1), Image.Resampling.LANCZOS)
    frame.paste(native, (px1+(px2-px1-native.width)//2, py1))
    draw.rectangle(presenter_box, outline="#dbb75d", width=2)
    path = OUT / f"{sid.lower()}-{asset}-{'390x844' if portrait else '1280x720'}.png"
    frame.save(path, optimize=True)
    return {"path": str(path.relative_to(ROOT)), "sha256": sha(path), "dimensions": list(size), "locator_source_box": list(focus_box) if focus_box else None, "presenter_box": list(presenter_box)}


def contact(paths: list[Path], portrait: bool) -> dict:
    cell = (390, 844) if portrait else (640, 360)
    sheet = Image.new("RGB", (cell[0]*len(paths), cell[1]), "#142137")
    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGB").resize(cell, Image.Resampling.LANCZOS)
        sheet.paste(image, (index*cell[0], 0))
    path = OUT / ("signals-contact-390x844.png" if portrait else "signals-contact-desktop.png")
    sheet.save(path, optimize=True)
    return {"path": str(path.relative_to(ROOT)), "sha256": sha(path), "dimensions": list(sheet.size)}


def main() -> None:
    if sha(BOOK) != BOOK_SHA:
        raise RuntimeError("Canonical SAM book plate drifted")
    book = Image.open(BOOK).convert("RGB")
    for asset, expected in RASTER_SHA.items():
        if sha(OUT / f"{asset}-raster.png") != expected:
            raise RuntimeError(f"{asset} raster drifted")
    old_plate = ROOT / "public/showcases/service-prototypes/v2/sam-signals-plate.webp"
    old_map = ROOT / "public/showcases/service-prototypes/accelerated-sam-infographic.png"
    receipt = {"schema": "accelerated_sam_signals_raster_stills_v1", "status": "still_only_visual_review_pending", "book_source": {"path": str(BOOK.relative_to(ROOT)), "sha256": BOOK_SHA, "dimensions": list(book.size)}, "superseded_focus_treatments": [{"path": str(old_plate.relative_to(ROOT)), "sha256": sha(old_plate), "note": "historical standalone workshop plate; retained but not the proposed focus view"}, {"path": str(old_map.relative_to(ROOT)), "sha256": sha(old_map), "note": "historical overview infographic; canonical book plate owns full-map orientation"}], "raster_recreations": {}, "scenes": {}, "contact_sheets": {}, "live_media_modified": False}
    for asset, expected in RASTER_SHA.items():
        path = OUT / f"{asset}-raster.png"
        receipt["raster_recreations"][asset] = {"path": str(path.relative_to(ROOT)), "sha256": expected, "dimensions": list(Image.open(path).size), "method": "new raster recreation guided by canonical book plate; no source bitmap crop or SVG final art"}
    outputs = {"desktop": [], "portrait": []}
    with tempfile.TemporaryDirectory() as temp:
        for scene in SCENES:
            presenter, media = speaker(scene[4], Path(temp))
            packet_path = ROOT / LESSON_SCRIPTS[scene[4]]
            packet = json.loads(packet_path.read_text())
            script_path = ROOT / packet["source_script"]
            if sha(script_path) != packet["source_script_sha256"]:
                raise RuntimeError(f"{scene[4]} canonical script drifted")
            stills = {}
            for variant, portrait in (("desktop", False), ("portrait", True)):
                stills[variant] = compose(scene, portrait, book, presenter)
                outputs[variant].append(ROOT / stills[variant]["path"])
            receipt["scenes"][scene[0]] = {"class": scene[1], "asset": scene[2], "teaching_line": scene[3], "canonical_script": {"path": str(script_path.relative_to(ROOT)), "sha256": packet["source_script_sha256"]}, "presenter_source": media, "stills": stills}
    receipt["contact_sheets"] = {"desktop": contact(outputs["desktop"], False), "portrait": contact(outputs["portrait"], True)}
    (OUT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt["contact_sheets"], indent=2))


if __name__ == "__main__":
    main()
