"""Verify L01-06/07 review candidates and the L01-08 protected-window stop."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
source_map = json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())
source = next(row for row in source_map['records'] if row['lessonId'] == 'L01')
composites = json.loads((ROOT / 'agentified/workshop/presentation-illustration-audit/composite-receipts.json').read_text())
composite = next(row for row in composites['composites'] if row['lesson_id'] == 'L01')
for key in ('currentVideo', 'currentCaption'):
    assert sha(ROOT / source[key]['path']) == source[key]['sha256']

frames = []
for scene in ('L01-06', 'L01-07', 'L01-08'):
    candidate = json.loads((HERE / f'candidate-receipt-{scene}.json').read_text())
    assert candidate['status'] == 'review_only_unbound' and candidate['selectedScenes'] == [scene]
    assert candidate['baseAuditSha256'] == sha(HERE / 'audit-receipt.json')
    row = candidate['frames'][0]
    before = ROOT / f'agentified/workshop/presentation-illustration-audit/frames/illustrated/{scene}.png'
    after = ROOT / row['frame_path']
    assert row['scene_id'] == scene and row['review_only_unbound']
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
    bounds = diff.getbbox()
    frames.append({'sceneId': scene, 'candidateFrameSha256': sha(after),
                   'changedPixelBounds': list(bounds) if bounds else None,
                   'outsidePanelPixelsIdentical': True})

clips = []
for scene in ('L01-06', 'L01-07'):
    for layout, dimensions in (('desktop', (1280, 720)), ('mobile', (390, 844))):
        path = HERE / f'checks/lesson-order/{scene}-{layout}.mp4'
        vtt = path.with_suffix('.vtt')
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
            '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', str(path)]))
        video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
        assert (video['width'], video['height']) == dimensions
        assert abs(float(probe['format']['duration']) - 8) < 0.01
        assert 'WEBVTT' in vtt.read_text()
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'],
                       stdout=subprocess.DEVNULL, check=True)
        clips.append({'sceneId': scene, 'layout': layout, 'path': str(path.relative_to(ROOT)),
                      'sha256': sha(path), 'vttPath': str(vtt.relative_to(ROOT)),
                      'vttSha256': sha(vtt), 'dimensionsPx': list(dimensions),
                      'durationSeconds': 8, 'decode': 'pass'})

scene = next(row for row in composite['scene_boundaries'] if row['scene_id'] == 'L01-08')
start = (scene['start_seconds'] + scene['end_seconds']) / 2 - 4
end = start + 8
protected = next((left, right, kind) for left, right, kind in composite['protected_windows']
                 if start < right and end > left)
assert protected[2] == 'approved branded end screen'
screens = {}
for layout in ('desktop', 'mobile'):
    path = HERE / f'checks/lesson-order/L01-06-{layout}-caption-on.png'
    assert path.exists()
    screens[layout] = {'path': str(path.relative_to(ROOT)), 'sha256': sha(path)}
receipt = {
    'schemaVersion': 1,
    'status': 'STOP: L01-08 midpoint context overlaps protected approved branded end screen',
    'paddingBasePr': 1290,
    'paddingBaseCommit': 'ff17e8a0e4ad6e38f2bfa62376fd8d63e2940496',
    'captionDependencyPr': 1293,
    'captionDependencyCommit': '77eb44c6232bf1095e267a24fcf6c6ec52aeaf00',
    'sourceVideoSha256': source['currentVideo']['sha256'],
    'sourceCaptionSha256': source['currentCaption']['sha256'],
    'frames': frames,
    'clips': clips,
    'browserEvidence': screens,
    'unqualified': ['L01-06 candidate caption-off, Aa, theme, and control-interaction states',
                    'L01-07 whole-scene context', 'L01-08 context and later scenes'],
    'failedCheck': {
        'command': 'python3 agentified/workshop/phase-3b-review/text-panel-padding/render-scene-context.py L01-08 desktop',
        'assertion': 'L01-08: overlaps protected approved branded end screen',
        'candidateWindowSeconds': [start, end],
        'protectedWindowSeconds': [protected[0], protected[1]],
        'protectedKind': protected[2],
        'mobileSameFailure': True,
    },
    'boundary': 'Review-only unbound; no L01-08 clip, learner media, or approved frame replaced; no later scene qualified.',
}
(HERE / 'l01-08-stop-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('TECHNICAL PASS L01-06/07; PROTECTED-WINDOW STOP L01-08')
