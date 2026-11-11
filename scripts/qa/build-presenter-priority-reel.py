#!/usr/bin/env python3
"""Make one review-only reel from six exact presenter comparison MP4s."""
import hashlib
import json
import pathlib
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10'
OUT = ARTIFACTS / 'priority-listening-reel'
REEL = OUT / 'accelerated-presenter-priority-listening-reel.mp4'
RECEIPT = OUT / 'receipt.json'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
CHAPTER_SECONDS = 2.4
CHAPTERS = [
    ('L05 A02 → A03', 'Our six notes support a question, not a verdict.',
     'Listen for “views” at the cut and “question, not” at the join.',
     'coordinated-presenter-sequences/l05-receipt.json'),
    ('L06 A02 → A03', 'Imagine the team tests the card and finds…',
     'Listen for “IDs” at the cut and “card and” at the join.',
     'coordinated-presenter-sequences/l06-receipt.json'),
    ('L08 A02 → A03', 'Before there is any data, walk the plan…',
     'Listen for “exercise” at the cut and “data, walk” at the join.',
     'coordinated-presenter-sequences/l08-receipt.json'),
    ('L06 A01', 'Keep the final “s” in “cards.”',
     'The candidate must omit “Now” with no partial onset.',
     'sample-accurate-jump-candidates/l06-a01-tail-pcm-receipt.json'),
    ('L16 A01', 'Keep all of “pain point.”',
     'The candidate must omit “Write” with no partial onset.',
     'sample-accurate-jump-candidates/l16-a01-tail-pcm-receipt.json'),
    ('L16 A02', 'Keep the complete word “it.”',
     'The candidate must omit “Put” with no partial onset.',
     'sample-accurate-jump-candidates/l16-a02-tail-pcm-receipt.json'),
]


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_entries',
                           'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels',
                           '-of', 'json', str(path)]).stdout)


def packet_hashes(path, stream):
    data = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', stream,
                           '-show_packets', '-show_data_hash', 'sha256',
                           '-show_entries', 'packet=data_hash', '-of', 'json', str(path)]).stdout)
    return [row['data_hash'] for row in data['packets']]


def card(path, index, title, phrase, instruction):
    image = Image.new('RGB', (1920, 1080), (8, 28, 40))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((100, 104, 1820, 976), radius=42,
                           fill=(20, 55, 66), outline=(220, 181, 105), width=5)
    draw.rounded_rectangle((150, 160, 602, 235), radius=18, fill=(224, 181, 98))
    draw.text((182, 170), f'CHAPTER {index:02d} / 06',
              font=ImageFont.truetype(FONT, 36), fill=(8, 28, 40))
    draw.text((152, 282), title, font=ImageFont.truetype(FONT, 72),
              fill=(246, 249, 244))
    draw.text((152, 408), 'ORIGINAL  →  CANDIDATE',
              font=ImageFont.truetype(FONT, 42), fill=(234, 192, 112))
    draw.multiline_text((152, 535), phrase, font=ImageFont.truetype(FONT, 52),
                        fill=(246, 249, 244), spacing=18)
    draw.multiline_text((152, 735), instruction,
                        font=ImageFont.truetype(FONT, 37),
                        fill=(199, 222, 224), spacing=12)
    draw.text((152, 912), 'REVIEW ONLY · EXISTING NATIVE SOURCE AUDIO',
              font=ImageFont.truetype(FONT, 28), fill=(165, 187, 188))
    image.save(path)


