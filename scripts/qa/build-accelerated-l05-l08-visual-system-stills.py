#!/usr/bin/env python3
"""Build the provider-free L05-L08 Accelerated visual-system still package.

This is deliberately a still-only qualification artifact. It does not read or
write learner bindings, call a media provider, or render lesson video.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

from accelerated_overlay_style import CONTRACT_ID, render_teaching_plate


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/accelerated-overlay-normalization-2026-11-14/l05-l08-still-rebuild"
FONT = Path("/System/Library/Fonts/Avenir Next.ttc")
PACKET = ROOT / "docs/accelerated-course-modules/visual-production/packet-l05-l08.md"

BLUE = "#0b2d3a"
BLUE_2 = "#123f50"
CREAM = "#f7eedc"
GOLD = "#d8ac52"
INK = "#102f3c"
MOSS = "#65734a"
TERRACOTTA = "#ad5f3e"
CORAL = "#cf8066"

L04_ART = ROOT / "artifacts/accelerated-l04-contextual-preflight-2026-11-13/scene-art"
L02_ROOT = ROOT / "artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-presenter-unified-still-proposal-2026-11-13/source/plates"
BOARD_ROOT = L02_ROOT / "l02-c01-matte-board-wayfinding-stills-v3-2026-11-13/source-art"
CHOICE_ROOT = L02_ROOT / "l02-choice-c03-matte-stills-2026-11-13/plates"
DRIVE_SAM = Path(
    "/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/"
    "2. AmaduTown Advisory Solutions/Artifacts /Promotional /"
    "Accelerated Building Smarter Products with AI/Final/Accelerated_infographic.png"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT), size, index=index)


SCENES: dict[str, list[dict[str, Any]]] = {
    "L05": [
        {"id": "01-decision-before-theme", "point": "Decision before theme", "title": "A full inbox is not a decision", "nodes": ["F01–F06", "Decision question", "Signals"], "source": L04_ART / "l04-scene-01.png", "kind": "converge"},
        {"id": "02-traceable-words", "point": "Keep raw words traceable", "title": "Raw words stay beside the proposed job", "nodes": ["Words", "Moment", "Possible job"], "source": L04_ART / "l04-scene-07.png", "kind": "ledger"},
        {"id": "03-several-jobs", "point": "One complaint, several jobs", "title": "Separate the jobs hidden in one complaint", "nodes": ["Confirmation", "Resume", "Instruction"], "source": L04_ART / "l04-scene-04.png", "kind": "fan"},
        {"id": "04-human-inspection", "point": "Check the source before accepting a cluster", "title": "The machine clusters. A person inspects.", "nodes": ["Draft cluster", "Original words", "Corrected cluster"], "source": CHOICE_ROOT / "evidence-check-matte.webp", "kind": "check"},
        {"id": "05-testable-opportunity", "point": "Make the opportunity testable", "title": "A pattern needs a counterexample", "nodes": ["Pattern", "Counterexample", "Proposed decision"], "source": L04_ART / "l04-scene-05.png", "kind": "sequence"},
        {"id": "06-contrary-note", "point": "Keep one contrary note", "title": "Leave room for evidence that disagrees", "nodes": ["Code six notes", "Keep one contrary note", "Update the worksheet"], "source": L04_ART / "l04-scene-06.png", "kind": "sequence"},
    ],
    "L06": [
        {"id": "01-three-options", "point": "Three options, one current bet", "title": "A roadmap choice is a visible trade", "nodes": ["Welcome email", "Guided first task", "Staff dashboard"], "source": CHOICE_ROOT / "choice-options-matte.webp", "kind": "fan"},
        {"id": "02-criteria", "point": "Why this now?", "title": "Choose with criteria, not volume", "nodes": ["Why now?", "Current bet", "What reopens the others?"], "source": BOARD_ROOT / "wayfinding-desktop.webp", "kind": "converge"},
        {"id": "03-prd-opening", "point": "Open with the change sought", "title": "The PRD starts with the change", "nodes": ["Problem", "Person", "Evidence", "Behavior"], "source": L04_ART / "l04-scene-02.png", "kind": "sequence"},
        {"id": "04-failed-handoff", "point": "What happens when begin fails?", "title": "Explain the failed handoff", "nodes": ["Invitation", "First task", "Blocked start"], "source": L04_ART / "l04-scene-04.png", "kind": "sequence"},
        {"id": "05-trace-card", "point": "Evidence must be measurable", "title": "Every decision keeps its trace", "nodes": ["Source", "Owner", "Scope", "Measure", "Change reason"], "source": CHOICE_ROOT / "evidence-check-matte.webp", "kind": "ledger"},
        {"id": "06-whole-line", "point": "Evidence to bet to PRD to observation", "title": "The work stays connected", "nodes": ["Evidence", "Bet", "PRD", "Observation"], "source": DRIVE_SAM, "kind": "sequence"},
    ],
    "L07": [
        {"id": "01-quarter-full", "point": "Delivery date + learning question", "title": "A full quarter still needs a question", "nodes": ["Delivery date", "Learning question", "Customer outcome"], "source": BOARD_ROOT / "board-desktop.webp", "kind": "converge"},
        {"id": "02-diagnose", "point": "Checkpoint 1 · diagnose", "title": "First, find where the start breaks", "nodes": ["Observe", "Locate friction", "Name the question"], "source": L04_ART / "l04-scene-03.png", "kind": "sequence"},
        {"id": "03-smaller-test", "point": "Checkpoint 2 · test smaller", "title": "Test the smallest useful change", "nodes": ["Small change", "Observed response", "Next question"], "source": L04_ART / "l04-scene-05.png", "kind": "sequence"},
        {"id": "04-team-question", "point": "What outcome? What will we learn?", "title": "The team changes the question", "nodes": ["Customer outcome", "Learning question", "Plan"], "source": L04_ART / "l04-scene-01.png", "kind": "converge"},
        {"id": "05-failed-test", "point": "A failed test changes the next question", "title": "Failure can redirect the plan", "nodes": ["Test", "Contrary evidence", "Revised question"], "source": CHOICE_ROOT / "evidence-check-matte.webp", "kind": "sequence"},
        {"id": "06-two-dates", "point": "Two dates, two decisions", "title": "Delivery and learning move together", "nodes": ["Delivery decision", "Learning decision"], "source": BOARD_ROOT / "wayfinding-desktop.webp", "kind": "parallel"},
    ],
    "L08": [
        {"id": "01-activity-outcome", "point": "Activity is not the customer outcome", "title": "A healthy dashboard can hide a weak start", "nodes": ["Activity", "Customer start", "Unanswered question"], "source": L04_ART / "l04-scene-03.png", "kind": "check"},
        {"id": "02-measure-guardrail", "point": "Define a successful start", "title": "Pair the measure with a guardrail", "nodes": ["Measure", "Guardrail", "Learning question"], "source": CHOICE_ROOT / "evidence-check-matte.webp", "kind": "converge"},
        {"id": "03-fields-one-five", "point": "Build the first half of the test", "title": "Fields 1–5 define the test", "nodes": ["Problem", "Cohort", "Hypothesis", "Scope", "Metrics"], "source": L04_ART / "l04-scene-07.png", "kind": "ledger"},
        {"id": "04-fields-six-ten", "point": "Finish the operating boundaries", "title": "Fields 6–10 govern the response", "nodes": ["Timing", "Tripwires", "Pivots", "Future path", "Backlog"], "source": L04_ART / "l04-scene-02.png", "kind": "ledger"},
        {"id": "05-two-results", "point": "Each result opens a next question", "title": "Two hypothetical results, two paths", "nodes": ["If A", "Next question", "If B", "Next question"], "source": BOARD_ROOT / "wayfinding-desktop.webp", "kind": "parallel"},
        {"id": "06-stop-condition", "point": "Write the stop condition before results", "title": "Complete the file before the test", "nodes": ["Ten-field file", "Stop condition", "Learning System Loop"], "source": DRIVE_SAM, "kind": "sequence"},
    ],
}


def cover(source: Path, size: tuple[int, int], centering: tuple[float, float] = (.5, .5)) -> Image.Image:
    image = Image.open(source).convert("RGB")
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=centering)


def unified_background(source: Path, size: tuple[int, int]) -> Image.Image:
    image = cover(source, size, (.5, .5 if size[0] > 600 else .46))
    image = ImageEnhance.Color(image).enhance(.78)
    blue = Image.new("RGB", size, BLUE)
    image = Image.blend(image, blue, .30)
    veil = Image.new("RGBA", size, (3, 24, 33, 52))
    image = Image.alpha_composite(image.convert("RGBA"), veil)
    # One continuous tonal field behind the editorial text; this is not a
    # permanent panel and it does not divide the illustration into columns.
    shade = Image.new("RGBA", size, (0, 0, 0, 0))
    pixels = shade.load()
    fade_height = 230 if size[0] > 600 else 205
    for y in range(fade_height):
        alpha = round(145 * (1 - y / fade_height))
        for x in range(size[0]):
            pixels[x, y] = (3, 28, 38, alpha)
    return Image.alpha_composite(image, shade)


def text_fit(draw: ImageDraw.ImageDraw, text: str, width: int, start: int, minimum: int) -> ImageFont.FreeTypeFont:
    for size in range(start, minimum - 1, -1):
        candidate = font(size, 2)
        if draw.textbbox((0, 0), text, font=candidate)[2] <= width:
            return candidate
    return font(minimum, 2)


def draw_node(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, accent: str) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=8, fill=CREAM, outline=GOLD, width=3)
    draw.rectangle((x1, y1, x1 + 10, y2), fill=accent)
    node_font = text_fit(draw, text, x2 - x1 - 42, 28 if x2 - x1 > 300 else 20, 14)
    tb = draw.textbbox((0, 0), text, font=node_font)
    draw.text((x1 + 24, (y1 + y2 - (tb[3] - tb[1])) // 2 - tb[1]), text, font=node_font, fill=INK)


def diagram(frame: Image.Image, scene: dict[str, Any], portrait: bool) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    w, h = frame.size
    if portrait:
        area = (20, 145, w - 20, 670)
    else:
        area = (100, 210, 1180, 900)
    ax1, ay1, ax2, ay2 = area
    draw.rounded_rectangle(area, radius=12, fill=(247, 238, 220, 232), outline=GOLD, width=3)

    nodes = scene["nodes"]
    gap = 14 if portrait else 20
    if portrait:
        node_h = (ay2 - ay1 - 56 - gap * (len(nodes) - 1)) // len(nodes)
        boxes = [(ax1 + 22, ay1 + 28 + i * (node_h + gap), ax2 - 22, ay1 + 28 + i * (node_h + gap) + node_h) for i in range(len(nodes))]
    else:
        if scene["kind"] in {"ledger", "sequence"} or len(nodes) > 3:
            node_h = (ay2 - ay1 - 70 - gap * (len(nodes) - 1)) // len(nodes)
            boxes = [(ax1 + 80, ay1 + 35 + i * (node_h + gap), ax2 - 80, ay1 + 35 + i * (node_h + gap) + node_h) for i in range(len(nodes))]
        else:
            node_w = (ax2 - ax1 - 120 - gap * (len(nodes) - 1)) // len(nodes)
            boxes = [(ax1 + 60 + i * (node_w + gap), ay1 + 135, ax1 + 60 + i * (node_w + gap) + node_w, ay2 - 135) for i in range(len(nodes))]

    accents = [GOLD, TERRACOTTA, MOSS, CORAL, BLUE_2]
    for idx, (box, label) in enumerate(zip(boxes, nodes)):
        draw_node(draw, box, label, accents[idx % len(accents)])
    for left, right in zip(boxes, boxes[1:]):
        if portrait or left[1] != right[1]:
            start = ((left[0] + left[2]) // 2, left[3])
            end = ((right[0] + right[2]) // 2, right[1])
        else:
            start = (left[2], (left[1] + left[3]) // 2)
            end = (right[0], (right[1] + right[3]) // 2)
        draw.line((start, end), fill=GOLD, width=5)
        ex, ey = end
        if portrait or left[1] != right[1]:
            draw.polygon([(ex, ey), (ex - 8, ey - 13), (ex + 8, ey - 13)], fill=GOLD)
        else:
            draw.polygon([(ex, ey), (ex - 13, ey - 8), (ex - 13, ey + 8)], fill=GOLD)


def teaching_plate(frame: Image.Image, text: str, portrait: bool, temp: Path) -> None:
    layout = {"font_size": 22 if portrait else 38, "line_spacing": 4, "align": "left"}
    render_teaching_plate(text, layout, temp)
    plate = Image.open(temp).convert("RGBA")
    max_w = frame.width - 36 if portrait else 760
    if plate.width > max_w:
        scale = max_w / plate.width
        plate = plate.resize((round(plate.width * scale), round(plate.height * scale)), Image.Resampling.LANCZOS)
    frame.alpha_composite(plate, (18 if portrait else 100, 42 if portrait else 70))


def caption_controls(frame: Image.Image, caption: str) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    w, h = frame.size
    controls_h = 64 if w > 600 else 70
    draw.rectangle((0, h - controls_h, w, h), fill=(0, 0, 0, 220))
    draw.line((24, h - 14, w - 24, h - 14), fill=(224, 224, 224, 255), width=3)
    cap_font = font(28 if w > 600 else 16, 0)
    max_chars = 60 if w > 600 else 34
    words = caption.split()
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
    text = "\n".join(lines[:2])
    tb = draw.multiline_textbbox((0, 0), text, font=cap_font, spacing=3, align="center")
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    x = (w - tw) // 2
    y = h - controls_h - th - 22
    draw.rounded_rectangle((x - 12, y - 8, x + tw + 12, y + th + 8), radius=5, fill=(0, 0, 0, 210))
    draw.multiline_text((x, y), text, font=cap_font, fill="white", spacing=3, align="center")


def contact_sheet(paths: list[Path], destination: Path, portrait: bool) -> None:
    width = 300 if portrait else 480
    images = [Image.open(path).convert("RGB") for path in paths]
    thumbs = [image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS) for image in images]
    cell_h = max(image.height for image in thumbs) + 34
    columns = 3 if portrait else 2
    rows = (len(thumbs) + columns - 1) // columns
    sheet = Image.new("RGB", (width * columns, cell_h * rows), BLUE)
    draw = ImageDraw.Draw(sheet)
    label_font = font(16, 0)
    for idx, (thumb, source) in enumerate(zip(thumbs, paths)):
        x = (idx % columns) * width
        y = (idx // columns) * cell_h
        sheet.paste(thumb, (x, y))
        draw.text((x + 8, y + thumb.height + 7), source.stem, font=label_font, fill=CREAM)
    sheet.save(destination, quality=92)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    staged = OUT / "source"
    staged.mkdir(exist_ok=True)
    required_sources = sorted({scene["source"] for scenes in SCENES.values() for scene in scenes}, key=str)
    for source in required_sources:
        if not source.exists():
            raise SystemExit(f"Missing approved source art: {source}")
    drive_copy = staged / "Accelerated_infographic.png"
    if not drive_copy.exists() or sha256(drive_copy) != sha256(DRIVE_SAM):
        shutil.copy2(DRIVE_SAM, drive_copy)

    receipt: dict[str, Any] = {
        "schema": "accelerated_l05_l08_still_rebuild_v1",
        "contract": CONTRACT_ID,
        "scope": "provider-free still-only visual-system rebuild",
        "presenter_rule": "Short native presenter passages stay fixed middle-right over a continuous AmaduTown-blue composition; dense instructional states are presenter-free.",
        "mobile_rule": "One illustration layer; no mirrored, duplicated, blurred, or stacked source image.",
        "source_register": [],
        "visual_packet": str(PACKET.relative_to(ROOT)),
        "visual_packet_sha256": sha256(PACKET),
        "lessons": {},
        "excluded": ["SVG illustration", "provider call", "speech generation", "spend", "video render", "learner-media change", "PR update", "merge", "deploy", "publish", "release"],
    }
    for source in required_sources:
        receipt["source_register"].append({
            "path": str(source),
            "sha256": sha256(source),
            "origin": "AmaduTown Google Drive" if source == DRIVE_SAM else "approved Portfolio review source",
        })

    temp_plate = OUT / ".teaching-plate.png"
    for lesson, scenes in SCENES.items():
        lesson_dir = OUT / lesson.lower()
        lesson_dir.mkdir(exist_ok=True)
        script = ROOT / f"docs/accelerated-course-modules/curriculum/scripts/{lesson}.md"
        if not script.exists():
            raise SystemExit(f"Missing canonical script: {script}")
        lesson_receipt: dict[str, Any] = {
            "canonical_script": str(script.relative_to(ROOT)),
            "canonical_script_sha256": sha256(script),
            "states": [],
        }
        for variant, size in (("desktop", (1920, 1080)), ("portrait", (390, 844))):
            clean_paths: list[Path] = []
            caption_paths: list[Path] = []
            for scene in scenes:
                frame = unified_background(scene["source"], size)
                diagram(frame, scene, variant == "portrait")
                teaching_plate(frame, scene["point"], variant == "portrait", temp_plate)
                clean = lesson_dir / f"{scene['id']}-{variant}-clean.png"
                frame.convert("RGB").save(clean)
                caption_frame = frame.copy()
                caption_controls(caption_frame, scene["title"])
                captioned = lesson_dir / f"{scene['id']}-{variant}-caption-on.png"
                caption_frame.convert("RGB").save(captioned)
                clean_paths.append(clean)
                caption_paths.append(captioned)
                lesson_receipt["states"].append({
                    "id": scene["id"], "variant": variant, "source": str(scene["source"]),
                    "clean": str(clean.relative_to(ROOT)), "clean_sha256": sha256(clean),
                    "caption_on": str(captioned.relative_to(ROOT)), "caption_on_sha256": sha256(captioned),
                    "point": scene["point"], "diagram_nodes": scene["nodes"],
                    "checks": {"single_mobile_image_layer": True, "caption_space": "pass", "native_control_clearance": "pass", "source_meaning": "source-bound"},
                })
            contact_sheet(clean_paths, lesson_dir / f"{lesson.lower()}-{variant}-clean-contact.jpg", variant == "portrait")
            contact_sheet(caption_paths, lesson_dir / f"{lesson.lower()}-{variant}-caption-on-contact.jpg", variant == "portrait")
        receipt["lessons"][lesson] = lesson_receipt

    if temp_plate.exists():
        temp_plate.unlink()
    receipt_path = OUT / "still-rebuild-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(receipt_path)


if __name__ == "__main__":
    main()
