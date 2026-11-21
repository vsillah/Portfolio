"""Bind the next lesson-order padding checkpoint to its first caption collision."""

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
clips = []
frames = []

for scene in ('L01-03', 'L01-04'):
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
    frames.append({'sceneId': scene, 'candidateFrameSha256': sha(after),
                   'changedPixelBounds': list(diff.getbbox()), 'outsidePanelPixelsIdentical': True})
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

for key in ('currentVideo', 'currentCaption'):
    assert sha(ROOT / source[key]['path']) == source[key]['sha256']

evidence = {}
for name in ('L01-03-desktop-caption-on.png', 'L01-03-mobile-caption-on.png',
             'L01-04-desktop-caption-collision.png'):
    path = HERE / 'checks/lesson-order' / name
    assert path.exists()
    evidence[name] = {'path': str(path.relative_to(ROOT)), 'sha256': sha(path)}

receipt = {
    'schemaVersion': 1,
    'status': 'STOP: L01-04 native desktop cue covers Receipt fields and Human gate',
    'paddingBasePr': 1290,
    'paddingBaseCommit': '16f26aa19411e8303f9cdad5b6c4ad5f1d4fb824',
    'captionDependencyPr': 1293,
    'captionDependencyCommit': '5aab9acd8f464684706649566aa6b1e368188726',
    'sourceVideoSha256': source['currentVideo']['sha256'],
    'sourceCaptionSha256': source['currentCaption']['sha256'],
    'frames': frames,
    'clips': clips,
    'browserEvidence': evidence,
    'lessonTimeSecondsApprox': 128.43,
    'boundary': 'Review-only unbound; no learner media or approved frame replaced; no later lesson qualified.',
}
(HERE / 'l01-04-stop-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('TECHNICAL PASS; VISUAL STOP: L01-04 desktop native caption covers two teaching labels')
