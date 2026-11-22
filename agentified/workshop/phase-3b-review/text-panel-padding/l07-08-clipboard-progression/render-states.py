#!/usr/bin/env python3
"""Render exact checklist copy as video plates; source artwork stays unedited."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "l07-08-closing-source-composition" / "studio-field.png"
FONT = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
SIZE = (1920, 1080)
INK = "#0b2838"
PENDING = "#4b5e62"
ROWS = (
    ("PRD", "PRD drafted"),
    ("Pod", "Pod assigned"),
    ("Failure route", "Failure route named"),
)


def check(draw: ImageDraw.ImageDraw, points: tuple[tuple[int, int], ...], width: int) -> None:
    draw.line(points, fill=INK, width=width, joint="curve")


def render_closeup(done: int) -> None:
    image = Image.open(HERE / "clipboard-teaching-plate-v4.png").convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, 76)
    for index, (pending, completed) in enumerate(ROWS):
        text = completed if index < done else pending
        y = (172, 290, 408)[index]
        width = draw.textbbox((0, 0), text, font=font)[2]
        assert 280 + width < 1810, f"Closeup row {index + 1} overflows"
        draw.text((280, y), text, font=font, fill=INK if index < done else PENDING, stroke_width=0)
        if index < done:
            shift = (0, 118, 236)[index]
            check(draw, ((126, 210 + shift), (163, 244 + shift), (218, 181 + shift)), 15)
    image.save(HERE / f"clipboard-state-{done}.png", optimize=True)


def render_full_field() -> None:
    image = Image.open(SOURCE).convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, 29)
    for index, (_, completed) in enumerate(ROWS):
        y = (133, 194, 255)[index]
        width = draw.textbbox((0, 0), completed, font=font)[2]
        assert 156 + width < 452, f"Full-field row {index + 1} overflows"
        draw.text((156, y), completed, font=font, fill=INK)
        shift = (0, 61, 122)[index]
        check(draw, ((82, 146 + shift), (89, 156 + shift), (109, 131 + shift)), 5)
    image.save(HERE / "studio-field-checked.png", optimize=True)


if __name__ == "__main__":
    for count in range(4):
        render_closeup(count)
    render_full_field()
