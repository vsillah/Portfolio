"""Create an unbound, complete-plate Portfolio stack Mission Control study."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent / 'l11-02-stack-study'
SOURCE = ROOT / 'agentified/manuscript/visuals/rendered/publication-plates/figure-8-1-portfolio-first-stack-publication-plate.png'
SOURCE_SHA = '292383540d22053939e927a791c28c4c316c220d05d297dc87bb2a59979c09e4'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
REGULAR = '/System/Library/Fonts/Supplemental/Arial.ttf'
SIZE = (1920, 1080)
CREAM, GOLD, NAVY = '#fff7e8', '#f2d36f', '#071b2a'
PATH = ['Open Brain', 'Harness', 'Agent roles', 'Mission Control']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size, bold=True):
    return ImageFont.truetype(FONT if bold else REGULAR, size)


def canvas():
    image = Image.new('RGB', SIZE, NAVY)
    grain = ImageOps.colorize(Image.effect_noise(SIZE, 17).convert('L'), '#061522', '#244450')
    image = Image.blend(image, grain, .09)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((18, 18, 1902, 1062), radius=25, outline='#c99c35', width=4)
    return image


def text(draw, xy, value, size, *, color=CREAM, bold=True):
    draw.text(xy, value, font=font(size, bold), fill=color)
    bounds = draw.textbbox(xy, value, font=font(size, bold))
    assert bounds[0] >= 35 and bounds[2] <= 1885 and bounds[3] <= 955, (value, bounds)
    return list(bounds)


def plate(image, source, box):
    x, y, w, h = box
    assert w * 2500 == h * 4000
    image.paste(source.resize((w, h), Image.Resampling.LANCZOS), (x, y))
    return list(box)


def overview(source):
    image = canvas()
    draw = ImageDraw.Draw(image)
    text(draw, (130, 42), 'Portfolio-first operating stack', 86, color=GOLD)
    box = plate(image, source, (384, 145, 1152, 720))
    text(draw, (385, 880), 'Mission Control sits inside the complete stack.', 58)
    return image, {'completePlatePx': box, 'sourcePath': PATH}


def mission(source):
    image = canvas()
    draw = ImageDraw.Draw(image)
    text(draw, (100, 43), 'Mission Control · operating path', 87, color=GOLD)
    boxes = []
    for i, name in enumerate(PATH):
        x = 72 + i * 460
        box = (x, 172, x + 400, 340)
        draw.rounded_rectangle(box, radius=22, fill='#102939', outline='#c99c35', width=4)
        label = name if name != 'Mission Control' else 'Mission\nControl'
        lines = label.split('\n')
        for j, line in enumerate(lines):
            f = font(59 if name == 'Mission Control' else 64)
            b = draw.textbbox((0, 0), line, font=f)
            tx = x + (400 - (b[2] - b[0])) / 2 - b[0]
            ty = 215 + j * 64 - b[1]
            assert tx >= x + 20 and tx + b[2] <= x + 380
            draw.text((tx, ty), line, font=f, fill=GOLD if i == 3 else CREAM)
        boxes.append({'name': name, 'boxPx': list(box)})
        if i < 3:
            draw.line((x + 405, 255, x + 445, 255), fill=GOLD, width=8)
            draw.polygon(((x + 435, 243), (x + 455, 255), (x + 435, 267)), fill=GOLD)
    full = plate(image, source, (74, 429, 592, 370))
    box = (720, 424, 1835, 816)
    draw.rounded_rectangle(box, radius=23, fill='#102939', outline='#c99c35', width=4)
    text(draw, (790, 457), 'Mission Control', 75, color=GOLD)
    text(draw, (790, 566), 'intake · route · approve · recover', 53)
    text(draw, (790, 650), 'Controls · receipts / approvals', 55)
    text(draw, (790, 723), 'Evals / drift checks', 55)
    text(draw, (94, 857), 'Full stack remains visible · source to proof', 58)
    return image, {'completePlatePx': full, 'pathCards': boxes, 'missionSourceFunctions': ['intake', 'route', 'approve', 'recover'],
                   'controls': ['receipts', 'approvals', 'evals', 'drift checks']}


assert sha(SOURCE) == SOURCE_SHA
source = Image.open(SOURCE).convert('RGB')
assert source.size == (4000, 2500)
OUT.mkdir(parents=True, exist_ok=True)
frames = []
for kind, name, image, geometry in [('overview', 'overview-wide.png', *overview(source)),
                                    ('mission', 'mission-focus.png', *mission(source))]:
    path = OUT / name
    image.save(path)
    preview = OUT / f'{path.stem}-mobile-preview.png'
    image.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
    frames.append({'kind': kind, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                   'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                   'geometry': geometry})
receipt = {'status': 'review_only_unbound', 'scene': 'L11-02',
           'approvedPlatePath': str(SOURCE.relative_to(ROOT)), 'approvedPlateSha256': SOURCE_SHA,
           'approvedPlatePx': list(source.size), 'sourcePath': PATH,
           'method': 'complete approved Portfolio stack in every frame plus source-faithful enlarged Open Brain to Mission Control path and controls; no crop or SVG art',
           'frames': frames}
(OUT / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered two L11-02 complete-stack review frames')
