#!/usr/bin/env python3
"""Build one local native P01→P02 motion reel at the reviewed middle-right anchor."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate'
SOURCE = ROOT / 'public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4'
P01 = OUT / 'p01-middle-base.png'
P02 = OUT / 'p02-middle-base.png'
LAYOUT = OUT / 'middle-anchor-layout-receipt.json'
VIDEO = OUT / 'l01-p01-p02-middle-motion.mp4'
RECEIPT = OUT / 'middle-motion-technical-receipt.json'
FPS = 25
ANCHOR = (1136, 348, 672, 384)
SEGMENTS = [
    {'id': 'P01', 'start': 24.0, 'end': 28.4, 'crop_y': 260, 'base': P01},
    {'id': 'P01_MOVED', 'start': 28.4, 'end': 30.8, 'crop_y': 260, 'base': P02},
    {'id': 'P02', 'start': 235.0, 'end': 241.0, 'crop_y': 790, 'base': P02},
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} exited {result.returncode}: {result.stderr[-2500:]}')
    return result.stdout


def source_check():
    assert sha(SOURCE) == 'a70ed876ccdedd468c1cfa7ea995087683c715fdb97c50bb1d58a58436820725'
    assert sha(P01) == 'ae7b6ba63739c8d45ecf9f3edeb4f0b487075ed78032d32059c845156d404071'
    assert sha(P02) == 'd68c58e29bd91498c181f87f359f93430abefdb36c0f51f5cdf943877b036faa'
    assert sha(LAYOUT) == 'b678c228e9a2efa051bff776c196e40c40f0d2ce74965b6d6108b112fbbb4a7d'
    layout = json.loads(LAYOUT.read_text())
    assert layout['proposed_source_1920x1080_xywh'] == list(ANCHOR)
    assert sum(round((row['end'] - row['start']) * FPS) for row in SEGMENTS) == 320


def render_segment(row, path):
    duration = round(row['end'] - row['start'], 6)
    frames = round(duration * FPS)
    # The native P02 inset has one blank frame at 235.00. Hold its first valid
    # native video frame for 40 ms; preserve the untouched 235.0s audio window.
    first = .04 if row['id'] == 'P02' else 0
    hold = ',tpad=start_mode=clone:start_duration=0.04' if first else ''
    graph = (
        f'[1:v]trim=start={first}:duration={duration-first:.6f},setpts=PTS-STARTPTS{hold},'
        f'crop=448:256:1420:{row["crop_y"]},scale={ANCHOR[2]}:{ANCHOR[3]}:flags=lanczos[presenter];'
        f'[0:v][presenter]overlay={ANCHOR[0]}:{ANCHOR[1]}:shortest=0,'
        'scale=1280:720:flags=lanczos,fps=25[v];'
        f'[1:a]atrim=duration={duration},asetpts=PTS-STARTPTS[a]'
    )
    run('ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(row['base']),
        '-ss', str(row['start']), '-i', str(SOURCE), '-filter_complex', graph,
        '-map', '[v]', '-map', '[a]', '-frames:v', str(frames), '-t', str(duration),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '256k', str(path))
    probe = json.loads(run('ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0',
                           '-show_entries', 'stream=nb_read_frames', '-of', 'json', str(path)))
    assert int(probe['streams'][0]['nb_read_frames']) == frames


def render():
    source_check()
    with tempfile.TemporaryDirectory(prefix='l01-middle-motion-') as folder:
        temp = Path(folder)
        parts = []
        for index, row in enumerate(SEGMENTS):
            part = temp / f'{index:02}.mp4'
            render_segment(row, part)
            parts.append(part)
        listing = temp / 'parts.txt'
        listing.write_text(''.join(f"file '{path}'\n" for path in parts))
        run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
            '-c', 'copy', '-movflags', '+faststart', str(VIDEO))
    inspect(write=True)


def inspect(write=False):
    source_check()
    probe = json.loads(run('ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                           'format=duration:stream=codec_name,codec_type,width,height,nb_read_frames',
                           '-of', 'json', str(VIDEO)))
    video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    assert (video['width'], video['height'], int(video['nb_read_frames'])) == (1280, 720, 320)
    assert abs(float(probe['format']['duration']) - 12.8) <= .05
    run('ffmpeg', '-v', 'error', '-i', str(VIDEO), '-f', 'null', '-')
    receipt = {
        'status': 'local_native_motion_review_only_not_learner_media',
        'source': {'path': str(SOURCE.relative_to(ROOT)), 'sha256': sha(SOURCE)},
        'layout_receipt_sha256': sha(LAYOUT),
        'backgrounds': {'P01': sha(P01), 'P02': sha(P02)},
        'presenter_source_1920x1080_xywh': list(ANCHOR),
        'segments': [{**{k: row[k] for k in ('id', 'start', 'end', 'crop_y')},
                      'base': str(row['base'].relative_to(ROOT)),
                      'audio': 'same native source window, AAC re-encoded; no J01'} for row in SEGMENTS],
        'native_visual_frame_hold': 'P02 source 235.04s held for first 40 ms frame; 235.0s audio unchanged',
        'reel': {'path': str(VIDEO.relative_to(ROOT)), 'sha256': sha(VIDEO),
                 'duration_seconds': float(probe['format']['duration']),
                 'video': video, 'audio': audio},
        'checks': {'full_decode': 'passed', 'frame_count': 320,
                   'browser_desktop_mobile_controls': 'see separate middle-motion-validation.json',
                   'native_audio_listening': 'not claimed; technical continuity in separate validation receipt'},
        'limits': ['Local voice-bearing MP4 remains ignored by Git.',
                   'No J01, learner binding, provider action, merge, or release.']
    }
    content = json.dumps(receipt, indent=2) + '\n'
    if write:
        RECEIPT.write_text(content)
    else:
        assert RECEIPT.read_text() == content, 'technical receipt differs'
    print(f'{"render" if write else "check"}: {video["nb_read_frames"]} frames, '
          f'{probe["format"]["duration"]}s, {sha(VIDEO)}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('render', 'check'))
    if parser.parse_args().action == 'render':
        render()
    else:
        inspect()


if __name__ == '__main__':
    main()
