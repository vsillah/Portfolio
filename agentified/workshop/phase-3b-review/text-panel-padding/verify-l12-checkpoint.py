"""Verify L12's complete First Receipt path and padded adjacent scenes."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
STUDY = HERE / 'l12-03-receipt-study'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(row for row in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if row['lessonId'] == 'L12')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
frames = json.loads((STUDY / 'frame-receipt.json').read_text())
clips = json.loads((STUDY / 'clip-receipt.json').read_text())
assert frames['status'] == clips['status'] == 'review_only_unbound'
assert frames['approvedPlateSha256'] == '1f5d13085c97dc9937bdd30362a17729b95d1401775706faa474bfe87858b669'
assert [Path(row['path']).name for row in frames['frames']] == ['overview-wide.png', 'proof-focus.png']
assert clips['sourceVideoSha256'] == source['currentVideo']['sha256']
assert clips['sourceCaptionSha256'] == source['currentCaption']['sha256']
assert clips['captionHead'] == 'af647b6adc101cafade371d5ca53047670d53213'
assert clips['playerHead'] == '7bb6267c9fb98172679e161aafa208dfc7a276c3'
assert sha(STUDY / 'L12-03-source-trim.vtt') == clips['trimmedCaptionSha256']
assert (STUDY / 'L12-03-source-trim.vtt').read_text().count(' --> ') == 7
for row in frames['frames']:
    assert sha(ROOT / row['path']) == row['sha256']
    assert sha(ROOT / row['mobilePreviewPath']) == row['mobilePreviewSha256']
    x, y, w, h = row['geometry']['completePlatePx']
    original_plate = Image.open(ROOT / frames['approvedPlatePath']).convert('RGB')
    image = Image.open(ROOT / row['path']).convert('RGB')
    assert ImageChops.difference(image.crop((x, y, x + w, y + h)), original_plate.resize((w, h), Image.Resampling.LANCZOS)).getbbox() is None
assert len(clips['clips']) == 2
for row in clips['clips']:
    path = ROOT / row['path']
    assert sha(path) == row['sha256']
    assert abs(sum(x['durationSeconds'] for x in row['timeline']) - 30.18) < .000001
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)

regulars = []
for number in (1, 2, 4, 5, 6, 7, 8):
    scene = f'L12-{number:02}'
    row = next(x for x in json.loads((HERE / ('candidate-receipt-L12-rest.json' if number >= 4 else f'candidate-receipt-{scene}.json')).read_text())['frames'] if x['scene_id'] == scene)
    original = ROOT / 'agentified/workshop/presentation-illustration-audit/frames/illustrated' / f'{scene}.png'
    frame = ROOT / row['frame_path']
    assert sha(original) == row['original_frame_sha256'] and sha(frame) == row['frame_sha256']
    assert sha(ROOT / row['source_path']) == row['source_sha256']
    a, b = Image.open(original).convert('RGB'), Image.open(frame).convert('RGB')
    mask = Image.new('L', a.size)
    draw = ImageDraw.Draw(mask)
    for decision in row['padding_decisions']:
        assert decision['action'] in ('fitted', 'retained')
        if decision['action'] == 'fitted':
            assert decision['paddingPx'] == 28
            for box in (decision['old'], decision['box']):
                draw.rectangle((box['x'] - 4, box['y'] - 4, box['x'] + box['width'] + 4,
                                box['y'] + box['height'] + 4), fill=255)
    assert ImageChops.difference(a, Image.composite(a, b, mask)).getbbox() is None
    local = []
    for layout in ('desktop', 'mobile'):
        path = HERE / 'checks/lesson-order' / f'{scene}-{layout}.mp4'
        assert path.with_suffix('.vtt').read_text().startswith('WEBVTT')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
        local.append({'layout': layout, 'sha256': sha(path), 'vttSha256': sha(path.with_suffix('.vtt'))})
    regulars.append({'scene': scene, 'frameSha256': sha(frame), 'clips': local})

receipt = {'status': 'review_only_unbound', 'sourceVideoSha256': source['currentVideo']['sha256'],
           'sourceCaptionSha256': source['currentCaption']['sha256'],
           'receiptFrameReceiptSha256': sha(STUDY / 'frame-receipt.json'),
           'receiptClipReceiptSha256': sha(STUDY / 'clip-receipt.json'),
           'receiptClips': clips['clips'], 'otherScenes': regulars,
           'limits': 'Source audio/VTT unchanged; candidate clips are unbound. Full L12 learner-route and protected end presentation remain separate gates.'}
(HERE / 'l12-checkpoint-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('PASS L12-03 complete receipt/two clips and seven adjacent scenes/14 clips')
