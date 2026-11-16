#!/usr/bin/env python3
"""Shared Accelerated workshop teaching-overlay contract and renderer."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


CONTRACT_ID = "accelerated-editorial-teaching-plate-v1"
FONT = Path("/System/Library/Fonts/Avenir Next.ttc")
FONT_INDEX = 2

PANEL_FILL = (10, 39, 50, 255)
PANEL_BORDER = (205, 171, 99, 255)
ACCENT_FILL = (222, 183, 91, 255)
TEXT_FILL = (249, 241, 219, 255)

FORBIDDEN_BULLET_PREFIXES = ("•", "‣", "◦", "▪", "- ", "* ")
REQUIRED_STYLE = {
    "contract": CONTRACT_ID,
    "panel": "temporary deep AmaduTown-blue contrast field",
    "type": "warm cream Avenir Next Demi Bold",
    "accent": "thin AmaduTown-gold rule and border",
    "motion": "reveal, hold, replace, clear",
}


def render_teaching_plate(text: str, layout: dict[str, Any], path: Path) -> tuple[int, int]:
    """Render one discrete teaching point as a bordered editorial plate."""
    font_size = int(layout["font_size"])
    font = ImageFont.truetype(str(FONT), font_size, index=FONT_INDEX)
    spacing = int(layout.get("line_spacing", 0))
    align = str(layout.get("align", "left"))
    probe = Image.new("RGBA", (8, 8))
    draw = ImageDraw.Draw(probe)
    box = draw.multiline_textbbox(
        (0, 0), text, font=font, spacing=spacing, align=align, stroke_width=2
    )
    pad_x = max(18, round(font_size * 0.55))
    pad_y = max(12, round(font_size * 0.34))
    accent_width = max(4, round(font_size * 0.10))
    accent_gap = max(10, round(font_size * 0.22))
    width = math.ceil(box[2] - box[0] + pad_x * 2 + accent_width + accent_gap)
    height = math.ceil(box[3] - box[1] + pad_y * 2)
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = max(3, round(font_size * 0.08))
    draw.rounded_rectangle(
        (2, 2, width - 3, height - 3),
        radius=radius,
        fill=PANEL_FILL,
        outline=PANEL_BORDER,
        width=2,
    )
    accent_x = pad_x
    draw.rounded_rectangle(
        (accent_x, pad_y, accent_x + accent_width, height - pad_y),
        radius=max(1, accent_width // 2),
        fill=ACCENT_FILL,
    )
    origin = (pad_x + accent_width + accent_gap - box[0], pad_y - box[1])
    draw.multiline_text(
        origin,
        text,
        font=font,
        fill=TEXT_FILL,
        spacing=spacing,
        align=align,
    )
    image.save(path)
    return image.size


def audit_plan(plan: dict[str, Any], source: str) -> list[str]:
    """Return contract violations for one narration-aligned overlay plan."""
    issues: list[str] = []
    style = plan.get("style", {})
    for key, expected in REQUIRED_STYLE.items():
        if style.get(key) != expected:
            issues.append(f"{source}: style.{key} must be {expected!r}")

    events = plan.get("events")
    if not isinstance(events, list) or not events:
        return issues + [f"{source}: events must be a non-empty list"]

    prior_end = -1.0
    for index, event in enumerate(events):
        label = f"{source}: events[{index}]"
        if not isinstance(event, dict):
            issues.append(f"{label} must be an object")
            continue
        start = event.get("start")
        end = event.get("end")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            issues.append(f"{label} requires numeric start and end")
        elif start >= end:
            issues.append(f"{label} must end after it starts")
        elif start < prior_end:
            issues.append(f"{label} overlaps the prior teaching point")
        else:
            prior_end = float(end)

        text_values = [event.get("text", "")]
        text_values.extend(
            event[key] for key in ("desktop_text", "portrait_text") if key in event
        )
        for text in text_values:
            if not isinstance(text, str) or not text.strip():
                issues.append(f"{label} has an empty text value")
                continue
            if any(line.lstrip().startswith(FORBIDDEN_BULLET_PREFIXES) for line in text.splitlines()):
                issues.append(f"{label} uses a bullet; each point needs its own plate")
            if len(text.replace("\n", " ")) > 64:
                issues.append(f"{label} exceeds the 64-character high-level-text limit")

        for variant in ("desktop", "portrait"):
            layout = event.get(variant)
            if not isinstance(layout, dict):
                issues.append(f"{label} is missing {variant} layout")
                continue
            for key in ("x", "y", "font_size"):
                if not isinstance(layout.get(key), (int, float)):
                    issues.append(f"{label}.{variant}.{key} must be numeric")

        if not event.get("source_cue"):
            issues.append(f"{label} must bind the short point to a narration source cue")

    return issues
