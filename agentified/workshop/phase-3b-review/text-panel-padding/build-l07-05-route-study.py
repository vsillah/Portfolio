"""Create a provider-free, unbound L07-05 Route study with the full plate intact."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
L06 = HERE / 'l06-03-responsive-study'
OUT = HERE / 'l07-05-route-study'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
CREAM = '#fff7e8'
GOLD = '#f2d36f'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


base_receipt = json.loads((L06 / 'frame-receipt.json').read_text())
assert base_receipt['sourceSha256'] == '073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b'
source_frames = {Path(row['path']).name: row for row in base_receipt['frames']}
for name in ('overview-wide.png', 'focus-03-route.png'):
    row = source_frames[name]
    assert sha(ROOT / row['path']) == row['sha256']

OUT.mkdir(parents=True, exist_ok=True)
frames = []
for kind, name in [('overview', 'overview-wide.png'), ('route-focus', 'focus-03-route.png')]:
    source_path = L06 / name
    image = Image.open(source_path).convert('RGB')
    assert image.size == (1920, 1080)
    if kind == 'route-focus':
        draw = ImageDraw.Draw(image)
        # Keep the handoff above the native desktop caption-safe lower field.
        box = (83, 39, 1837, 127)
        draw.rounded_rectangle(box, radius=22, fill='#0d2030', outline='#c99c35', width=4)
        draw.rounded_rectangle((box[0] + 10, box[1] + 10, box[2] - 10, box[3] - 10), radius=13, outline='#796544', width=2)
        f = ImageFont.truetype(FONT, 56)
        for value, center in (('Authority ladder', 428), ('Handoff', 1040), ('Morgan', 1590)):
            bounds = draw.textbbox((0, 0), value, font=f)
            w, h = bounds[2] - bounds[0], bounds[3] - bounds[1]
            x, y = round(center - w / 2 - bounds[0]), round(83 - h / 2 - bounds[1])
            assert x >= box[0] + 28 and x + bounds[2] <= box[2] - 28
            draw.text((x, y), value, font=f, fill=CREAM)
        draw.line((1235, 83, 1345, 83), fill=GOLD, width=9)
        draw.polygon(((1345, 66), (1378, 83), (1345, 100)), fill=GOLD)
    out = OUT / ('l07-05-overview.png' if kind == 'overview' else 'l07-05-route-focus.png')
    image.save(out)
    preview = OUT / f'{out.stem}-mobile-preview.png'
    image.resize((390, 219), Image.Resampling.LANCZOS).save(preview)
    frames.append({'kind': kind, 'path': str(out.relative_to(ROOT)), 'sha256': sha(out),
                   'sourceFramePath': str(source_path.relative_to(ROOT)), 'sourceFrameSha256': sha(source_path),
                   'fullPlatePx': source_frames[name]['geometry']['platePx'],
                   'mobilePreviewPath': str(preview.relative_to(ROOT)), 'mobilePreviewSha256': sha(preview),
                   'handoffBoxPx': list(box) if kind == 'route-focus' else None})

receipt = {'status': 'review_only_unbound', 'scene': 'L07-05',
           'approvedPlateSha256': base_receipt['sourceSha256'],
           'method': 'intact approved plate in overview and Route focus, source-faithful enlarged Route words/gate, plus separate Handoff to Morgan teaching cue; no source crop or SVG art',
           'frameworkOrderBottomToTop': base_receipt['frameworkOrderBottomToTop'],
           'gateByRung': base_receipt['gateByRung'], 'frames': frames}
(OUT / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered two L07-05 full-plate review frames')
