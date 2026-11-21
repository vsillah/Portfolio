"""Render source-audio desktop/mobile review clips for L14 complete-plate studies."""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SCENE = sys.argv[1]
SPECS = {'L14-03': (52.0, 26.0, 7), 'L14-04': (78.0, 26.0, 6)}
START, DURATION, CUES = SPECS[SCENE]
OUT = Path(__file__).resolve().parent / f'{SCENE.lower()}-plate-study'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


frames = json.loads((OUT / 'frame-receipt.json').read_text())
assert frames['status'] == 'review_only_unbound' and frames['scene'] == SCENE
for frame in frames['frames']:
    assert sha(ROOT / frame['path']) == frame['sha256']
record = next(row for row in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if row['lessonId'] == 'L14')
video, captions = ROOT / record['currentVideo']['path'], ROOT / record['currentCaption']['path']
assert sha(video) == record['currentVideo']['sha256'] == 'a58c3a1cf8550d67a1f164e64008a6eeea342978264904242cb23ad5a5a1591c'
assert sha(captions) == record['currentCaption']['sha256'] == '74ce7e73e379f6b25eb3f5b67ed6771f24641d3a0f7c97114abe5e7fe9cc5446'
vtt = OUT / f'{SCENE}-source-trim.vtt'
run('python3', str(ROOT / 'docs/agentified-distribution-readiness/phase-3b/trim_vtt.py'), str(captions), str(vtt), str(START), str(DURATION))
assert vtt.read_text().count(' --> ') == CUES

clips = []
for layout in ('desktop', 'mobile'):
    timeline = [(OUT / 'overview-wide.png', 1.60), (OUT / 'focus.png', 24.40)]
    concat = OUT / f'{SCENE}-{layout}-timeline.txt'
    lines = []
    for frame, duration in timeline:
        lines.extend((f"file '{frame}'", f'duration {duration:.3f}'))
    lines.append(f"file '{timeline[-1][0]}'")
    concat.write_text('\n'.join(lines) + '\n')
    width, height = (1280, 720) if layout == 'desktop' else (780, 438)
    output = OUT / f'{SCENE}-{layout}-review.mp4'
    run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat),
        '-ss', str(START), '-t', str(DURATION), '-i', str(video), '-i', str(vtt), '-t', str(DURATION),
        '-map', '0:v:0', '-map', '1:a:0', '-map', '2:0',
        '-vf', f'fps=25,scale={width}:{height}:flags=lanczos,format=yuv420p',
        '-r', '25', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
        '-c:a', 'aac', '-b:a', '192k', '-c:s', 'mov_text',
        '-metadata:s:s:0', 'language=eng', '-disposition:s:0', 'default',
        '-movflags', '+faststart', str(output))
    run('ffmpeg', '-v', 'error', '-i', str(output), '-f', 'null', '-')
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                                                'format=duration:stream=codec_type,width,height,nb_frames',
                                                '-of', 'json', str(output)]))
    clips.append({'layout': layout, 'path': str(output.relative_to(ROOT)), 'sha256': sha(output),
                  'timeline': [{'frame': str(path.relative_to(ROOT)), 'durationSeconds': duration}
                               for path, duration in timeline], 'probe': probe})

receipt = {'status': 'review_only_unbound', 'scene': SCENE,
           'paddingHead': '919a56134', 'captionHead': 'af647b6adc101cafade371d5ca53047670d53213',
           'playerHead': '7bb6267c9fb98172679e161aafa208dfc7a276c3',
           'lessonStartSeconds': START, 'durationSeconds': DURATION,
           'sourceVideoSha256': record['currentVideo']['sha256'],
           'sourceCaptionSha256': record['currentCaption']['sha256'],
           'trimmedCaptionSha256': sha(vtt), 'frameReceiptSha256': sha(OUT / 'frame-receipt.json'),
           'clips': clips}
(OUT / 'clip-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'Rendered two {SCENE} complete-plate review clips')
