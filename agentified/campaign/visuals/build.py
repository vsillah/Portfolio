"""Build the provider-free Agentified social review pack from owned local assets."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / "public/agentified/campaign-review/2026-11-23"
OUT.mkdir(parents=True, exist_ok=True)
FONT = ROOT / "public/fonts/inter-latin-variable.ttf"
NAVY, PANEL, CREAM, GOLD, MUTED = "#091b29", "#102838", "#f4eee0", "#d6b46c", "#b6c7cf"

SOURCES = {
    "landing": HERE / "sources/landing.png",
    "l01-screen": HERE / "sources/l01.png",
    "l06-screen": HERE / "sources/l06.png",
    "l16-screen": HERE / "sources/l16.png",
    "operating-file": HERE / "sources/operating-file.png",
    "l01-poster": ROOT / "public/agentified/posters/l01-poster.webp",
    "l06-poster": ROOT / "public/agentified/posters/l06-poster.webp",
    "l16-poster": ROOT / "public/agentified/posters/l16-poster.webp",
    "receipt-diagram": ROOT / "public/agentified/workshop/figure-1-1-first-receipt-publication-plate.png",
    "authority-diagram": ROOT / "public/agentified/workshop/figure-ii-1-authority-ladder-publication-plate.png",
    "logo": ROOT / "public/amadutown-logo-upscaled.png",
}

def font(size: int):
    return ImageFont.truetype(str(FONT), size)

def wrap(draw, line, face, max_width):
    words = line.split()
    rows, row = [], ""
    for word in words:
        test = f"{row} {word}".strip()
        if row and draw.textbbox((0, 0), test, font=face)[2] > max_width:
            rows.append(row)
            row = word
        else:
            row = test
    if row:
        rows.append(row)
    return rows

def lines(draw, text, xy, size, width, fill=CREAM, spacing=1.16):
    face = font(size)
    x, y = xy
    for paragraph in text.split("\n"):
        for row in wrap(draw, paragraph, face, width):
            draw.text((x, y), row, font=face, fill=fill)
            y += int(size * spacing)
    return y

def text_height(draw, text, size, width, spacing=1.16):
    face = font(size)
    return sum(len(wrap(draw, paragraph, face, width)) for paragraph in text.split("\n")) * int(size * spacing)

def text_plate(im, heading, detail, top, heading_size, detail_size, x0=42, x1=None):
    d = ImageDraw.Draw(im)
    x1 = x1 or im.width - 42
    pad = 30
    width = x1 - x0 - pad * 2
    heading_height = text_height(d, heading, heading_size, width)
    detail_height = text_height(d, detail, detail_size, width) if detail else 0
    gap = 18 if detail else 0
    bottom = top + pad * 2 + heading_height + gap + detail_height
    d.rounded_rectangle((x0, top, x1, bottom), radius=24, fill=PANEL)
    lines(d, heading, (x0 + pad, top + pad), heading_size, width)
    if detail:
        lines(d, detail, (x0 + pad, top + pad + heading_height + gap), detail_size, width, GOLD)
    return bottom

def base(size, label, number=None):
    im = Image.new("RGB", size, NAVY)
    d = ImageDraw.Draw(im)
    w, h = size
    d.rectangle((0, 0, w, 11), fill=GOLD)
    d.text((62, 49), "AMADUTOWN  /  AGENTIFIED", font=font(25), fill=GOLD)
    d.text((62, 95), label.upper(), font=font(23), fill=MUTED)
    if number is not None:
        d.text((w - 110, 57), f"{number:02}", font=font(30), fill=GOLD)
    return im

def framed_image(im, key, box, mode="contain"):
    x0, y0, x1, y1 = box
    source = Image.open(SOURCES[key]).convert("RGB")
    if key in {"landing", "l01-screen", "l06-screen", "l16-screen", "operating-file"} and mode != "contain":
        raise ValueError(f"Public guest screen must be shown whole: {key}")
    inset = 10
    area = (x1 - x0 - 2 * inset, y1 - y0 - 2 * inset)
    if mode == "cover":
        source = ImageOps.fit(source, area, method=Image.Resampling.LANCZOS)
    else:
        source.thumbnail(area, Image.Resampling.LANCZOS)
    x = x0 + (x1 - x0 - source.width) // 2
    y = y0 + inset
    d = ImageDraw.Draw(im)
    actual = (x - inset, y - inset, x + source.width + inset, y + source.height + inset)
    d.rounded_rectangle(actual, radius=20, fill=PANEL, outline=GOLD, width=2)
    im.paste(source, (x, y))
    return actual

def carousel(code, slides):
    files = []
    for n, (heading, detail, asset, treatment) in enumerate(slides, 1):
        im = base((1080, 1350), code, n)
        plate_bottom = text_plate(im, heading, detail, 160, 63, 31)
        d = ImageDraw.Draw(im)
        framed_image(im, asset, (43, plate_bottom + 32, 1037, 1165), treatment)
        d.line((62, 1210, 1018, 1210), fill=GOLD, width=2)
        d.text((62, 1240), "amadutown.com/agentified", font=font(29), fill=CREAM)
        d.text((895, 1240), f"{n} / 7", font=font(27), fill=GOLD)
        path = OUT / f"{code.lower()}-{n:02}.png"
        im.save(path, optimize=True)
        files.append(path)
    return files

CAR1 = [
    ("A clean draft can still be hard to trust.", "An empty source field is a reason to pause.", "operating-file", "contain"),
    ("Name the job.", "What was the agent asked to prepare?", "l01-poster", "contain"),
    ("Name the source.", "What current material supports it?", "receipt-diagram", "contain"),
    ("Name the boundary.", "What could the agent read or change?", "authority-diagram", "contain"),
    ("Name the result.", "What did it produce, and what failed?", "receipt-diagram", "contain"),
    ("Name the reviewer.", "Who owns the decision and the stop?", "l06-poster", "contain"),
    ("Carry the receipt.", "Try L01 as a guest at amadutown.com/agentified.", "l01-screen", "contain"),
]
CAR2 = [
    ("Give an agent a job you can inspect.", "Begin with an invented workflow.", "l01-poster", "contain"),
    ("Draw the Operating Map.", "Job · source · receipt · owner · gate", "receipt-diagram", "contain"),
    ("Write the permission slip.", "Allowed preparation. Prohibited action.", "l06-poster", "contain"),
    ("Test a broken source.", "Stop the handoff and say why.", "l16-poster", "contain"),
    ("Record the human decision.", "Keep the decision in the Operating File.", "operating-file", "contain"),
    ("Continue through the workshop.", "13 guided videos · 3 transcript-led lessons", "l16-screen", "contain"),
    ("Start as a guest.", "Sign in only for cross-device progress.\namadutown.com/agentified", "landing", "contain"),
]

def vertical(code, panels):
    files = []
    for n, (heading, caption, asset, seconds) in enumerate(panels, 1):
        im = base((1080, 1920), code, n)
        plate_bottom = text_plate(im, heading, caption, 170, 67, 32)
        d = ImageDraw.Draw(im)
        framed_image(im, asset, (42, plate_bottom + 42, 1038, 1580), "contain")
        d.line((62, 1640, 1018, 1640), fill=GOLD, width=2)
        d.text((62, 1690), "amadutown.com/agentified", font=font(39), fill=CREAM)
        d.text((62, 1760), f"{seconds} sec · silent review composition", font=font(27), fill=MUTED)
        path = OUT / f"{code.lower()}-scene-{n:02}.png"
        im.save(path, optimize=True)
        files.append((path, seconds))
    return files

REEL1 = [
    ("An agent can draft a brief in minutes.", "Before that brief reaches another person, give it a boundary.", "landing", 5),
    ("What can the agent read?", "What can it prepare? What must it hand back to a human?", "l06-poster", 10),
    ("Write that permission slip.", "In the Agentified workshop, you write that permission slip against an invented workflow.", "operating-file", 14),
    ("See where useful work ends.", "Then you can see where the useful work ends and a real decision begins. Start as a guest at amadutown.com/agentified.", "l06-screen", 11),
]
REEL2 = [
    ("A draft can sound confident.", "A draft can sound confident after its source has gone stale.", "l16-poster", 7),
    ("Stop at the review gate.", "That is where a review gate should stop the work. The agent records the source and the reason it cannot go forward.", "authority-diagram", 11),
    ("A person decides what comes next.", "A person decides what evidence is needed next. Agentified lets you practice that stop condition in an Operating File.", "operating-file", 12),
    ("Give the agent a larger job later.", "Before you give an agent a larger job. The public workshop starts with guest access at amadutown.com/agentified.", "landing", 10),
]

def thumbnail():
    im = base((1280, 720), "AW-YT-01  /  PROOF EPISODE")
    text_plate(im, "Give the agent\na job.\nGet a receipt.", "", 170, 73, 0, 35, 685)
    framed_image(im, "l01-poster", (715, 165, 1250, 610), "contain")
    p = OUT / "aw-yt-01-thumbnail.png"
    im.save(p, optimize=True)
    return p

def encode_stills(items, target, width, height):
    playlist = OUT / (target.stem + ".ffconcat")
    playlist.write_text("ffconcat version 1.0\n" + "".join(
        f"file '{p.name}'\nduration {s}\n" for p, s in items
    ) + f"file '{items[-1][0].name}'\n")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-safe", "0", "-f", "concat", "-i", str(playlist), "-vf", f"fps=12,scale={width}:{height}", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", str(sum(s for _, s in items)), str(target)], check=True)
    playlist.unlink()

def contact_sheet(paths, target, cols=4, cell=(320, 410)):
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell[0], rows * cell[1]), CREAM)
    for i, p in enumerate(paths):
        im = Image.open(p).convert("RGB")
        im.thumbnail((cell[0] - 16, cell[1] - 42), Image.Resampling.LANCZOS)
        x = (i % cols) * cell[0] + (cell[0] - im.width) // 2
        y = (i // cols) * cell[1] + 6
        sheet.paste(im, (x, y))
        ImageDraw.Draw(sheet).text(((i % cols) * cell[0] + 9, (i // cols) * cell[1] + cell[1] - 30), p.stem, font=font(17), fill=NAVY)
    sheet.save(target, quality=90)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    a = carousel("AW-IG-CAR-01", CAR1)
    b = carousel("AW-IG-CAR-02", CAR2)
    r1 = vertical("AW-REEL-01", REEL1)
    r2 = vertical("AW-REEL-02", REEL2)
    thumb = thumbnail()
    contact_sheet(a + b, OUT / "carousel-contact-sheet.jpg")
    contact_sheet([p for p, _ in r1 + r2] + [thumb], OUT / "video-contact-sheet.jpg", cols=3, cell=(360, 530))
    encode_stills(r1, OUT / "aw-reel-01-silent-review.mp4", 1080, 1920)
    encode_stills(r2, OUT / "aw-reel-02-silent-review.mp4", 1080, 1920)
    # Screen-backed editorial proof candidate. Holds are intentionally long for captain review.
    yt = [(HERE / "sources/landing.png", 35), (HERE / "sources/l01.png", 85), (HERE / "sources/operating-file.png", 70), (HERE / "sources/l06.png", 60), (HERE / "sources/l16.png", 35), (HERE / "sources/landing.png", 15)]
    # Fit source screenshots to 16:9 frames; preserve the full browser viewport.
    yt_frames = []
    for i, (source, sec) in enumerate(yt, 1):
        frame = base((1280, 720), "AW-YT-01  /  SILENT SCREEN PROOF", i)
        framed_image_from_path(frame, source, (35, 160, 1245, 640))
        path = OUT / f"aw-yt-01-scene-{i:02}.png"
        frame.save(path, optimize=True)
        yt_frames.append((path, sec))
    encode_stills(yt_frames, OUT / "aw-yt-01-silent-proof-candidate.mp4", 1280, 720)
    outputs = sorted(p for p in OUT.iterdir() if p.is_file() and p.suffix in {".png", ".jpg", ".mp4"} and not p.name.startswith("review-"))
    manifest = {
        "status": "internal review only; no publication approval",
        "base_commit": "f452b5b7f6cb44182d39be133fa8f82b37c5a2b6",
        "script": "agentified/campaign/visuals/build.py",
        "source_map": {k: {"path": str(v.relative_to(ROOT)), "sha256": sha(v)} for k, v in SOURCES.items()},
        "outputs": [{"path": str(p.relative_to(ROOT)), "sha256": sha(p), "bytes": p.stat().st_size} for p in outputs],
        "notes": ["Owned local art and public guest-route captures only.", "Blank Operating File; no learner entries or account identity.", "Reels and YouTube proof are silent editorial review compositions; scripts remain in draft-assets.md and require narration/pace approval before publication.", "Source screenshots captured on local guest route with inert Supabase placeholders and outbound n8n disabled."],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Built {len(outputs)} review assets in {OUT}")

def framed_image_from_path(im, path, box):
    source = Image.open(path).convert("RGB")
    x0, y0, x1, y1 = box
    source.thumbnail((x1 - x0 - 20, y1 - y0 - 20), Image.Resampling.LANCZOS)
    x = x0 + ((x1 - x0) - source.width)//2
    y = y0 + ((y1 - y0) - source.height)//2
    ImageDraw.Draw(im).rounded_rectangle((x-10, y-10, x+source.width+10, y+source.height+10), radius=18, fill=PANEL, outline=GOLD, width=2)
    im.paste(source, (x, y))

if __name__ == "__main__":
    main()
