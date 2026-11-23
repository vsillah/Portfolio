"""Verify the L09-01 candidate and the L09-02 meaning stop source bindings."""

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
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256'] == '998a5ccc01d9a599025e27f035a72fe9b5104d98b69ce17bd12de5f6436a4dd6'
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256'] == '68371ffd0a983e3f599be63acb57851bd96dd9bceebc574516db86680c093f3d'
briefs = json.loads((ROOT / 'agentified/workshop/presentation-illustration-audit/semantic-briefs.json').read_text())['scenes']
brief = next(row for row in briefs if row['scene_id'] == 'L09-02')
plate = brief['approved_plate']
assert plate['crop_source_px'] == [950, 300, 2100, 1500]
assert sha(ROOT / plate['path']) == plate['sha256'] == 'fc3621b103f102664c5a455adade3e6df5dbbbf19d49d9491e1f0ccea35c0ed1'
assert Image.open(ROOT / plate['path']).size == (4000, 2500)
vtt = (ROOT / source['currentCaption']['path']).read_text()
assert 'seven rungs: activity, output, quality, behavior, outcome, learning, and authority' in vtt
assert 'A count of briefs belongs low on the ladder' in vtt

first = json.loads((HERE / 'candidate-receipt-L09-01.json').read_text())['frames'][0]
original = ROOT / 'agentified/workshop/presentation-illustration-audit/frames/illustrated/L09-01.png'
candidate = ROOT / first['frame_path']
assert sha(original) == first['original_frame_sha256'] and sha(candidate) == first['frame_sha256']
a, b = Image.open(original).convert('RGB'), Image.open(candidate).convert('RGB')
mask = Image.new('L', a.size)
draw = ImageDraw.Draw(mask)
for decision in first['padding_decisions']:
    assert decision['action'] in ('fitted', 'retained')
    if decision['action'] == 'fitted':
        assert decision['paddingPx'] == 28
        for box in (decision['old'], decision['box']):
            draw.rectangle((box['x'] - 4, box['y'] - 4, box['x'] + box['width'] + 4,
                            box['y'] + box['height'] + 4), fill=255)
assert ImageChops.difference(a, Image.composite(a, b, mask)).getbbox() is None
clips = []
for layout in ('desktop', 'mobile'):
    clip = HERE / 'checks/lesson-order' / f'L09-01-{layout}.mp4'
    vtt_path = clip.with_suffix('.vtt')
    assert vtt_path.read_text().startswith('WEBVTT')
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(clip), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
    clips.append({'layout': layout, 'sha256': sha(clip), 'vttSha256': sha(vtt_path)})

rejected = json.loads((HERE / 'candidate-receipt-L09-02.json').read_text())['frames'][0]
assert rejected['source_path'] == plate['path'] and rejected['source_sha256'] == plate['sha256']
assert sha(ROOT / rejected['frame_path']) == rejected['frame_sha256']
receipt = {'status': 'stop_new_failure_class_source_narration_mismatch', 'firstQualifiedScene': 'L09-01',
           'firstQualifiedFrameSha256': first['frame_sha256'], 'firstQualifiedClips': clips,
           'stoppedScene': 'L09-02', 'sceneStartSeconds': 31.82, 'sceneEndSeconds': 69.72,
           'sourceVideoSha256': source['currentVideo']['sha256'], 'sourceCaptionSha256': source['currentCaption']['sha256'],
           'approvedPlatePath': plate['path'], 'approvedPlateSha256': plate['sha256'],
           'rejectedCropSourcePx': plate['crop_source_px'], 'rejectedCandidateFrameSha256': rejected['frame_sha256'],
           'reason': 'Approved SAM trust-layer plate has three sections and no narrated seven-rung metrics ladder; uncropping alone cannot teach the stated relationship.',
           'nextGate': 'Source illustration owner selects exact L09-02 visual treatment; resume full desktop/mobile route qualification after decision.',
           'unqualifiedScenes': [f'L09-{n:02}' for n in range(2, 9)]}
(HERE / 'l09-02-stop-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('PASS L09-01 frame/two clips; STOP L09-02 approved source-to-narration mismatch')
