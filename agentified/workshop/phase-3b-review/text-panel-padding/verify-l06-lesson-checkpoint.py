"""Verify the unbound L06-04..08 padding checkpoint and write exact hashes."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
SCENES = [f'L06-{n:02}' for n in range(4, 9)]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(r for r in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if r['lessonId'] == 'L06')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
rows = []
for scene in SCENES:
    candidate_path = HERE / f'candidate-receipt-{scene}.json'
    candidate = json.loads(candidate_path.read_text())
    assert candidate['status'] == 'review_only_unbound' and candidate['selectedScenes'] == [scene]
    assert len(candidate['frames']) == 1
    record = candidate['frames'][0]
    original = ROOT / 'agentified/workshop/presentation-illustration-audit/frames/illustrated' / f'{scene}.png'
    frame = ROOT / record['frame_path']
    assert sha(original) == record['original_frame_sha256']
    assert sha(frame) == record['frame_sha256']
    assert sha(ROOT / record['source_path']) == record['source_sha256']
    old, new = Image.open(original).convert('RGB'), Image.open(frame).convert('RGB')
    assert old.size == new.size == (1920, 1080)
    mask = Image.new('L', old.size)
    draw = ImageDraw.Draw(mask)
    for decision in record['padding_decisions']:
        assert decision['action'] in ('fitted', 'retained')
        if decision['action'] == 'fitted':
            assert decision['paddingPx'] == 28
            for box in (decision['old'], decision['box']):
                draw.rectangle((box['x'] - 4, box['y'] - 4,
                                box['x'] + box['width'] + 4,
                                box['y'] + box['height'] + 4), fill=255)
    assert ImageChops.difference(old, Image.composite(old, new, mask)).getbbox() is None, f'{scene}: pixels outside panel unions changed'
    if scene == 'L06-07':
        assert sha(original) == sha(frame), 'protected worksheet changed'
    clips = []
    for layout in ('desktop', 'mobile'):
        clip = HERE / 'checks/lesson-order' / f'{scene}-{layout}.mp4'
        vtt = clip.with_suffix('.vtt')
        assert clip.exists() and vtt.exists() and vtt.read_text().startswith('WEBVTT')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(clip), '-f', 'null', '-'], check=True,
                       stdout=subprocess.DEVNULL)
        clips.append({'layout': layout, 'path': str(clip.relative_to(ROOT)),
                      'sha256': sha(clip), 'vttSha256': sha(vtt)})
    rows.append({'scene': scene, 'receipt': str(candidate_path.relative_to(ROOT)),
                 'receiptSha256': sha(candidate_path), 'frameSha256': sha(frame),
                 'fittedPanels': sum(d['action'] == 'fitted' for d in record['padding_decisions']),
                 'clips': clips})

receipt = {'status': 'review_only_unbound', 'sourceVideoSha256': source['currentVideo']['sha256'],
           'sourceCaptionSha256': source['currentCaption']['sha256'], 'scenes': rows,
           'limits': 'Scene-local clips and pixel checks; no candidate learner binding or L06-04..08 browser matrix.'}
(HERE / 'l06-lesson-checkpoint-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'PASS {len(rows)} scenes, {sum(r["fittedPanels"] for r in rows)} fitted panels, 10 decoded clips')
