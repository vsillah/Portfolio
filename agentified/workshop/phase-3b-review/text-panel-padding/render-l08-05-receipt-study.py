"""Render unbound L08-05 review clips with mapped source audio and VTT."""

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = HERE / 'l08-05-receipt-study'
START, DURATION = 125.431, 35.793


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


frame_receipt = json.loads((OUT / 'frame-receipt.json').read_text())
assert frame_receipt['status'] == 'review_only_unbound'
for frame in frame_receipt['frames']:
    assert sha(ROOT / frame['path']) == frame['sha256']
record = next(item for item in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if item['lessonId'] == 'L08')
video, captions = ROOT / record['currentVideo']['path'], ROOT / record['currentCaption']['path']
assert sha(video) == record['currentVideo']['sha256'] == '5ea78c3647a901be84eddc1647185fcbea7178d79a5588befb467f92d20c93bd'
assert sha(captions) == record['currentCaption']['sha256'] == '25261c89f43785ba30239c37d1c1e17e9a484614efd20a241e25ab0554c92011'
vtt = OUT / 'L08-05-source-trim.vtt'
run('python3', str(ROOT / 'docs/agentified-distribution-readiness/phase-3b/trim_vtt.py'), str(captions), str(vtt), str(START), str(DURATION))
assert vtt.read_text().count(' --> ') == 7

overview = OUT / 'overview-wide.png'
timelines = {'desktop': [(overview, DURATION)], 'mobile': [
    (overview, 1.600), (OUT / 'focus-a.png', 9.603), (OUT / 'focus-b.png', 6.144),
    (OUT / 'focus-c.png', 6.968), (OUT / 'focus-final.png', 11.478)]}
clips = []
for layout, timeline in timelines.items():
    assert abs(sum(duration for _, duration in timeline) - DURATION) < .000001
    concat = OUT / f'L08-05-{layout}-timeline.txt'
    lines = []
    for frame, duration in timeline:
        lines.extend((f"file '{frame}'", f'duration {duration:.3f}'))
    lines.append(f"file '{timeline[-1][0]}'")
    concat.write_text('\n'.join(lines) + '\n')
    width, height = (1280, 720) if layout == 'desktop' else (780, 438)
    output = OUT / f'L08-05-{layout}-review.mp4'
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

receipt = {'status': 'review_only_unbound', 'scene': 'L08-05',
           'paddingHead': '6a7f8aa00', 'captionHead': 'af647b6adc101cafade371d5ca53047670d53213',
           'playerHead': '7bb6267c9fb98172679e161aafa208dfc7a276c3',
           'lessonStartSeconds': START, 'durationSeconds': DURATION,
           'sourceVideoSha256': record['currentVideo']['sha256'],
           'sourceCaptionSha256': record['currentCaption']['sha256'],
           'trimmedCaptionSha256': sha(vtt), 'frameReceiptSha256': sha(OUT / 'frame-receipt.json'),
           'clips': clips}
(OUT / 'clip-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('Rendered two L08-05 complete-plate review clips')
