"""Verify the review-only L16-04 mobile legibility revision and source binding."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
STUDY = HERE / 'l16-04-audit-study'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = next(row for row in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if row['lessonId'] == 'L16')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256']
frames = json.loads((STUDY / 'frame-receipt.json').read_text())
clips = json.loads((STUDY / 'clip-receipt.json').read_text())
assert frames['status'] == clips['status'] == 'review_only_unbound'
assert frames['scene'] == clips['scene'] == 'L16-04'
assert frames['approvedPlateSha256'] == sha(ROOT / frames['approvedPlatePath'])
assert clips['sourceVideoSha256'] == source['currentVideo']['sha256']
assert clips['sourceCaptionSha256'] == source['currentCaption']['sha256']
assert clips['captionHead'] == 'af647b6adc101cafade371d5ca53047670d53213'
assert clips['playerHead'] == '7bb6267c9fb98172679e161aafa208dfc7a276c3'
assert clips['durationSeconds'] == 28.0 and clips['lessonStartSeconds'] == 89.0
assert sha(STUDY / 'L16-04-source-trim.vtt') == clips['trimmedCaptionSha256']
assert (STUDY / 'L16-04-source-trim.vtt').read_text().count(' --> ') == 8
plate = Image.open(ROOT / frames['approvedPlatePath']).convert('RGB')
assert len(frames['frames']) == 5
for row in frames['frames']:
    path = ROOT / row['path']
    assert sha(path) == row['sha256']
    assert sha(ROOT / row['mobilePreviewPath']) == row['mobilePreviewSha256']
    box = row['geometry']['completePlatePx']
    if box:
        x, y, w, h = box
        image = Image.open(path).convert('RGB')
        assert ImageChops.difference(image.crop((x, y, x + w, y + h)),
                                     plate.resize((w, h), Image.Resampling.LANCZOS)).getbbox() is None
assert [row['kind'] for row in frames['frames'][2:]] == ['mobile_roles', 'mobile_prohibitions', 'mobile_hold']
assert len(clips['clips']) == 2
for row in clips['clips']:
    path = ROOT / row['path']
    assert sha(path) == row['sha256']
    assert abs(sum(item['durationSeconds'] for item in row['timeline']) - 28.0) < .000001
    assert len(row['timeline']) == (4 if row['layout'] == 'mobile' else 2)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'],
                   check=True, stdout=subprocess.DEVNULL)
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                                                'format=duration:stream=codec_type,width,height,nb_frames',
                                                '-of', 'json', str(path)]))
    assert abs(float(probe['format']['duration']) - 28.0) < .1
    video = next(item for item in probe['streams'] if item['codec_type'] == 'video')
    assert int(video['nb_frames']) == 700
assert next(row for row in clips['clips'] if row['layout'] == 'desktop')['sha256'] == '5e938af3c7a9d59ac8c552ae47d4b9c93cbbb7443b760da4bf1824041a7f10cc'
print('PASS L16-04 complete plate, timed readable mobile cards, source captions, and two decoded 28-second clips')
