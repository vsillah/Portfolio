"""Render source-bound L13 context with a caption region below the teaching video."""

import hashlib
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
SOURCE = ROOT / "agentified/workshop/phase-3b-review/L13/agentified-l13-unknown-content-aware-candidate.mp4"
VTT = HERE / "L13-60-80-review.vtt"
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"

assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == "878d262919c6e7f93997c1289aa9f22ff7dee9c8893b329b4920e8ef6d10ec02"
assert hashlib.sha256(VTT.read_bytes()).hexdigest() == "8c83871e3b3ee9908a26ae56353af8b194cd7d3b9fbd562aad7ba0cf0a5ed2f6"


def run(command):
    subprocess.run(command, check=True)


def cues():
    result = []
    for block in VTT.read_text().strip().split("\n\n")[1:]:
        lines = block.splitlines()
        match = re.fullmatch(r"(\d\d):(\d\d):(\d\d\.\d{3}) --> (\d\d):(\d\d):(\d\d\.\d{3})", lines[0])
        assert match, block
        start = int(match[1]) * 3600 + int(match[2]) * 60 + float(match[3])
        end = int(match[4]) * 3600 + int(match[5]) * 60 + float(match[6])
        result.append((start, end, " ".join(lines[1:])))
    return result


def caption_image(path, width, height, font_size, top, text):
    image = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, font_size)
    max_width = width - (100 if width > 400 else 48)
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if line and draw.textbbox((0, 0), trial, font=font)[2] > max_width:
            lines.append(line)
            line = word
        else:
            line = trial
    if line:
        lines.append(line)
    line_height = font_size + 6
    box_height = len(lines) * line_height + 24
    assert top + box_height < height - 12, (width, text, lines)
    left = 24 if width < 400 else 50
    draw.rounded_rectangle((left, top, width - left, top + box_height), radius=12, fill=(3, 20, 31, 230))
    for index, value in enumerate(lines):
        bounds = draw.textbbox((0, 0), value, font=font)
        draw.text(((width - (bounds[2] - bounds[0])) / 2, top + 11 + index * line_height), value, font=font, fill="white")
    image.save(path)
    return len(lines), top + box_height


def render(layout):
    width, height, scale, pad, font_size, caption_top = (
        (1280, 844, "1120:630", "1280:844:80:20", 26, 674)
        if layout == "desktop"
        else (390, 844, "342:192", "390:844:24:180", 20, 432)
    )
    output = HERE / f"L13-{layout}-60-80.mp4"
    with tempfile.TemporaryDirectory(prefix=f"l13-{layout}-review-") as temp:
        temp = Path(temp)
        base = temp / "base.mp4"
        run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", "60", "-i", str(SOURCE),
            "-i", str(VTT), "-t", "20", "-vf", f"scale={scale},pad={pad}:color=0x071b2a",
            "-map", "0:v:0", "-map", "0:a:0", "-map", "1:0", "-c:v", "libx264", "-preset", "veryfast",
            "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text",
            "-movflags", "+faststart", str(base),
        ])
        inputs = ["-i", str(base)]
        filters, previous = [], "[0:v]"
        for index, (start, end, text) in enumerate(cues(), 1):
            picture = temp / f"cue-{index}.png"
            line_count, bottom = caption_image(picture, width, height, font_size, caption_top, text)
            print(layout, index, "lines", line_count, "caption-bottom", bottom, flush=True)
            inputs.extend(["-loop", "1", "-framerate", "25", "-i", str(picture)])
            next_label = f"[v{index}]"
            filters.append(f"{previous}[{index}:v]overlay=0:0:enable='gte(t,{start})*lt(t,{end})':shortest=1{next_label}")
            previous = next_label
        run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *inputs,
            "-filter_complex", ";".join(filters), "-map", previous, "-map", "0:a:0",
            "-t", "20", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-movflags", "+faststart", str(output),
        ])
    print(output, flush=True)


if __name__ == "__main__":
    render("desktop")
    render("mobile")
