#!/usr/bin/env python3
"""Move L01 optional captions to a centered control-safe player position."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "artifacts/accelerated-overlay-normalization-2026-11-14"
SOURCE = ROOT / "artifacts/accelerated-lesson-pacing-2026-11-10/l01-continuous-review.vtt"
OUTPUT = PACKAGE / "l01/l01-optional-captions-control-safe.vtt"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cue_payload(lines: list[str]) -> list[str]:
    return [line.split(" line:", 1)[0] if "-->" in line else line for line in lines]


def main() -> None:
    source_lines = SOURCE.read_text(encoding="utf-8").splitlines()
    output_lines: list[str] = []
    cue_count = 0
    for line in source_lines:
        if "-->" in line:
            line = line.split(" line:", 1)[0]
            line = f"{line} line:78% position:50% size:88% align:middle"
            cue_count += 1
        output_lines.append(line)
    if cue_payload(source_lines) != cue_payload(output_lines):
        raise SystemExit("caption words or cue times changed")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(output_lines) + "\n", encoding="utf-8")
    receipt = {
        "source": str(SOURCE.relative_to(ROOT)),
        "source_sha256": sha256(SOURCE),
        "output": str(OUTPUT.relative_to(ROOT)),
        "output_sha256": sha256(OUTPUT),
        "cue_count": cue_count,
        "words_and_times": "byte-identical after removing WebVTT placement settings",
        "placement": "line:78% position:50% size:88% align:middle",
        "scope": "optional-caption placement metadata only; video, audio, cue times, words, and learner media unchanged",
    }
    path = PACKAGE / "l01/l01-optional-caption-placement-receipt.json"
    path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(path)


if __name__ == "__main__":
    main()
