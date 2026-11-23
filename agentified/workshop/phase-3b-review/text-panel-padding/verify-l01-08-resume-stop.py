"""Bind the safe L01-08 QA sample and its caption-over-card visual stop."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
scene_id = 'L01-08'
candidate = json.loads((HERE / f'candidate-receipt-{scene_id}.json').read_text())
source_map = json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())
source = next(row for row in source_map['records'] if row['lessonId'] == 'L01')
composites = json.loads((ROOT / 'agentified/workshop/presentation-illustration-audit/composite-receipts.json').read_text())
composite = next(row for row in composites['composites'] if row['lesson_id'] == 'L01')
scene = next(row for row in composite['scene_boundaries'] if row['scene_id'] == scene_id)
protected = next((left, right, kind) for left, right, kind in composite['protected_windows']
                 if kind == 'approved branded end screen')
start = scene['start_seconds'] + 4
end = start + 8
assert scene['start_seconds'] <= start < end <= protected[0] < protected[1]
assert candidate['status'] == 'review_only_unbound' and candidate['selectedScenes'] == [scene_id]
assert candidate['baseAuditSha256'] == sha(HERE / 'audit-receipt.json')
row = candidate['frames'][0]
before = ROOT / f'agentified/workshop/presentation-illustration-audit/frames/illustrated/{scene_id}.png'
after = ROOT / row['frame_path']
assert sha(before) == row['original_frame_sha256'] and sha(after) == row['frame_sha256']
diff = ImageChops.difference(Image.open(before).convert('RGB'), Image.open(after).convert('RGB'))
mask = Image.new('L', diff.size, 255)
draw = ImageDraw.Draw(mask)
for item in row['padding_decisions']:
    old, box, glyph = item['old'], item['box'], item['glyph']
    assert item['action'] == 'fitted' and item['paddingPx'] == 28
    assert box['width'] == glyph['width'] + 56 and box['height'] == glyph['height'] + 56
    draw.rectangle((min(old['x'], box['x']) - 3, min(old['y'], box['y']) - 3,
                    max(old['x'] + old['width'], box['x'] + box['width']) + 3,
                    max(old['y'] + old['height'], box['y'] + box['height']) + 3), fill=0)
assert ImageChops.multiply(diff.convert('L'), mask).getbbox() is None
for key in ('currentVideo', 'currentCaption'):
    assert sha(ROOT / source[key]['path']) == source[key]['sha256']

clips = []
for layout, dimensions in (('desktop', (1280, 720)), ('mobile', (390, 844))):
    path = HERE / f'checks/lesson-order/{scene_id}-{layout}.mp4'
    vtt = path.with_suffix('.vtt')
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
        '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', str(path)]))
    video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
    assert (video['width'], video['height']) == dimensions
    assert abs(float(probe['format']['duration']) - 8) < 0.01
    assert 'Your stop condition is simple' in vtt.read_text()
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'],
                   stdout=subprocess.DEVNULL, check=True)
    clips.append({'layout': layout, 'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                  'vttPath': str(vtt.relative_to(ROOT)), 'vttSha256': sha(vtt),
                  'dimensionsPx': list(dimensions), 'durationSeconds': 8, 'decode': 'pass'})

screens = {}
for name in ('L01-08-desktop-paused-caption-collision.png', 'L01-08-desktop-caption-off.png',
             'L01-08-mobile-paused-caption-on.png', 'L01-08-mobile-paused-caption-off.png'):
    path = HERE / 'checks/lesson-order' / name
    assert path.exists()
    screens[name] = {'path': str(path.relative_to(ROOT)), 'sha256': sha(path)}
receipt = {
    'schemaVersion': 1,
    'status': 'STOP: L01-08 native desktop cue crosses lower Operating File card field and bottom edge',
    'paddingBasePr': 1290,
    'paddingBaseCommit': '11f60c302d4f7bbf998be8a5d198e6600dd101aa',
    'captionDependencyPr': 1293,
    'captionDependencyCommit': '77eb44c6232bf1095e267a24fcf6c6ec52aeaf00',
    'sourceVideoSha256': source['currentVideo']['sha256'],
    'sourceCaptionSha256': source['currentCaption']['sha256'],
    'candidateFrameSha256': sha(after),
    'changedPixelBounds': list(diff.getbbox()),
    'outsidePanelPixelsIdentical': True,
    'safeSampleWindowSeconds': [start, end],
    'protectedEndScreenWindowSeconds': [protected[0], protected[1]],
    'clips': clips,
    'browserEvidence': screens,
    'visualFinding': 'At desktop paused 2.77s, native two-line cue overlaps blank lower card field and bottom edge; Workflow and Receipt labels remain legible. Mobile cue is outside the art.',
    'unqualified': ['L01-06 candidate caption-off, Aa, theme, and control-interaction matrix',
                    'L01-07 whole-scene matrix', 'L01-08 learner-route candidate matrix',
                    'L02-01 and later scenes', 'consolidated walkthrough and Human QA'],
    'boundary': 'Review-only unbound; no learner media or approved frame replaced.',
}
(HERE / 'l01-08-resume-stop-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('TECHNICAL PASS; VISUAL STOP: L01-08 desktop caption crosses lower Operating File card')
