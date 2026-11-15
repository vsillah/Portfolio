#!/usr/bin/env python3
"""Compose still-only SAM raster focus review frames and source receipts."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/accelerated-sam-focus-stills-2026-11-14"
BOOK = ROOT / "agentified/manuscript/visuals/rendered/print/color-600dpi/figure-0-0-accelerated-sam-loop-print-600dpi.png"
BOOK_SHA = "b7ab226d17f5ae4b421936b0ea541646223f55c0121da328e483941175c39ea3"
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
SCENES = (
    ("L09-01", "alignment", "A sound recommendation can still stall", "L09", (1150, 350, 2150, 2370)),
    ("L12-01", "momentum", "Keep the source beside the job", "L12", (2195, 350, 3170, 2370)),
    ("L12-03", "clientq", "A book case gives us a method, not proof", "L12", (2510, 600, 2820, 1200)),
)
RASTER_SHA = {
    "alignment": "496ec67b62d372b07bfcb3d939273879d80f177e3b34cf44ed1e9b8d98eaca71",
    "momentum": "7d37baf2841fc7115c1a7d9bd3f6860ed9eebdbe10ffad8186019534c33010d6",
    "clientq": "209dae1f622fef51c1d3714d1b72a399790b9eb17b99624b8d1149c2232bb56c",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size)


def presenter(lesson: str, bindings: dict, temp: Path) -> tuple[Image.Image, dict]:
    binding = bindings[lesson]["variants"]["desktop"]
    path = ROOT / "public" / binding["path"].lstrip("/")
    if sha(path) != binding["sha256"]:
        raise RuntimeError(f"{lesson} media hash drift")
    frame = temp / f"{lesson}.png"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-frames:v", "1", str(frame)], check=True)
    image = Image.open(frame).convert("RGB").crop((1136, 348, 1808, 732))
    return image, {"path": str(path.relative_to(ROOT)), "sha256": binding["sha256"], "frame_box": [1136, 348, 1808, 732]}


def locator(book: Image.Image, focus_box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    small = ImageOps.contain(book, size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "#142137")
    ox, oy = (size[0] - small.width) // 2, (size[1] - small.height) // 2
    canvas.paste(small, (ox, oy))
    sx, sy = small.width / book.width, small.height / book.height
    x1, y1, x2, y2 = focus_box
    ImageDraw.Draw(canvas).rectangle((ox+x1*sx, oy+y1*sy, ox+x2*sx, oy+y2*sy), outline="#fff0a2", width=3)
    return canvas


def draw_statement(draw: ImageDraw.ImageDraw, text: str, box: tuple[int, int, int, int], size: int) -> None:
    draw.rounded_rectangle(box, radius=9, fill="#123a49", outline="#dbb75d", width=2)
    x1, y1, x2, y2 = box
    words, lines, current = text.split(), [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), trial, font=font(size))[2] > x2-x1-28:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    line_height = size + 7
    top = y1 + (y2-y1-len(lines)*line_height)//2
    for i, line in enumerate(lines):
        draw.text((x1+13, top+i*line_height), line, font=font(size), fill="#f5f4ed")


def compose(scene: tuple, portrait: bool, book: Image.Image, speaker: Image.Image) -> dict:
    sid, focus, statement, lesson, focus_box = scene
    size = (390, 844) if portrait else (1280, 720)
    image = Image.new("RGB", size, "#142137")
    draw = ImageDraw.Draw(image)
    w, h = size
    draw.rounded_rectangle((10, 10, w-10, h-10), radius=15, outline="#dbb75d", width=2)
    draw.text((24 if portrait else 38, 28), f"ACCELERATED · {lesson}", font=font(17 if portrait else 24), fill="#dbb75d")
    art = Image.open(OUT / f"{focus}-raster.png").convert("RGB")
    art_box = (36, 74, 286, 514) if portrait else (355, 78, 785, 675)
    ax1, ay1, ax2, ay2 = art_box
    art = ImageOps.contain(art, (ax2-ax1, ay2-ay1), Image.Resampling.LANCZOS)
    image.paste(art, (ax1+(ax2-ax1-art.width)//2, ay1+(ay2-ay1-art.height)//2))
    loc_box = (288, 85, 375, 157) if portrait else (844, 503, 1194, 675)
    lx1, ly1, lx2, ly2 = loc_box
    image.paste(locator(book, focus_box, (lx2-lx1, ly2-ly1)), (lx1, ly1))
    draw.rectangle(loc_box, outline="#dbb75d", width=2)
    draw_statement(draw, statement, (20, 520, 370, 589) if portrait else (36, 265, 336, 407), 18 if portrait else 25)
    speaker_box = (18, 605, 372, 807) if portrait else (809, 193, 1231, 434)
    px1, py1, px2, py2 = speaker_box
    native = ImageOps.contain(speaker, (px2-px1, py2-py1), Image.Resampling.LANCZOS)
    image.paste(native, (px1+(px2-px1-native.width)//2, py1))
    draw.rectangle(speaker_box, outline="#dbb75d", width=2)
    path = OUT / f"{sid.lower()}-{focus}-{'390x844' if portrait else '1280x720'}.png"
    image.save(path, optimize=True)
    return {"path": str(path.relative_to(ROOT)), "sha256": sha(path), "dimensions": list(size), "locator_source_box": list(focus_box), "presenter_box": list(speaker_box)}


def contact(paths: list[Path], portrait: bool) -> dict:
    cell = (390, 844) if portrait else (640, 360)
    sheet = Image.new("RGB", (cell[0]*len(paths), cell[1]), "#142137")
    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGB").resize(cell, Image.Resampling.LANCZOS)
        sheet.paste(image, (index*cell[0], 0))
    path = OUT / ("contact-390x844.png" if portrait else "contact-desktop.png")
    sheet.save(path, optimize=True)
    return {"path": str(path.relative_to(ROOT)), "sha256": sha(path), "dimensions": list(sheet.size)}


def main() -> None:
    if sha(BOOK) != BOOK_SHA:
        raise RuntimeError("Canonical book plate drifted")
    book = Image.open(BOOK).convert("RGB")
    for focus, expected in RASTER_SHA.items():
        if sha(OUT / f"{focus}-raster.png") != expected:
            raise RuntimeError(f"{focus} raster drifted")
    bindings = json.loads((ROOT / "lib/accelerated-contextual-bindings.json").read_text())["lessons"]
    receipt = {"schema": "accelerated_sam_raster_focus_stills_v1", "status": "still_only_visual_review_pending", "source_book": {"path": str(BOOK.relative_to(ROOT)), "sha256": BOOK_SHA, "dimensions": list(book.size)}, "user_reference_sha256": "c530a383d89c125e2bbef4827f5cbde3ff124d58d9c68e34a1e4c68d05a51407", "raster_recreations": {}, "scenes": {}, "contact_sheets": {}}
    for focus, expected in RASTER_SHA.items():
        path = OUT / f"{focus}-raster.png"
        receipt["raster_recreations"][focus] = {"path": str(path.relative_to(ROOT)), "sha256": expected, "dimensions": list(Image.open(path).size), "method": "imagegen raster recreation grounded in canonical book plate; no source bitmap crop or SVG final art"}
    paths = {"desktop": [], "portrait": []}
    with tempfile.TemporaryDirectory() as directory:
        for scene in SCENES:
            speaker, source = presenter(scene[3], bindings, Path(directory))
            transcript = next((ROOT / "docs/accelerated-course-modules").glob(f"*/{scene[3].lower()}-transcript.json"))
            outputs = {}
            for variant, portrait in (("desktop", False), ("portrait", True)):
                outputs[variant] = compose(scene, portrait, book, speaker)
                paths[variant].append(ROOT / outputs[variant]["path"])
            receipt["scenes"][scene[0]] = {"class": "component-focus" if scene[1] == "clientq" else "column-focus", "focus": scene[1], "statement": scene[2], "presenter_source": source, "narration_source": {"path": str(transcript.relative_to(ROOT)), "sha256": sha(transcript)}, "outputs": outputs}
    receipt["contact_sheets"] = {"desktop": contact(paths["desktop"], False), "portrait": contact(paths["portrait"], True)}
    (OUT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt["contact_sheets"], indent=2))


if __name__ == "__main__":
    main()
