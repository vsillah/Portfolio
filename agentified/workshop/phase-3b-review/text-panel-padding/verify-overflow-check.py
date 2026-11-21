"""Verify review-only overflow candidates and preserve the visual STOP receipt."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
AUDIT = json.loads((HERE / 'audit-receipt.json').read_text())
CANDIDATE = json.loads((HERE / 'candidate-receipt.json').read_text())
SOURCE_MAP = json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()

assert AUDIT['summary'] == {'scenes': 128, 'panels': 276, 'candidatePanels': 273, 'clippingPanels': 2}
assert CANDIDATE['baseAuditSha256'] == sha(HERE / 'audit-receipt.json')
assert CANDIDATE['status'] == 'review_only_unbound' and CANDIDATE['headlinesOnly'] is True
assert CANDIDATE['selectedScenes'] == ['L06-03', 'L10-03']
records = {record['lessonId']: record for record in SOURCE_MAP['records']}
frames = []
for row in CANDIDATE['frames']:
    scene = row['scene_id']
    assert scene in ('L06-03', 'L10-03')
    before = ROOT / f'agentified/workshop/presentation-illustration-audit/frames/illustrated/{scene}.png'
    after = ROOT / row['frame_path']
    assert sha(before) == row['original_frame_sha256']
    assert sha(after) == row['frame_sha256']
    decision = next(d for d in row['padding_decisions'] if d['kind'] == 'headline')
    assert decision['action'] == 'fitted' and decision['paddingPx'] == 28
    box, glyph, old = decision['box'], decision['glyph'], decision['old']
    assert box['width'] == glyph['width'] + 56 and box['height'] == glyph['height'] + 56
    assert box['x'] == old['x'] and box['y'] == old['y']
    original = Image.open(before).convert('RGB')
    revised = Image.open(after).convert('RGB')
    difference = ImageChops.difference(original, revised)
    safe = (min(old['x'], box['x']) - 3, min(old['y'], box['y']) - 3,
            max(old['x'] + old['width'], box['x'] + box['width']) + 3,
            max(old['y'] + old['height'], box['y'] + box['height']) + 3)
    mask = Image.new('L', original.size, 255)
    ImageDraw.Draw(mask).rectangle(safe, fill=0)
    assert ImageChops.multiply(difference.convert('L'), mask).getbbox() is None
    frames.append({'sceneId': scene, 'originalSha256': sha(before), 'candidateSha256': sha(after),
                   'oldBoxPx': old, 'fittedBoxPx': box, 'paddingPx': 28,
                   'changedPixelBounds': list(difference.getbbox()),
                   'outsideHeadlinePixelsIdentical': True})

clips = []
for lesson, scene in [('L06', 'L06-03'), ('L10', 'L10-03')]:
    record = records[lesson]
    for key in ('currentVideo', 'currentCaption'):
        asset = record[key]
        assert sha(ROOT / asset['path']) == asset['sha256']
    for layout, dimensions in [('desktop', (1280, 720)), ('mobile', (390, 844))]:
        clip = HERE / 'checks' / f'{scene}-{layout}.mp4'
        vtt = HERE / 'checks' / f'{scene}-{layout}.vtt'
        probe = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration',
            '-of', 'json', str(clip)]))
        video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
        assert (video['width'], video['height']) == dimensions
        assert abs(float(probe['format']['duration']) - 8) < 0.01
        assert 'WEBVTT' in vtt.read_text()
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(clip), '-f', 'null', '-'],
                       stdout=subprocess.DEVNULL, check=True)
        clips.append({'sceneId': scene, 'layout': layout, 'path': str(clip.relative_to(ROOT)),
                      'sha256': sha(clip), 'sourceVideoSha256': record['currentVideo']['sha256'],
                      'sourceCaptionSha256': record['currentCaption']['sha256'],
                      'durationSeconds': 8, 'dimensionsPx': list(dimensions),
                      'nativeCaptionTrack': True, 'technicalDecode': 'pass'})

screenshot = HERE / 'checks/L06-03-desktop-caption-on-stop.png'
assert screenshot.exists()
result = {'schemaVersion': 1, 'status': 'STOP: L06-03 desktop caption covers Prepare and Human gate',
          'reviewOnlyUnbound': True, 'frames': frames, 'clips': clips,
          'browserEvidence': {'path': str(screenshot.relative_to(ROOT)), 'sha256': sha(screenshot),
                              'reviewClipOffsetSeconds': 2, 'lessonTimeSecondsApprox': 77},
          'boundary': 'No approved frames or learner media replaced; no broader lesson pass or Human QA.'}
(HERE / 'context-check-receipt.json').write_text(json.dumps(result, indent=2) + '\n')
print('TECHNICAL PASS; VISUAL STOP: L06-03 caption/label collision')
