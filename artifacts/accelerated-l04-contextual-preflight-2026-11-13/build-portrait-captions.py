#!/usr/bin/env python3
"""Place unchanged L04 cues within the portrait presenter video section."""

import json
from pathlib import Path

out = Path(__file__).resolve().parent / "whole-lesson-review"
contract = json.loads((out.parent / "l04-timing-contract.json").read_text())
presenter_windows = [(s["timeline_start_seconds"], s["timeline_end_seconds"])
                     for s in contract["segments"] if s["id"].startswith("P")]
source = (out / "l04-local-review-optional.vtt").read_text()
blocks = source.strip().split("\n\n")
assert blocks[0] == "WEBVTT"
portrait = ["WEBVTT"]
for block in blocks[1:]:
    timing, *content = block.splitlines()
    assert " --> " in timing and len(content) == 1
    h, m, seconds = timing.split(" --> ")[0].split(":")
    start = int(h) * 3600 + int(m) * 60 + float(seconds)
    if not any(a <= start < b for a, b in presenter_windows):
        portrait.append(block)
        continue
    words = content[0].split()
    text = " ".join(words)
    if len(text) > 43:
        candidates = [(abs(len(" ".join(words[:i])) - len(" ".join(words[i:]))), i)
                      for i in range(1, len(words))]
        split = min(candidates)[1]
        content = [" ".join(words[:split]), " ".join(words[split:])]
    portrait.append("\n".join([timing + " line:82% position:50% size:96% align:center", *content]))

(out / "l04-local-review-portrait-optional.vtt").write_text("\n\n".join(portrait) + "\n")
print(f"Portrait captions: {len(portrait) - 1} cues")
