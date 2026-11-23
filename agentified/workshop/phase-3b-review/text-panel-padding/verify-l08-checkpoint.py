"""Verify the source-bound, review-only L08 receipt study and adjacent clips."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
STUDY = HERE / 'l08-05-receipt-study'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(row for row in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if row['lessonId'] == 'L08')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
frames = json.loads((STUDY / 'frame-receipt.json').read_text())
clips = json.loads((STUDY / 'clip-receipt.json').read_text())
assert frames['status'] == clips['status'] == 'review_only_unbound'
assert frames['approvedPlateSha256'] == sha(ROOT / frames['approvedPlatePath'])
assert frames['frameworkPath'] == ['Agent run', 'Receipt envelope', 'Human gate', 'Outcome']
assert len(frames['receiptFields']) == 9 and len(frames['frames']) == 5
assert clips['captionHead'] == 'af647b6adc101cafade371d5ca53047670d53213'
assert clips['playerHead'] == '7bb6267c9fb98172679e161aafa208dfc7a276c3'
assert clips['sourceVideoSha256'] == source['currentVideo']['sha256']
assert clips['sourceCaptionSha256'] == source['currentCaption']['sha256']
assert sha(STUDY / 'L08-05-source-trim.vtt') == clips['trimmedCaptionSha256']
assert (STUDY / 'L08-05-source-trim.vtt').read_text().count(' --> ') == 7
plate = Image.open(ROOT / frames['approvedPlatePath']).convert('RGB')
for entry in frames['frames']:
    frame = ROOT / entry['path']
    preview = ROOT / entry['mobilePreviewPath']
    assert sha(frame) == entry['sha256'] and sha(preview) == entry['mobilePreviewSha256']
    image = Image.open(frame).convert('RGB')
    assert image.size == (1920, 1080)
    x, y, w, h = entry['geometry']['platePx']
    assert (w, h) == (1120, 700) if entry['kind'] == 'overview' else (w, h) == (520, 325)
    assert ImageChops.difference(image.crop((x, y, x + w, y + h)), plate.resize((w, h), Image.Resampling.LANCZOS)).getbbox() is None
    assert Image.open(preview).size == (390, 219)
    if entry['kind'] == 'focus':
        assert [card['label'] for card in entry['geometry']['pathCards']] == frames['frameworkPath']

assert len(clips['clips']) == 2
for entry in clips['clips']:
    clip = ROOT / entry['path']
    assert sha(clip) == entry['sha256']
    assert sum(part['durationSeconds'] for part in entry['timeline']) == clips['durationSeconds']
    assert int(next(s for s in entry['probe']['streams'] if s['codec_type'] == 'video')['nb_frames']) >= 895
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(clip), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)

rows = []
for number in (1, 2, 3, 4, 6, 7, 8):
    scene = f'L08-{number:02}'
    receipt_path = HERE / f'candidate-receipt-{scene}.json'
    if number in (7, 8):
        receipt_path = HERE / 'candidate-receipt-L08-07-08.json'
    entry = next(row for row in json.loads(receipt_path.read_text())['frames'] if row['scene_id'] == scene)
    original = ROOT / 'agentified/workshop/presentation-illustration-audit/frames/illustrated' / f'{scene}.png'
    frame = ROOT / entry['frame_path']
    assert sha(original) == entry['original_frame_sha256'] and sha(frame) == entry['frame_sha256']
    assert sha(ROOT / entry['source_path']) == entry['source_sha256']
    a, b = Image.open(original).convert('RGB'), Image.open(frame).convert('RGB')
    mask = Image.new('L', a.size)
    draw = ImageDraw.Draw(mask)
    for decision in entry['padding_decisions']:
        assert decision['action'] in ('fitted', 'retained')
        if decision['action'] == 'fitted':
            assert decision['paddingPx'] == 28
            for box in (decision['old'], decision['box']):
                draw.rectangle((box['x'] - 4, box['y'] - 4, box['x'] + box['width'] + 4,
                                box['y'] + box['height'] + 4), fill=255)
    assert ImageChops.difference(a, Image.composite(a, b, mask)).getbbox() is None
    local = []
    for layout in ('desktop', 'mobile'):
        clip = HERE / 'checks/lesson-order' / f'{scene}-{layout}.mp4'
        vtt = clip.with_suffix('.vtt')
        assert vtt.read_text().startswith('WEBVTT')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(clip), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
        local.append({'layout': layout, 'sha256': sha(clip), 'vttSha256': sha(vtt)})
    rows.append({'scene': scene, 'frameSha256': sha(frame), 'clips': local})

receipt = {'status': 'review_only_unbound', 'sourceVideoSha256': source['currentVideo']['sha256'],
           'sourceCaptionSha256': source['currentCaption']['sha256'],
           'frameReceiptSha256': sha(STUDY / 'frame-receipt.json'),
           'clipReceiptSha256': sha(STUDY / 'clip-receipt.json'),
           'receiptStudyClips': clips['clips'], 'otherScenes': rows,
           'limits': 'Candidate review page and learner source route are separate; candidate is not learner-bound.'}
(HERE / 'l08-checkpoint-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'PASS L08-05 complete plate/two clips and {len(rows)} adjacent scenes/{len(rows) * 2} clips')
