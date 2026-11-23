"""Complete approved Portfolio and Authority plates with distinct L14 teaching cues."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
CREAM, GOLD, NAVY = '#fff7e8', '#f2d36f', '#071b2a'
SPECS = {
    'L14-03': {
        'source': 'agentified/manuscript/visuals/rendered/publication-plates/figure-8-1-portfolio-first-stack-publication-plate.png',
        'sha': '292383540d22053939e927a791c28c4c316c220d05d297dc87bb2a59979c09e4',
        'size': (4000, 2500), 'overview': (384, 145, 1152, 720), 'focus': (70, 440, 592, 370),
        'title': 'Portfolio-first operating stack', 'focusTitle': 'Held brief · trace the decision',
        'sourceRole': 'Mission Control and controls',
        'cards': ['Cleared source', 'Agent draft', 'Staffing check', 'Morgan holds'],
        'claim': 'No send or booking event.'
    },
    'L14-04': {
        'source': 'agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png',
        'sha': '073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b',
        'size': (3000, 4700), 'overview': (720, 145, 480, 752), 'focus': (80, 173, 420, 658),
        'title': 'Authority ladder · complete path', 'focusTitle': 'A proposed rule stays in review',
        'sourceRole': 'Route and human gate',
        'cards': ['Owner', 'Scope', 'Source reference', 'Status', 'Review date'],
        'claim': 'Draft · a person confirms staffing.'
    },
}


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
    assert w * source.height == h * source.width
    im.paste(source.resize((w, h), Image.Resampling.LANCZOS), (x, y))
    return list(box)


def overview(spec, source):
    im = canvas()
    draw = ImageDraw.Draw(im)
    txt(draw, (85, 42), spec['title'], 80, GOLD)
    box = plate(im, source, spec['overview'])
    return im, {'completePlatePx': box, 'sourceRole': spec['sourceRole']}


def focus(scene, spec, source):
    im = canvas()
    draw = ImageDraw.Draw(im)
    txt(draw, (75, 44), spec['focusTitle'], 78, GOLD)
    full = plate(im, source, spec['focus'])
    if scene == 'L14-03':
        cards = []
        for i, word in enumerate(spec['cards']):
            x = 67 + 456 * i
            box = (x, 171, x + 410, 325)
            draw.rounded_rectangle(box, radius=22, fill='#2b1b20' if i == 3 else '#102939', outline='#c99c35', width=4)
            assert draw.textbbox((0, 0), word, font=font(45))[2] <= 362
            txt(draw, (x + 24, 211), word, 45, GOLD if i == 3 else CREAM)
            cards.append({'label': word, 'boxPx': list(box)})
        draw.rounded_rectangle((720, 430, 1835, 816), radius=23, fill='#102939', outline='#c99c35', width=4)
        txt(draw, (775, 480), 'Morgan owns the hold.', 65)
        txt(draw, (775, 605), spec['claim'], 62, GOLD)
    else:
        cards = []
        draw.rounded_rectangle((570, 171, 1835, 856), radius=23, fill='#102939', outline='#c99c35', width=4)
        txt(draw, (625, 211), 'Rule record needs:', 68, GOLD)
        for i, word in enumerate(spec['cards']):
            y = 322 + 99 * i
            txt(draw, (650, y), word, 56)
            cards.append({'label': word, 'boxPx': [625, y, 1790, y + 73]})
        txt(draw, (570, 891), spec['claim'], 54, GOLD)
    return im, {'completePlatePx': full, 'sourceRole': spec['sourceRole'],
                'narrationCards': cards, 'narrationClaim': spec['claim']}


for scene, spec in SPECS.items():
    path = ROOT / spec['source']
    assert sha(path) == spec['sha']
    source = Image.open(path).convert('RGB')
    assert source.size == spec['size']
    out = HERE / f'{scene.lower()}-plate-study'
    out.mkdir(parents=True, exist_ok=True)
    frames = []
    for kind, name, rendered in [('overview', 'overview-wide.png', overview(spec, source)),
                                 ('focus', 'focus.png', focus(scene, spec, source))]:
        im, geometry = rendered
        frame = out / name
        im.save(frame)
        preview = out / f'{frame.stem}-mobile-preview.png'
        im.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
        frames.append({'kind': kind, 'path': str(frame.relative_to(ROOT)), 'sha256': sha(frame),
                       'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                       'geometry': geometry})
    receipt = {'status': 'review_only_unbound', 'scene': scene,
               'approvedPlatePath': spec['source'], 'approvedPlateSha256': spec['sha'],
               'approvedPlatePx': list(spec['size']), 'sourceRole': spec['sourceRole'],
               'method': 'complete approved source plate in both frames; separate narration-grounded teaching cues; no crop or SVG',
               'frames': frames}
    (out / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(f'Rendered {scene} complete-plate frames')
