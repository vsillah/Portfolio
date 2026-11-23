"""Render one review-only scene clip with exact source audio and caption words."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
scene_id = sys.argv[1]
layout = sys.argv[2]
assert layout in ('desktop', 'mobile')
lesson = scene_id[:3]
source_map = json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())
record = next(record for record in source_map['records'] if record['lessonId'] == lesson)
composites = json.loads((ROOT / 'agentified/workshop/presentation-illustration-audit/composite-receipts.json').read_text())
composite = next(item for item in composites['composites'] if item['lesson_id'] == lesson)
scene = next(item for item in composite['scene_boundaries'] if item['scene_id'] == scene_id)
duration = min(8, scene['end_seconds'] - scene['start_seconds'] - 0.1)
assert duration > 0
start = (scene['start_seconds'] + scene['end_seconds'] - duration) / 2
if scene_id == 'L01-08':
    start = scene['start_seconds'] + 4  # Review the lesson art before its protected end screen.
if scene_id == 'L05-01':
    start = 12.5  # Review the scene after the protected native presenter opening.
if scene_id == 'L05-07':
    start = scene['start_seconds'] + 10  # Review the worksheet before the protected countdown.
if scene_id == 'L05-08':
    start = scene['start_seconds'] + 0.2  # Review the file before the protected presenter ending.
if any(start < right and start + duration > left for left, right, _ in composite['protected_windows']):
    # Choose the longest scene-local unprotected interval, with a boundary margin.
    windows = sorted((max(scene['start_seconds'], left), min(scene['end_seconds'], right))
                     for left, right, _ in composite['protected_windows']
                     if left < scene['end_seconds'] and right > scene['start_seconds'])
    gaps, cursor = [], scene['start_seconds']
    for left, right in windows:
        if left > cursor:
            gaps.append((cursor, left))
        cursor = max(cursor, right)
    if cursor < scene['end_seconds']:
        gaps.append((cursor, scene['end_seconds']))
    left, right = max(gaps, key=lambda gap: gap[1] - gap[0])
    duration = min(duration, right - left - 0.2)
    assert duration > 0, f'{scene_id}: no safe review interval'
    start = left + 0.1 + (right - left - 0.2 - duration) / 2
assert start >= scene['start_seconds'] and start + duration <= scene['end_seconds']
for left, right, kind in composite['protected_windows']:
    assert start + duration <= left or start >= right, f'{scene_id}: overlaps protected {kind}'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
video = ROOT / record['currentVideo']['path']
vtt = ROOT / record['currentCaption']['path']
frame = HERE / 'frames/illustrated' / f'{scene_id}.png'
assert sha(video) == record['currentVideo']['sha256']
assert sha(vtt) == record['currentCaption']['sha256']
assert frame.exists()
out = HERE / 'checks/lesson-order'
out.mkdir(parents=True, exist_ok=True)
stem = out / f'{scene_id}-{layout}'
subprocess.run(['python3', str(ROOT / 'docs/agentified-distribution-readiness/phase-3b/trim_vtt.py'),
                str(vtt), str(stem) + '.vtt', str(start), str(duration)], check=True)
trimmed_vtt = stem.with_suffix('.vtt')
if trimmed_vtt.read_text().strip() == 'WEBVTT':
    trimmed_vtt.write_text('WEBVTT\n')
scale = 'scale=1280:720' if layout == 'desktop' else 'scale=390:219,pad=390:844:0:312:color=0x071b2a'
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', str(start), '-i', str(video),
                '-loop', '1', '-framerate', '25', '-i', str(frame), '-i', str(stem) + '.vtt', '-t', str(duration),
                '-filter_complex', f'[1:v]{scale},format=yuv420p[v]', '-map', '[v]', '-map', '0:a:0', '-map', '2:0',
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '25', '-c:a', 'aac', '-b:a', '192k',
                '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default',
                '-movflags', '+faststart', str(stem) + '.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(stem) + '.mp4', '-f', 'null', '-'], check=True)
print(json.dumps({'sceneId': scene_id, 'layout': layout, 'lessonStartSeconds': start,
                  'durationSeconds': duration,
                  'videoSha256': sha(stem.with_suffix('.mp4')),
                  'sourceVideoSha256': record['currentVideo']['sha256'],
                  'sourceCaptionSha256': record['currentCaption']['sha256']}))
