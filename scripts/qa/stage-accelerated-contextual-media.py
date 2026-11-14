#!/usr/bin/env python3
"""Stage verified L09-L16 contextual masters without changing their audio stream."""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def run(*args):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def audio_hash(path):
    return run('ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0', '-c:a', 'copy', '-f', 'hash', '-hash', 'SHA256', '-').stdout.strip()


def probe(path):
    return json.loads(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height', '-of', 'json', str(path)).stdout)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source_root', type=Path)
    parser.add_argument('--output-root', type=Path, default=Path('public/accelerated/contextual-review'))
    parser.add_argument('--receipt', type=Path, default=Path('docs/accelerated-course-modules/l09-l16-contextual-binding/technical-receipt.json'))
    parser.add_argument('--binding', type=Path, default=Path('lib/accelerated-contextual-bindings.json'))
    args = parser.parse_args()
    source = args.source_root.resolve()
    approved = {
        'desktop': 'e3d56170ac6e5ba2d9968c139de17dbd9848ac4b15da7bfa96c9b70a4eea03d3',
        'portrait': '77670556bc97a1bc729bc09c94c315b09d8a38e84bf928739edf5fe11c4540f8',
        'receipt': '7327975f1cc5922da3bd004f7b1af9b797f57005b6a220e4167da0f51aa97fdf',
    }
    consolidated = source / 'consolidated-human-qa'
    for name, filename in [('desktop', 'accelerated-l09-l16-desktop-human-qa.mp4'), ('portrait', 'accelerated-l09-l16-portrait-human-qa.mp4'), ('receipt', 'consolidated-human-qa-receipt.json')]:
        assert sha(consolidated / filename) == approved[name], f'Approved {name} review drifted'
    record = {'schema': 'accelerated_l09_l16_contextual_binding_v1', 'review_sha256': approved, 'video_encoder': 'libx264 preset=fast crf=21; source audio stream copied', 'lessons': {}}
    for number in range(9, 17):
        low = f'l{number:02d}'
        lesson = source / low
        original = json.loads((lesson / 'receipt.json').read_text())
        entry = {'duration_seconds': original['duration'], 'source_receipt_sha256': sha(lesson / 'receipt.json'), 'caption_source_sha256': sha(lesson / f'{low}-captions.vtt'), 'variants': {}}
        for variant, dimensions in [('desktop', (1920, 1080)), ('portrait', (390, 844))]:
            upstream = original['outputs'][variant]
            src = Path(upstream['path'])
            assert src.resolve() == (lesson / f'{low}-{variant}-contextual-review.mp4').resolve()
            assert sha(src) == upstream['sha256'], f'{low} {variant} source drifted'
            source_probe = probe(src)
            assert abs(float(source_probe['format']['duration']) - original['duration']) < .02
            assert tuple((source_probe['streams'][0]['width'], source_probe['streams'][0]['height'])) == dimensions
            with tempfile.TemporaryDirectory() as temp:
                candidate = Path(temp) / f'{low}-{variant}.mp4'
                run('ffmpeg', '-y', '-v', 'error', '-i', str(src), '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', str(candidate))
                assert audio_hash(src) == audio_hash(candidate), f'{low} {variant} audio changed'
                result = run('ffmpeg', '-v', 'info', '-i', str(src), '-i', str(candidate), '-filter_complex', '[0:v][1:v]ssim', '-an', '-f', 'null', '-')
                match = re.search(r'SSIM Y:[^\n]* All:([0-9.]+)', result.stderr)
                assert match and float(match.group(1)) >= .995, f'{low} {variant} visual similarity below gate'
                target = args.output_root / low / f'contextual-{sha(candidate)[:12]}' / f'{low}-{variant}.mp4'
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(candidate, target)
            final_probe = probe(target)
            assert abs(float(final_probe['format']['duration']) - original['duration']) < .02
            entry['variants'][variant] = {'path': '/' + str(target.relative_to('public')), 'sha256': sha(target), 'source_sha256': upstream['sha256'], 'bytes_before': src.stat().st_size, 'bytes_after': target.stat().st_size, 'audio_stream_hash': audio_hash(target), 'ssim': float(match.group(1)), 'duration_seconds': float(final_probe['format']['duration']), 'dimensions': dimensions}
        caption = lesson / f'{low}-captions.vtt'
        target = args.output_root / low / f'captions-{sha(caption)[:12]}' / f'{low}-captions.vtt'
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(caption, target)
        entry['caption'] = {'path': '/' + str(target.relative_to('public')), 'sha256': sha(target)}
        record['lessons'][low.upper()] = entry
        print(f'{low}: {sum(v["bytes_before"] for v in entry["variants"].values()) / 2**20:.1f} -> {sum(v["bytes_after"] for v in entry["variants"].values()) / 2**20:.1f} MiB', flush=True)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(record, indent=2) + '\n')
    binding = {'schema': 'accelerated_l09_l16_contextual_review_v1', 'status': 'human_qa_pending', 'approved_excerpt_receipt_sha256': approved['receipt'], 'technical_receipt_sha256': sha(args.receipt), 'lessons': {}}
    for lesson_id, entry in record['lessons'].items():
        caption_text = (Path('public') / entry['caption']['path'].lstrip('/')).read_text()
        cues = []
        for part in re.split(r'\n\s*\n', caption_text.strip()):
            lines = part.splitlines()
            timing = next((index for index, line in enumerate(lines) if ' --> ' in line), None)
            if timing is None:
                continue
            start, end = lines[timing].split(' --> ')
            cues.append({'start': start, 'end': end, 'text': ' '.join(lines[timing + 1:]).strip()})
        assert cues and abs(sum(float(part) * 60 ** index for index, part in enumerate(reversed(cues[-1]['end'].split(':')))) - entry['duration_seconds']) < .02
        final_seconds = sum(float(part) * 60 ** index for index, part in enumerate(reversed(cues[-1]['end'].split(':'))))
        binding['lessons'][lesson_id] = {
            'duration_seconds': entry['duration_seconds'],
            'variants': {variant: {'path': data['path'], 'sha256': data['sha256']} for variant, data in entry['variants'].items()},
            'caption': entry['caption'],
            'transcript': {'source_vtt_sha256': entry['caption']['sha256'], 'cues': cues},
            'final_caption_end_seconds': final_seconds,
            'final_caption_text': cues[-1]['text'],
        }
    args.binding.write_text(json.dumps(binding, indent=2) + '\n')


if __name__ == '__main__':
    main()
