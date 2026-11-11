#!/usr/bin/env python3
"""Render one review-only P02 SAM motif redraw with a fixed presenter."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'docs/accelerated-course-modules/visual-production/p02-redraw'
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p02-redraw-stills'
BASE = OUT.parent / 'p02-clean-base.png'
SAM = ROOT / 'public/showcases/service-prototypes/accelerated-sam-infographic.png'
VIDEO = ROOT / 'public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4'
ANCHOR = (1136, 348, 672, 384)
FONT = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
SECTIONS = {
    'signals': {'heading': 'SIGNALS', 'svg': 'signals-target.svg',
                'reference_region_xyxy': [160, 590, 285, 744]},
    'alignment': {'heading': 'ALIGNMENT', 'svg': 'alignment-trophy.svg',
                  'reference_region_xyxy': [505, 208, 635, 325]},
    'momentum': {'heading': 'MOMENTUM', 'svg': 'momentum-loop.svg',
                 'reference_region_xyxy': [808, 350, 1032, 581]},
}


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


def render_svg(source, target):
    js = '''const {chromium}=require('playwright');
    (async()=>{const b=await chromium.launch({headless:true});
      const p=await b.newPage({viewport:{width:400,height:400},deviceScaleFactor:1});
      await p.goto('file://'+process.argv[1]);
      await p.locator('svg').screenshot({path:process.argv[2],omitBackground:true});
      await b.close();})().catch(e=>{console.error(e);process.exit(1)});'''
    subprocess.run(['node', '-e', js, str(source), str(target)], cwd=ROOT, check=True)


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
    for name, spec in SECTIONS.items():
        frame = clean.copy().convert('RGBA')
        draw = ImageDraw.Draw(frame)
        draw.rounded_rectangle((270, 328, 810, 420), radius=5, fill='#80601d', outline='#bc913e', width=3)
        draw.text((540, 374), spec['heading'], font=ImageFont.truetype(str(BOLD), 62),
                  fill='#fff3cd', anchor='mm', stroke_width=1, stroke_fill='#473519')
        png = OUT / f'{name}-motif.png'
        render_svg(ART / spec['svg'], png)
        motif = Image.open(png).convert('RGBA').resize((350,350), Image.Resampling.LANCZOS)
        frame.alpha_composite(motif, (365,410))
        paths += stills(frame.convert('RGB'), f'p02-{name}', face)
    receipt = {
        'status': 'review_only_stills_no_video_render',
        'source_sam': {'path': str(SAM.relative_to(ROOT)), 'sha256': sha(SAM),
                       'reference_regions_xyxy': {name: spec['reference_region_xyxy'] for name,spec in SECTIONS.items()}},
        'source_base': {'path': str(BASE.relative_to(ROOT)), 'sha256': sha(BASE)},
        'source_video_sha256': sha(VIDEO),
        'presenter_anchor_xywh': list(ANCHOR),
        'heading_destination_xyxy': [270,328,810,420],
        'motif_destination_xywh': [365,410,350,350],
        'whole_map_destination_xywh': [275,320,530,440],
        'redraw_sources': {name: {'path': str((ART/spec['svg']).relative_to(ROOT)),
                                   'sha256': sha(ART/spec['svg']),
                                   'meaning': spec['heading'] + ' source motif'} for name,spec in SECTIONS.items()},
        'stills': {path.name: sha(path) for path in paths},
        'limits': ['Simulated controls; actual player/captions untested.',
                   'No video, audio, learner media, or binding changed.'],
    }
    (OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    print('built', len(paths), 'stills')


if __name__ == '__main__':
    main()
