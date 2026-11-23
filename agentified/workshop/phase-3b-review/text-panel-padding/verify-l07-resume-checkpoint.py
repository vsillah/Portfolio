"""Verify the L07 review-only responsive Route and remaining padded scene clips."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
STUDY = HERE / 'l07-05-route-study'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(r for r in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if r['lessonId'] == 'L07')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
frame_receipt = json.loads((STUDY / 'frame-receipt.json').read_text())
clip_receipt = json.loads((STUDY / 'clip-receipt.json').read_text())
assert frame_receipt['status'] == clip_receipt['status'] == 'review_only_unbound'
assert frame_receipt['approvedPlateSha256'] == '073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b'
assert clip_receipt['captionHead'] == 'af647b6adc101cafade371d5ca53047670d53213'
assert clip_receipt['playerHead'] == '7bb6267c9fb98172679e161aafa208dfc7a276c3'
assert clip_receipt['sourceVideoSha256'] == source['currentVideo']['sha256']
assert clip_receipt['sourceCaptionSha256'] == source['currentCaption']['sha256']
assert sha(STUDY / 'L07-05-source-trim.vtt') == clip_receipt['trimmedCaptionSha256']
assert (STUDY / 'L07-05-source-trim.vtt').read_text().count(' --> ') == 8
assert len(frame_receipt['frames']) == 2 and len(clip_receipt['clips']) == 2

for frame in frame_receipt['frames']:
    path, base = ROOT / frame['path'], ROOT / frame['sourceFramePath']
    assert sha(path) == frame['sha256'] and sha(base) == frame['sourceFrameSha256']
    a, b = Image.open(base).convert('RGB'), Image.open(path).convert('RGB')
    assert a.size == b.size == (1920, 1080)
    px, py, pw, ph = frame['fullPlatePx']
    assert ImageChops.difference(a.crop((px, py, px + pw, py + ph)), b.crop((px, py, px + pw, py + ph))).getbbox() is None
    if frame['kind'] == 'overview':
        assert sha(path) == sha(base)
    else:
        box = frame['handoffBoxPx']
        mask = Image.new('L', a.size)
        ImageDraw.Draw(mask).rectangle(box, fill=255)
        assert ImageChops.difference(a, Image.composite(a, b, mask)).getbbox() is None

for clip in clip_receipt['clips']:
    path = ROOT / clip['path']
    assert sha(path) == clip['sha256']
    video_stream = next(s for s in clip['probe']['streams'] if s['codec_type'] == 'video')
    assert int(video_stream['nb_frames']) >= 659
    assert abs(float(clip['probe']['format']['duration']) - 26.371) < .1
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True,
                   stdout=subprocess.DEVNULL)

rows = []
for number in (1, 2, 3, 4, 6, 7, 8):
    scene = f'L07-{number:02}'
    receipt_path = HERE / f'candidate-receipt-{scene}.json'
    record = json.loads(receipt_path.read_text())['frames'][0]
    original = ROOT / 'agentified/workshop/presentation-illustration-audit/frames/illustrated' / f'{scene}.png'
    frame = ROOT / record['frame_path']
    assert sha(original) == record['original_frame_sha256'] and sha(frame) == record['frame_sha256']
    assert sha(ROOT / record['source_path']) == record['source_sha256']
    a, b = Image.open(original).convert('RGB'), Image.open(frame).convert('RGB')
    mask = Image.new('L', a.size)
    draw = ImageDraw.Draw(mask)
    for decision in record['padding_decisions']:
        assert decision['action'] in ('fitted', 'retained')
        if decision['action'] == 'fitted':
            assert decision['paddingPx'] == 28
            for box in (decision['old'], decision['box']):
                draw.rectangle((box['x'] - 4, box['y'] - 4, box['x'] + box['width'] + 4,
                                box['y'] + box['height'] + 4), fill=255)
    assert ImageChops.difference(a, Image.composite(a, b, mask)).getbbox() is None
    if scene == 'L07-07':
        assert sha(original) == sha(frame), 'protected worksheet changed'
    clips = []
    for layout in ('desktop', 'mobile'):
        clip = HERE / 'checks/lesson-order' / f'{scene}-{layout}.mp4'
        vtt = clip.with_suffix('.vtt')
        assert vtt.read_text().startswith('WEBVTT')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(clip), '-f', 'null', '-'], check=True,
                       stdout=subprocess.DEVNULL)
        clips.append({'layout': layout, 'sha256': sha(clip), 'vttSha256': sha(vtt)})
    rows.append({'scene': scene, 'frameSha256': sha(frame),
                 'fittedPanels': sum(d['action'] == 'fitted' for d in record['padding_decisions']),
                 'clips': clips})

receipt = {'status': 'review_only_unbound', 'sourceVideoSha256': source['currentVideo']['sha256'],
           'sourceCaptionSha256': source['currentCaption']['sha256'],
           'routeFrameReceiptSha256': sha(STUDY / 'frame-receipt.json'),
           'routeClipReceiptSha256': sha(STUDY / 'clip-receipt.json'),
           'routeClips': clip_receipt['clips'], 'otherScenes': rows,
           'limits': 'Candidate review page and corrected-stack source route were checked separately; candidate is not learner-bound.'}
(HERE / 'l07-resume-checkpoint-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'PASS L07-05 intact plate/two clips and {len(rows)} adjacent scenes/{sum(len(r["clips"]) for r in rows)} clips')
