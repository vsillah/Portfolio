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
start = (scene['start_seconds'] + scene['end_seconds']) / 2 - 4
assert start >= scene['start_seconds'] and start + 8 <= scene['end_seconds']
for left, right, kind in composite['protected_windows']:
    assert start + 8 <= left or start >= right, f'{scene_id}: overlaps protected {kind}'
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
                str(vtt), str(stem) + '.vtt', str(start), '8'], check=True)
scale = 'scale=1280:720' if layout == 'desktop' else 'scale=390:219,pad=390:844:0:312:color=0x071b2a'
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', str(start), '-i', str(video),
                '-loop', '1', '-framerate', '25', '-i', str(frame), '-i', str(stem) + '.vtt', '-t', '8',
                '-filter_complex', f'[1:v]{scale},format=yuv420p[v]', '-map', '[v]', '-map', '0:a:0', '-map', '2:0',
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '25', '-c:a', 'aac', '-b:a', '192k',
                '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default',
                '-movflags', '+faststart', str(stem) + '.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(stem) + '.mp4', '-f', 'null', '-'], check=True)
print(json.dumps({'sceneId': scene_id, 'layout': layout, 'lessonStartSeconds': start,
                  'videoSha256': sha(stem.with_suffix('.mp4')),
                  'sourceVideoSha256': record['currentVideo']['sha256'],
                  'sourceCaptionSha256': record['currentCaption']['sha256']}))
