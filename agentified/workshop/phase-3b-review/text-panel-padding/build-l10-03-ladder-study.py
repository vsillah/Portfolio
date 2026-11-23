"""Bind L10-03 review frames to the previously verified complete Authority Ladder."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
BASE = HERE / 'l06-03-responsive-study'
OUT = HERE / 'l10-03-ladder-study'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


base = json.loads((BASE / 'frame-receipt.json').read_text())
assert base['sourceSha256'] == '073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b'
names = ('overview-wide.png', 'focus-02-recommend.png', 'focus-05-execute.png')
frames = []
for name in names:
    entry = next(row for row in base['frames'] if Path(row['path']).name == name)
    assert sha(ROOT / entry['path']) == entry['sha256']
    assert sha(ROOT / entry['mobilePreviewPath']) == entry['mobilePreviewSha256']
    frames.append(entry)
OUT.mkdir(parents=True, exist_ok=True)
receipt = {'status': 'review_only_unbound', 'scene': 'L10-03', 'approvedPlateSha256': base['sourceSha256'],
           'frameworkOrderBottomToTop': base['frameworkOrderBottomToTop'], 'gateByRung': base['gateByRung'],
           'method': 'reuse verified complete approved plate and source-faithful Recommend/Execute focus frames; no crop, SVG, or source modification',
           'frames': frames}
(OUT / 'frame-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Bound three complete-plate L10-03 review frames')
