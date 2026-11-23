"""Verify the first lesson-order padding candidate and preserve its caption STOP."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
audit = json.loads((HERE / 'audit-receipt.json').read_text())
candidate = json.loads((HERE / 'candidate-receipt-L01-02.json').read_text())
source_map = json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())
source = next(item for item in source_map['records'] if item['lessonId'] == 'L01')
binding = audit['crossPrCaptionClearance']
assert binding['pr'] == 1293 and binding['head'] == 'c746b96d6076d20f0e605be4ffc7aee7b36b9ddc'
assert candidate['baseAuditSha256'] == sha(HERE / 'audit-receipt.json')
assert candidate['status'] == 'review_only_unbound' and candidate['selectedScenes'] == ['L01-02']
row = candidate['frames'][0]
assert row['scene_id'] == 'L01-02' and row['review_only_unbound']
before = ROOT / 'agentified/workshop/presentation-illustration-audit/frames/illustrated/L01-02.png'
after = ROOT / row['frame_path']
assert sha(before) == row['original_frame_sha256'] and sha(after) == row['frame_sha256']
old = Image.open(before).convert('RGB')
new = Image.open(after).convert('RGB')
diff = ImageChops.difference(old, new)
mask = Image.new('L', old.size, 255)
draw = ImageDraw.Draw(mask)
for item in row['padding_decisions']:
    a, b, glyph = item['old'], item['box'], item['glyph']
    assert item['action'] == 'fitted' and item['paddingPx'] == 28
    assert b['width'] == glyph['width'] + 56 and b['height'] == glyph['height'] + 56
    draw.rectangle((min(a['x'], b['x']) - 3, min(a['y'], b['y']) - 3,
                    max(a['x'] + a['width'], b['x'] + b['width']) + 3,
                    max(a['y'] + a['height'], b['y'] + b['height']) + 3), fill=0)
assert ImageChops.multiply(diff.convert('L'), mask).getbbox() is None
for key in ('currentVideo', 'currentCaption'):
    assert sha(ROOT / source[key]['path']) == source[key]['sha256']

clips = []
for layout, dimensions in [('desktop', (1280, 720)), ('mobile', (390, 844))]:
    path = HERE / f'checks/lesson-order/L01-02-{layout}.mp4'
    vtt = HERE / f'checks/lesson-order/L01-02-{layout}.vtt'
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration',
        '-of', 'json', str(path)]))
    video = next(item for item in probe['streams'] if item['codec_type'] == 'video')
    assert (video['width'], video['height']) == dimensions
    assert abs(float(probe['format']['duration']) - 8) < 0.01
    assert 'WEBVTT' in vtt.read_text()
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'],
                   stdout=subprocess.DEVNULL, check=True)
    clips.append({'layout': layout, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                  'vttPath': str(vtt.relative_to(ROOT)), 'vttSha256': sha(vtt),
                  'dimensionsPx': list(dimensions), 'durationSeconds': 8, 'decode': 'pass'})

screen = HERE / 'checks/lesson-order/L01-02-desktop-caption-on-stop.png'
assert screen.exists()
receipt = {'schemaVersion': 1, 'status': 'STOP: L01-02 native desktop cue covers Prepare one brief',
           'paddingBasePr': 1290, 'paddingBaseCommit': '519918b9df23ae012d5c20c700ffb8a696775afb',
           'crossPrCaptionClearance': binding, 'candidateFrameSha256': sha(after),
           'changedPixelBounds': list(diff.getbbox()), 'outsidePanelPixelsIdentical': True,
           'sourceVideoSha256': source['currentVideo']['sha256'],
           'sourceCaptionSha256': source['currentCaption']['sha256'], 'clips': clips,
           'browserEvidence': {'path': str(screen.relative_to(ROOT)), 'sha256': sha(screen),
                               'lessonTimeSecondsApprox': 52},
           'boundary': 'Review-only unbound; no learner media or approved frame replaced; no later lesson qualified.'}
(HERE / 'lesson-order-stop-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('TECHNICAL PASS; VISUAL STOP: L01-02 desktop native caption covers teaching label')
