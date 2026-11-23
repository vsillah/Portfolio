"""Render unbound L07-05 review clips with exact source audio and VTT words."""

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'l07-05-route-study'
START, DURATION = 127.108, 26.371


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


frame_receipt = json.loads((OUT / 'frame-receipt.json').read_text())
assert frame_receipt['status'] == 'review_only_unbound'
for frame in frame_receipt['frames']:
    assert sha(ROOT / frame['path']) == frame['sha256']

source_map = json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())
record = next(item for item in source_map['records'] if item['lessonId'] == 'L07')
video = ROOT / record['currentVideo']['path']
captions = ROOT / record['currentCaption']['path']
assert sha(video) == record['currentVideo']['sha256'] == '42782f17a49cc35e3e01be1f29f7de18d13ee5406004a84da7e9602aa06f2f55'
assert sha(captions) == record['currentCaption']['sha256'] == '984fa64e556279730d30a602b3ce160620822ef0577a7ff6cf7de7028e3f8f21'
vtt = OUT / 'L07-05-source-trim.vtt'
run('python3', str(ROOT / 'docs/agentified-distribution-readiness/phase-3b/trim_vtt.py'), str(captions), str(vtt), str(START), str(DURATION))
assert vtt.read_text().count(' --> ') == 8

overview = OUT / 'l07-05-overview.png'
focus = OUT / 'l07-05-route-focus.png'
timelines = {'desktop': [(focus, DURATION)], 'mobile': [(overview, 1.5), (focus, DURATION - 1.5)]}
clips = []
for layout, timeline in timelines.items():
    concat = OUT / f'L07-05-{layout}-timeline.txt'
    lines = []
    for frame, duration in timeline:
        lines.extend((f"file '{frame}'", f'duration {duration:.3f}'))
    lines.append(f"file '{timeline[-1][0]}'")
    concat.write_text('\n'.join(lines) + '\n')
    width, height = (1280, 720) if layout == 'desktop' else (780, 438)
    output = OUT / f'L07-05-{layout}-review.mp4'
    run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', str(concat),
        '-ss', str(START), '-t', str(DURATION), '-i', str(video),
        '-i', str(vtt), '-t', str(DURATION),
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

receipt = {'status': 'review_only_unbound', 'scene': 'L07-05',
           'paddingHead': '241822880bb3343e00e47c0f6218730bee7fa6b2',
           'captionHead': 'af647b6adc101cafade371d5ca53047670d53213',
           'playerHead': '7bb6267c9fb98172679e161aafa208dfc7a276c3',
           'lessonStartSeconds': START, 'durationSeconds': DURATION,
           'sourceVideoSha256': record['currentVideo']['sha256'],
           'sourceCaptionSha256': record['currentCaption']['sha256'],
           'trimmedCaptionSha256': sha(vtt), 'frameReceiptSha256': sha(OUT / 'frame-receipt.json'),
           'clips': clips}
(OUT / 'clip-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered two L07-05 full-plate review clips')
