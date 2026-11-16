#!/usr/bin/env python3
"""Still-only preflight for conditional teaching copy around intact SAM plates."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/accelerated-sam-overlay-preflight-2026-11-15"
MEDIA_ROOT = ROOT / "artifacts/accelerated-sam-contextual-review-2026-11-14"
MANIFEST = json.loads((MEDIA_ROOT / "v9-source-manifest.json").read_text())
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
BG = "#101128"
SCENES = (
    ("L01-03", "book"),
    ("L02-02", "signals-column"),
    ("L05-01", "signals-column"),
    ("L05-03", "signals-funnel"),
)
DECISIONS = {
    "L01-03": {
        "desktop": ("omit", "The full book map already labels Signals, Alignment, and Momentum; the extra panel repeats its heading."),
        "mobile": ("omit", "The extra label duplicates the full map and occupies the clear interval before the fixed presenter."),
    },
    "L02-02": {
        "desktop": ("overlay", "Retain the decision reminder in unused space to the right of the centered plate, clear of all geometry."),
        "mobile": ("overlay", "Retain the reminder in the presenter-free scene's unobstructed area below the complete plate."),
    },
    "L05-01": {
        "desktop": ("overlay", "Retain the required phrase in the unused field below-left of the fixed presenter without touching the plate."),
        "mobile": ("sequence", "The full-width plate and presenter leave no caption-safe copy area; show the required phrase in a separate text state before the intact plate."),
    },
    "L05-03": {
        "desktop": ("shorten", "Use the script's shorter visible copy, 'One complaint, several jobs', in the unused field beside the complete funnel plate."),
        "mobile": ("sequence", "The full-width funnel plate, receiver, and presenter leave no clean mobile overlay area; show the source phrase separately before the intact plate."),
    },
}
COPY = {
    "L01-03": "Signals · Alignment · Momentum",
    "L02-02": "Choose one. Keep two alternatives.",
    "L05-01": "Decision before theme",
    "L05-03": "One complaint can hide several jobs",
}
AFTER_COPY = {"L01-03": None, "L02-02": COPY["L02-02"], "L05-01": COPY["L05-01"], "L05-03": "One complaint, several jobs"}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source(sid: str, aspect: str) -> tuple[Path, str]:
    item = MANIFEST["scenes"][sid]["input_stills"][aspect]
    path = ROOT / item["path"]
    expected = item["sha256"]
    if sha(path) != expected:
        raise RuntimeError(f"Source still drifted: {path}")
    return path, expected


def erase(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    draw.rectangle(box, fill=BG)


def sequence(source_frame: Image.Image, phrase: str, sid: str, target: Path) -> None:
    frame = source_frame.copy()
    draw = ImageDraw.Draw(frame)
    erase(draw, (20, 47, 370, 615))
    draw.text((26, 214), "SIGNALS", font=ImageFont.truetype(FONT, 22), fill="#dbb75d")
    box = (20, 250, 370, 390)
    draw.rounded_rectangle(box, radius=10, fill="#123a49", outline="#dbb75d", width=2)
    lines = [phrase] if sid == "L05-01" else ["One complaint,", "several jobs"]
    font = ImageFont.truetype(FONT, 26)
    line_height = 36
    y = (box[1] + box[3] - len(lines) * line_height) // 2
    for line in lines:
        width = draw.textlength(line, font=font)
        draw.text(((390 - width) / 2, y), line, font=font, fill="#f5f4ed")
        y += line_height
    frame.save(target, optimize=True)


def compose(sid: str, aspect: str, original: Path, target: Path) -> Path | None:
    frame = Image.open(original).convert("RGB")
    draw = ImageDraw.Draw(frame)
    if sid == "L01-03":
        erase(draw, (155, 620, 601, 693) if aspect == "desktop" else (20, 390, 370, 459))
    elif sid in ("L05-01", "L05-03") and aspect == "mobile":
        erase(draw, (20, 47, 370, 94))
    elif sid == "L05-03" and aspect == "desktop":
        erase(draw, (555, 540, 785, 625))
        box = (555, 540, 785, 625)
        draw.rounded_rectangle(box, radius=9, fill="#123a49", outline="#dbb75d", width=2)
        font = ImageFont.truetype(FONT, 18)
        for index, line in enumerate(("One complaint,", "several jobs")):
            draw.text((568, 555 + index * 30), line, font=font, fill="#f5f4ed")
    frame.save(target, optimize=True)
    if sid in ("L05-01", "L05-03") and aspect == "mobile":
        sequence(Image.open(original).convert("RGB"), AFTER_COPY[sid], sid, target.with_name(target.stem + "-copy-sequence.png"))
        return target.with_name(target.stem + "-copy-sequence.png")
    return None


def contact(paths: list[Path], aspect: str, label: str) -> dict:
    portrait = aspect == "mobile"
    cell = (195, 422) if portrait else (640, 360)
    sheet = Image.new("RGB", (cell[0] * len(paths), cell[1]), BG)
    for index, path in enumerate(paths):
        with Image.open(path) as image:
            sheet.paste(image.convert("RGB").resize(cell, Image.Resampling.LANCZOS), (index * cell[0], 0))
    target = OUT / f"v9-{aspect}-{label}-contact.png"
    sheet.save(target, optimize=True)
    return {"path": str(target.relative_to(ROOT)), "sha256": sha(target), "dimensions": list(sheet.size)}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    receipt = {"schema": "accelerated_sam_conditional_overlay_v9_still_preflight", "status": "still_only_captain_review_pending", "source_manifest_sha256": sha(MEDIA_ROOT / "v9-source-manifest.json"), "source_script_paths": ["docs/accelerated-course-modules/curriculum/scripts/L02.md", "docs/accelerated-course-modules/curriculum/scripts/L05.md"], "video_modified": False, "audio_modified": False, "captions_modified": False, "learner_bindings_modified": False, "scenes": {}, "contacts": {}}
    contacts: dict[str, dict[str, list[Path]]] = {aspect: {"before": [], "after": []} for aspect in ("desktop", "mobile")}
    for sid, asset in SCENES:
        receipt["scenes"][sid] = {}
        for aspect in ("desktop", "mobile"):
            original, expected = source(sid, aspect)
            prefix = f"v9-{sid.lower()}-{aspect}"
            before = OUT / f"{prefix}-before.png"
            after = OUT / f"{prefix}-after.png"
            shutil.copyfile(original, before)
            sequence_path = compose(sid, aspect, original, after)
            disposition, reason = DECISIONS[sid][aspect]
            item = {"disposition": disposition, "reason": reason, "before": {"path": str(before.relative_to(ROOT)), "sha256": sha(before), "source_sha256": expected}, "after": {"path": str(after.relative_to(ROOT)), "sha256": sha(after)}, "source_overlay": COPY[sid], "result_overlay": AFTER_COPY[sid] if disposition not in ("omit", "sequence") else None, "approved_plate_unchanged": True}
            if sequence_path:
                item["separate_copy_state"] = {"path": str(sequence_path.relative_to(ROOT)), "sha256": sha(sequence_path), "copy": AFTER_COPY[sid], "plate_visible_in_this_state": False}
            receipt["scenes"][sid][aspect] = item
            contacts[aspect]["before"].append(before)
            if sequence_path:
                contacts[aspect]["after"].append(sequence_path)
            contacts[aspect]["after"].append(after)
    for aspect in ("desktop", "mobile"):
        receipt["contacts"][aspect] = {label: contact(paths, aspect, label) for label, paths in contacts[aspect].items()}
    target = OUT / "v9-overlay-disposition-receipt.json"
    target.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt["contacts"], indent=2))


if __name__ == "__main__":
    main()
