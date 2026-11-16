#!/usr/bin/env python3
"""One local four-section caption review render using transparent raster cues."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
PARENT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate'
OUT = Path(__file__).resolve().parent
SOURCE = PARENT / 'c01-c02-v15-all-captions-review/l01-c01-c02-v15-all-captions-review.mp4'
SOURCE_SHA = '3fba2f2bd724f4da1e5778138a95765b4b5946e478e8b52598ac9124e5a0d869'
PLAN = OUT / 'caption-plan.json'
VIDEO = OUT / 'l01-c01-c02-v17-four-section-caption-review.mp4'
RENDER_RECEIPT = OUT / 'render-output-receipt.json'
SOURCE_COMMIT = '3a2df476a96d3106823537c2442a72bd69a95080'
PLAN_SHA = 'd917317e98f7dc05590e714097af9faf00a9c09236ce894a18c214ce9138b21e'
J01_WAV_SHA = '24ce83730c2112a52fee7e765794c29c771886ad103094ddff53511d33491360'
AAC_STREAM_SHA = '5bef7336fbd6b0716007208d8481ba8bd896768a8ed3c9b7f206a7e1d859c655'
APPROVED_VIDEO_SHA = '80a1be496b7b05e1ae7bf6bff2cd00e2410374e6c8abe65e280fe7e4c444d0d1'
C01_STILL_RECEIPT = PARENT / 'c01-visual-still-audit-v13/receipt.json'
C01_STILL_RECEIPT_SHA = 'b6776a7ae75e564211d353e5e4e1184d97dbdab5c8b9e00eed78f04d048a1ccb'
FPS = 25
TOTAL = 8625
P01_END = 710
P02_START = 5875
C02_START = 6205
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run(*args):
    p = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(f'{args[0]} exited {p.returncode}: {p.stderr[-3000:]}')
    return p.stdout


def preflight():
    run('git', 'merge-base', '--is-ancestor', SOURCE_COMMIT, 'HEAD')
    if not SOURCE.exists():
        raise FileNotFoundError(f'local-only voice-bearing source required: {SOURCE} (SHA-256 {SOURCE_SHA})')
    assert sha(SOURCE) == SOURCE_SHA
    assert sha(PLAN) == PLAN_SHA
    assert sha(C01_STILL_RECEIPT) == C01_STILL_RECEIPT_SHA
    plan = json.loads(PLAN.read_text())
    assert len(plan['caption_cues']) == 175
    assert plan['sources']['artifacts/accelerated-visual-parity-2026-11-10/narration-pilot/l01-j01-original.wav'] == J01_WAV_SHA
    source_audio = run('ffmpeg', '-v', 'error', '-i', str(SOURCE), '-map', '0:a:0',
                       '-c', 'copy', '-f', 'streamhash', '-hash', 'sha256', '-').strip()
    assert source_audio == f'0,a,SHA256={AAC_STREAM_SHA}'
    windows = ((0, 28.4, 18), (28.4, 235, 102), (235, 248.2, 8), (248.2, 345, 47))
    font = ImageFont.truetype(FONT, 46)
    draw = ImageDraw.Draw(Image.new('RGB', (1280, 900)))
    for start, end, count in windows:
        cues = [cue for cue in plan['caption_cues'] if cue['start'] < end and cue['end'] > start]
        assert len(cues) == count
        center = 800 if start in (0, 235) else 640
        boxes = [draw.textbbox((center, 57), cue['text'], font=font,
                               anchor='mm', stroke_width=1) for cue in cues]
        assert all(left >= (400 if center == 800 else 60) and right <= 1220
                   and top >= 20 and bottom <= 90 for left, top, right, bottom in boxes)
    # Prove the raster path on one frame without making another MP4.
    with tempfile.TemporaryDirectory(prefix='four-section-caption-probe-') as scratch:
        temp = Path(scratch)
        caption = Image.new('RGBA', (1280, 100), (0, 0, 0, 0))
        ImageDraw.Draw(caption).text((800, 47), 'That story makes the pressure',
                                     font=font, fill='white', anchor='mm',
                                     stroke_width=1, stroke_fill='#10202a')
        caption_path = temp / 'caption.png'
        caption.save(caption_path)
        listing = temp / 'one-frame-list.txt'
        listing.write_text(f"file '{caption_path}'\nduration 0.04\nfile '{caption_path}'\n")
        output = temp / 'probe.png'
        graph = ('[0:v]trim=start_frame=0:end_frame=1,setpts=N/(25*TB),'
                 'crop=1280:720:0:0,pad=1280:900:0:0:color=0x0c202a[base];'
                 '[1:v]fps=25,trim=end_frame=1,setpts=N/(25*TB),format=rgba[cap];'
                 '[base][cap]overlay=0:10:format=auto:shortest=1[v]')
        run('ffmpeg', '-v', 'error', '-ss', '235.3', '-i', str(SOURCE),
            '-f', 'concat', '-safe', '0', '-i', str(listing), '-filter_complex', graph,
            '-map', '[v]', '-frames:v', '1', '-y', str(output))
        with Image.open(output) as image:
            assert image.size == (1280, 900)
    return plan


def presenter_caption_listing(cues, temp):
    font = ImageFont.truetype(FONT, 46)
    own = [c for c in cues if c['start'] < 28.4 or 235 <= c['start'] < 248.2]
    assert len(own) == 26
    images = []
    for index, copy in enumerate(['', *(c['text'] for c in own)]):
        image = Image.new('RGBA', (1280, 100), (0, 0, 0, 0))
        if copy:
            ImageDraw.Draw(image).text((800, 47), copy, font=font, fill='white',
                                       anchor='mm', stroke_width=1, stroke_fill='#10202a')
        path = temp / f'presenter-caption-{index:03}.png'
        image.save(path)
        images.append(path)
    labels = []
    index = 0
    for frame in range(TOTAL):
        at = (frame + .5) / FPS
        while index < len(own) and at >= own[index]['end']:
            index += 1
        cue = own[index] if index < len(own) else None
        labels.append(index + 1 if cue and cue['start'] <= at else 0)
    assert all(label == 0 for label in labels[P01_END:P02_START])
    assert all(label == 0 for label in labels[C02_START:])
    runs = []
    for label in labels:
        if runs and runs[-1][0] == label:
            runs[-1][1] += 1
        else:
            runs.append([label, 1])
    assert sum(count for _, count in runs) == TOTAL
    listing = temp / 'presenter-caption-list.txt'
    listing.write_text(''.join(f"file '{images[label]}'\nduration {count/FPS:.6f}\n"
                               for label, count in runs) + f"file '{images[runs[-1][0]]}'\n")
    return listing, len(runs)


def render():
    assert not VIDEO.exists() and not RENDER_RECEIPT.exists(), 'candidate already exists; no retry or overwrite'
    plan = preflight()
    with tempfile.TemporaryDirectory(prefix='four-section-raster-captions-') as scratch:
        listing, run_count = presenter_caption_listing(plan['caption_cues'], Path(scratch))
        # Check the full raster timing source before making the single MP4.
        run('ffmpeg', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing),
            '-vf', 'fps=25,trim=end_frame=8625', '-f', 'null', '-')
        graph = (
            '[0:v]split=4[p01src][c01src][p02src][c02src];'
            '[1:v]fps=25,trim=end_frame=8625,setpts=N/(25*TB),format=rgba,'
            'split=2[p01capsrc][p02capsrc];'
            f'[p01src]trim=start_frame=0:end_frame={P01_END},setpts=N/({FPS}*TB),'
            'crop=1280:720:0:0,pad=1280:900:0:0:color=0x0c202a[p01base];'
            f'[p01capsrc]trim=start_frame=0:end_frame={P01_END},setpts=N/({FPS}*TB)[p01cap];'
            '[p01base][p01cap]overlay=0:10:format=auto:shortest=1[p01];'
            f'[c01src]trim=start_frame={P01_END}:end_frame={P02_START},'
            f'setpts=N/({FPS}*TB)[c01];'
            f'[p02src]trim=start_frame={P02_START}:end_frame={C02_START},'
            f'setpts=N/({FPS}*TB),crop=1280:720:0:0,'
            'pad=1280:900:0:0:color=0x0c202a[p02base];'
            f'[p02capsrc]trim=start_frame={P02_START}:end_frame={C02_START},'
            f'setpts=N/({FPS}*TB)[p02cap];'
            '[p02base][p02cap]overlay=0:10:format=auto:shortest=1[p02];'
            f'[c02src]trim=start_frame={C02_START}:end_frame={TOTAL},'
            f'setpts=N/({FPS}*TB)[c02];'
            '[p01][c01][p02][c02]concat=n=4:v=1:a=0[v]'
        )
        run('ffmpeg', '-v', 'error', '-y', '-i', str(SOURCE),
            '-f', 'concat', '-safe', '0', '-i', str(listing),
            '-filter_complex', graph, '-map', '[v]', '-map', '0:a:0',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
            '-pix_fmt', 'yuv420p', '-r', str(FPS), '-frames:v', str(TOTAL),
            '-c:a', 'copy', '-t', '345', '-movflags', '+faststart', str(VIDEO))
    receipt = {
        'status': 'rendered_pending_playback_review',
        'source_commit': SOURCE_COMMIT,
        'source_mp4_sha256': SOURCE_SHA,
        'source_plan_sha256': sha(PLAN),
        'source_c01_still_receipt_sha256': C01_STILL_RECEIPT_SHA,
        'j01_original_wav_sha256': plan['sources']['artifacts/accelerated-visual-parity-2026-11-10/narration-pilot/l01-j01-original.wav'],
        'caption_cues_preserved': len(plan['caption_cues']),
        'presenter_raster_runs': run_count,
        'video': {'path': str(VIDEO.relative_to(ROOT)), 'sha256': sha(VIDEO)},
        'change': 'P01/P02 bottom captions replaced with transparent top-right raster captions; their approved visuals and presenter coordinates are unchanged. C01/C02 top captions unchanged.',
        'limits': ['One local review MP4 only; no learner binding, HeyGen, spend, merge or release.',
                   'Playback, decode, audio-identity and caption checks remain pending.']
    }
    RENDER_RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    print(VIDEO)


def inspect():
    preflight()
    assert VIDEO.exists(), 'approved local MP4 is not present; no media is committed'
    assert sha(VIDEO) == APPROVED_VIDEO_SHA
    probe = json.loads(run('ffprobe', '-v', 'error', '-count_frames',
                           '-show_entries', 'format=duration:stream=codec_type,width,height,nb_read_frames',
                           '-of', 'json', str(VIDEO)))
    picture = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
    assert (picture['width'], picture['height'], int(picture['nb_read_frames'])) == (1280, 900, TOTAL)
    assert float(probe['format']['duration']) == 345.0
    audio = run('ffmpeg', '-v', 'error', '-i', str(VIDEO), '-map', '0:a:0',
                '-c', 'copy', '-f', 'streamhash', '-hash', 'sha256', '-').strip()
    assert audio == f'0,a,SHA256={AAC_STREAM_SHA}'
    run('ffmpeg', '-v', 'error', '-i', str(VIDEO), '-f', 'null', '-')
    print('approved local review MP4 and unchanged AAC:', APPROVED_VIDEO_SHA)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('preflight', 'render', 'inspect'))
    args = parser.parse_args()
    if args.action == 'preflight':
        p = preflight()
        print('preflight passed', len(p['caption_cues']), 'cues, one-frame raster filters')
    elif args.action == 'render':
        render()
    else:
        inspect()
