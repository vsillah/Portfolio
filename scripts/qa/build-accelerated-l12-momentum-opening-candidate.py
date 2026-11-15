#!/usr/bin/env python3
"""Build local review-only L12 Momentum opening candidates from approved sources."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-l12-poster-qa/momentum-opening-candidate-2026-11-15'
STILLS = ROOT / 'artifacts/accelerated-sam-focus-stills-2026-11-14'
SOURCE = {
    'desktop': ROOT / 'public/accelerated/contextual-review/l12/contextual-abdbf06e6be3/l12-desktop.mp4',
    'portrait': ROOT / 'public/accelerated/contextual-review/l12/contextual-0fec271db067/l12-portrait.mp4',
}
EXPECTED_SOURCE = {
    'desktop': 'abdbf06e6be3caf1c2f8678eb1f9af8a5ddd06324e99802d4d253b97581ccb81',
    'portrait': '0fec271db0679876d4e53eb416864dce509dce161749a8e56c809f54f618da1e',
}
EXPECTED_RASTER = '7d37baf2841fc7115c1a7d9bd3f6860ed9eebdbe10ffad8186019534c33010d6'
CAPTIONS = ROOT / 'public/accelerated/contextual-review/l12/captions-0363e17aba64/l12-captions.vtt'
EXPECTED_CAPTIONS = '0363e17aba64d2986b417f7ac0fb6585896c9f5d43743fb5ec285de8c104f749'
EXPECTED_AUDIO_STREAM = 'SHA256=60fa992c5d4a6fc134c8ab7599ecf160756523717ea7b08e434052e383092a23'
PRESENTER_END = 24.52
OPENING_END = 86.04
FPS = 25
FRAMES = 11511


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args):
    subprocess.run(args, check=True)


def cutaway(variant, raster):
    target = OUT / f'l12-{variant}-momentum-cutaway.png'
    frame = OUT / f'l12-{variant}-source-cutaway-frame.png'
    run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '30', '-i', str(SOURCE[variant]), '-frames:v', '1', str(frame)])
    image = Image.open(frame).convert('RGB')
    draw = ImageDraw.Draw(image)
    if variant == 'desktop':
        erase = (960, 155, 1841, 906)
        field = (1110, 149, 650, 745)
        sample_x = range(940, 959)
    else:
        erase = (25, 145, 365, 460)
        field = (53, 139, 284, 426)
        sample_x = range(1, 14)
    for y in range(erase[1], erase[3]):
        samples = [image.getpixel((x, y)) for x in sample_x]
        color = tuple(sorted(pixel[channel] for pixel in samples)[len(samples) // 2] for channel in range(3))
        draw.line((erase[0], y, erase[2], y), fill=color)
    plate = ImageOps.contain(raster, (field[2], field[3]), Image.Resampling.LANCZOS)
    x = field[0] + (field[2] - plate.width) // 2
    y = field[1] + (field[3] - plate.height) // 2
    image.paste(plate, (x, y))
    image.save(target)
    return target, (x, y, x + plate.width, y + plate.height)


def render(variant, poster, cutaway_path, seconds=None):
    source = SOURCE[variant]
    if variant == 'desktop':
        size = '1920:1080'
        crop = '672:384:1136:348'
        live_size = '633:362'
        live_pos = '1214:290'
    else:
        size = '390:844'
        crop = '354:200:18:526'
        live_size = '354:202'
        live_pos = '18:605'
    graph = (
        f'[0:v]split=2[base][presenter];'
        f'[1:v]scale={size},format=yuv420p[poster];'
        f'[2:v]format=yuv420p[cutaway];'
        f'[presenter]crop={crop},scale={live_size},format=yuv420p[live];'
        f"[base][poster]overlay=0:0:enable='lt(t,{PRESENTER_END})'[a];"
        f"[a][live]overlay={live_pos}:enable='lt(t,{PRESENTER_END})'[b];"
        f"[b][cutaway]overlay=0:0:enable='gte(t,{PRESENTER_END})*lt(t,{OPENING_END})',format=yuv420p[v]"
    )
    visual = OUT / (f'l12-{variant}-opening-sample-visual.mp4' if seconds else f'l12-{variant}-momentum-visual-building.mp4')
    target = OUT / (f'l12-{variant}-opening-sample.mp4' if seconds else f'l12-{variant}-contextual-momentum-building.mp4')
    args = ['ffmpeg', '-y', '-nostdin', '-loglevel', 'error', '-i', str(source), '-loop', '1', '-framerate', str(FPS), '-i', str(poster), '-loop', '1', '-framerate', str(FPS), '-i', str(cutaway_path), '-filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-g', '25', '-keyint_min', '25', '-sc_threshold', '0', '-pix_fmt', 'yuv420p']
    if seconds:
        args += ['-t', str(seconds)]
    else:
        args += ['-frames:v', str(FRAMES)]
    run(args + [str(visual)])
    run(['ffmpeg', '-y', '-nostdin', '-loglevel', 'error', '-i', str(visual), '-i', str(source),
         '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', str(target)])
    if not seconds:
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
            'format=duration:stream=codec_type,nb_frames,r_frame_rate', '-of', 'json', str(target)]))
        video, audio = probe['streams']
        audio_hash = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(target), '-map', '0:a:0',
            '-c', 'copy', '-f', 'hash', '-hash', 'SHA256', '-'], text=True).strip()
        if (int(video['nb_frames']) != FRAMES or video['r_frame_rate'] != '25/1'
                or int(audio['nb_frames']) != 21586 or abs(float(probe['format']['duration']) - 460.459) > .001
                or audio_hash != EXPECTED_AUDIO_STREAM):
            raise RuntimeError(f'{variant} bounded mux identity failed: {probe}; {audio_hash}')
        visual.unlink()
        candidate_hash = sha(target)
        immutable = OUT / f'l12-{variant}-contextual-momentum-{candidate_hash[:12]}.mp4'
        if immutable.exists():
            if sha(immutable) != candidate_hash:
                raise RuntimeError(f'{variant} immutable candidate collision')
            target.unlink()
        else:
            target.replace(immutable)
        target = immutable
    return target


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    receipt = json.loads((STILLS / 'receipt.json').read_text())
    scene = receipt['scenes']['L12-01']
    raster_path = STILLS / 'momentum-raster.png'
    if sha(raster_path) != EXPECTED_RASTER or sha(CAPTIONS) != EXPECTED_CAPTIONS:
        raise RuntimeError('Momentum raster or caption source drifted')
    raster = Image.open(raster_path).convert('RGB')
    outputs = {}
    for variant in ('desktop', 'portrait'):
        source = SOURCE[variant]
        if sha(source) != EXPECTED_SOURCE[variant]:
            raise RuntimeError(f'{variant} contextual source drifted')
        item = scene['outputs'][variant]
        poster = ROOT / item['path']
        if sha(poster) != item['sha256']:
            raise RuntimeError(f'{variant} approved composition drifted')
        cutaway_path, plate_box = cutaway(variant, raster)
        target = render(variant, poster, cutaway_path, 5 if '--sample' in sys.argv else None)
        outputs[variant] = {'path': str(target.relative_to(ROOT)), 'sha256': sha(target), 'bytes': target.stat().st_size,
                            'source_sha256': EXPECTED_SOURCE[variant], 'poster_still_sha256': item['sha256'],
                            'cutaway_sha256': sha(cutaway_path), 'complete_momentum_plate_box': plate_box}
    (OUT / ('sample-receipt.json' if '--sample' in sys.argv else 'render-receipt-v3.json')).write_text(json.dumps({
        'schema': 'accelerated_l12_momentum_opening_candidate_v3', 'status': 'bounded_mux_validated_visual_review_pending',
        'presenter_end_seconds': PRESENTER_END, 'opening_end_seconds': OPENING_END,
        'expected_frames': FRAMES, 'expected_aac_packets': 21586, 'audio_stream_hash': EXPECTED_AUDIO_STREAM,
        'fps': FPS, 'raster_sha256': EXPECTED_RASTER,
        'captions_sha256': EXPECTED_CAPTIONS, 'outputs': outputs,
        'excluded': ['learner bindings', 'PR update', 'commit', 'push', 'merge', 'manual deployment', 'provider action', 'spend', 'publication', 'release'],
    }, indent=2) + '\n')
    print(json.dumps(outputs, indent=2))


if __name__ == '__main__':
    main()
