"""Keep the complete SAM trust plate and clarify the limited L15 approval."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'l15-04-trust-study'
SOURCE = ROOT / 'agentified/manuscript/visuals/rendered/publication-plates/figure-0-1-sam-trust-layer-publication-plate.png'
SOURCE_SHA = 'fc3621b103f102664c5a455adade3e6df5dbbbf19d49d9491e1f0ccea35c0ed1'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
CREAM, GOLD, NAVY = '#fff7e8', '#f2d36f', '#071b2a'
PATH = ['Source', 'Receipt', 'Gate', 'Eval', 'Proof']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size):
    return ImageFont.truetype(FONT, size)


def txt(draw, xy, value, size, color=CREAM):
    draw.text(xy, value, font=font(size), fill=color)
    box = draw.textbbox(xy, value, font=font(size))
    assert box[0] >= 25 and box[2] <= 1890 and box[3] <= 955, (value, box)


def canvas():
    im = Image.new('RGB', (1920, 1080), NAVY)
    grain = ImageOps.colorize(Image.effect_noise(im.size, 17).convert('L'), '#061522', '#244450')
    im = Image.blend(im, grain, .09)
    ImageDraw.Draw(im).rounded_rectangle((18, 18, 1902, 1062), radius=25, outline='#c99c35', width=4)
    return im


def plate(im, source, box):
    x, y, w, h = box
    assert w * 2500 == h * 4000
    im.paste(source.resize((w, h), Image.Resampling.LANCZOS), (x, y))
    return list(box)


def overview(source):
    im = canvas()
    draw = ImageDraw.Draw(im)
    txt(draw, (90, 42), 'SAM with the trust layer', 85, GOLD)
    full = plate(im, source, (384, 145, 1152, 720))
    return im, {'completePlatePx': full, 'trustPath': PATH}


def review(source):
    im = canvas()
    draw = ImageDraw.Draw(im)
    txt(draw, (85, 40), 'Review, then limited approval', 84, GOLD)
    cards = []
    for i, word in enumerate(PATH):
        x = 60 + 369 * i
        box = (x, 170, x + 330, 329)
        draw.rounded_rectangle(box, radius=22, fill='#2b1b20' if i == 2 else '#102939', outline='#c99c35', width=4)
        txt(draw, (x + 35, 213), word, 62, GOLD if i == 2 else CREAM)
        cards.append({'label': word, 'boxPx': list(box)})
    full = plate(im, source, (70, 440, 592, 370))
    draw.rounded_rectangle((720, 431, 1835, 818), radius=23, fill='#102939', outline='#c99c35', width=4)
    for i, value in enumerate(('Stale course source', 'Claim unsupported', 'Staffing hold remains', 'Paper correction only')):
        txt(draw, (772, 465 + i * 80), value, 55, GOLD if i == 3 else CREAM)
    return im, {'completePlatePx': full, 'trustPathCards': cards,
                'narrationReview': ['Stale course source', 'Claim unsupported', 'Staffing hold remains', 'Paper correction only']}


assert sha(SOURCE) == SOURCE_SHA
source = Image.open(SOURCE).convert('RGB')
assert source.size == (4000, 2500)
OUT.mkdir(parents=True, exist_ok=True)
frames = []
for kind, name, rendered in [('overview', 'overview-wide.png', overview(source)),
                             ('review', 'limited-approval.png', review(source))]:
    im, geometry = rendered
    path = OUT / name
    im.save(path)
    preview = OUT / f'{path.stem}-mobile-preview.png'
    im.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
    frames.append({'kind': kind, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                   'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                   'geometry': geometry})
receipt = {'status': 'review_only_unbound', 'scene': 'L15-04',
           'approvedPlatePath': str(SOURCE.relative_to(ROOT)), 'approvedPlateSha256': SOURCE_SHA,
           'approvedPlatePx': list(source.size), 'trustPath': PATH,
           'method': 'complete approved SAM trust plate in both frames and distinct narration-grounded limited approval; no crop or SVG',
           'frames': frames}
(OUT / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered L15-04 complete trust-layer study')
