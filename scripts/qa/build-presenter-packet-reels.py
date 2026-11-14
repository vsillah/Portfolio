#!/usr/bin/env python3
"""Package 24 packet-copy review clips into three browser-safe eight-clip reels."""
import hashlib
import importlib.util
import json
import pathlib
import re
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10'
NATIVE = ARTIFACTS / 'native-jump-candidates'
OUT = ARTIFACTS / 'packet-copy-listening-reels'
PACK = ROOT / 'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json'
TRIAGE = ARTIFACTS / 'presenter-jump-triage.json'
CARD_SECONDS = 2.4

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('priority_reel', ROOT / 'scripts/qa/build-presenter-priority-reel.py')
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


def words(text):
    return re.findall(r"[\w’']+", text)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def script_order(row, receipt, pack, triage):
    lesson = next(x for x in pack['lessons'] if x['lesson_id'] == row['lesson_id'])
    entry = next(x for x in triage['entries'] if (x['lesson_id'], x['presenter_window']) ==
                 (row['lesson_id'], row['presenter_window']))
    script = ' '.join(re.findall(r'```narration\n(.*?)\n```',
                                 (ROOT / lesson['source_script']['path']).read_text(), re.S))
    tokens = words(script)
    first, second = entry['script_word_jump']
    context = receipt['intended_words']
    if receipt['orientation'] == 'tail':
        retained = words(context['retained_approved_words_end'])
        removed = words(context['removed_later_phrase_start'])
    else:
        retained = words(context['retained_approved_words_start'])
        removed = words(context['removed_earlier_phrase_end'])
    if receipt['orientation'] == 'tail':
        assert tokens[first-len(retained):first] == retained
        assert tokens[second:second+len(removed)] == removed
    else:
        assert tokens[first-len(removed):first] == removed
        assert tokens[second:second+len(retained)] == retained
    assert first < second
    return {'approved_script_sha256': lesson['source_script']['sha256'],
            'script_word_jump': [first, second], 'orientation': receipt['orientation'],
            'retained_words': ' '.join(retained), 'removed_words': ' '.join(removed),
            'verified': True}


