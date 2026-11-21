"""Verify L10's complete Recommend/Execute ladder and padded adjacent scenes."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
STUDY = HERE / 'l10-03-ladder-study'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(row for row in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if row['lessonId'] == 'L10')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
frames = json.loads((STUDY / 'frame-receipt.json').read_text())
clips = json.loads((STUDY / 'clip-receipt.json').read_text())
assert frames['status'] == clips['status'] == 'review_only_unbound'
assert frames['approvedPlateSha256'] == '073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b'
assert [Path(row['path']).name for row in frames['frames']] == ['overview-wide.png', 'focus-02-recommend.png', 'focus-05-execute.png']
assert clips['sourceVideoSha256'] == source['currentVideo']['sha256']
assert clips['sourceCaptionSha256'] == source['currentCaption']['sha256']
assert clips['captionHead'] == 'af647b6adc101cafade371d5ca53047670d53213'
assert clips['playerHead'] == '7bb6267c9fb98172679e161aafa208dfc7a276c3'
assert sha(STUDY / 'L10-03-source-trim.vtt') == clips['trimmedCaptionSha256']
assert (STUDY / 'L10-03-source-trim.vtt').read_text().count(' --> ') == 7
for row in frames['frames']:
    assert sha(ROOT / row['path']) == row['sha256']
    assert sha(ROOT / row['mobilePreviewPath']) == row['mobilePreviewSha256']
    assert row['geometry']['platePx']
assert len(clips['clips']) == 2
for row in clips['clips']:
    path = ROOT / row['path']
    assert sha(path) == row['sha256']
    assert abs(sum(x['durationSeconds'] for x in row['timeline']) - 29.90) < .000001
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)

regulars = []
for number in (1, 2, 4, 5, 6, 7, 8):
    scene = f'L10-{number:02}'
    row = json.loads((HERE / f'candidate-receipt-{scene}.json').read_text())['frames'][0]
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
           'ladderFrameReceiptSha256': sha(STUDY / 'frame-receipt.json'),
           'ladderClipReceiptSha256': sha(STUDY / 'clip-receipt.json'),
           'ladderClips': clips['clips'], 'otherScenes': regulars,
           'limits': 'Source audio/VTT unchanged; candidate clips are unbound. L10 source acoustic join and full lesson route remain separate gates.'}
(HERE / 'l10-checkpoint-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('PASS L10-03 complete plate/two clips and seven adjacent scenes/14 clips')
