#!/usr/bin/env python3
"""Validate the bounded L04 review source package without provider media."""

import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
manifest = json.loads((HERE / "package-manifest.json").read_text())
provenance = json.loads((HERE / "scene-art-provenance.json").read_text())
contract = json.loads((HERE / "l04-timing-contract.json").read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


assert manifest["schema"] == "accelerated_l04_review_source_package_v1"
assert len(manifest["files"]) >= 25
for item in manifest["files"]:
    name = item["path"]
    assert not re.search(r"(__pycache__|\.pcm$|\.wav$|\.mp4$|\.jsonl$|provider-return/|portrait-study|native-local-asr|native-corrected-window-asr)", name), name
    path = HERE / name
    assert path.is_file(), name
    assert path.stat().st_size == item["bytes"], name
    assert sha(path) == item["sha256"], name

assert len(provenance["scenes"]) == 7
for scene in provenance["scenes"]:
    assert scene["method"] == "built_in_image_gen"
    assert scene["prompt"] and scene["rights"]
    assert sha(HERE / scene["project_path"]) == scene["sha256"]

assert sha(ROOT / "docs/accelerated-course-modules/curriculum/scripts/L04.md") == contract["script_sha256"]
assert sha(ROOT / "docs/accelerated-course-modules/narration-production-pack-2026-11-10.json") == contract["narration_pack_sha256"]
assert contract["native_presenter"]["sha256"] == manifest["excluded_local_inputs"][0]["sha256"]


def cues(path):
    chunks = re.split(r"\n\s*\n", path.read_text().strip())
    result = []
    for chunk in chunks:
        lines = chunk.splitlines()
        if lines[0] == "WEBVTT":
            continue
        head = lines[0] if "-->" in lines[0] else lines[1]
        start, end = head.split("-->")
        end = end.split()[0]
        body = " ".join(lines[1:] if "-->" in lines[0] else lines[2:])
        result.append((start.strip(), end.strip(), re.sub(r"\s+", " ", body).strip()))
    return result


desktop = cues(HERE / "whole-lesson-review/l04-local-review-optional.vtt")
portrait = cues(HERE / "whole-lesson-review/l04-local-review-portrait-optional.vtt")
assert len(desktop) == len(portrait) == 149
assert desktop == portrait, "Caption words or times differ between layouts"
for path, expected in (
    ("whole-lesson-review/l04-local-review-optional.vtt", "3773ab5ceec12987ddf3837bc30390613f5b0d18cbf527bcea4a6e3f615e6691"),
    ("whole-lesson-review/l04-local-review-portrait-optional.vtt", "597f740705c236174463180a57cafb94deb7c784c67f7e7f14f74960719f18a5"),
):
    assert sha(HERE / path) == expected

for name, expected in manifest["approved_outputs_sha256"].items():
    filename = ("l04-whole-lesson-desktop-expanded-presenter-local-review.mp4" if name == "desktop_mp4"
                else "l04-whole-lesson-portrait-presenter-section-local-review.mp4")
    target = HERE / "whole-lesson-review" / filename
    if target.exists():
        assert sha(target) == expected, filename

for name, expected in manifest.get("local_correction_candidate_outputs_sha256", {}).items():
    filename = ("l04-whole-lesson-desktop-editorial-plates-local-review.mp4" if name == "desktop_mp4"
                else "l04-whole-lesson-portrait-editorial-plates-local-review.mp4")
    target = HERE / "whole-lesson-review" / filename
    if target.exists():
        assert sha(target) == expected, filename

layer_gate = json.loads((HERE / "whole-lesson-review/presenter-section-preflight/portrait-image-layer-gate.json").read_text())
assert layer_gate["active_image_layers"] == {name: 1 for name in ("P01", "P02", "P03", "P04")}

print(f"L04 package validated: {len(manifest['files'])} files; 7 scene sources; 149 matched caption cues")
