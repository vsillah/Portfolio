"""Verify L09's separate metrics/trust and complete ladder review evidence."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(row for row in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if row['lessonId'] == 'L09')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
specials = []
for scene, folder, count in [('L09-02', 'l09-02-metrics-study', 4),
                              ('L09-04', 'l09-04-ladder-study', 3)]:
    study = HERE / folder
    frames = json.loads((study / 'frame-receipt.json').read_text())
    clips = json.loads((study / 'clip-receipt.json').read_text())
    assert frames['status'] == clips['status'] == 'review_only_unbound'
    assert len(frames['frames']) == count and len(clips['clips']) == 2
    assert clips['sourceVideoSha256'] == source['currentVideo']['sha256']
    assert clips['sourceCaptionSha256'] == source['currentCaption']['sha256']
    assert clips['captionHead'] == 'af647b6adc101cafade371d5ca53047670d53213'
    assert clips['playerHead'] == '7bb6267c9fb98172679e161aafa208dfc7a276c3'
    assert sha(study / f'{scene}-source-trim.vtt') == clips['trimmedCaptionSha256']
    assert (study / f'{scene}-source-trim.vtt').read_text().count(' --> ') == (7 if scene == 'L09-02' else 8)
    if scene == 'L09-02':
        assert sha(ROOT / frames['approvedPlatePath']) == frames['approvedPlateSha256']
        assert frames['narratedRungs'] == ['Activity', 'Output', 'Quality', 'Behavior', 'Outcome', 'Learning', 'Authority']
        trust = next(row for row in frames['frames'] if row['kind'] == 'context')
        image = Image.open(ROOT / trust['path']).convert('RGB')
        plate = Image.open(ROOT / frames['approvedPlatePath']).convert('RGB')
        x, y, w, h = trust['geometry']['completePlatePx']
        assert ImageChops.difference(image.crop((x, y, x + w, y + h)),
                                     plate.resize((w, h), Image.Resampling.LANCZOS)).getbbox() is None
        assert trust['geometry']['sourceSections'] == ['Signals', 'Alignment', 'Momentum']
        assert [len(row['geometry']['rungs']) for row in frames['frames'] if row['kind'] == 'metrics'] == [7, 4, 3]
    else:
        assert frames['approvedPlateSha256'] == '073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b'
        assert [Path(row['path']).name for row in frames['frames']] == ['overview-wide.png', 'focus-04-stage.png', 'focus-05-execute.png']
        for row in frames['frames']:
            assert row['geometry']['platePx'] and sha(ROOT / row['path']) == row['sha256']
    for row in frames['frames']:
        assert sha(ROOT / row['path']) == row['sha256']
        assert sha(ROOT / row['mobilePreviewPath']) == row['mobilePreviewSha256']
    clip_rows = []
    for row in clips['clips']:
        path = ROOT / row['path']
        assert sha(path) == row['sha256']
        assert abs(sum(x['durationSeconds'] for x in row['timeline']) - clips['durationSeconds']) < .000001
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
        clip_rows.append({'layout': row['layout'], 'sha256': row['sha256']})
    specials.append({'scene': scene, 'frameReceiptSha256': sha(study / 'frame-receipt.json'),
                     'clipReceiptSha256': sha(study / 'clip-receipt.json'), 'clips': clip_rows})

regulars = []
for number in (1, 3, 5, 6, 7, 8):
    scene = f'L09-{number:02}'
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
    clips = []
    for layout in ('desktop', 'mobile'):
        path = HERE / 'checks/lesson-order' / f'{scene}-{layout}.mp4'
        assert path.with_suffix('.vtt').read_text().startswith('WEBVTT')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
        clips.append({'layout': layout, 'sha256': sha(path), 'vttSha256': sha(path.with_suffix('.vtt'))})
    regulars.append({'scene': scene, 'frameSha256': sha(frame), 'clips': clips})

receipt = {'status': 'review_only_unbound', 'sourceVideoSha256': source['currentVideo']['sha256'],
           'sourceCaptionSha256': source['currentCaption']['sha256'], 'specialScenes': specials,
           'otherScenes': regulars,
           'limits': 'Complete-plate and scene-local candidate clips are not bound learner media; L09 source speech/VTT exact-word mismatch remains historical separate issue.'}
(HERE / 'l09-resume-checkpoint-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('PASS L09-02/04 complete studies plus six adjacent scenes and 16 decoded clips')
