#!/usr/bin/env python3
"""Create a labeled L01 boundary excerpt without changing the source AAC packets."""
import hashlib
import json
import pathlib
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'public/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4'
OUTPUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-a02-boundary-review-235-252.mp4'
RECEIPT = OUTPUT.with_suffix('.json')
SOURCE_SHA = 'ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a'
START, DURATION, FPS = 235, 17, 25
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def packet_hashes(path):
    result = run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_packets',
                  '-show_data_hash', 'sha256', '-show_entries', 'packet=data_hash', '-of', 'json', str(path)])
    return [packet['data_hash'] for packet in json.loads(result.stdout)['packets']]


def overlay_frame(index, directory):
    image = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((345, 17, 1575, 133), radius=18, fill=(7, 19, 35, 224))
    draw.rounded_rectangle((42, 936, 718, 1026), radius=14, fill=(7, 19, 35, 206))
    large = ImageFont.truetype(FONT, 35)
    small = ImageFont.truetype(FONT, 28)
    second = START + index
    stamp = f'SOURCE {second // 60:02d}:{second % 60:02d}'
    if second < 245:
        label = 'A02 native presenter'
    elif second < 248:
        label = 'Listen: suspected first-page sentence'
    elif second == 248:
        label = 'A02 → C02 boundary at 04:08.20'
    else:
        label = 'C02 cutaway gap in source'
    draw.text((375, 36), stamp, font=large, fill=(246, 201, 106, 255))
    draw.text((760, 36), label, font=small, fill=(255, 255, 255, 255))
    draw.text((66, 956), 'REVIEW ONLY · ORIGINAL AAC AUDIO', font=small, fill=(255, 255, 255, 255))
    image.save(directory / f'{index:02d}.png')


def main():
    assert sha(SOURCE) == SOURCE_SHA, 'Native source changed'
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='l01-a02-review-') as temp:
        scratch = pathlib.Path(temp)
        for second in range(DURATION):
            overlay_frame(second, scratch)
        pattern = scratch / '%02d.png'
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(START), '-i', str(SOURCE),
             '-framerate', '1', '-i', str(pattern), '-filter_complex',
             '[0:v][1:v]overlay=shortest=1:format=auto,format=yuv420p[v]',
             '-map', '[v]', '-map', '0:a:0', '-t', str(DURATION), '-r', str(FPS),
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'copy',
             '-movflags', '+faststart', '-y', str(OUTPUT)])
        reference_audio = scratch / 'reference-audio.m4a'
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(START), '-i', str(SOURCE),
             '-map', '0:a:0', '-t', str(DURATION), '-c:a', 'copy', '-y', str(reference_audio)])
        rendered_packets = packet_hashes(OUTPUT)
        reference_packets = packet_hashes(reference_audio)
        assert rendered_packets == reference_packets, 'Audio packets changed during labeled render'
    run(['ffmpeg', '-v', 'error', '-i', str(OUTPUT), '-f', 'null', '-'])
    probe = json.loads(run(['ffprobe', '-v', 'error', '-show_entries',
                            'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate',
                            '-of', 'json', str(OUTPUT)]).stdout)
    assert 16.9 <= float(probe['format']['duration']) <= 17.2
    assert any(s['codec_type'] == 'audio' and s['codec_name'] == 'aac' for s in probe['streams'])
    assert any(s['codec_type'] == 'video' and s['width'] == 1920 and s['height'] == 1080 for s in probe['streams'])
    receipt = {'status': 'review_only_existing_native_media', 'source_path': str(SOURCE.relative_to(ROOT)),
               'source_sha256': SOURCE_SHA, 'start_seconds': START, 'end_seconds': START + DURATION,
               'a02_to_c02_boundary_seconds': 248.2, 'suspected_sentence_seconds': [245.13, 248.23],
               'output_path': str(OUTPUT.relative_to(ROOT)), 'output_sha256': sha(OUTPUT),
               'audio_codec': 'aac_stream_copy', 'audio_packet_hashes_match_reference_extract': True,
               'audio_packet_count': len(rendered_packets), 'ffmpeg_full_decode': 'passed',
               'duration_seconds': float(probe['format']['duration']), 'purpose': 'timestamped listening checkpoint; no learner binding'}
    RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
