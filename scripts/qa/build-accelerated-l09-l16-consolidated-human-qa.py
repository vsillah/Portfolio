#!/usr/bin/env python3
"""Build contextual L09-L16 Human-QA walkthroughs from approved local masters."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
REVIEWS = Path(os.environ.get("ACCELERATED_REVIEW_OUTPUT", REPO / ".local/accelerated-l09-l16-contextual-review"))
OUT = REVIEWS / "consolidated-human-qa"
LESSONS = [f"L{number:02d}" for number in range(9, 17)]


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def duration(path: Path) -> float:
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", str(path),
    ], text=True).strip())


def parse_stamp(value: str) -> float:
    hours, minutes, seconds = value.replace(",", ".").split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def stamp(value: float) -> str:
    value = max(0.0, value)
    hours = int(value // 3600)
    value -= hours * 3600
    minutes = int(value // 60)
    value -= minutes * 60
    return f"{hours:02d}:{minutes:02d}:{value:06.3f}"


def parse_vtt(path: Path) -> list[tuple[float, float, str]]:
    cues = []
    for block in re.split(r"\n\s*\n", path.read_text(encoding="utf-8-sig")):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        timing = next((line for line in lines if "-->" in line), None)
        if not timing:
            continue
        start_text, end_text = [part.strip().split()[0] for part in timing.split("-->")]
        index = lines.index(timing)
        text = " ".join(lines[index + 1:])
        if text:
            cues.append((parse_stamp(start_text), parse_stamp(end_text), text))
    return cues


def choose_end(cues: list[tuple[float, float, str]], minimum: float = 28.0, target: float = 32.0, maximum: float = 38.0) -> float:
    candidates = [end for _, end, _ in cues if minimum <= end <= maximum]
    if not candidates:
        raise RuntimeError("No sentence-safe caption boundary in contextual review window")
    return min(candidates, key=lambda value: abs(value - target))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    receipt = {
        "schema": "accelerated_l09_l16_consolidated_human_qa_v1",
        "purpose": "Contextual visual, narration, presenter, transition, responsive, and optional-caption review",
        "lessons": {},
        "outputs": {},
        "exclusions": ["provider contact", "spend", "learner media change", "PR update", "merge", "deploy", "publish", "release"],
    }
    consolidated_cues: list[tuple[float, float, str]] = []
    sequence_cursor = 0.0
    variant_parts = {"desktop": [], "portrait": []}

    for lesson in LESSONS:
        lower = lesson.lower()
        lesson_dir = REVIEWS / lower
        source_vtt = lesson_dir / f"{lower}-captions.vtt"
        cues = parse_vtt(source_vtt)
        end = choose_end(cues)
        lesson_record = {"source_start": 0.0, "source_end": end, "duration": end, "variants": {}}

        for variant in ("desktop", "portrait"):
            source = lesson_dir / f"{lower}-{variant}-contextual-review.mp4"
            clip = OUT / f"{lower}-{variant}-contextual-clip.mp4"
            run([
                "ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", "0", "-to", f"{end:.3f}",
                "-i", str(source), "-map", "0:v:0", "-map", "0:a:0",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "25",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(clip),
            ])
            variant_parts[variant].append(clip)
            lesson_record["variants"][variant] = {"source": str(source), "source_sha256": sha256(source), "clip": str(clip), "clip_sha256": sha256(clip)}

        for start, cue_end, text in cues:
            overlap_start, overlap_end = max(0.0, start), min(end, cue_end)
            if overlap_end > overlap_start:
                consolidated_cues.append((sequence_cursor + overlap_start, sequence_cursor + overlap_end, text))
        receipt["lessons"][lesson] = lesson_record
        sequence_cursor += end

    for variant, parts in variant_parts.items():
        manifest = OUT / f"{variant}.ffconcat"
        manifest.write_text("ffconcat version 1.0\n" + "".join(f"file '{part.as_posix()}'\n" for part in parts))
        output = OUT / f"accelerated-l09-l16-{variant}-human-qa.mp4"
        run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c", "copy", "-movflags", "+faststart", str(output)])
        run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(output), "-map", "0:v:0", "-f", "null", "-", "-map", "0:a:0", "-f", "null", "-"])
        receipt["outputs"][variant] = {"path": str(output), "sha256": sha256(output), "duration": duration(output)}

    vtt = OUT / "accelerated-l09-l16-human-qa.vtt"
    vtt.write_text("WEBVTT\n\n" + "\n\n".join(
        f"{index}\n{stamp(start)} --> {stamp(end)}\n{text}"
        for index, (start, end, text) in enumerate(consolidated_cues, start=1)
    ) + "\n")
    receipt["captions"] = {"path": str(vtt), "sha256": sha256(vtt), "cues": len(consolidated_cues)}

    receipt_path = OUT / "consolidated-human-qa-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
    receipt_hash = sha256(receipt_path)
    desktop_hash = receipt["outputs"]["desktop"]["sha256"]
    portrait_hash = receipt["outputs"]["portrait"]["sha256"]
    html = OUT / "review.html"
    html.write_text(
        '<!doctype html><meta charset="utf-8"><title>Accelerated L09-L16 contextual Human QA</title>'
        '<style>body{background:#071c25;color:#eaecee;font:16px system-ui;padding:24px;max-width:1200px;margin:auto}'
        'video{max-width:100%;max-height:82vh;display:block;margin:12px 0 36px}p{color:#b8c7cc}</style>'
        '<h1>Accelerated L09-L16 contextual Human QA</h1>'
        '<p>Each lesson contributes a sentence-safe opening passage that includes the presenter-to-teaching-visual handoff. Captions are optional through the native CC control.</p>'
        f'<h2>Desktop</h2><video controls preload="metadata"><source src="accelerated-l09-l16-desktop-human-qa.mp4?v={desktop_hash}"><track kind="captions" src="accelerated-l09-l16-human-qa.vtt?v={receipt_hash}" srclang="en" label="English"></video>'
        f'<h2>Mobile</h2><video controls preload="metadata"><source src="accelerated-l09-l16-portrait-human-qa.mp4?v={portrait_hash}"><track kind="captions" src="accelerated-l09-l16-human-qa.vtt?v={receipt_hash}" srclang="en" label="English"></video>'
    )
    print(json.dumps({"receipt": str(receipt_path), "receipt_sha256": receipt_hash, "outputs": receipt["outputs"], "captions": receipt["captions"]}, indent=2))


if __name__ == "__main__":
    main()