def qa_sheets(entries):
    outputs = {}
    with tempfile.TemporaryDirectory(prefix='accelerated-reel-frames-') as tmp:
        scratch = pathlib.Path(tmp)
        for kind, offset, key in [('chapter', .35, 'chapter_start_seconds'),
                                  ('source', .5, 'source_clip_start_seconds')]:
            sheet = Image.new('RGB', (1280, 1080), (0, 0, 0))
            for i, row in enumerate(entries):
                frame = scratch / f'{kind}-{i+1:02d}.png'
                run(['ffmpeg', '-v', 'error', '-ss', f"{row[key]+offset:.3f}",
                     '-i', str(REEL), '-frames:v', '1', '-update', '1',
                     '-y', str(frame)])
                with Image.open(frame) as item:
                    sheet.paste(item.resize((640, 360)), ((i % 2)*640, (i // 2)*360))
            path = OUT / f'{kind}-contact-sheet.png'
            sheet.save(path)
            outputs[kind] = {'path': str(path.relative_to(ROOT)), 'sha256': sha(path)}
    return outputs


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    source_paths = []
    cursor = 0.0
    with tempfile.TemporaryDirectory(prefix='accelerated-priority-reel-') as tmp:
        scratch = pathlib.Path(tmp)
        concat_paths = []
        for index, (title, phrase, instruction, receipt_rel) in enumerate(CHAPTERS, 1):
            receipt_path = ARTIFACTS / receipt_rel
            receipt = json.loads(receipt_path.read_text())
            clip_rel = receipt['before_after_path']
            clip_path = ROOT / clip_rel
            assert sha(clip_path) == receipt['before_after_sha256']
            media = probe(clip_path)
            video = next(x for x in media['streams'] if x['codec_type'] == 'video')
            audio = next(x for x in media['streams'] if x['codec_type'] == 'audio')
            assert (video['width'], video['height'], video['r_frame_rate']) == (1920, 1080, '25/1')
            assert audio['codec_name'] == 'aac' and audio['sample_rate'] == '48000' and audio['channels'] == 2
            image_path = OUT / f'chapter-{index:02d}.png'
            card(image_path, index, title, phrase, instruction)
            chapter_path = scratch / f'chapter-{index:02d}.mp4'
            run(['ffmpeg', '-v', 'error', '-loop', '1', '-framerate', '25', '-i', str(image_path),
                 '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
                 '-t', str(CHAPTER_SECONDS), '-r', '25', '-c:v', 'libx264',
                 '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
                 '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
                 '-y', str(chapter_path)])
            chapter_duration = float(probe(chapter_path)['format']['duration'])
            clip_duration = float(media['format']['duration'])
            entry = {'index': index, 'title': title, 'phrase_to_check': phrase,
                     'instruction': instruction,
                     'source_receipt_path': str(receipt_path.relative_to(ROOT)),
                     'source_receipt_sha256': sha(receipt_path),
                     'source_clip_path': clip_rel, 'source_clip_sha256': sha(clip_path),
                     'source_clip_duration_seconds': clip_duration,
                     'chapter_card_path': str(image_path.relative_to(ROOT)),
                     'chapter_card_sha256': sha(image_path),
                     'chapter_start_seconds': round(cursor, 3),
                     'source_clip_start_seconds': round(cursor + chapter_duration, 3),
                     'chapter_end_seconds': round(cursor + chapter_duration + clip_duration, 3)}
            entries.append(entry)
            source_paths.append(clip_path)
            concat_paths.extend([chapter_path, clip_path])
            cursor += chapter_duration + clip_duration
        listing = scratch / 'segments.txt'
        listing.write_text(''.join("file '" + str(path).replace("'", "'\\''") + "'\n"
                                   for path in concat_paths))
        concatenated = scratch / 'concatenated.mp4'
        run(['ffmpeg', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing),
             '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy',
             '-movflags', '+faststart', '-y', str(concatenated)])
        # Different H.264 sequence headers in the source clips can survive a
        # packet-copy concat yet fail in a browser. Normalize one CFR video
        # stream, omit the MP4 chapter/data track, and copy AAC untouched.
        run(['ffmpeg', '-v', 'error', '-i', str(concatenated),
             '-map', '0:v:0', '-map', '0:a:0', '-map_metadata', '-1', '-map_chapters', '-1',
             '-dn', '-sn', '-vf', 'fps=25,format=yuv420p', '-r', '25',
             '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.1',
             '-preset', 'medium', '-crf', '20', '-c:a', 'copy',
             '-movflags', '+faststart', '-y', str(REEL)])
    run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(REEL), '-f', 'null', '-'])
    duration = float(probe(REEL)['format']['duration'])
    assert abs(duration - cursor) < .15, (duration, cursor)
    browser_probe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams',
                                    '-show_format', '-of', 'json', str(REEL)]).stdout)
    streams = browser_probe['streams']
    assert len(streams) == 2 and [x['codec_type'] for x in streams] == ['video', 'audio']
    video, audio = streams
    assert (video['codec_name'], video['pix_fmt'], video['r_frame_rate'],
            video['avg_frame_rate']) == ('h264', 'yuv420p', '25/1', '25/1')
    assert video['profile'] == 'High' and video['level'] <= 41
    assert audio['codec_name'] == 'aac' and audio['profile'] == 'LC'
    assert audio['sample_rate'] == '48000' and audio['channels'] == 2
    data = REEL.read_bytes()
    assert data.find(b'moov') < data.find(b'mdat')
    output_audio = packet_hashes(REEL, 'a:0')
    audio_position = 0
    packet_counts = {}
    for index, clip_path in enumerate(source_paths, 1):
        expected = packet_hashes(clip_path, 'a:0')
        found = next((i for i in range(audio_position, len(output_audio)-len(expected)+1)
                      if output_audio[i:i+len(expected)] == expected), None)
        assert found is not None, (clip_path, 'audio')
        audio_position = found + len(expected)
        packet_counts[index] = {'audio': len(expected)}
    visual_sheets = qa_sheets(entries)
    receipt = {'schema_version': 1, 'status': 'review_only_not_audible_signoff',
               'reel_path': str(REEL.relative_to(ROOT)), 'reel_sha256': sha(REEL),
               'duration_seconds': duration, 'chapter_card_duration_seconds': CHAPTER_SECONDS,
               'chapter_count': len(entries), 'chapters': entries,
               'source_audio_packets_preserved_in_order': True,
               'source_video_reencoded_as_single_browser_compatible_stream': True,
               'source_packet_counts': packet_counts,
               'visual_contact_sheets': visual_sheets,
               'audio_treatment': 'Six pre-existing before/after MP4s were concatenated, then only video was re-encoded. Chapter-card silence was newly AAC-encoded; all six source comparison AAC packet payload hashes match the browser-safe reel in order.',
               'video_treatment': 'One constant-25-fps H.264 High Profile 4.1 yuv420p stream; no MP4 chapter/data track; faststart moov precedes mdat.',
               'embedded_mp4_chapter_track': False,
               'chapter_timestamps_in_listening_index': True,
               'browser_compatible_probe': {'stream_count': len(streams),
                                            'video_codec': video['codec_name'],
                                            'video_profile': video['profile'],
                                            'video_level': video['level'],
                                            'video_pixel_format': video['pix_fmt'],
                                            'video_frame_rate': video['avg_frame_rate'],
                                            'audio_codec': audio['codec_name'],
                                            'audio_profile': audio['profile'],
                                            'audio_sample_rate': audio['sample_rate'],
                                            'audio_channels': audio['channels'],
                                            'faststart_moov_before_mdat': True},
               'full_mp4_decode': 'passed', 'voice_generation': False,
               'canonical_media_or_learner_binding_changed': False,
               'residual_uncertainty': 'Listening judgment remains open; the reel does not qualify full-lesson timing or final narration.'}
    RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
    for row in entries:
        print(f"{row['index']:02d} {row['title']} {row['chapter_start_seconds']:.2f}s clip {row['source_clip_start_seconds']:.2f}s")
    print(f'Reel {duration:.2f}s; all six source audio packet sequences preserved')


if __name__ == '__main__':
    main()
