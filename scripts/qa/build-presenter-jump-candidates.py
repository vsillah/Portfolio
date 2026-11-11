#!/usr/bin/env python3
"""Build review-only presenter jump edits from existing native packets and cards."""
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACK = ROOT / 'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json'
TRIAGE = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/presenter-jump-triage.json'
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
# ASR blocks that start after a spoken chapter label, plus one paraphrased lead.
# These are sentence-onset word times read from the full-window small.en JSON.
ONSET_OVERRIDES = {('L02', 'A01'): 21.81, ('L08', 'A01'): 24.80,
                   ('L10', 'A01'): 22.63, ('L15', 'A01'): 22.51,
                   ('L10', 'A03'): 3.24}
BLOCKED_CUTS = {
    ('L06', 'A01'): '“cards” ends against “Now”; machine check loses the final plural sound.',
    ('L16', 'A01'): '“pain point” ends against “Write”; machine check loses the final words.',
    ('L16', 'A02'): '“it” ends against “Put”; machine check loses the final word.',
}
SEQUENCE_CONDITIONS = {
    ('L05', 'A02'): 'A03 begins “Not a verdict”; it needs the removed “Our six notes support a question” immediately before it.',
    ('L06', 'A02'): 'A03 begins “and finds”; it needs the removed “Imagine the team tests the card” immediately before it.',
    ('L08', 'A02'): 'A03 begins “Walk the plan”; it needs the removed “Before there is any data” immediately before it.',
}
COORDINATED_PROPOSALS = {
    ('L05', 'A02'): 'artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l05-sequence-before-after.mp4',
    ('L06', 'A02'): 'artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l06-sequence-before-after.mp4',
    ('L08', 'A02'): 'artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences/l08-sequence-before-after.mp4',
}


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_entries',
                           'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate',
                           '-of', 'json', str(path)]).stdout)


def packets(path, with_time=False):
    fields = 'packet=data_hash,pts_time' if with_time else 'packet=data_hash'
    result = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'a:0',
                             '-show_packets', '-show_data_hash', 'sha256',
                             '-show_entries', fields, '-of', 'json', str(path)]).stdout)
    return result['packets']


def silence_peak(path):
    result = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'info', '-i', str(path),
                             '-af', 'volumedetect', '-f', 'null', '-'],
                            capture_output=True, text=True, check=True)
    match = re.search(r'max_volume: (-?[\d.]+) dB', result.stderr)
    if not match:
        raise ValueError(f'No volume measurement for {path}')
    return float(match.group(1))


def make_label(path, title, detail, before=False):
    image = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((290, 18, 1630, 132), radius=18, fill=(7, 19, 35, 226))
    draw.rounded_rectangle((42, 936, 842, 1026), radius=14, fill=(7, 19, 35, 210))
    large = ImageFont.truetype(FONT, 34)
    small = ImageFont.truetype(FONT, 28)
    draw.text((315, 34), title, font=large, fill=(246, 201, 106, 255))
    draw.text((315, 77), detail, font=small, fill=(255, 255, 255, 255))
    draw.text((67, 955), 'BEFORE · NATIVE SOURCE' if before else 'AFTER · REVIEW-ONLY EDIT',
              font=small, fill=(255, 255, 255, 255))
    image.save(path)


def source_word_context(lesson, entry, orientation):
    script = ' '.join(re.findall(r'```narration\n(.*?)\n```',
                                (ROOT / lesson['source_script']['path']).read_text(), re.S))
    matches = list(re.finditer(r"[\w’']+", script))
    from_word, to_word = entry['script_word_jump']
    if orientation == 'tail':
        return {'retained_approved_words_end': script[matches[max(0, from_word - 8)].start():matches[from_word - 1].end()],
                'removed_later_phrase_start': script[matches[to_word].start():matches[min(to_word + 11, len(matches) - 1)].end()]}
    return {'removed_earlier_phrase_end': script[matches[max(0, from_word - 8)].start():matches[from_word - 1].end()],
            'retained_approved_words_start': script[matches[to_word].start():matches[min(to_word + 11, len(matches) - 1)].end()]}


