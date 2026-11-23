"""Make an unbound complete First Receipt plate with a distinct proof-review cue."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'l12-03-receipt-study'
SOURCE = ROOT / 'agentified/manuscript/visuals/rendered/publication-plates/figure-1-1-first-receipt-publication-plate.png'
SOURCE_SHA = '1f5d13085c97dc9937bdd30362a17729b95d1401775706faa474bfe87858b669'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
SIZE = (1920, 1080)
CREAM, GOLD, NAVY = '#fff7e8', '#f2d36f', '#071b2a'
PATH = ['Agent run', 'Receipt envelope', 'Human gate', 'Outcome']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size):
    return ImageFont.truetype(FONT, size)


def text(draw, xy, value, size, color=CREAM):
    draw.text(xy, value, font=font(size), fill=color)
    b = draw.textbbox(xy, value, font=font(size))
    assert b[0] >= 30 and b[2] <= 1885 and b[3] <= 950, (value, b)
    return list(b)


def canvas():
    image = Image.new('RGB', SIZE, NAVY)
    grain = ImageOps.colorize(Image.effect_noise(SIZE, 17).convert('L'), '#061522', '#244450')
    image = Image.blend(image, grain, .09)
    ImageDraw.Draw(image).rounded_rectangle((18, 18, 1902, 1062), radius=25, outline='#c99c35', width=4)
    return image


def complete_plate(image, source, box):
    x, y, w, h = box
    assert w * 2500 == h * 4000
    image.paste(source.resize((w, h), Image.Resampling.LANCZOS), (x, y))
    return list(box)


def overview(source):
    image = canvas()
    draw = ImageDraw.Draw(image)
    text(draw, (140, 42), 'The first receipt · complete framework', 81, GOLD)
    box = complete_plate(image, source, (384, 145, 1152, 720))
    text(draw, (355, 875), 'Artifact and approval travel with the work.', 62)
    return image, {'completePlatePx': box, 'frameworkPath': PATH}


def proof_focus(source):
    image = canvas()
    draw = ImageDraw.Draw(image)
    text(draw, (90, 44), 'Receipt first · proof review next', 84, GOLD)
    cards = []
    for i, name in enumerate(PATH):
        x = 62 + i * 460
        box = (x, 165, x + 400, 335)
        draw.rounded_rectangle(box, radius=23, fill='#2b1b20' if i == 2 else '#102939', outline='#c99c35', width=4)
        words = name.split(' ') if name == 'Receipt envelope' else [name]
        if name == 'Receipt envelope':
            for j, word in enumerate(words):
                f = font(54)
                b = draw.textbbox((0, 0), word, font=f)
                draw.text((x + (400 - (b[2] - b[0])) / 2 - b[0], 192 + j * 65 - b[1]), word, font=f, fill=CREAM)
        else:
            f = font(61 if name != 'Human gate' else 56)
            b = draw.textbbox((0, 0), name, font=f)
            assert b[2] - b[0] <= 350
            draw.text((x + (400 - (b[2] - b[0])) / 2 - b[0], 222 - b[1]), name, font=f, fill=GOLD if i == 2 else CREAM)
        cards.append({'label': name, 'boxPx': list(box)})
        if i < 3:
            draw.line((x + 405, 250, x + 443, 250), fill=GOLD, width=8)
            draw.polygon(((x + 433, 238), (x + 454, 250), (x + 433, 262)), fill=GOLD)
    full = complete_plate(image, source, (75, 440, 592, 370))
    card = (720, 430, 1835, 820)
    draw.rounded_rectangle(card, radius=23, fill='#102939', outline='#c99c35', width=4)
    text(draw, (785, 467), 'Artifact → Approval', 75, GOLD)
    text(draw, (785, 570), 'Morgan reviews before sharing.', 58)
    text(draw, (785, 670), 'Withhold unsafe fields with a reason.', 53)
    return image, {'completePlatePx': full, 'pathCards': cards,
                   'proofReview': ['Artifact', 'Approval', 'Morgan reviews before sharing', 'Withhold unsafe fields with a reason']}


assert sha(SOURCE) == SOURCE_SHA
source = Image.open(SOURCE).convert('RGB')
assert source.size == (4000, 2500)
OUT.mkdir(parents=True, exist_ok=True)
frames = []
for kind, name, image, geometry in [('overview', 'overview-wide.png', *overview(source)),
                                    ('focus', 'proof-focus.png', *proof_focus(source))]:
    path = OUT / name
    image.save(path)
    preview = OUT / f'{path.stem}-mobile-preview.png'
    image.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
    frames.append({'kind': kind, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                   'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                   'geometry': geometry})
receipt = {'status': 'review_only_unbound', 'scene': 'L12-03',
           'approvedPlatePath': str(SOURCE.relative_to(ROOT)), 'approvedPlateSha256': SOURCE_SHA,
           'approvedPlatePx': list(source.size), 'frameworkPath': PATH,
           'method': 'complete approved receipt plate in every frame plus distinct source-faithful artifact/approval path and narration-grounded proof-review cue; no crop or SVG art',
           'frames': frames}
(OUT / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered two L12-03 complete-receipt frames')
