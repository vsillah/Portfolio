"""Verify L15 complete approved plates, bounded padding, and mapped review clips."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(row for row in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if row['lessonId'] == 'L15')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
studies = []
for scene, expected_plate, cue_count in (
    ('L15-04', 'fc3621b103f102664c5a455adade3e6df5dbbbf19d49d9491e1f0ccea35c0ed1', 8),
):
    study = HERE / f'{scene.lower()}-trust-study'
    frames = json.loads((study / 'frame-receipt.json').read_text())
    clips = json.loads((study / 'clip-receipt.json').read_text())
    assert frames['status'] == clips['status'] == 'review_only_unbound'
    assert frames['scene'] == clips['scene'] == scene
    assert frames['approvedPlateSha256'] == expected_plate == sha(ROOT / frames['approvedPlatePath'])
    assert clips['sourceVideoSha256'] == source['currentVideo']['sha256']
    assert clips['sourceCaptionSha256'] == source['currentCaption']['sha256']
    assert clips['captionHead'] == 'af647b6adc101cafade371d5ca53047670d53213'
    assert clips['playerHead'] == '7bb6267c9fb98172679e161aafa208dfc7a276c3'
    vtt = study / f'{scene}-source-trim.vtt'
    assert sha(vtt) == clips['trimmedCaptionSha256'] and vtt.read_text().count(' --> ') == cue_count
    original_plate = Image.open(ROOT / frames['approvedPlatePath']).convert('RGB')
    for row in frames['frames']:
        frame = ROOT / row['path']
        assert sha(frame) == row['sha256']
        assert sha(ROOT / row['mobilePreviewPath']) == row['mobilePreviewSha256']
        x, y, w, h = row['geometry']['completePlatePx']
        image = Image.open(frame).convert('RGB')
        assert ImageChops.difference(image.crop((x, y, x + w, y + h)), original_plate.resize((w, h), Image.Resampling.LANCZOS)).getbbox() is None
    assert len(clips['clips']) == 2
    for row in clips['clips']:
        path = ROOT / row['path']
        assert sha(path) == row['sha256']
        assert abs(sum(x['durationSeconds'] for x in row['timeline']) - 29.0) < .000001
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
    studies.append({'scene': scene, 'frameReceiptSha256': sha(study / 'frame-receipt.json'),
                    'clipReceiptSha256': sha(study / 'clip-receipt.json'), 'clips': clips['clips']})

regulars = []
candidate = json.loads((HERE / 'candidate-receipt-L15-rest.json').read_text())
for number in (1, 2, 3, 5, 6, 7, 8):
    scene = f'L15-{number:02}'
    row = next(x for x in candidate['frames'] if x['scene_id'] == scene)
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
    assert ImageChops.difference(a, Image.composite(a, b, mask)).getbbox() is None, scene
    local = []
    for layout in ('desktop', 'mobile'):
        path = HERE / 'checks/lesson-order' / f'{scene}-{layout}.mp4'
        assert path.with_suffix('.vtt').read_text().startswith('WEBVTT')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
        local.append({'layout': layout, 'sha256': sha(path), 'vttSha256': sha(path.with_suffix('.vtt')),
                      'cueCount': path.with_suffix('.vtt').read_text().count(' --> ')})
    regulars.append({'scene': scene, 'frameSha256': sha(frame), 'clips': local})

receipt = {'status': 'review_only_unbound', 'sourceVideoSha256': source['currentVideo']['sha256'],
           'sourceCaptionSha256': source['currentCaption']['sha256'], 'plateStudies': studies,
           'otherScenes': regulars,
           'limits': 'Source audio/VTT unchanged; candidate clips unbound. L15-08 sample falls after the mapped VTT final cue. Full learner-route and protected intervals remain separate gates.'}
(HERE / 'l15-checkpoint-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('PASS L15 one complete plate/two clips and seven adjacent scenes/14 clips')