def build_one(entry, lesson):
    lid, window = entry['lesson_id'], entry['presenter_window']
    source = ROOT / lesson['native_source']['path']
    assert digest(source) == entry['source_media_sha256']
    presenter = [w for w in lesson['windows'] if w['kind'] == 'presenter'][int(window[1:]) - 1]
    orientation = ('tail' if abs(presenter['word_start'] - entry['script_word_jump'][0]) <
                   abs(presenter['word_start'] - entry['script_word_jump'][1]) else 'head')
    start, end = presenter['native_media_start_seconds'], presenter['native_media_end_seconds']
    onset = ONSET_OVERRIDES.get((lid, window), entry['small_word_time_in_window_seconds'][0])
    suggested_cut = start + onset
    # Use the last native AAC packet boundary no later than the machine onset.
    packet_times = [float(p['pts_time']) for p in packets(source, with_time=True) if 'pts_time' in p]
    cut = max(t for t in packet_times if suggested_cut - 0.03 <= t <= suggested_cut)
    assert start + 0.5 < cut < end - 0.5
    length = end - start
    base = f'{lid.lower()}-{window.lower()}-{orientation}'
    candidate = OUT / f'{base}-candidate.mp4'
    comparison = OUT / f'{base}-before-after.mp4'
    receipt_path = OUT / f'{base}-receipt.json'
    with tempfile.TemporaryDirectory(prefix=f'{base}-') as tmp:
        scratch = pathlib.Path(tmp)
        card_time = end + 1 if orientation == 'tail' else start - 1
        silent_source_time = end + 2 if orientation == 'tail' else max(0, start - 8)
        card = scratch / 'adjacent-native-card.png'
        run(['ffmpeg', '-v', 'error', '-ss', str(card_time), '-i', str(source),
             '-frames:v', '1', '-y', str(card)])
        label = scratch / 'after-label.png'
        before_label = scratch / 'before-label.png'
        title = f'{lid} {window} · {orientation.upper()} CUT {cut // 60:02.0f}:{cut % 60:05.2f}'
        detail = f'Source {start:.2f}–{end:.2f} s · candidate, not sign-off'
        make_label(label, title, detail)
        make_label(before_label, title, detail, before=True)
        native = scratch / 'retained-native.m4a'
        silent = scratch / 'copied-native-silence.m4a'
        joined = scratch / 'spliced-audio.m4a'
        native_start = start if orientation == 'tail' else cut
        native_len = cut - start if orientation == 'tail' else end - cut
        silence_len = end - cut if orientation == 'tail' else cut - start
        run(['ffmpeg', '-v', 'error', '-i', str(source), '-ss', f'{native_start:.6f}',
             '-t', f'{native_len:.6f}', '-map', '0:a:0', '-c:a', 'copy', '-y', str(native)])
        run(['ffmpeg', '-v', 'error', '-i', str(source), '-ss', f'{silent_source_time:.6f}',
             '-t', f'{silence_len:.6f}', '-map', '0:a:0', '-c:a', 'copy', '-y', str(silent)])
        peak = silence_peak(silent)
        assert peak <= -70, (lid, window, peak)
        audio_list = scratch / 'audio.txt'
        first, second = (native, silent) if orientation == 'tail' else (silent, native)
        audio_list.write_text(f"file '{first}'\nfile '{second}'\n")
        run(['ffmpeg', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(audio_list),
             '-c:a', 'copy', '-y', str(joined)])
        retain_hashes = [x['data_hash'] for x in packets(native)]
        silence_hashes = [x['data_hash'] for x in packets(silent)]
        expected = retain_hashes + silence_hashes if orientation == 'tail' else silence_hashes + retain_hashes
        assert [x['data_hash'] for x in packets(joined)] == expected
        enable = f"gte(t,{cut - start:.6f})" if orientation == 'tail' else f"lt(t,{cut - start:.6f})"
        run(['ffmpeg', '-v', 'error', '-ss', f'{start:.6f}', '-i', str(source),
             '-loop', '1', '-i', str(card), '-loop', '1', '-i', str(label),
             '-i', str(joined), '-filter_complex',
             f"[0:v]setpts=PTS-STARTPTS[base];[base][1:v]overlay=enable='{enable}':shortest=0:repeatlast=1[card];[card][2:v]overlay=shortest=0:repeatlast=1:format=auto,format=yuv420p[v]",
             '-map', '[v]', '-map', '3:a:0', '-t', f'{length:.6f}', '-r', '25',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'copy',
             '-movflags', '+faststart', '-y', str(candidate)])
        assert [x['data_hash'] for x in packets(candidate)] == expected
        # A short paired review focuses on the edit; audio here is re-encoded
        # for reliable sequential playback. The isolated candidate is packet copy.
        local_start = max(0, (cut - start) - 3.5)
        local_end = min(length, (cut - start) + 3.5)
        review_len = local_end - local_start
        source_review_start = start + local_start
        run(['ffmpeg', '-v', 'error', '-ss', f'{source_review_start:.6f}', '-i', str(source),
             '-ss', f'{local_start:.6f}', '-i', str(candidate),
             '-loop', '1', '-i', str(before_label),
             '-filter_complex',
             f"[0:v]trim=duration={review_len:.6f},setpts=PTS-STARTPTS[v0raw];"
             f"[v0raw][2:v]overlay=shortest=1:repeatlast=1:format=auto[v0];"
             f"[1:v]trim=duration={review_len:.6f},setpts=PTS-STARTPTS[v1];"
             f"[0:a]atrim=duration={review_len:.6f},asetpts=PTS-STARTPTS[a0];"
             f"[1:a]atrim=duration={review_len:.6f},asetpts=PTS-STARTPTS[a1];"
             '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
             '-map', '[v]', '-map', '[a]', '-t', f'{2 * review_len + 0.1:.6f}',
             '-r', '25', '-c:v', 'libx264',
             '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k',
             '-movflags', '+faststart', '-y', str(comparison)])
        assert abs(float(probe(comparison)['format']['duration']) - 2 * review_len) < 0.15
        assert abs(float(probe(candidate)['format']['duration']) - length) < 0.1
        for path in (candidate, comparison):
            run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'])
        receipt = {'status': 'review_only_machine_candidate_not_audibly_signed_off',
                   'lesson_id': lid, 'presenter_window': window, 'orientation': orientation,
                   'source_path': lesson['native_source']['path'], 'source_sha256': entry['source_media_sha256'],
                   'source_window_seconds': [start, end], 'candidate_cut_seconds': cut,
                   'machine_onset_seconds': suggested_cut, 'aac_snap_delta_seconds': round(suggested_cut - cut, 6),
                   'intended_words': source_word_context(lesson, entry, orientation),
                   'silent_packet_source_start_seconds': silent_source_time,
                   'copied_silence_peak_dbfs': peak, 'retained_native_packet_count': len(retain_hashes),
                   'copied_silence_packet_count': len(silence_hashes),
                   'candidate_audio_packets_match_source_extracts': True,
                   'candidate_path': str(candidate.relative_to(ROOT)), 'candidate_sha256': digest(candidate),
                   'before_after_path': str(comparison.relative_to(ROOT)), 'before_after_sha256': digest(comparison),
                   'before_after_source_excerpt_seconds': [source_review_start, source_review_start + review_len],
                   'before_after_segment_seconds': round(review_len, 3),
                   'candidate_duration_seconds': float(probe(candidate)['format']['duration']),
                   'before_after_duration_seconds': float(probe(comparison)['format']['duration']),
                   'full_mp4_decode': 'passed', 'voice_generation': False, 'learner_binding': False,
                   'residual_uncertainty': 'Machine onset and packet snap need audible first/last-phoneme confirmation; adjacent presenter windows may need a coordinated edit.'}
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        return receipt


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pack = json.loads(PACK.read_text())
    triage = json.loads(TRIAGE.read_text())
    results = []
    for entry in triage['entries']:
        if entry['lesson_id'] == 'L01' and entry['presenter_window'] == 'A02':
            continue  # Already has the approved review clip and isolated candidate.
        blocked_reason = BLOCKED_CUTS.get((entry['lesson_id'], entry['presenter_window']))
        if blocked_reason:
            results.append({'lesson_id': entry['lesson_id'], 'presenter_window': entry['presenter_window'],
                            'status': 'blocked_no_clean_packet_gap', 'reason': blocked_reason})
            continue
        lesson = next(x for x in pack['lessons'] if x['lesson_id'] == entry['lesson_id'])
        try:
            receipt = build_one(entry, lesson)
            results.append({'lesson_id': entry['lesson_id'], 'presenter_window': entry['presenter_window'],
                            'status': 'rendered_pending_asr_and_audible_review',
                            'receipt': receipt['candidate_path'].replace('-candidate.mp4', '-receipt.json')})
            print(f"{entry['lesson_id']} {entry['presenter_window']} ready", flush=True)
        except Exception as error:
            results.append({'lesson_id': entry['lesson_id'], 'presenter_window': entry['presenter_window'],
                            'status': 'blocked', 'reason': str(error)[:400]})
            print(f"{entry['lesson_id']} {entry['presenter_window']} BLOCKED: {error}", flush=True)
    validation = OUT / 'asr-validation.json'
    if validation.exists():
        checked = {(r['lesson_id'], r['presenter_window']): r
                   for r in json.loads(validation.read_text())['results']}
        for result in results:
            if result['status'].startswith('blocked'):
                continue
            row = checked.get((result['lesson_id'], result['presenter_window']))
            receipt = json.loads((ROOT / result['receipt']).read_text())
            if row and row['candidate_sha256'] == receipt['candidate_sha256']:
                result['status'] = ('machine_pass_pending_audible_review'
                                    if row['machine_result'].startswith('passed')
                                    else 'machine_blocked_cut_boundary')
                condition = SEQUENCE_CONDITIONS.get((result['lesson_id'], result['presenter_window']))
                if condition and row['machine_result'].startswith('passed'):
                    result['status'] = 'machine_pass_conditional_on_following_window'
                    result['sequence_condition'] = condition
                    result['coordinated_proposal'] = COORDINATED_PROPOSALS[(result['lesson_id'], result['presenter_window'])]
    manifest = {'schema_version': 1, 'status': 'review_only',
                'source_pack_sha256': digest(PACK), 'triage_sha256': digest(TRIAGE),
                'approved_existing_l01_a02_candidate': 'l01-a02-native-trim-candidate-235-252.mp4',
                'asr_validation_path': str(validation.relative_to(ROOT)) if validation.exists() else None,
                'results': results, 'rendered_count': sum(not r['status'].startswith('blocked') for r in results),
                'machine_pass_count': sum(r['status'] in ('machine_pass_pending_audible_review',
                                                        'machine_pass_conditional_on_following_window') for r in results),
                'sequence_conditional_count': sum(r['status'] == 'machine_pass_conditional_on_following_window' for r in results),
                'machine_blocked_count': sum(r['status'] == 'machine_blocked_cut_boundary' for r in results),
                'boundary_blocked_count': sum(r['status'] == 'blocked_no_clean_packet_gap' for r in results),
                'render_blocked_count': sum(r['status'] == 'blocked' for r in results)}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f"Rendered {manifest['rendered_count']}; machine pass {manifest['machine_pass_count']}; "
          f"machine blocked {manifest['machine_blocked_count']}; boundary blocked "
          f"{manifest['boundary_blocked_count']}; render blocked {manifest['render_blocked_count']}")


if __name__ == '__main__':
    main()
