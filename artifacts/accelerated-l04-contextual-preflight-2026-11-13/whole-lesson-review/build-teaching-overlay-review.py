#!/usr/bin/env python3
"""Build review-only L04 teaching-overlay candidates from qualified local masters."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO_ROOT = next(parent for parent in ROOT.parents if (parent / "scripts" / "qa").exists())
sys.path.insert(0, str(REPO_ROOT / "scripts" / "qa"))

from accelerated_overlay_style import FONT, render_teaching_plate  # noqa: E402


PLAN = ROOT / "l04-teaching-overlay-plan.json"

VARIANTS = {
    "desktop": {
        "source": ROOT / "l04-whole-lesson-desktop-intact-native-background-local-review.mp4",
        "output": ROOT / "l04-whole-lesson-desktop-editorial-plates-local-review.mp4",
        "width": 1920,
        "height": 1080,
    },
    "portrait": {
        "source": ROOT / "l04-whole-lesson-portrait-intact-native-background-local-review.mp4",
        "output": ROOT / "l04-whole-lesson-portrait-editorial-plates-local-review.mp4",
        "width": 390,
        "height": 844,
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_overlays(events: list[dict], variant: str, text_dir: Path) -> tuple[list[Path], str]:
    config = VARIANTS[variant]
    overlays: list[Path] = []
    filters: list[str] = []
    prior = "[0:v]"
    for index, event in enumerate(events):
        layout = event[variant]
        image_path = text_dir / f"{index:02d}-{event['id']}.png"
        text = event.get(f"{variant}_text", event["text"])
        text_width, text_height = render_teaching_plate(text, layout, image_path)
        overlays.append(image_path)
        start = float(event["start"])
        end = float(event["end"])
        x = min(int(layout["x"]), int(config["width"]) - text_width - 8)
        y = min(int(layout["y"]), int(config["height"]) - text_height - 8)
        output = f"[v{index}]"
        filters.append(
            f"{prior}[{index + 1}:v]overlay=x={x}:y={y}:"
            f"enable='between(t,{start:.3f},{end:.3f})':eof_action=pass{output}"
        )
        prior = output
    return overlays, ";".join(filters)


def run(variant: str) -> dict:
    config = VARIANTS[variant]
    source: Path = config["source"]
    output: Path = config["output"]
    if not source.exists():
        raise SystemExit(f"Missing qualified source: {source}")
    if not FONT.exists():
        raise SystemExit(f"Missing font: {FONT}")
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(prefix=f"l04-{variant}-overlay-") as tmp:
        overlays, filter_chain = build_overlays(plan["events"], variant, Path(tmp))
        command = ["ffmpeg", "-hide_banner", "-y", "-i", str(source)]
        for overlay in overlays:
            command.extend(["-loop", "1", "-framerate", "25", "-i", str(overlay)])
        command.extend([
            "-filter_complex", filter_chain,
            "-map", f"[v{len(overlays) - 1}]", "-map", "0:a:0",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-c:a", "copy", "-t", "399.32449", str(output),
        ])
        subprocess.run(command, check=True)
    return {
        "variant": variant,
        "source": str(source.relative_to(ROOT)),
        "source_sha256": sha256(source),
        "output": str(output.relative_to(ROOT)),
        "output_sha256": sha256(output),
        "plan_sha256": sha256(PLAN),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=("desktop", "portrait", "all"), default="all")
    args = parser.parse_args()
    variants = list(VARIANTS) if args.variant == "all" else [args.variant]
    receipts = [run(variant) for variant in variants]
    receipt = ROOT / "l04-teaching-overlay-render-receipt.json"
    receipt.write_text(json.dumps({"renders": receipts}, indent=2) + "\n", encoding="utf-8")
    print(receipt)
    for item in receipts:
        print(f"{item['variant']}: {item['output_sha256']}  {item['output']}")


if __name__ == "__main__":
    main()
