#!/usr/bin/env python3
"""Build source-bound, review-only timing decisions for Accelerated lessons."""
import hashlib
import json
import pathlib
import re
import statistics
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = pathlib.Path('artifacts/accelerated-visual-parity-2026-11-10')
PACK = pathlib.Path('docs/accelerated-course-modules/narration-production-pack-2026-11-10.json')
OUT = BASE / 'full-lesson-timing-decisions.json'
PRIORITY = BASE / 'priority-listening-reel/human-listening-receipt-2026-11-11.json'
PACKET = BASE / 'packet-copy-listening-reels/human-listening-receipt-2026-11-11.json'
BUDGET = BASE / 'coordinated-presenter-sequences/timing-budget.json'
TRIAGE = BASE / 'presenter-jump-triage.json'


def read(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def words(text):
    return re.findall(r"[\w’']+", text)


def seconds(timestamp):
    parts = timestamp.split(':')
    hours, minutes, second = (['0'] + parts) if len(parts) == 2 else parts
    return int(hours) * 3600 + int(minutes) * 60 + float(second)


def vtt_boundaries(path, windows):
    cues = []
    for match in re.finditer(r'(?m)^((?:\d\d:)?\d\d:\d\d\.\d+) --> ((?:\d\d:)?\d\d:\d\d\.\d+)$', (ROOT / path).read_text()):
        cues.append([seconds(match.group(1)), seconds(match.group(2))])
    assert cues and all(a < b for a, b in cues)
    return [{'window': w['window'], 'near_start': min(cues, key=lambda c: abs(c[0] - w['start_seconds'])),
             'near_end': min(cues, key=lambda c: abs(c[1] - w['end_seconds']))} for w in windows]


def main():
    subprocess.run(['python3', str(ROOT / 'scripts/qa/build-accelerated-narration-pack.py'), '--check'], check=True)
    pack, priority, packet, budget, triage = map(read, (PACK, PRIORITY, PACKET, BUDGET, TRIAGE))
    assert priority['reviewed_commit'] == '9aaf109874a9ef4f302233aeb07914a88af4493e'
    assert packet['reviewed_commit'] == '31b05313e98376da9b2a29d2e12d7cc8983b22cc'
    assert len(priority['reviewed_clips']) == 6 and len(packet['reviewed_clips']) == 24
    assert sha(pathlib.Path(packet['reviewed_reel_manifest_path'])) == packet['reviewed_reel_manifest_sha256']
    for signoff in priority['reviewed_clips'] + packet['reviewed_clips']:
        assert sha(pathlib.Path(signoff['review_clip_path'])) == signoff['review_clip_sha256']
    packet_by_key = {x['scope']: x for x in packet['reviewed_clips']}
    assert len(packet_by_key) == 24
    priority_by_key = {x['scope']: x for x in priority['reviewed_clips']}
    budget_by_lesson = {x['lesson_id']: x for x in budget['results']}
    triage_by_key = {(x['lesson_id'], x['presenter_window']): x for x in triage['entries']}
    voice = read(pathlib.Path('artifacts/accelerated-lesson-pacing-2026-11-10/review-receipt.json'))
    raw_rates = [60 * x['word_count'] / x['source_seconds'] for x in voice['teaching_narration']]
    assert len(raw_rates) == 3
    lessons = []
    all_actions = []
    total_jobs = 0
    for lesson in pack['lessons']:
        lid = lesson['lesson_id']
        assert all(sha(pathlib.Path(lesson[k]['path'])) == lesson[k]['sha256'] for k in ('source_script', 'native_source', 'current_visual', 'captions'))
        assert sha(pathlib.Path(lesson['presenter_request']['path'])) == lesson['presenter_request']['sha256']
        script = ' '.join(re.findall(r'```narration\n(.*?)\n```', (ROOT / lesson['source_script']['path']).read_text(), re.S))
        script_words = words(script)
        windows = []
        cursor = 0
        for w in lesson['windows']:
            assert w['word_start'] == cursor and w['word_end_exclusive'] - cursor == w['word_count']
            assert words(w['text']) == script_words[w['word_start']:w['word_end_exclusive']]
            cursor = w['word_end_exclusive']
            start = w.get('native_media_start_seconds', w.get('planned_start_seconds'))
            end = w.get('native_media_end_seconds', w.get('planned_end_seconds'))
            assert start is not None and end is not None and end > start
            windows.append({'window': w['id'], 'kind': w['kind'], 'source_start_seconds': start,
                            'source_end_seconds': end, 'start_seconds': start, 'end_seconds': end,
                            'script_word_span': [w['word_start'], w['word_end_exclusive']],
                            'word_count': w['word_count'], 'text_sha256': w['text_sha256']})
        assert cursor == lesson['narration_word_count'] == len(script_words)
        assert all(abs(a['end_seconds'] - b['start_seconds']) < .001 for a, b in zip(windows, windows[1:]))
        actions = []
        for key, signoff in packet_by_key.items():
            if not key.startswith(lid + ' '):
                continue
            window_id = 'P' + signoff['scope'].split()[-1][1:]
            receipt = read(pathlib.Path(signoff['source_receipt_path']))
            assert sha(pathlib.Path(signoff['source_receipt_path'])) == signoff['source_receipt_sha256']
            assert receipt['candidate_audio_packets_match_source_extracts']
            assert receipt['source_sha256'] == lesson['native_source']['sha256']
            tri = triage_by_key[(lid, signoff['scope'].split()[-1])]
            assert tri['script_word_jump'][0] < tri['script_word_jump'][1]
            assert receipt['candidate_cut_seconds'] >= receipt['source_window_seconds'][0]
            assert receipt['candidate_cut_seconds'] <= receipt['source_window_seconds'][1]
            actions.append({'window': window_id, 'decision': 'local_packet_cut',
                            'orientation': receipt['orientation'], 'source_window_seconds': receipt['source_window_seconds'],
                            'source_cut_seconds': receipt['candidate_cut_seconds'],
                            'script_word_jump': tri['script_word_jump'],
                            'candidate_path': receipt['candidate_path'], 'candidate_sha256': receipt['candidate_sha256'],
                            'review_clip_sha256': signoff['review_clip_sha256'],
                            'alternate_local_cut_only': signoff['local_cut_only_alternate_split'],
                            'selected_for_sentence_continuity': not signoff['local_cut_only_alternate_split']})
            assert sha(pathlib.Path(receipt['candidate_path'])) == receipt['candidate_sha256']
        for scope, signoff in priority_by_key.items():
            if not scope.startswith(lid + ' '):
                continue
            if '→' in scope:
                continue
            window_id = 'P' + scope.split()[-1][1:]
            source = next(x for x in read(BASE / 'sample-accurate-jump-candidates/manifest.json')['results'] if x['lesson_id'] == lid and x['presenter_window'] == scope.split()[-1])
            receipt = read(pathlib.Path(source['receipt']))
            actions.append({'window': window_id, 'decision': 'sample_accurate_pcm_cut',
                            'receipt_path': source['receipt'], 'receipt_sha256': sha(pathlib.Path(source['receipt'])),
                            'review_clip_sha256': signoff['review_clip_sha256'], 'audio_reencoded': True})
        if lid == 'L01':
            l01 = pathlib.Path('artifacts/accelerated-visual-parity-2026-11-10/l01-a02-native-trim-candidate-235-252.json')
            actions.append({'window': 'P02', 'decision': 'previously_owner_confirmed_isolated_cut',
                            'receipt_path': str(l01), 'receipt_sha256': sha(l01),
                            'timing_behavior': 'retain source window length with silence after local cut; do not shift C02'})
        if lid in budget_by_lesson:
            b = budget_by_lesson[lid]
            assert sha(pathlib.Path(b['coordinated_receipt_path'])) == b['coordinated_receipt_sha256']
            assert b['source_sha256'] == lesson['native_source']['sha256']
            assert b['approved_c02_text_sha256'] == next(w for w in lesson['windows'] if w['id'] == 'C02')['text_sha256']
            assert b['remaining_c02_duration_margin_seconds'] == b['unallocated_transition_buffer_seconds'] == 0
            p02, c02, p03 = (next(x for x in windows if x['window'] == k) for k in ('P02', 'C02', 'P03'))
            assert abs(p02['end_seconds'] - b['original_c02_seconds'][0]) < .001
            assert abs(p03['start_seconds'] - b['original_c02_seconds'][1]) < .001
            p02['end_seconds'] = b['proposed_a02_presenter_end_seconds']
            c02['start_seconds'], c02['end_seconds'] = b['proposed_c02_seconds']
            p03['start_seconds'] = b['proposed_moved_opening_seconds'][0]
            assert abs((c02['end_seconds'] - c02['start_seconds']) - b['original_c02_planned_duration_seconds']) < .001
            assert abs(b['proposed_moved_opening_seconds'][1] - b['proposed_a03_continuation_start_seconds']) < .001
            actions.append({'window': 'P02→C02→P03', 'decision': 'coordinated_native_move_governs_sentence_continuity',
                            'source_split_seconds': b['native_a02_split_seconds'],
                            'moved_native_source_span_seconds': b['moved_native_source_span_seconds'],
                            'moved_opening_target_seconds': b['proposed_moved_opening_seconds'],
                            'c02_target_seconds': b['proposed_c02_seconds'],
                            'c02_transition_reserve_seconds': 0.0,
                            'receipt_path': b['coordinated_receipt_path'], 'receipt_sha256': b['coordinated_receipt_sha256'],
                            'review_clip_sha256': priority_by_key[f'{lid} A02 → A03']['review_clip_sha256']})
        for a, b in zip(windows, windows[1:]):
            assert abs(a['end_seconds'] - b['start_seconds']) < .001, (lid, a['window'], b['window'])
        for w in windows:
            assert w['end_seconds'] > w['start_seconds'], (lid, w['window'])
            if w['kind'] == 'cutaway':
                duration = w['end_seconds'] - w['start_seconds']
                w['required_words_per_minute'] = round(60 * w['word_count'] / duration, 2)
                w['duration_seconds'] = round(duration, 3)
                w['transition_reserve_at_planned_duration_seconds'] = 0.0
                w['provisional_room_at_measured_system_voice_median_seconds'] = round(duration - 60 * w['word_count'] / statistics.median(raw_rates), 3)
                w['voice_fit_status'] = 'provisional_rate_only_no_final_voice_audio'
                assert w['required_words_per_minute'] <= max(raw_rates)
        jobs = lesson['speech_jobs']
        total_jobs += len(jobs)
        assert all(len(j['text']) == j['character_count'] <= 5000 and sha_text(j['text']) == j['text_sha256'] for j in jobs)
        assert [wid for j in jobs for wid in j['window_ids']] == [w['window'] for w in windows if w['kind'] == 'cutaway']
        audio_plan = []
        for w in windows:
            if w['kind'] != 'presenter':
                continue
            source_start, source_end = w['source_start_seconds'], w['source_end_seconds']
            selected = [a for a in actions if a['window'] == w['window'] and a.get('selected_for_sentence_continuity', True)]
            assert len(selected) <= 1, (lid, w['window'])
            if selected and selected[0]['decision'] == 'local_packet_cut':
                a = selected[0]
                source_start = a['source_cut_seconds'] if a['orientation'] == 'head' else source_start
                source_end = a['source_cut_seconds'] if a['orientation'] == 'tail' else source_end
            elif selected and selected[0]['decision'] == 'sample_accurate_pcm_cut':
                a = read(pathlib.Path(selected[0]['receipt_path']))
                assert a['source_sha256'] == lesson['native_source']['sha256']
                assert sha(pathlib.Path(a['candidate_path'])) == a['candidate_sha256']
                source_start = a['candidate_cut_seconds'] if a['orientation'] == 'head' else source_start
                source_end = a['candidate_cut_seconds'] if a['orientation'] == 'tail' else source_end
            elif selected and selected[0]['decision'] == 'previously_owner_confirmed_isolated_cut':
                a = read(pathlib.Path(selected[0]['receipt_path']))
                assert a['canonical_source_sha256'] == lesson['native_source']['sha256']
                assert sha(pathlib.Path(a['candidate_path'])) == a['candidate_sha256']
                source_end = a['proposed_a02_cut_seconds']
            if lid in budget_by_lesson and w['window'] == 'P02':
                source_end = budget_by_lesson[lid]['native_a02_split_seconds']
            assert source_start < source_end
            target_start = w['start_seconds'] + (source_start - w['source_start_seconds'])
            if lid in budget_by_lesson and w['window'] == 'P03':
                target_start = source_start  # Original A03 stays fixed; its moved prefix fills the preceding span.
            target_end = target_start + (source_end - source_start)
            assert w['start_seconds'] - .001 <= target_start < target_end <= w['end_seconds'] + .001
            audio_plan.append({'window': w['window'], 'source_seconds': [round(source_start, 6), round(source_end, 6)],
                               'target_seconds': [round(target_start, 6), round(target_end, 6)]})
            if lid in budget_by_lesson and w['window'] == 'P03':
                b = budget_by_lesson[lid]
                audio_plan.append({'window': 'P03_moved_A02_opening',
                                   'source_seconds': b['moved_native_source_span_seconds'],
                                   'target_seconds': b['proposed_moved_opening_seconds']})
        audio_plan.sort(key=lambda x: x['target_seconds'][0])
        assert all(a['target_seconds'][1] <= b['target_seconds'][0] + .001 for a, b in zip(audio_plan, audio_plan[1:])), lid
        assert all(not (a['target_seconds'][0] < c['end_seconds'] - .001 and a['target_seconds'][1] > c['start_seconds'] + .001)
                   for a in audio_plan for c in windows if c['kind'] == 'cutaway'), lid
        caption_boundaries = vtt_boundaries(lesson['captions']['path'], windows)
        lessons.append({'lesson_id': lid, 'source_bindings': {k: lesson[k] for k in ('source_script', 'presenter_request', 'native_source', 'current_visual', 'captions')},
                        'windows': windows, 'caption_boundary_reference': caption_boundaries,
                        'native_edit_actions': actions, 'scheduled_native_audio_spans': audio_plan,
                        'speech_job_ids': [j['id'] for j in jobs],
                        'speech_job_max_characters': max(j['character_count'] for j in jobs),
                        'status': 'arithmetic_schedule_only_final_voice_and_caption_sync_unverified'})
        all_actions.extend({'lesson_id': lid, **a} for a in actions)
    assert len(lessons) == 16 and len([a for a in all_actions if a['decision'] == 'local_packet_cut']) == 24
    assert total_jobs == 31
    assert len([a for a in all_actions if a['decision'] == 'sample_accurate_pcm_cut']) == 3
    assert len([a for a in all_actions if a['decision'] == 'coordinated_native_move_governs_sentence_continuity']) == 3
    result = {'schema_version': 1, 'status': 'review_only_arithmetic_schedule_not_render_ready',
              'source_pack': {'path': str(PACK), 'sha256': sha(PACK)},
              'source_triage': {'path': str(TRIAGE), 'sha256': sha(TRIAGE)},
              'priority_six_signoff': {'path': str(PRIORITY), 'sha256': sha(PRIORITY)},
              'packet_24_signoff': {'path': str(PACKET), 'sha256': sha(PACKET)},
              'coordinated_budget': {'path': str(BUDGET), 'sha256': sha(BUDGET)},
              'system_voice_timing_reference': {'path': 'artifacts/accelerated-lesson-pacing-2026-11-10/review-receipt.json',
                                                'sha256': sha(pathlib.Path('artifacts/accelerated-lesson-pacing-2026-11-10/review-receipt.json')),
                                                'raw_words_per_minute': [round(x, 2) for x in raw_rates],
                                                'median_raw_words_per_minute': round(statistics.median(raw_rates), 2),
                                                'limitation': 'Provisional macOS system voice only; no presenter-match or final provider voice pace proof.'},
              'method': 'Preserve 16-lesson approved script/window text, source media, VTT, and 31 speech payloads. Packet and PCM cuts retain nominal video windows with silence. Coordinated L05/L06/L08 move source A02 opening to immediately before A03 and shift C02 earlier without changing its duration.',
              'lessons': lessons, 'native_action_count': len(all_actions),
              'validation': {'script_word_coverage_and_order': 'passed', 'no_duplicate_or_omitted_planned_words': 'passed',
                             'no_scheduled_native_audio_overlap': 'passed_arithmetic', 'positive_cutaway_duration': 'passed',
                             '31_speech_payloads_at_most_5000_characters': 'passed',
                             'measured_system_voice_rate_screen': 'passed_provisional_all_cutaway_required_rates_below_fastest_reference',
                             'final_voice_pacing_and_caption_sync': 'unverified'},
              'zero_transition_margin_lessons': ['L05', 'L06', 'L08'],
              'canonical_media_or_learner_binding_changed': False, 'new_voice_audio_generated': False}
    (ROOT / OUT).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {OUT}: 16 lessons, {len(all_actions)} native decisions, {total_jobs} speech jobs')


def sha_text(value):
    return hashlib.sha256(value.encode()).hexdigest()


if __name__ == '__main__':
    main()
