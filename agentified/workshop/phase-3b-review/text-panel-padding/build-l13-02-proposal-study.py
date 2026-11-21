"""Render complete Amina context and a distinct narration-derived proposal path."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'l13-02-proposal-study'
SOURCE = ROOT / 'agentified/manuscript/visuals/rendered/publication-plates/figure-3-amina-inside-sam-publication-plate.png'
SOURCE_SHA = '730c5fb6319845a015fa8c4c6c95a28148887e57daa8919246a0edadf50989fd'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
CREAM, GOLD, NAVY = '#fff7e8', '#f2d36f', '#071b2a'
STATES = ['Propose', 'Not run', 'Gate', 'Trace', 'Approve or discard']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size):
    return ImageFont.truetype(FONT, size)


def label(draw, xy, value, size, color=CREAM):
    draw.text(xy, value, font=font(size), fill=color)
    box = draw.textbbox(xy, value, font=font(size))
    assert box[0] >= 25 and box[2] <= 1890 and box[3] <= 955, (value, box)


def canvas():
    im = Image.new('RGB', (1920, 1080), NAVY)
    grain = ImageOps.colorize(Image.effect_noise(im.size, 17).convert('L'), '#061522', '#244450')
    im = Image.blend(im, grain, .09)
    ImageDraw.Draw(im).rounded_rectangle((18, 18, 1902, 1062), radius=25, outline='#c99c35', width=4)
    return im


def plate(im, source, xy, height):
    x, y = xy
    width = height * 4 // 5
    assert width * 4500 == height * 3600
    im.paste(source.resize((width, height), Image.Resampling.LANCZOS), (x, y))
    return [x, y, width, height]


def overview(source):
    im = canvas()
    draw = ImageDraw.Draw(im)
    label(draw, (88, 38), 'A.M.I.N.A. · governed framework', 80, GOLD)
    full = plate(im, source, (625, 150), 800)
    return im, {'completePlatePx': full, 'semanticRole': 'Amina contextual framework'}


def proposal(source):
    im = canvas()
    draw = ImageDraw.Draw(im)
    label(draw, (80, 39), 'A proposal has five states', 82, GOLD)
    full = plate(im, source, (96, 174), 680)
    label(draw, (96, 870), 'A.M.I.N.A. context', 51)
    cards = []
    for i, state in enumerate(STATES):
        x, y = 720, 170 + i * 150
        box = (x, y, 1825, y + 125)
        draw.rounded_rectangle(box, radius=22, fill='#2b1b20' if i == 2 else '#102939', outline='#c99c35', width=4)
        label(draw, (765, y + 23), state, 69 if i < 4 else 62, GOLD if i == 2 else CREAM)
        cards.append({'label': state, 'boxPx': list(box)})
    label(draw, (733, 902), 'Research proposal · no experiment run', 42)
    return im, {'completePlatePx': full, 'narrationStates': cards,
                'semanticRole': 'distinct narration-derived proposal states'}


assert sha(SOURCE) == SOURCE_SHA
source = Image.open(SOURCE).convert('RGB')
assert source.size == (3600, 4500)
OUT.mkdir(parents=True, exist_ok=True)
frames = []
for kind, name, rendered in [('context', 'amina-complete.png', overview(source)),
                             ('proposal', 'proposal-five-states.png', proposal(source))]:
    im, geometry = rendered
    path = OUT / name
    im.save(path)
    preview = OUT / f'{path.stem}-mobile-preview.png'
    im.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
    frames.append({'kind': kind, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                   'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                   'geometry': geometry})
receipt = {'status': 'review_only_unbound', 'scene': 'L13-02',
           'approvedPlatePath': str(SOURCE.relative_to(ROOT)), 'approvedPlateSha256': SOURCE_SHA,
           'approvedPlatePx': list(source.size), 'narrationStates': STATES,
           'method': 'complete Amina plate in both frames as contextual framework; separate narration-derived proposal states; no crop or SVG',
           'frames': frames}
(OUT / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered L13-02 complete Amina context and proposal states')
