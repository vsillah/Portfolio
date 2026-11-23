"""Create separate narrated metrics and intact SAM trust-layer review frames."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent / 'l09-02-metrics-study'
SOURCE = ROOT / 'agentified/manuscript/visuals/rendered/publication-plates/figure-0-1-sam-trust-layer-publication-plate.png'
SOURCE_SHA = 'fc3621b103f102664c5a455adade3e6df5dbbbf19d49d9491e1f0ccea35c0ed1'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
REGULAR = '/System/Library/Fonts/Supplemental/Arial.ttf'
SIZE = (1920, 1080)
NAVY, CREAM, GOLD = '#071b2a', '#fff7e8', '#f2d36f'
RUNGS = [
    ('Activity', 'brief count'),
    ('Output', 'drafts produced'),
    ('Quality', 'source-supported claims'),
    ('Behavior', 'correct holds'),
    ('Outcome', 'clearer decision'),
    ('Learning', 'fewer repeat errors'),
    ('Authority', 'human-granted scope'),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size, bold=True):
    return ImageFont.truetype(FONT if bold else REGULAR, size)


def canvas():
    image = Image.new('RGB', SIZE, NAVY)
    grain = ImageOps.colorize(Image.effect_noise(SIZE, 17).convert('L'), '#061522', '#244450')
    return Image.blend(image, grain, .09)


def label(draw, xy, value, size, color=CREAM, bold=True):
    x, y = xy
    draw.text((x, y), value, font=font(size, bold), fill=color)
    bounds = draw.textbbox((x, y), value, font=font(size, bold))
    assert bounds[2] <= SIZE[0] - 40 and bounds[3] <= SIZE[1] - 120, (value, bounds)
    return list(bounds)


def metric_frame(title, first, last, wide=False):
    image = canvas()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((30, 30, 1890, 1050), radius=26, outline='#b99a50', width=4)
    label(draw, (78, 55), title, 92 if not wide else 84, GOLD)
    label(draw, (80, 890), f'{first + 1}–{last} of 7 · Activity to authority', 53, CREAM)
    entries = RUNGS[first:last]
    if wide:
        top, gap, height = 165, 100, 86
        left, right = 90, 1830
        name_x, detail_x = 160, 810
        name_size, detail_size = 64, 52
    else:
        top, gap = (160, 170) if len(entries) == 4 else (200, 215)
        height = 145 if len(entries) == 4 else 175
        left, right = 90, 1830
        name_x, detail_x = 150, 820
        name_size, detail_size = 75, 62
    boxes = []
    for idx, (name, detail) in enumerate(entries, first + 1):
        y = top + (idx - first - 1) * gap
        box = (left, y, right, y + height)
        draw.rounded_rectangle(box, radius=23, fill='#102d3c', outline='#caa64a', width=4)
        label(draw, (name_x, y + 16), f'{idx:02}  {name}', name_size, GOLD)
        label(draw, (detail_x, y + 22), detail, detail_size)
        boxes.append({'rung': name, 'detail': detail, 'boxPx': list(box)})
        if idx < last:
            draw.line((960, y + height + 3, 960, y + gap - 4), fill=GOLD, width=7)
    return image, {'rungs': boxes, 'orderedRungs': [name for name, _ in RUNGS]}


def trust_frame(source):
    image = canvas()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((30, 30, 1890, 1050), radius=26, outline='#b99a50', width=4)
    label(draw, (170, 43), 'The trust layer · separate context', 83, GOLD)
    box = (416, 155, 1088, 680)
    x, y, w, h = box
    image.paste(source.resize((w, h), Image.Resampling.LANCZOS), (x, y))
    label(draw, (340, 865), 'Signals → Alignment → Momentum', 66)
    return image, {'completePlatePx': list(box), 'sourceSections': ['Signals', 'Alignment', 'Momentum']}


assert sha(SOURCE) == SOURCE_SHA
source = Image.open(SOURCE).convert('RGB')
assert source.size == (4000, 2500)
OUT.mkdir(parents=True, exist_ok=True)
builds = [
    ('metrics-full.png', 'metrics', *metric_frame('Metrics ladder · seven measures', 0, 7, True)),
    ('metrics-1-4.png', 'metrics', *metric_frame('Metrics ladder · first four', 0, 4)),
    ('metrics-5-7.png', 'metrics', *metric_frame('Metrics ladder · final three', 4, 7)),
    ('trust-context.png', 'context', *trust_frame(source)),
]
frames = []
for name, kind, image, geometry in builds:
    path = OUT / name
    image.save(path)
    preview = OUT / f'{path.stem}-mobile-preview.png'
    image.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
    frames.append({'kind': kind, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                   'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                   'geometry': geometry})
receipt = {'status': 'review_only_unbound', 'scene': 'L09-02', 'approvedPlatePath': str(SOURCE.relative_to(ROOT)),
           'approvedPlateSha256': SOURCE_SHA, 'approvedPlatePx': list(source.size),
           'narratedRungs': [name for name, _ in RUNGS],
           'method': 'separate seven-rung metrics ladder derived from exact narration and complete approved SAM trust-layer contextual frame; no crop, SVG, or implication that three trust-layer sections are seven metrics',
           'frames': frames}
(OUT / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered four separate L09-02 metrics/trust review frames')
