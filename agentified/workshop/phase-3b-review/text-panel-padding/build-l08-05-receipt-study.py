"""Provider-free, unbound raster study of the complete First Receipt plate."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'l08-05-receipt-study'
SOURCE = ROOT / 'agentified/manuscript/visuals/rendered/publication-plates/figure-1-1-first-receipt-publication-plate.png'
SOURCE_SHA = '1f5d13085c97dc9937bdd30362a17729b95d1401775706faa474bfe87858b669'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
REGULAR = '/System/Library/Fonts/Supplemental/Arial.ttf'
SIZE = (1920, 1080)
CREAM, GOLD, NAVY = '#fff7e8', '#f2d36f', '#071b2a'
FIELDS = ['Intent', 'Agent', 'Source', 'Action', 'Artifact', 'Approval', 'Cost', 'Outcome', 'Rollback']
PATH = ['Agent run', 'Receipt envelope', 'Human gate', 'Outcome']
CASES = [
    ('A', 'Facilitator unconfirmed', 'Pass checks; wait for Morgan'),
    ('B', 'Stale facilitator note', 'Fail freshness; hold'),
    ('C', 'Unsupported staffing claim', 'Fail wording; return'),
    ('Final', 'Three cases are not proof', 'Investigate judge and rubric'),
]


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
    draw.rounded_rectangle((28, 28, 1892, 1052), radius=22, outline='#6e5c35', width=2)
    return image


def panel(draw, box, red=False, radius=22):
    draw.rounded_rectangle(box, radius=radius, fill='#2b1b20' if red else '#102939', outline='#c99c35', width=4)


def centered(draw, box, value, size, *, min_size=None, color=CREAM, bold=True):
    min_size = min_size or size
    for s in range(size, min_size - 1, -1):
        f = font(s, bold)
        b = draw.textbbox((0, 0), value, font=f)
        w, h = b[2] - b[0], b[3] - b[1]
        if w <= box[2] - box[0] - 56 and h <= box[3] - box[1] - 56:
            break
    else:
        raise AssertionError((value, box, size))
    x = (box[0] + box[2] - w) / 2 - b[0]
    y = (box[1] + box[3] - h) / 2 - b[1]
    assert x + b[0] >= box[0] + 28 and y + b[1] >= box[1] + 28
    assert x + b[2] <= box[2] - 28 and y + b[3] <= box[3] - 28
    draw.text((x, y), value, font=f, fill=color)
    return {'fontPx': s, 'glyphPx': [round(x + b[0]), round(y + b[1]), w, h]}


def paste_plate(image, source, box):
    x, y, w, h = box
    assert round(source.width / source.height, 3) == round(w / h, 3)
    image.paste(source.resize((w, h), Image.Resampling.LANCZOS), (x, y))
    return list(box)


def path_cards(image, y=95):
    draw = ImageDraw.Draw(image)
    cards = []
    for i, value in enumerate(PATH):
        x = 67 + i * 459
        box = (x, y, x + 400, y + 160)
        panel(draw, box, red=i == 2, radius=18)
        if value == 'Receipt envelope':
            parts = []
            f = font(54)
            for word, offset in (('Receipt', 29), ('envelope', 82)):
                bounds = draw.textbbox((0, 0), word, font=f)
                w, h = bounds[2] - bounds[0], bounds[3] - bounds[1]
                tx = x + (400 - w) / 2 - bounds[0]
                ty = y + offset - bounds[1]
                assert tx + bounds[0] >= x + 28 and tx + bounds[2] <= x + 372
                assert ty + bounds[1] >= y + 28 and ty + bounds[3] <= y + 132
                draw.text((tx, ty), word, font=f, fill=CREAM)
                parts.append({'fontPx': 54, 'glyphPx': [round(tx + bounds[0]), round(ty + bounds[1]), w, h]})
            label_text = parts
        else:
            label_text = centered(draw, box, value, 68, min_size=57, color=GOLD if i == 2 else CREAM)
        cards.append({'label': value, 'boxPx': list(box), 'text': label_text})
        if i < 3:
            draw.line((x + 402, y + 80, x + 449, y + 80), fill=GOLD, width=8)
            draw.polygon(((x + 435, y + 67), (x + 457, y + 80), (x + 435, y + 93)), fill=GOLD)
    return cards


def wide(source):
    image = canvas()
    draw = ImageDraw.Draw(image)
    centered(draw, (65, 35, 1855, 170), 'Three cases are not production proof.', 67, min_size=58, color=GOLD)
    plate_box = (68, 202, 1120, 700)
    paste_plate(image, source, plate_box)
    draw = ImageDraw.Draw(image)
    for i, value in enumerate(PATH):
        box = (1240, 205 + i * 178, 1840, 349 + i * 178)
        panel(draw, box, red=i == 2)
        centered(draw, box, value, 61, min_size=51, color=GOLD if i == 2 else CREAM)
        if i < 3:
            draw.line((1540, box[3] + 7, 1540, box[3] + 26), fill=GOLD, width=8)
            draw.polygon(((1528, box[3] + 23), (1552, box[3] + 23), (1540, box[3] + 42)), fill=GOLD)
    draw.text((85, 951), 'Receipt fields: Intent · Agent · Source / Action · Artifact · Approval / Cost · Outcome · Rollback', font=font(40), fill=CREAM)
    return image, {'platePx': list(plate_box), 'path': PATH, 'receiptFields': FIELDS}


def focused(source, case):
    label, premise, disposition = case
    image = canvas()
    cards = path_cards(image)
    plate_box = (74, 313, 520, 325)
    paste_plate(image, source, plate_box)
    draw = ImageDraw.Draw(image)
    box = (660, 290, 1835, 853)
    panel(draw, box, red=label in ('B', 'C', 'Final'), radius=34)
    title = 'No promotion' if label == 'Final' else f'Case {label}'
    title_text = centered(draw, (705, 323, 1790, 475), title, 121, min_size=98, color=GOLD)
    premise_text = centered(draw, (705, 476, 1790, 640), premise, 88, min_size=69, bold=False)
    disposition_text = centered(draw, (705, 655, 1790, 821), disposition, 84, min_size=64)
    field_box = (75, 695, 594, 862)
    panel(draw, field_box)
    field_text = centered(draw, field_box, 'Outcome + rollback', 52, min_size=44)
    return image, {'case': label, 'premise': premise, 'disposition': disposition, 'platePx': list(plate_box),
                   'pathCards': cards, 'caseBoxPx': list(box), 'titleText': title_text,
                   'premiseText': premise_text, 'dispositionText': disposition_text,
                   'fieldBoxPx': list(field_box), 'fieldText': field_text}


assert sha(SOURCE) == SOURCE_SHA
source = Image.open(SOURCE).convert('RGB')
assert source.size == (4000, 2500)
OUT.mkdir(parents=True, exist_ok=True)
frames = []
for kind, name, output in [('overview', None, 'overview-wide.png')] + [('focus', case, f'focus-{case[0].lower()}.png') for case in CASES]:
    image, geometry = wide(source) if kind == 'overview' else focused(source, name)
    path = OUT / output
    image.save(path)
    preview = OUT / f'{path.stem}-mobile-preview.png'
    image.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
    frames.append({'kind': kind, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                   'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                   'geometry': geometry})
receipt = {'status': 'review_only_unbound', 'scene': 'L08-05', 'approvedPlatePath': str(SOURCE.relative_to(ROOT)),
           'approvedPlateSha256': SOURCE_SHA, 'approvedPlatePx': list(source.size),
           'frameworkPath': PATH, 'receiptFields': FIELDS,
           'method': 'complete approved plate in every frame plus provider-free raster recreation of the Agent run to Receipt envelope to Human gate to Outcome path; mobile case details follow exact narration and retain outcome/rollback; no source crop or SVG art',
           'frames': frames}
(OUT / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered five L08-05 complete-plate review frames')
