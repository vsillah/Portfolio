"""Build an unbound L06-01 mobile layout clip from the exact mapped lesson source."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
source_map = json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())
record = next(item for item in source_map['records'] if item['lessonId'] == 'L06')
video = ROOT / record['currentVideo']['path']
caption = ROOT / record['currentCaption']['path']
panel_only = '--panel-only' in sys.argv
suffix = 'mobile-panel-only' if panel_only else 'mobile-controls-clear'
frame = HERE / 'frames/illustrated' / f'L06-01-{suffix}.png'
candidate = json.loads((HERE / f'l06-01-{suffix}-candidate.json').read_text())
assert sha(video) == record['currentVideo']['sha256']
assert sha(caption) == record['currentCaption']['sha256']
assert sha(frame) == candidate['outputSha256']
out = HERE / 'checks/lesson-order'
out.mkdir(parents=True, exist_ok=True)
stem = out / f'L06-01-{suffix}'
duration = 28.639
presenter_end = 13.64
subprocess.run(['python3', str(ROOT / 'docs/agentified-distribution-readiness/phase-3b/trim_vtt.py'),
                str(caption), str(stem) + '.vtt', '0', str(duration)], check=True)
filter_complex = (f'[0:v][1:v]overlay=0:0:enable=gte(t\\,{presenter_end}),scale=1280:720,format=yuv420p[v]'
                  if panel_only else
                  '[0:v]crop=768:432:1048:326,scale=704:396:flags=lanczos[presenter];'
                  f'[1:v][presenter]overlay=1060:190:enable=lt(t\\,{presenter_end}),scale=1280:720,format=yuv420p[v]')
subprocess.run([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(video),
    '-loop', '1', '-framerate', '25', '-i', str(frame), '-i', str(stem) + '.vtt',
    '-t', str(duration), '-filter_complex', filter_complex,
    '-map', '[v]', '-map', '0:a:0', '-map', '2:0', '-c:v', 'libx264',
    '-preset', 'veryfast', '-crf', '20', '-r', '25', '-c:a', 'aac', '-b:a', '192k',
    '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default',
    '-movflags', '+faststart', str(stem) + '.mp4'
], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(stem) + '.mp4', '-f', 'null', '-'], check=True)
print(json.dumps({'sourceVideoSha256': sha(video), 'sourceCaptionSha256': sha(caption),
                  'frameSha256': sha(frame), 'clipSha256': sha(stem.with_suffix('.mp4')),
                  'vttSha256': sha(stem.with_suffix('.vtt')), 'durationSeconds': duration,
                  'presenterWindowSeconds': [0, presenter_end],
                  'presenterSourceRect': [1048, 326, 768, 432],
                  'presenterCandidateRect': [1048, 326, 768, 432] if panel_only else [1060, 190, 704, 396]}))