def qa_sheets(reel, entries, reel_number):
    sheets = {}
    with tempfile.TemporaryDirectory(prefix=f'packet-reel-{reel_number}-frames-') as tmp:
        scratch = pathlib.Path(tmp)
        for kind, key, offset in [('chapter', 'chapter_start_seconds', .35),
                                  ('source', 'source_clip_start_seconds', .5)]:
            canvas = Image.new('RGB', (1280, 1440), (0, 0, 0))
            for i, row in enumerate(entries):
                frame = scratch / f'{kind}-{i+1:02d}.png'
                media.run(['ffmpeg', '-v', 'error', '-ss', f"{row[key]+offset:.3f}",
                           '-i', str(reel), '-frames:v', '1', '-update', '1',
                           '-y', str(frame)])
                with Image.open(frame) as image:
                    canvas.paste(image.resize((640, 360)), ((i % 2)*640, (i // 2)*360))
            path = OUT / f'reel-{reel_number:02d}-{kind}-contact-sheet.png'
            canvas.save(path)
            sheets[kind] = {'path': str(path.relative_to(ROOT)), 'sha256': sha(path)}
    return sheets


def browser_probe(path):
    result = json.loads(media.run(['ffprobe', '-v', 'error', '-show_streams',
                                   '-show_format', '-of', 'json', str(path)]).stdout)
    streams = result['streams']
    assert len(streams) == 2 and [x['codec_type'] for x in streams] == ['video', 'audio']
    video, audio = streams
    assert (video['codec_name'], video['profile'], video['pix_fmt'],
            video['r_frame_rate'], video['avg_frame_rate']) == ('h264', 'High', 'yuv420p', '25/1', '25/1')
    assert video['level'] <= 41
    assert (audio['codec_name'], audio['profile'], audio['sample_rate'], audio['channels']) == ('aac', 'LC', '48000', 2)
    data = path.read_bytes()
    assert data.find(b'moov') < data.find(b'mdat')
    return {'stream_count': 2, 'video_codec': 'H.264 High Profile',
            'video_level': video['level'], 'pixel_format': video['pix_fmt'],
            'frame_rate': video['avg_frame_rate'], 'audio_codec': 'AAC LC',
            'audio_sample_rate': audio['sample_rate'], 'audio_channels': audio['channels'],
            'faststart_moov_before_mdat': True, 'no_data_or_chapter_track': True}


def build_group(number, rows, pack, triage, asr):
    assert len(rows) == 8
    reel = OUT / f'packet-copy-listening-reel-{number:02d}.mp4'
    entries, clips = [], []
    cursor = 0.0
    with tempfile.TemporaryDirectory(prefix=f'packet-reel-{number}-') as tmp:
        scratch = pathlib.Path(tmp)
        paths = []
        for chapter, row in enumerate(rows, 1):
            lid, window = row['lesson_id'], row['presenter_window']
            receipt_path = ROOT / row['receipt']
            receipt = json.loads(receipt_path.read_text())
            source = ROOT / receipt['before_after_path']
            assert sha(source) == receipt['before_after_sha256']
            assert sha(ROOT / receipt['candidate_path']) == receipt['candidate_sha256']
            checked = next(x for x in asr['results'] if (x['lesson_id'], x['presenter_window']) == (lid, window))
            assert checked['candidate_sha256'] == receipt['candidate_sha256']
            assert checked['machine_result'].startswith('passed')
            assert all(flags['removed_phrase_in_before'] and not flags['removed_phrase_in_after']
                       and flags['retained_phrase_in_after'] for flags in checked['model_checks'].values())
            order = script_order(row, receipt, pack, triage)
            source_probe = media.probe(source)
            video = next(x for x in source_probe['streams'] if x['codec_type'] == 'video')
            audio = next(x for x in source_probe['streams'] if x['codec_type'] == 'audio')
            assert (video['width'], video['height'], video['r_frame_rate']) == (1920, 1080, '25/1')
            assert (audio['codec_name'], audio['sample_rate'], audio['channels']) == ('aac', '48000', 2)
            conditional = row['status'] == 'machine_pass_conditional_on_following_window'
            label = f'{lid} {window} · {receipt["orientation"].upper()} CUT'
            phrase = f'KEEP “{checked["retained_probe_words"]}”'
            instruction = f'OMIT “{checked["removed_probe_words"]}”'
            if conditional:
                instruction += '\nALTERNATE CUT · coordinated join approved at a different split.'
            card_path = OUT / f'reel-{number:02d}-chapter-{chapter:02d}.png'
            media.card(card_path, chapter, label, phrase, instruction, total=8)
            card_video = scratch / f'chapter-{chapter:02d}.mp4'
            media.run(['ffmpeg', '-v', 'error', '-loop', '1', '-framerate', '25',
                       '-i', str(card_path), '-f', 'lavfi', '-i',
                       'anullsrc=channel_layout=stereo:sample_rate=48000',
                       '-t', str(CARD_SECONDS), '-r', '25', '-c:v', 'libx264',
                       '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
                       '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
                       '-y', str(card_video)])
            card_duration = float(media.probe(card_video)['format']['duration'])
            clip_duration = float(source_probe['format']['duration'])
            entries.append({'chapter': chapter, 'lesson_id': lid, 'presenter_window': window,
                            'orientation': receipt['orientation'], 'conditional_alternate_cut': conditional,
                            'source_clip_path': receipt['before_after_path'],
                            'source_clip_sha256': receipt['before_after_sha256'],
                            'source_receipt_path': row['receipt'],
                            'source_receipt_sha256': sha(receipt_path),
                            'source_candidate_sha256': receipt['candidate_sha256'],
                            'source_clip_duration_seconds': clip_duration,
                            'chapter_card_path': str(card_path.relative_to(ROOT)),
                            'chapter_card_sha256': sha(card_path),
                            'chapter_start_seconds': round(cursor, 3),
                            'source_clip_start_seconds': round(cursor+card_duration, 3),
                            'chapter_end_seconds': round(cursor+card_duration+clip_duration, 3),
                            'retained_probe_words': checked['retained_probe_words'],
                            'removed_probe_words': checked['removed_probe_words'],
                            'approved_script_order': order})
            clips.append(source)
            paths += [card_video, source]
            cursor += card_duration + clip_duration
        listing = scratch / 'segments.txt'
        listing.write_text(''.join("file '" + str(path).replace("'", "'\\''") + "'\n"
                                   for path in paths))
        joined = scratch / 'joined.mp4'
        media.run(['ffmpeg', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing),
                   '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy',
                   '-movflags', '+faststart', '-y', str(joined)])
        media.run(['ffmpeg', '-v', 'error', '-i', str(joined), '-map', '0:v:0',
                   '-map', '0:a:0', '-map_metadata', '-1', '-map_chapters', '-1',
                   '-dn', '-sn', '-vf', 'fps=25,format=yuv420p', '-r', '25',
                   '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.1',
                   '-preset', 'medium', '-crf', '20', '-c:a', 'copy',
                   '-movflags', '+faststart', '-y', str(reel)])
    media.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(reel), '-f', 'null', '-'])
    duration = float(media.probe(reel)['format']['duration'])
    assert abs(duration - cursor) < .2, (duration, cursor)
    output_audio = media.packet_hashes(reel, 'a:0')
    position = 0
    counts = []
    for clip in clips:
        hashes = media.packet_hashes(clip, 'a:0')
        found = next((i for i in range(position, len(output_audio)-len(hashes)+1)
                      if output_audio[i:i+len(hashes)] == hashes), None)
        assert found is not None, clip
        position = found + len(hashes)
        counts.append(len(hashes))
    sheets = qa_sheets(reel, entries, number)
    receipt = {'schema_version': 1, 'status': 'review_only_not_audibly_signed_off',
               'reel_number': number, 'reel_path': str(reel.relative_to(ROOT)),
               'reel_sha256': sha(reel), 'duration_seconds': duration,
               'chapter_card_duration_seconds': CARD_SECONDS,
               'chapter_count': len(entries), 'chapters': entries,
               'native_manifest_sha256': sha(NATIVE / 'manifest.json'),
               'native_asr_validation_sha256': sha(NATIVE / 'asr-validation.json'),
               'source_audio_packets_preserved_in_order': True,
               'source_audio_packet_counts': counts,
               'visual_contact_sheets': sheets,
               'browser_compatible_probe': browser_probe(reel),
               'audio_treatment': 'Existing sequential before/after AAC packet payloads copied unchanged; chapter-card silence newly AAC-encoded. One CFR H.264 video stream re-encoded for browser playback.',
               'conditional_alternate_clips': [f"{x['lesson_id']} {x['presenter_window']}" for x in entries if x['conditional_alternate_cut']],
               'full_mp4_decode': 'passed', 'voice_generation': False,
               'canonical_media_or_learner_binding_changed': False,
               'residual_uncertainty': 'All eight cuts still need audible first/last-word review; conditional A02 packet cuts differ from their approved coordinated joins.'}
    receipt_path = OUT / f'reel-{number:02d}-receipt.json'
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
    print(f'Reel {number}: {duration:.2f}s, {len(entries)} clips, source AAC packets preserved', flush=True)
    return {'reel_number': number, 'receipt_path': str(receipt_path.relative_to(ROOT)),
            'receipt_sha256': sha(receipt_path), 'reel_path': str(reel.relative_to(ROOT)),
            'reel_sha256': sha(reel), 'chapter_count': len(entries),
            'duration_seconds': duration}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    native_manifest = json.loads((NATIVE / 'manifest.json').read_text())
    asr = json.loads((NATIVE / 'asr-validation.json').read_text())
    pack = json.loads(PACK.read_text())
    triage = json.loads(TRIAGE.read_text())
    rows = [x for x in native_manifest['results'] if x['status'].startswith('machine_pass')]
    assert len(rows) == 24 and asr['machine_pass_count'] == 24
    groups = [rows[i:i+8] for i in range(0, len(rows), 8)]
    assert len(groups) == 3 and all(len(x) == 8 for x in groups)
    reels = [build_group(i, rows, pack, triage, asr) for i, rows in enumerate(groups, 1)]
    manifest = {'schema_version': 1, 'status': 'review_only_24_pending_packet_copy_cuts',
                'native_manifest_sha256': sha(NATIVE / 'manifest.json'),
                'native_asr_validation_sha256': sha(NATIVE / 'asr-validation.json'),
                'source_pack_sha256': sha(PACK), 'source_triage_sha256': sha(TRIAGE),
                'reels': reels, 'reel_count': 3, 'clips_per_reel': 8,
                'total_pending_clips': 24, 'audibly_approved_packet_copy_clips': 0,
                'priority_six_clip_approval_does_not_extend_to_these_reels': True}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__':
    main()
