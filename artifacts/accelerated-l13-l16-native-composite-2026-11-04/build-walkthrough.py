#!/usr/bin/env python3
"""Create a short privacy-safe walkthrough from each lesson's complete A01 passage."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
LESSONS = ("L13", "L14", "L15", "L16")


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> None:
    clips = []
    work = ROOT / "walkthrough-work"
    work.mkdir(exist_ok=True)
    for lesson in LESSONS:
        lower = lesson.lower()
        manifest = json.loads((ROOT / lower / "composite-manifest.json").read_text())
        a01 = next(item for item in manifest["timeline"] if item.get("passage") == "A01")
        duration = a01["frames"] / 25
        source = ROOT / lower / f"accelerated-{lower}-native-composite.mp4"
        clip = work / f"{lower}-a01.mp4"
        run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning", "-i", str(source),
            "-t", f"{duration:.6f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "160k",
            "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(clip),
        ])
        clips.append(clip)
    listing = work / "concat.txt"
    listing.write_text("".join(f"file '{clip}'\n" for clip in clips))
    output = ROOT / "accelerated-l13-l16-human-qa-walkthrough.mp4"
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning", "-f", "concat", "-safe", "0",
        "-i", str(listing), "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", str(output),
    ])
    run(["ffmpeg", "-v", "error", "-i", str(output), "-map", "0:v:0", "-f", "null", "-", "-map", "0:a:0", "-f", "null", "-"])
    print(output)


if __name__ == "__main__":
    main()
