"""Render unbound L10-03 clips from mapped audio/VTT and complete Stage/Execute plate."""

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent / 'l10-03-ladder-study'
START, DURATION = 69.00, 29.90


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


frames = json.loads((OUT / 'frame-receipt.json').read_text())
assert frames['status'] == 'review_only_unbound'
for frame in frames['frames']:
    assert sha(ROOT / frame['path']) == frame['sha256']
record = next(row for row in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if row['lessonId'] == 'L10')
video, captions = ROOT / record['currentVideo']['path'], ROOT / record['currentCaption']['path']
assert sha(video) == record['currentVideo']['sha256'] == '65936cf362e2299d70f9fea807102cbc3813dec491b4805d51d0ddaecd59a762'
assert sha(captions) == record['currentCaption']['sha256'] == 'e54bdfb260e186474ec496a72e2031716a8ddab89594eff6fdc940f1e35df1b8'
vtt = OUT / 'L10-03-source-trim.vtt'
run('python3', str(ROOT / 'docs/agentified-distribution-readiness/phase-3b/trim_vtt.py'), str(captions), str(vtt), str(START), str(DURATION))
assert vtt.read_text().count(' --> ') == 7

timelines = {'desktop': [(ROOT / 'agentified/workshop/phase-3b-review/text-panel-padding/l06-03-responsive-study/overview-wide.png', 29.90)],
             'mobile': [(ROOT / 'agentified/workshop/phase-3b-review/text-panel-padding/l06-03-responsive-study/overview-wide.png', 1.60),
                        (ROOT / 'agentified/workshop/phase-3b-review/text-panel-padding/l06-03-responsive-study/focus-02-recommend.png', 9.08),
                        (ROOT / 'agentified/workshop/phase-3b-review/text-panel-padding/l06-03-responsive-study/focus-05-execute.png', 19.22)]}
clips = []
for layout, timeline in timelines.items():
    assert abs(sum(duration for _, duration in timeline) - DURATION) < .000001
    concat = OUT / f'L10-03-{layout}-timeline.txt'
    lines = []
    for frame, duration in timeline:
        lines.extend((f"file '{frame}'", f'duration {duration:.3f}'))
    lines.append(f"file '{timeline[-1][0]}'")
    concat.write_text('\n'.join(lines) + '\n')
    width, height = (1280, 720) if layout == 'desktop' else (780, 438)
    output = OUT / f'L10-03-{layout}-review.mp4'
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

receipt = {'status': 'review_only_unbound', 'scene': 'L10-03',
           'paddingHead': '83b4a03af', 'captionHead': 'af647b6adc101cafade371d5ca53047670d53213',
           'playerHead': '7bb6267c9fb98172679e161aafa208dfc7a276c3',
           'lessonStartSeconds': START, 'durationSeconds': DURATION,
           'sourceVideoSha256': record['currentVideo']['sha256'],
           'sourceCaptionSha256': record['currentCaption']['sha256'],
           'trimmedCaptionSha256': sha(vtt), 'frameReceiptSha256': sha(OUT / 'frame-receipt.json'),
           'clips': clips}
(OUT / 'clip-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered two L10-03 complete-ladder review clips')
