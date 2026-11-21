"""Review-only L16 complete plates beside narration-specific audit records."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
SPECS = {
    'L16-04': {
        'source': 'agentified/manuscript/visuals/rendered/publication-plates/figure-3-amina-inside-sam-publication-plate.png',
        'sha': '730c5fb6319845a015fa8c4c6c95a28148887e57daa8919246a0edadf50989fd',
        'size': (3600, 4500), 'overview': (672, 135, 576, 720), 'focus': (82, 190, 480, 600),
        'title': 'Amina inside SAM · complete framework', 'focusTitle': 'The operating action remains held',
        'lines': ['Preparation role: draft brief', 'Morgan: session recommendation',
                  'Separate owner: spend review', 'Staffing: no evidence yet', 'Hold: no book, send, or buy'],
    },
    'L16-05': {
        'source': 'agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png',
        'sha': '073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b',
        'size': (3000, 4700), 'overview': (720, 145, 480, 752), 'focus': (80, 173, 420, 658),
        'title': 'Authority ladder · complete path', 'focusTitle': 'Export and rollback stay bounded',
        'lines': ['Proof outline: not shared', 'Retain the prior paper draft',
                  'Correct the claim and log why', 'Future rule: named revoke owner',
                  'Weakest gate: staffing confirmation'],
    },
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def draw_text(draw, xy, value, size, color='#fff7e8'):
    font = ImageFont.truetype(FONT, size)
    box = draw.textbbox(xy, value, font=font)
    assert box[0] >= 25 and box[2] <= 1885 and box[3] <= 954, (value, box)
    draw.text(xy, value, font=font, fill=color)


def canvas():
    im = Image.new('RGB', (1920, 1080), '#071b2a')
    noise = ImageOps.colorize(Image.effect_noise(im.size, 17).convert('L'), '#061522', '#244450')
    im = Image.blend(im, noise, .09)
    ImageDraw.Draw(im).rounded_rectangle((18, 18, 1902, 1062), radius=25, outline='#c99c35', width=4)
    return im


def put_plate(im, plate, box):
    x, y, w, h = box
    assert w * plate.height == h * plate.width
    im.paste(plate.resize((w, h), Image.Resampling.LANCZOS), (x, y))
    return list(box)


for scene, spec in SPECS.items():
    source = ROOT / spec['source']
    assert sha(source) == spec['sha']
    plate = Image.open(source).convert('RGB')
    assert plate.size == spec['size']
    out = HERE / f'{scene.lower()}-audit-study'
    out.mkdir(parents=True, exist_ok=True)
    frames = []
    for kind, name in (('overview', 'overview-wide.png'), ('audit', 'audit.png')):
        im = canvas()
        draw = ImageDraw.Draw(im)
        draw_text(draw, (78, 35), spec['title'] if kind == 'overview' else spec['focusTitle'], 76, '#f2d36f')
        box = put_plate(im, plate, spec['overview'] if kind == 'overview' else spec['focus'])
        if kind == 'audit':
            draw.rounded_rectangle((600, 185, 1837, 826), radius=23, fill='#102939', outline='#c99c35', width=4)
            for i, line in enumerate(spec['lines']):
                draw_text(draw, (650, 232 + 109 * i), line, 49, '#f2d36f' if i == 4 else '#fff7e8')
        path = out / name
        im.save(path)
        preview = out / f'{path.stem}-mobile-preview.png'
        im.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
        frames.append({'kind': kind, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                       'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                       'geometry': {'completePlatePx': box, 'narrationAudit': spec['lines'] if kind == 'audit' else []}})
    receipt = {'status': 'review_only_unbound', 'scene': scene,
               'approvedPlatePath': spec['source'], 'approvedPlateSha256': spec['sha'],
               'approvedPlatePx': list(spec['size']),
               'method': 'complete approved plate in both frames beside distinct narration-derived audit; no crop or SVG',
               'frames': frames}
    (out / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(f'Rendered {scene} complete-plate audit frames')
