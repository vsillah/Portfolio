"""Bind the ordered L07 padding pass and first source-geometry stop to hashes."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
SCENES = [f'L07-{n:02}' for n in range(1, 6)]
STACK = {'caption': 'af647b6adc101cafade371d5ca53047670d53213',
         'player': '7bb6267c9fb98172679e161aafa208dfc7a276c3'}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(r for r in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if r['lessonId'] == 'L07')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
for head in STACK.values():
    subprocess.run(['git', 'cat-file', '-e', f'{head}^{{commit}}'], cwd=ROOT, check=True)

rows = []
for scene in SCENES:
    receipt_path = HERE / f'candidate-receipt-{scene}.json'
    candidate = json.loads(receipt_path.read_text())
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
    clips = []
    for layout in ('desktop', 'mobile'):
        clip = HERE / 'checks/lesson-order' / f'{scene}-{layout}.mp4'
        vtt = clip.with_suffix('.vtt')
        assert clip.exists() and vtt.exists() and vtt.read_text().startswith('WEBVTT')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(clip), '-f', 'null', '-'], check=True,
                       stdout=subprocess.DEVNULL)
        clips.append({'layout': layout, 'path': str(clip.relative_to(ROOT)),
                      'sha256': sha(clip), 'vttSha256': sha(vtt)})
    rows.append({'scene': scene, 'disposition': 'rejected_source_geometry' if scene == 'L07-05' else 'review_only_unbound',
                 'receiptSha256': sha(receipt_path), 'frameSha256': sha(frame),
                 'fittedPanels': sum(d['action'] == 'fitted' for d in record['padding_decisions']),
                 'clips': clips})

briefs = json.loads((ROOT / 'agentified/workshop/presentation-illustration-audit/semantic-briefs.json').read_text())['scenes']
brief = next(b for b in briefs if b['scene_id'] == 'L07-05')
plate = brief['approved_plate']
plate_path = ROOT / plate['path']
assert Image.open(plate_path).size == (3000, 4700)
assert sha(plate_path) == plate['sha256'] == '073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b'
assert plate['crop_source_px'] == [450, 1750, 2200, 1500]
assert brief['visual_artifact'] == 'Approved authority ladder focused on the Route rung.'
assert brief['one_second_read'] == 'Source checker, drafter, and coordinator pass work to Morgan.'

receipt = {'status': 'STOP_at_L07-05_source_geometry', 'paddingHeadBeforeThisPass': '51f32d189f6c9be45470e478b77cc6376da3fbd4',
           'stackHeads': STACK, 'sourceVideoSha256': source['currentVideo']['sha256'],
           'sourceCaptionSha256': source['currentCaption']['sha256'],
           'approvedPlate': {'path': plate['path'], 'sha256': plate['sha256'],
                             'sizePx': [3000, 4700], 'cropSourcePx': plate['crop_source_px']},
           'failure': 'L07-05 uses a cropped Route-rung fragment. The full subject, gate, connectors, and output path are absent; measured text padding cannot restore them.',
           'scenes': rows, 'notQualified': ['L07-06', 'L07-07', 'L07-08', 'L08-L16'],
           'limits': 'Source-route caption/player behavior was not re-run in this stopped L07 sweep; scene-local clips are not candidate learner playback.'}
(HERE / 'l07-05-stop-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('PASS L07-01..04 panel and clip checks; STOP L07-05 cropped approved plate')
