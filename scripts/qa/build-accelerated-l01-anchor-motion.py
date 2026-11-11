#!/usr/bin/env python3
"""Build a local, native-only P01→P02 presenter placement reel."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate'
SOURCE = ROOT / 'public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4'
P01 = OUT / 'p01-reflow-base.png'
P02 = OUT / 'p02-clean-base.png'
ANCHOR = OUT / 'anchor-review.json'
VIDEO = OUT / 'l01-p01-p02-anchor-motion.mp4'
FPS = 25
SEGMENTS = [
    {'id': 'P01', 'label': 'P01  /  Q3 PLAN', 'source': [24.0, 28.4], 'base': P01, 'crop_y': 260},
    {'id': 'P01_MOVED', 'label': 'P02  /  MOVED NATIVE SENTENCE', 'source': [28.4, 30.8], 'base': P02, 'crop_y': 260},
    {'id': 'P02', 'label': 'P02  /  WORKSHOP MAP', 'source': [235.0, 241.0], 'base': P02, 'crop_y': 790},
]


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def run(*args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} exited {result.returncode}: {result.stderr[-1800:]}')
    return result.stdout


def prepare():
    anchor = json.loads(ANCHOR.read_text())
    assert anchor['source_video_sha256'] == sha(SOURCE)
    assert anchor['p01_reflow_background_sha256'] == sha(P01)
    assert anchor['p02_clean_base_sha256'] == sha(P02)
    assert anchor['anchor']['source_1920x1080_xywh'] == [1420, 48, 448, 256]
    assert anchor['status'] == 'anchor_stills_only_timing_validation_stopped'
    assert sum(round((row['source'][1] - row['source'][0]) * FPS) for row in SEGMENTS) == 320
    return anchor


def make_label(path, text):
    plate = Image.new('RGB', (1280, 100), '#0c202a')
    draw = ImageDraw.Draw(plate)
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 30)
    draw.text((640, 50), text, font=font, fill='white', anchor='mm')
    plate.save(path)


def render_segment(row, path, label):
    start, end = row['source']
    duration = round(end - start, 6)
    frames = round(duration * FPS)
    graph = (
        f'[1:v]trim=duration={duration},setpts=PTS-STARTPTS,'
        f'crop=448:256:1420:{row["crop_y"]}[presenter];'
        '[0:v][presenter]overlay=1420:48:shortest=0,'
        'scale=1280:720:flags=lanczos,fps=25,pad=1280:820:0:0:color=0x0c202a[base];'
        '[base][2:v]overlay=0:720:shortest=0[v];'
        f'[1:a]atrim=duration={duration},asetpts=PTS-STARTPTS[a]'
    )
    run('ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(row['base']),
        '-ss', str(start), '-i', str(SOURCE), '-loop', '1', '-framerate', '25', '-i', str(label),
        '-filter_complex', graph, '-map', '[v]', '-map', '[a]', '-frames:v', str(frames),
        '-t', str(duration), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', str(path))
    probe = json.loads(run('ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                           'format=duration:stream=codec_type,nb_read_frames', '-of', 'json', str(path)))
    video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
    assert int(video['nb_read_frames']) == frames, (row['id'], video, frames)
    assert abs(float(probe['format']['duration']) - duration) <= .05, (row['id'], probe)


def render():
    prepare()
    with tempfile.TemporaryDirectory(prefix='l01-anchor-motion-') as directory:
        temp = Path(directory)
        parts = []
        for index, row in enumerate(SEGMENTS):
            label = temp / f'label-{index}.png'
            part = temp / f'part-{index}.mp4'
            make_label(label, row['label'])
            render_segment(row, part, label)
            parts.append(part)
        listing = temp / 'parts.txt'
        listing.write_text(''.join(f"file '{path}'\n" for path in parts))
        run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
            '-r', str(FPS), '-c:a', 'aac', '-b:a', '256k', '-t', '12.8',
            '-movflags', '+faststart', str(VIDEO))
    inspect(write=True)


def inspect(write=False):
    anchor = prepare()
    probe = json.loads(run('ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                           'format=duration:stream=codec_type,codec_name,width,height,nb_read_frames',
                           '-of', 'json', str(VIDEO)))
    video = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
    audio = next(stream for stream in probe['streams'] if stream['codec_type'] == 'audio')
    assert (video['width'], video['height'], int(video['nb_read_frames'])) == (1280, 820, 320)
    assert abs(float(probe['format']['duration']) - 12.8) <= .05
    run('ffmpeg', '-v', 'error', '-i', str(VIDEO), '-f', 'null', '-')
    receipt = {
        'status': 'local_motion_review_only_not_human_qa',
        'source_video': {'path': str(SOURCE.relative_to(ROOT)), 'sha256': sha(SOURCE)},
        'anchor_review_sha256': sha(ANCHOR),
        'backgrounds': {'P01': sha(P01), 'P02': sha(P02)},
        'anchor_source_1920x1080_xywh': anchor['anchor']['source_1920x1080_xywh'],
        'segments': [{**row, 'base': str(row['base'].relative_to(ROOT)),
                      'target_seconds': [sum(previous['source'][1] - previous['source'][0] for previous in SEGMENTS[:index]),
                                         sum(previous['source'][1] - previous['source'][0] for previous in SEGMENTS[:index + 1])],
                      'audio': 'native source window, AAC re-encoded; no J01'}
                     for index, row in enumerate(SEGMENTS)],
        'reel': {'path': str(VIDEO.relative_to(ROOT)), 'sha256': sha(VIDEO),
                 'duration_seconds': float(probe['format']['duration']),
                 'video': video, 'audio': audio},
        'checks': {'full_decode': 'passed', 'frame_count': 320,
                   'same_inset_geometry': True, 'desktop_and_narrow_playback': 'pending visual inspection'},
        'limits': ['Native excerpts are re-encoded for this local review; the original MP4 is unchanged.',
                   'The C01/C02 timing candidate remains stopped at two pauses over 2.5 seconds.',
                   'No J01, learner media, binding, provider action, merge, or release.'],
    }
    target = OUT / 'motion-review.json'
    content = json.dumps(receipt, ensure_ascii=False, indent=2) + '\n'
    if write:
        target.write_text(content)
    else:
        assert target.read_text() == content, 'motion review receipt differs'
    print(f'{"build" if write else "check"}: 320 frames, {probe["format"]["duration"]}s, {sha(VIDEO)}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('build', 'check'))
    if parser.parse_args().action == 'build':
        render()
    else:
        inspect()


if __name__ == '__main__':
    main()
