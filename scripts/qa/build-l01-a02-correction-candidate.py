#!/usr/bin/env python3
"""Render a review-only A02 trim using only existing native source audio packets."""
import hashlib
import json
import pathlib
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'public/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4'
BEFORE = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-a02-boundary-review-235-252.mp4'
OUTPUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-a02-native-trim-candidate-235-252.mp4'
COMPARE = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-a02-before-after-235-252.mp4'
RECEIPT = OUTPUT.with_suffix('.json')
SOURCE_SHA = 'ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a'
START, LENGTH, CUT = 235.0, 17, 245.133333
SILENT_SOURCE_START = 249.0
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def packets(path):
    data = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_packets',
                           '-show_data_hash', 'sha256', '-show_entries', 'packet=data_hash',
                           '-of', 'json', str(path)]).stdout)
    return [packet['data_hash'] for packet in data['packets']]


def duration(path):
    data = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                           '-of', 'json', str(path)]).stdout)
    return float(data['format']['duration'])


def make_overlay(index, directory):
    image = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((345, 17, 1575, 133), radius=18, fill=(7, 19, 35, 224))
    draw.rounded_rectangle((42, 936, 804, 1026), radius=14, fill=(7, 19, 35, 206))
    font_large = ImageFont.truetype(FONT, 35)
    font_small = ImageFont.truetype(FONT, 28)
    second = int(START) + index
    if second < 245:
        phase = 'A02 presenter · original footage'
    elif second == 245:
        phase = 'Proposed A02 trim at 04:05.13'
    else:
        phase = 'C02 card advanced · source silence'
    draw.text((375, 36), f'SOURCE {second // 60:02d}:{second % 60:02d}', font=font_large,
              fill=(246, 201, 106, 255))
    draw.text((760, 36), phase, font=font_small, fill=(255, 255, 255, 255))
    draw.text((66, 956), 'AFTER · REVIEW-ONLY NATIVE EDIT', font=font_small,
              fill=(255, 255, 255, 255))
    image.save(directory / f'{index:02d}.png')


def main():
    assert sha(SOURCE) == SOURCE_SHA, 'Canonical source changed'
    assert BEFORE.exists(), 'Build the unchanged boundary review first'
    with tempfile.TemporaryDirectory(prefix='l01-a02-candidate-') as temp:
        scratch = pathlib.Path(temp)
        for second in range(LENGTH):
            make_overlay(second, scratch)
        card = scratch / 'existing-cutaway-card.png'
        run(['ffmpeg', '-v', 'error', '-ss', '249', '-i', str(SOURCE), '-frames:v', '1', '-y', str(card)])
        pre = scratch / 'native-pre.m4a'
        silence = scratch / 'native-silence.m4a'
        joined = scratch / 'native-splice.m4a'
        run(['ffmpeg', '-v', 'error', '-i', str(SOURCE), '-ss', str(START),
             '-t', f'{CUT - START:.6f}', '-map', '0:a:0', '-c:a', 'copy', '-y', str(pre)])
        run(['ffmpeg', '-v', 'error', '-i', str(SOURCE), '-ss', str(SILENT_SOURCE_START),
             '-t', f'{START + LENGTH - CUT:.6f}', '-map', '0:a:0', '-c:a', 'copy', '-y', str(silence)])
        listing = scratch / 'audio-concat.txt'
        listing.write_text(f"file '{pre}'\nfile '{silence}'\n")
        run(['ffmpeg', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing),
             '-c:a', 'copy', '-y', str(joined)])
        retained = packets(pre)
        silent_packets = packets(silence)
        assert packets(joined) == retained + silent_packets
        run(['ffmpeg', '-v', 'error', '-ss', str(START), '-i', str(SOURCE), '-loop', '1', '-i', str(card),
             '-framerate', '1', '-i', str(scratch / '%02d.png'), '-i', str(joined),
             '-filter_complex', "[0:v]setpts=PTS-STARTPTS[base];[base][1:v]overlay=enable='gte(t,10.133333)':shortest=0:repeatlast=1[card];[card][2:v]overlay=shortest=0:repeatlast=1:format=auto,format=yuv420p[v]",
             '-map', '[v]', '-map', '3:a:0', '-t', str(LENGTH), '-r', '25',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'copy',
             '-movflags', '+faststart', '-y', str(OUTPUT)])
        assert packets(OUTPUT) == packets(joined), 'Correction mux changed AAC packet payloads'
        before_hashes = packets(BEFORE)
        assert any(before_hashes[i:i + len(retained)] == retained for i in range(len(before_hashes) - len(retained) + 1)), 'Retained packets differ from original review'
        # The original excerpt carries AAC preroll metadata. Decode and join only
        # the convenience comparison; the isolated correction retains packet copy.
        run(['ffmpeg', '-v', 'error', '-i', str(BEFORE), '-i', str(OUTPUT),
             '-filter_complex',
             '[0:v]trim=duration=17,setpts=PTS-STARTPTS[v0];[1:v]trim=duration=17,setpts=PTS-STARTPTS[v1];'
             '[0:a]atrim=duration=17,asetpts=PTS-STARTPTS[a0];[1:a]atrim=duration=17,asetpts=PTS-STARTPTS[a1];'
             '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
             '-map', '[v]', '-map', '[a]', '-r', '25', '-c:v', 'libx264',
             '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k',
             '-movflags', '+faststart', '-y', str(COMPARE)])
    for path in (OUTPUT, COMPARE):
        run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'])
    assert 16.9 <= duration(OUTPUT) <= 17.2
    assert 33.9 <= duration(COMPARE) <= 34.3
    receipt = {'status': 'review_only_machine_supported_not_audibly_signed_off',
               'canonical_source_path': str(SOURCE.relative_to(ROOT)), 'canonical_source_sha256': SOURCE_SHA,
               'before_path': str(BEFORE.relative_to(ROOT)), 'before_sha256': sha(BEFORE),
               'candidate_path': str(OUTPUT.relative_to(ROOT)), 'candidate_sha256': sha(OUTPUT),
               'comparison_path': str(COMPARE.relative_to(ROOT)), 'comparison_sha256': sha(COMPARE),
               'source_excerpt_seconds': [START, START + LENGTH], 'proposed_a02_cut_seconds': CUT,
               'original_a02_end_seconds': 248.2, 'silent_audio_source_seconds': [SILENT_SOURCE_START, SILENT_SOURCE_START + START + LENGTH - CUT],
               'retained_native_audio_packet_count': len(retained), 'copied_native_silence_packet_count': len(silent_packets),
               'all_candidate_audio_packets_match_source_extracts': True,
               'comparison_audio': 'decoded and AAC re-encoded only for sequential review; source and isolated correction retain packet payloads',
               'candidate_duration_seconds': duration(OUTPUT), 'comparison_duration_seconds': duration(COMPARE),
               'ffmpeg_full_decode': 'passed', 'voice_generation': False, 'learner_binding': False,
               'residual_uncertainty': 'Cut point follows machine word timing and AAC packet boundary, not audible human confirmation; inspect whether public proof ends cleanly.'}
    RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
