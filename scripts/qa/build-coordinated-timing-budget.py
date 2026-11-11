#!/usr/bin/env python3
"""Measure review-only C02-to-A03 timing for native sentence moves."""
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile
import wave

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACK = ROOT / 'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json'
SEQUENCES = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences'
OUT = SEQUENCES / 'timing-budget.json'
LESSONS = ('L05', 'L06', 'L08')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def milli(value):
    result = round(value, 3)
    return 0.0 if result == 0 else result


def main():
    pack = json.loads(PACK.read_text())
    manifest = json.loads((SEQUENCES / 'manifest.json').read_text())
    assert manifest['source_pack_sha256'] == sha(PACK)
    assert {x['lesson_id'] for x in manifest['results']} == set(LESSONS)
    results = []
    for lid in LESSONS:
        lesson = next(x for x in pack['lessons'] if x['lesson_id'] == lid)
        row = next(x for x in manifest['results'] if x['lesson_id'] == lid)
        receipt_path = ROOT / row['receipt']
        receipt = json.loads(receipt_path.read_text())
        source = ROOT / lesson['native_source']['path']
        source_sha = sha(source)
        assert source_sha == lesson['native_source']['sha256'] == receipt['source_sha256']
        c02 = next(x for x in lesson['windows'] if x['id'] == 'C02')
        a02 = next(x for x in lesson['windows'] if x['id'] == 'P02')
        a03 = next(x for x in lesson['windows'] if x['id'] == 'P03')
        assert sha_text(c02['text']) == c02['text_sha256']
        assert len(re.findall(r"[\w’']+", c02['text'])) == c02['word_count']
        old_start = c02['planned_start_seconds']
        old_end = c02['planned_end_seconds']
        old_duration = c02['planned_duration_seconds']
        assert abs(old_start - a02['native_media_end_seconds']) < 1e-6
        assert abs(old_end - a03['native_media_start_seconds']) < 1e-6
        assert abs(old_end - old_start - old_duration) < 1e-6
        cut = receipt['split_seconds']
        moved_end = a02['native_media_end_seconds']
        with tempfile.TemporaryDirectory(prefix=f'{lid.lower()}-timing-') as tmp:
            extracted = pathlib.Path(tmp) / 'moved-native.wav'
            subprocess.run(['ffmpeg', '-v', 'error', '-i', str(source),
                            '-af', f'atrim=start={cut:.6f}:end={moved_end:.6f},'
                                   'asetpts=PTS-STARTPTS,aresample=48000',
                            '-c:a', 'pcm_s16le', '-ar', '48000', '-y', str(extracted)],
                           check=True, capture_output=True)
            with wave.open(str(extracted), 'rb') as audio:
                assert audio.getframerate() == 48000
                source_frames = audio.getnframes()
                measured = source_frames / audio.getframerate()
        assert abs(measured - receipt['moved_opening_duration_seconds']) <= 1/48000 + 1e-9
        # Move C02 earlier by exactly the source-tail duration. The same source
        # tail then occupies the former last part of C02, ending at A03.
        proposed_c02_start = cut
        proposed_c02_end = old_end - measured
        proposed_c02_duration = proposed_c02_end - proposed_c02_start
        margin = proposed_c02_duration - old_duration
        assert abs(margin) < 1/48000 + 1e-6
        assert abs(proposed_c02_end + measured - a03['native_media_start_seconds']) < 1/48000 + 1e-6
        results.append({
            'lesson_id': lid,
            'source_path': lesson['native_source']['path'],
            'source_sha256': source_sha,
            'coordinated_receipt_path': row['receipt'],
            'coordinated_receipt_sha256': sha(receipt_path),
            'approved_c02_text_sha256': c02['text_sha256'],
            'approved_c02_word_count': c02['word_count'],
            'original_c02_seconds': [old_start, old_end],
            'original_c02_planned_duration_seconds': old_duration,
            'original_c02_planned_words_per_minute': round(c02['word_count'] * 60 / old_duration, 2),
            'a02_source_window_seconds': [a02['native_media_start_seconds'], a02['native_media_end_seconds']],
            'a03_source_window_seconds': [a03['native_media_start_seconds'], a03['native_media_end_seconds']],
            'native_a02_split_seconds': cut,
            'moved_native_source_span_seconds': [cut, moved_end],
            'measured_native_source_frames_48000hz': source_frames,
            'measured_moved_opening_duration_seconds': milli(measured),
            'proposed_a02_presenter_end_seconds': cut,
            'proposed_c02_seconds': [milli(proposed_c02_start), milli(proposed_c02_end)],
            'proposed_c02_duration_seconds': milli(proposed_c02_duration),
            'proposed_moved_opening_seconds': [milli(proposed_c02_end), old_end],
            'proposed_a03_continuation_start_seconds': a03['native_media_start_seconds'],
            'remaining_c02_duration_margin_seconds': milli(margin),
            'unallocated_transition_buffer_seconds': 0.0,
            'planned_word_rate_change': 0.0,
            'schedule_result': 'same_c02_duration_with_zero_unallocated_buffer',
            'qualification': 'Review-only arithmetic. C02 speech is approved text, not rendered provider audio; audible joins, actual voice pace, and transition room remain unverified.',
        })
    result = {'schema_version': 1, 'status': 'review_only_timing_budget_not_audio_signoff',
              'source_pack_sha256': sha(PACK),
              'sequence_manifest_sha256': sha(SEQUENCES / 'manifest.json'),
              'method': 'Measure moved native AAC source span after PCM decode at 48 kHz; shift the unchanged approved C02 window earlier by that duration and place the source opening immediately before the original A03 start.',
              'results': results,
              'narration_text_or_payload_changed': False,
              'canonical_media_or_learner_binding_changed': False}
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    for row in results:
        print(row['lesson_id'], 'C02', row['proposed_c02_seconds'], 'opening',
              row['proposed_moved_opening_seconds'], 'margin',
              row['remaining_c02_duration_margin_seconds'])


def sha_text(value):
    return hashlib.sha256(value.encode()).hexdigest()


if __name__ == '__main__':
    main()
