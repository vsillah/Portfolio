#!/usr/bin/env python3
"""Build review-only P02 stills from the approved high-resolution SAM plates."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'public/showcases/service-prototypes/v2'
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p02-approved-plate-stills'
BASE = OUT.parent / 'p02-clean-base.png'
SAM = ROOT / 'public/showcases/service-prototypes/accelerated-sam-infographic.png'
VIDEO = ROOT / 'public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4'
ANCHOR = (1136, 348, 672, 384)
FONT = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
SECTIONS = {
    'signals': {'heading': 'SIGNALS', 'plate': 'sam-signals-plate.webp',
                'sha256': '8554d40fb4e5471c61c7c3e530da80bfa07c7a77ab34afb79eecfb9945985e6c'},
    'alignment': {'heading': 'ALIGNMENT', 'plate': 'sam-alignment-plate.webp',
                  'sha256': '82b9fd4429387182e4fab545ecd11a3cd7174794fd9c9b0f9fbda6606b4c72a0'},
    'momentum': {'heading': 'MOMENTUM', 'plate': 'sam-momentum-plate.webp',
                 'sha256': '8b32de9f499e3fdefadcb847ac1032dac27405f74fde844af9c53ae1b4a5d2d3'},
}
HEADING_BOX = (270, 235, 810, 318)
ART_BOX = (205, 340, 875, 800)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fill_region(image, source, left, top, right, bottom, sample_left, sample_right):
    pixels = image.load()
    for y in range(top, bottom):
        a = source.getpixel((sample_left, y))
        b = source.getpixel((sample_right, y))
        for x in range(left, right):
            t = (x - left) / (right - left - 1)
            pixels[x, y] = tuple(round(v * (1 - t) + w * t) for v, w in zip(a, b))


def background():
    source = Image.open(BASE).convert('RGB')
    clean = source.copy()
    fill_region(clean, source, 180, 155, 1006, 835, 160, 1050)
    fill_region(clean, source, 1100, 275, 1885, 725, 1080, 1895)
    fill_region(clean, source, 1680, 40, 1865, 100, 1660, 1885)
    return source, clean


def presenter():
    with tempfile.TemporaryDirectory(prefix='p02-redraw-face-') as folder:
        path = Path(folder) / 'frame.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '240.5', '-i', str(VIDEO),
                        '-frames:v', '1', '-update', '1', str(path)], check=True)
        frame = Image.open(path).convert('RGB')
        return frame.crop((1420, 790, 1868, 1046)).resize(ANCHOR[2:], Image.Resampling.LANCZOS)


def focus_frame(clean, name):
    section = SECTIONS[name]
    plate_path = ART / section['plate']
    assert sha(plate_path) == section['sha256']
    frame = clean.copy().convert('RGBA')
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle(HEADING_BOX, radius=5, fill='#80601d', outline='#bc913e', width=3)
    draw.text(((HEADING_BOX[0]+HEADING_BOX[2])//2, (HEADING_BOX[1]+HEADING_BOX[3])//2),
              section['heading'], font=ImageFont.truetype(str(BOLD), 60),
              fill='#fff3cd', anchor='mm', stroke_width=1, stroke_fill='#473519')
    plate = Image.open(plate_path).convert('RGBA')
    plate.thumbnail((ART_BOX[2]-ART_BOX[0], ART_BOX[3]-ART_BOX[1]), Image.Resampling.LANCZOS)
    x = (ART_BOX[0]+ART_BOX[2]-plate.width)//2
    y = (ART_BOX[1]+ART_BOX[3]-plate.height)//2
    frame.alpha_composite(plate, (x,y))
    return frame.convert('RGB'), [x,y,plate.width,plate.height]


def stills(frame, name, face):
    stage = frame.copy()
    draw = ImageDraw.Draw(stage)
    draw.rectangle((ANCHOR[0]-4, ANCHOR[1]-4, ANCHOR[0]+ANCHOR[2]+4,
                    ANCHOR[1]+ANCHOR[3]+4), fill='#d9aa43')
    stage.paste(face, ANCHOR[:2])
    desktop = Image.new('RGB', (1280, 820), '#0c202a')
    desktop.paste(stage.resize((1280, 720), Image.Resampling.LANCZOS), (0, 0))
    d = ImageDraw.Draw(desktop)
    d.rectangle((0, 674, 1280, 720), fill='#07141c')
    d.rectangle((25, 705, 1255, 708), fill='#f5f5f5')
    d.text((28, 681), 'Play  00:00 / 05:45', font=ImageFont.truetype(str(FONT), 18), fill='white')
    desktop_path = OUT / f'{name}-desktop-controls.png'
    desktop.save(desktop_path)
    mobile = Image.new('RGB', (390, 844), 'black')
    mobile.paste(desktop.resize((390, 250), Image.Resampling.LANCZOS), (0, 297))
    wash = Image.new('RGBA', mobile.size, (0, 0, 0, 0))
    shade = ImageDraw.Draw(wash)
    for y in range(455, 516):
        shade.line((0, y, 389, y), fill=(0, 0, 0, min(220, (y - 455) * 4)))
    shade.text((19, 478), 'Play  00:00 / 00:12',
               font=ImageFont.truetype(str(FONT), 13), fill=(255,255,255,255))
    shade.rectangle((18, 510, 372, 512), fill=(255,255,255,255))
    mobile = Image.alpha_composite(mobile.convert('RGBA'), wash).convert('RGB')
    mobile_path = OUT / f'{name}-390x844-controls.png'
    mobile.save(mobile_path)
    return desktop_path, mobile_path


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source, clean = background()
    face = presenter()
    paths = []
    full = clean.copy()
    full.paste(source.crop((190, 165, 990, 830)).resize((530,440), Image.Resampling.LANCZOS), (275,320))
    paths += stills(full, 'p02-full-map', face)
    placements = {}
    for name in SECTIONS:
        frame, placement = focus_frame(clean, name)
        placements[name] = placement
        paths += stills(frame, f'p02-{name}', face)
    receipt = {
        'status': 'review_only_stills_no_video_render',
        'source_sam': {'path': str(SAM.relative_to(ROOT)), 'sha256': sha(SAM)},
        'source_base': {'path': str(BASE.relative_to(ROOT)), 'sha256': sha(BASE)},
        'source_video_sha256': sha(VIDEO),
        'presenter_anchor_xywh': list(ANCHOR),
        'heading_destination_xyxy': list(HEADING_BOX),
        'art_box_xyxy': list(ART_BOX),
        'plate_destinations_xywh': placements,
        'whole_map_destination_xywh': [275,320,530,440],
        'approved_plates': {name: {'path': str((ART/spec['plate']).relative_to(ROOT)),
                                   'sha256': sha(ART/spec['plate']),
                                   'source_size': Image.open(ART/spec['plate']).size}
                             for name,spec in SECTIONS.items()},
        'stills': {path.name: sha(path) for path in paths},
        'limits': ['Simulated controls; actual player/captions untested.',
                   'No video, audio, learner media, or binding changed.'],
    }
    (OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    print('built', len(paths), 'stills')


if __name__ == '__main__':
    main()
