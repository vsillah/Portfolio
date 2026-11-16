#!/usr/bin/env python3
"""Make a silent, browser-capture walkthrough of selected L01 player states."""
import hashlib
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REVIEW = HERE.parent
BASE = REVIEW.parent
MP4 = REVIEW / "l01-345s-unapproved-c02-local-review.mp4"
VTT = BASE / "c01-c02-v18-optional-caption-feasibility/lower-captions.vtt"
EXPECTED_MP4 = "b09b4e6839d2cc0483f0bc32c02ae8e5271dc97f25435218d88e65487b58617f"
EXPECTED_VTT = "427376480d444d321513ddc09c226e7896967909d8baa790b1569dd4a79b508b"
SHOTS = [
    "01-desktop-p01-off.jpg",
    "02-desktop-p02-off.jpg",
    "03-desktop-c02-315-off.jpg",
    "04-desktop-c02-320-off.jpg",
    "05-desktop-c02-320-on.jpg",
    "06-desktop-c02-324-on.jpg",
    "07-desktop-c02-324-off.jpg",
    "08-desktop-final-off.jpg",
    "09-mobile-p01-off.jpg",
    "10-mobile-c02-320-off.jpg",
    "11-mobile-c02-320-on.jpg",
    "12-mobile-c02-324-on.jpg",
    "13-mobile-c02-324-off.jpg",
    "14-mobile-final-off.jpg",
]
LABELS = [
    "Presenter and planning document · CC off",
    "Presenter and book · CC off",
    "C02: review before use · categories empty",
    "C02: categories introduced · CC off",
    "C02: representative cue · CC on",
    "C02: three categories · CC on",
    "C02: caption rail collapses · CC off",
    "Decision File handoff · CC off",
    "390 px: presenter · CC off",
    "390 px: C02 · CC off",
    "390 px: C02 cue · CC on",
    "390 px: three categories · CC on",
    "390 px: caption rail collapses · CC off",
    "390 px: Decision File handoff · CC off",
]
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run(*args):
    subprocess.run(args, check=True)


def main():
    assert digest(MP4) == EXPECTED_MP4, "candidate MP4 changed"
    assert digest(VTT) == EXPECTED_VTT, "caption VTT changed"
    frames = HERE / "frames"
    frames.mkdir(exist_ok=True)
    for index, name in enumerate(SHOTS, 1):
        source = HERE / name
        assert source.is_file(), f"missing browser capture: {source}"
        frame = frames / f"{index:02d}.png"
        shot = Image.open(source).convert("RGB")
        canvas = Image.new("RGB", (1600, 1200), "#081b25")
        draw = ImageDraw.Draw(canvas)
        draw.text((80, 20), "LOCAL REVIEW · C02 CONCEPT UNAPPROVED",
                  font=ImageFont.truetype(FONT, 30), fill="#f6ca69")
        draw.text((80, 58), LABELS[index - 1],
                  font=ImageFont.truetype(FONT, 25), fill="#ffffff")
        if "mobile" not in name:
            assert shot.size == (1440, 1100), f"desktop capture size changed: {source}"
            canvas.paste(shot, (80, 100))
        else:
            assert shot.size == (390, 844), f"mobile capture size changed: {source}"
            full = shot.resize((508, 1100), Image.Resampling.LANCZOS)
            canvas.paste(full, (80, 100))
            player_bottom = 568 if "-off.jpg" in name else 629
            detail_height = round((player_bottom - 304) * 900 / 368)
            detail = shot.crop((12, 304, 380, player_bottom)).resize(
                (900, detail_height), Image.Resampling.LANCZOS
            )
            canvas.paste(detail, (630, 235))
            draw.text((630, 172), "Player detail · enlarged from the same capture",
                      font=ImageFont.truetype(FONT, 24), fill="#ffffff")
        canvas.save(frame)
    concat = HERE / "frames.ffconcat"
    lines = ["ffconcat version 1.0"]
    for index in range(1, len(SHOTS) + 1):
        lines += [f"file '{(frames / f'{index:02d}.png').as_posix()}'", "duration 2.5"]
    lines += [f"file '{(frames / f'{len(SHOTS):02d}.png').as_posix()}'"]
    concat.write_text("\n".join(lines) + "\n")
    output = HERE / "l01-local-player-illustration-walkthrough-v2.mp4"
    run("ffmpeg", "-v", "error", "-y", "-safe", "0", "-f", "concat", "-i",
        str(concat), "-vf", "fps=25,format=yuv420p", "-c:v", "libx264",
        "-preset", "medium", "-crf", "18", "-movflags", "+faststart", str(output))
    assert digest(MP4) == EXPECTED_MP4, "candidate MP4 changed during walkthrough build"
    assert digest(VTT) == EXPECTED_VTT, "caption VTT changed during walkthrough build"
    print(output)
    print(digest(output))


if __name__ == "__main__":
    main()
