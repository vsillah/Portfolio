#!/usr/bin/env python3
"""Build one local P01→P02 reel with approved SAM plates and copied native audio."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PARENT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate'
OUT = PARENT / 'p02-approved-plate-motion'
SOURCE = ROOT / 'public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4'
P01 = PARENT / 'p01-middle-base.png'
P02 = OUT / 'p02-full-base.png'
FOCUS = {name: OUT / f'p02-focus-{name}-base.png'
         for name in ('signals', 'alignment', 'momentum')}
PLATES = ROOT / 'scripts/qa/build-accelerated-p02-approved-plate-stills.py'
STILL_RECEIPT = PARENT / 'p02-approved-plate-stills/receipt.json'
SAM = ROOT / 'public/showcases/service-prototypes/accelerated-sam-infographic.png'
VIDEO = OUT / 'l01-p01-p02-approved-plate-motion.mp4'
PRIOR_AUDIO = PARENT / 'l01-p01-p02-middle-motion-failed-copy-reduction.mp4'
RECEIPT = OUT / 'motion-receipt.json'
FPS = 25
ANCHOR = (1136, 348, 672, 384)
SEGMENTS = [
    {'id': 'P01', 'start': 24.0, 'end': 28.4, 'crop_y': 260, 'base': P01},
    {'id': 'P01_MOVED', 'start': 28.4, 'end': 30.8, 'crop_y': 260, 'base': P02},
    {'id': 'P02_FULL_IN', 'start': 235.0, 'end': 235.6, 'crop_y': 790, 'base': P02,
     'hold_first_frame': True},
    {'id': 'P02_SIGNALS', 'start': 235.6, 'end': 237.08, 'crop_y': 790, 'base': FOCUS['signals']},
    {'id': 'P02_ALIGNMENT', 'start': 237.08, 'end': 238.56, 'crop_y': 790, 'base': FOCUS['alignment']},
    {'id': 'P02_MOMENTUM', 'start': 238.56, 'end': 240.04, 'crop_y': 790, 'base': FOCUS['momentum']},
    {'id': 'P02_FULL_OUT', 'start': 240.04, 'end': 241.0, 'crop_y': 790, 'base': P02},
]
for index in (1, 3, 4, 5, 6):
    SEGMENTS[index]['previous_base'] = SEGMENTS[index - 1]['base']
FADE_SECONDS = 0.20


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} exited {result.returncode}: {result.stderr[-2500:]}')
    return result.stdout


def source_check():
    assert sha(SOURCE) == 'a70ed876ccdedd468c1cfa7ea995087683c715fdb97c50bb1d58a58436820725'
    assert sha(PRIOR_AUDIO) == '820c42a81311152c454318d47549ca5ed90c8e44dfb8713d6aa5007b5d382461'
    assert sha(P01) == 'ae7b6ba63739c8d45ecf9f3edeb4f0b487075ed78032d32059c845156d404071'
    assert sha(SAM) == '13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6'
    assert sha(PLATES) == '189a44c119ce2e3b6696073fba4b4ca1844d344c4abdd44dd613311adf22462d'
    stills = json.loads(STILL_RECEIPT.read_text())
    assert stills['presenter_anchor_xywh'] == list(ANCHOR)
    assert stills['source_sam']['sha256'] == sha(SAM)
    assert stills['status'] == 'review_only_stills_no_video_render'
    assert all(sha(ROOT / row['path']) == row['sha256']
               for row in stills['approved_plates'].values())
    assert sum(round((row['end'] - row['start']) * FPS) for row in SEGMENTS) == 320


def prepare_bases():
    spec = importlib.util.spec_from_file_location('p02_approved_plate_still_builder', PLATES)
    plates = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(plates)
    source, clean = plates.background()
    full = clean.copy()
    full.paste(source.crop((190, 165, 990, 830)).resize((530,440), Image.Resampling.LANCZOS), (275,320))
    full.save(P02)
    for name in plates.SECTIONS:
        frame, _ = plates.focus_frame(clean, name)
        frame.save(FOCUS[name])


def render_segment(row, path):
    duration = round(row['end'] - row['start'], 6)
    frames = round(duration * FPS)
    # The native P02 inset has one blank frame at 235.00. Hold its first valid
    # native video frame for 40 ms. Audio is copied as one prior passing track.
    first = .04 if row.get('hold_first_frame') else 0
    hold = ',tpad=start_mode=clone:start_duration=0.04' if first else ''
    background = ('[0:v][2:v]blend=all_expr='
                  f"'A*min(T/{FADE_SECONDS},1)+B*(1-min(T/{FADE_SECONDS},1))'[bg];"
                  if row.get('previous_base') else '[0:v]null[bg];')
    graph = (
        background +
        f'[1:v]trim=start={first}:duration={duration-first:.6f},setpts=PTS-STARTPTS{hold},'
        f'crop=448:256:1420:{row["crop_y"]},scale={ANCHOR[2]}:{ANCHOR[3]}:flags=lanczos[presenter];'
        f'[bg][presenter]overlay={ANCHOR[0]}:{ANCHOR[1]}:shortest=0,'
        'scale=1280:720:flags=lanczos,fps=25[v]'
    )
    args = ['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(row['base']),
            '-ss', str(row['start']), '-i', str(SOURCE)]
    if row.get('previous_base'):
        args += ['-loop', '1', '-framerate', '25', '-i', str(row['previous_base'])]
    run(*args, '-filter_complex', graph,
        '-map', '[v]', '-an', '-frames:v', str(frames), '-t', str(duration),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        str(path))
    probe = json.loads(run('ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0',
                           '-show_entries', 'stream=nb_read_frames', '-of', 'json', str(path)))
    assert int(probe['streams'][0]['nb_read_frames']) == frames


def render():
    OUT.mkdir(parents=True, exist_ok=True)
    source_check()
    prepare_bases()
    with tempfile.TemporaryDirectory(prefix='l01-middle-motion-') as folder:
        temp = Path(folder)
        parts = []
        for index, row in enumerate(SEGMENTS):
            part = temp / f'{index:02}.mp4'
            render_segment(row, part)
            parts.append(part)
        listing = temp / 'parts.txt'
        listing.write_text(''.join(f"file '{path}'\n" for path in parts))
        joined_video = temp / 'joined-video.mp4'
        run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
            '-c:v', 'copy', str(joined_video))
        run('ffmpeg', '-v', 'error', '-y', '-i', str(joined_video), '-i', str(PRIOR_AUDIO),
            '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', str(VIDEO))
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
    def pcm_info(path):
        decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0',
                                  '-f', 's16le', '-ac', '2', '-ar', '48000', '-'],
                                 cwd=ROOT, capture_output=True, check=True).stdout
        return {'bytes': len(decoded), 'sha256': hashlib.sha256(decoded).hexdigest()}
    prior_pcm = pcm_info(PRIOR_AUDIO)
    reel_pcm = pcm_info(VIDEO)
    assert prior_pcm == reel_pcm, f'Native audio mismatch: {prior_pcm} != {reel_pcm}'
    receipt = {
        'status': 'local_native_motion_review_only_not_learner_media',
        'source': {'path': str(SOURCE.relative_to(ROOT)), 'sha256': sha(SOURCE)},
        'approved_still_receipt_sha256': sha(STILL_RECEIPT),
        'transition_seconds': FADE_SECONDS,
        'transition_method': 'five-frame background dissolve only; native presenter and one copied audio track remain continuous',
        'sam_source_sha256': sha(SAM),
        'backgrounds': {'P01': sha(P01), 'P02': sha(P02),
                        **{name: sha(path) for name, path in FOCUS.items()}},
        'presenter_source_1920x1080_xywh': list(ANCHOR),
        'segments': [{**{k: row[k] for k in ('id', 'start', 'end', 'crop_y')},
                      'base': str(row['base'].relative_to(ROOT)),
                      'audio': 'one copied prior-reel AAC track spans all visual segments; no J01'} for row in SEGMENTS],
        'audio_source': {'path': str(PRIOR_AUDIO.relative_to(ROOT)), 'sha256': sha(PRIOR_AUDIO),
                         'decoded_pcm': prior_pcm},
        'native_visual_frame_hold': 'P02 source 235.04s held for first 40 ms frame; 235.0s audio unchanged',
        'reel': {'path': str(VIDEO.relative_to(ROOT)), 'sha256': sha(VIDEO),
                 'duration_seconds': float(probe['format']['duration']),
                 'video': video, 'audio': audio},
        'checks': {'full_decode': 'passed', 'frame_count': 320,
                   'decoded_pcm_identity': reel_pcm,
                   'browser_desktop_mobile_controls': 'pending Chrome playback review',
                   'native_audio_listening': 'pending; decoded PCM identity to prior reel passed'},
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
