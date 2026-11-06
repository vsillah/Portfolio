"""Render a privacy-safe MP4 from certificate QA browser captures."""

from __future__ import annotations

import base64
import html
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "certificate-botanical-walkthrough.mp4"

SCENES = [
    ("desktop-dark-blocked.png", (1200, 800, 380, 140), 3, "01  Eligibility", ["15 / 16 lessons", "The certificate stays locked.", "Continue lessons is available."]),
    ("desktop-light-preclaim.png", (1200, 1140, 380, 80), 4, "02  Before claiming", ["The name appears in preview.", "The completion date is pending."]),
    ("desktop-light-claimed.png", (1200, 1140, 380, 100), 4, "03  Claimed · light", ["The name and date are recorded.", "Download and share actions appear."]),
    ("desktop-dark-claimed.png", (1200, 1140, 380, 100), 4, "04  Claimed · dark", ["Ink and paper reverse.", "The botanical frame stays legible."]),
    ("mobile-light-claimed.png", (585, 1050, 0, 700), 4, "05  Mobile · light", ["Full certificate at 390 px.", "Issuer and signature area stay clear."]),
    ("mobile-dark-claimed.png", (585, 1050, 0, 700), 4, "06  Mobile · dark", ["The same layout works in dark mode.", "No clipped corners or controls."]),
    ("downloaded-light-botanical.png", None, 4, "07  Download · light", ["The export keeps the Roman serif", "and four botanical corners."]),
    ("downloaded-dark-botanical.png", None, 5, "08  Download · dark", ["The dark export preserves the type", "and complete engraved frame."]),
]


def run(*args: str) -> None:
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def make_scene(image: Path, title: str, lines: list[str], output: Path) -> None:
    data = base64.b64encode(image.read_bytes()).decode("ascii")
    dims = subprocess.check_output(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(image)], text=True)
    width = int(next(line.split(":")[-1] for line in dims.splitlines() if "pixelWidth" in line))
    height = int(next(line.split(":")[-1] for line in dims.splitlines() if "pixelHeight" in line))
    exported = title.startswith(("07", "08"))
    max_width, max_height = (1260, 990) if exported else (1140, 990)
    scale = min(max_width / width, max_height / height)
    display_width, display_height = round(width * scale), round(height * scale)
    image_x = 60 + (max_width - display_width) // 2
    image_y = (1080 - display_height) // 2
    caption_x = 1390 if exported else 1275
    caption = "".join(
        f'<text x="{caption_x}" y="{320 + index * 58}" fill="#dbe5e3" font-family="Arial" font-size="27">{html.escape(line)}</text>'
        for index, line in enumerate(lines)
    )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
      <rect width="1920" height="1080" fill="#0d2230"/>
      <rect x="{image_x - 2}" y="{image_y - 2}" width="{display_width + 4}" height="{display_height + 4}" fill="#d6b96d"/>
      <image href="data:image/png;base64,{data}" x="{image_x}" y="{image_y}" width="{display_width}" height="{display_height}"/>
      <text x="{caption_x}" y="200" fill="#d6b96d" font-family="Arial" font-size="25" letter-spacing="4">ACCELERATED CERTIFICATE</text>
      <text x="{caption_x}" y="265" fill="#fff9e9" font-family="Georgia" font-size="49">{html.escape(title)}</text>
      {caption}
      <text x="{caption_x}" y="1005" fill="#9fb5b7" font-family="Arial" font-size="21">Synthetic QA fixture · localhost:3100</text>
    </svg>'''
    source = output.with_suffix(".svg")
    source.write_text(svg)
    run("sips", "-s", "format", "png", str(source), "--out", str(output))


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="certificate-walkthrough-") as temp_dir:
        temporary = Path(temp_dir)
        clips = []
        for index, (filename, crop, duration, title, lines) in enumerate(SCENES):
            source = ROOT / filename
            image = temporary / f"capture-{index:02}.png"
            if crop:
                width, height, x, y = crop
                run("ffmpeg", "-y", "-i", str(source), "-vf", f"crop={width}:{height}:{x}:{y}", "-frames:v", "1", str(image))
            else:
                image.write_bytes(source.read_bytes())
            scene = temporary / f"scene-{index:02}.png"
            make_scene(image, title, lines, scene)
            clip = temporary / f"clip-{index:02}.mp4"
            run("ffmpeg", "-y", "-loop", "1", "-framerate", "24", "-t", str(duration), "-i", str(scene), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "24", str(clip))
            clips.append(clip)
        listing = temporary / "clips.txt"
        listing.write_text("".join(f"file '{clip}'\n" for clip in clips))
        run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(OUTPUT))
    print(OUTPUT)


if __name__ == "__main__":
    main()
