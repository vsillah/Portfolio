#!/usr/bin/env python3
"""Measure native source audio holds and caption boundaries without altering media."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = pathlib.Path('artifacts/accelerated-visual-parity-2026-11-10')
EDL = BASE / 'full-lesson-timing-decisions.json'
ASR = BASE / 'presenter-audio-asr-audit.json'
OUT = BASE / 'native-transition-audit'


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def secs(value):
    parts = value.split(':')
    return sum(float(item) * power for item, power in zip(reversed(parts), (1, 60, 3600)))


def cues(path):
    result = []
    text = (ROOT / path).read_text()
    for match in re.finditer(r'(?m)^((?:\d\d:)?\d\d:\d\d\.\d+) --> ((?:\d\d:)?\d\d:\d\d\.\d+)$', text):
        line = text[match.end():].split('\n\n', 1)[0].strip().replace('\n', ' ')
        result.append({'start_seconds': secs(match.group(1)), 'end_seconds': secs(match.group(2)), 'text': line})
    assert result
    return result


def silence_spans(path, duration):
    process = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'info', '-i', str(ROOT / path), '-vn',
                              '-af', 'silencedetect=n=-45dB:d=0.12', '-f', 'null', '-'],
                             capture_output=True, text=True, check=True)
    events = re.findall(r'silence_(start|end):\s*([0-9.]+)', process.stderr)
    result, pending = [], None
    for kind, raw in events:
        value = float(raw)
        if kind == 'start':
            pending = value
        elif pending is not None and value > pending:
            result.append([pending, min(value, duration)])
            pending = None
    if pending is not None and pending < duration:
        result.append([pending, duration])
    result.sort()
    merged = []
    for start, end in result:
        if merged and start <= merged[-1][1] + .025:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def active_spans(silence, start, end):
    result, cursor = [], start
    for a, b in silence:
        if b <= start or a >= end:
            continue
        if a > cursor + .04:
            result.append([cursor, min(a, end)])
        cursor = max(cursor, b)
    if cursor < end - .04:
        result.append([cursor, end])
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--through', type=int, default=16)
    args = parser.parse_args()
    assert 1 <= args.through <= 16
    edl, audit = json.loads((ROOT / EDL).read_text()), json.loads((ROOT / ASR).read_text())
    assert len(edl['lessons']) == 16 and len(audit['windows']) == 64
    by_window = {(w['lesson_id'], w['presenter_window']): w for w in audit['windows']}
    results, findings = [], []
    for lesson in edl['lessons'][:args.through]:
        lid = lesson['lesson_id']
        source = pathlib.Path(lesson['source_bindings']['native_source']['path'])
        caption = pathlib.Path(lesson['source_bindings']['captions']['path'])
        assert sha(source) == lesson['source_bindings']['native_source']['sha256']
        assert sha(caption) == lesson['source_bindings']['captions']['sha256']
        windows = lesson['windows']
        silence = silence_spans(source, windows[-1]['source_end_seconds'])
        vtt = cues(caption)
        presenter = []
        cutaway = []
        for w in windows:
            if w['kind'] != 'presenter':
                activity = active_spans(silence, w['source_start_seconds'], w['source_end_seconds'])
                active_duration = round(sum(b-a for a,b in activity), 3)
                cutaway.append({'window': w['window'], 'source_seconds': [w['source_start_seconds'], w['source_end_seconds']],
                                'duration_seconds': round(w['source_end_seconds']-w['source_start_seconds'], 3),
                                'threshold_activity_seconds': active_duration,
                                'status': 'native_source_silent_teaching_gap' if active_duration < .15 else 'threshold_activity_requires_review'})
                continue
            n = int(w['window'][1:])
            asr = by_window[(lid, f'A{n:02d}')]
            active = active_spans(silence, w['source_start_seconds'], w['source_end_seconds'])
            first = round(active[0][0], 3) if active else None
            last = round(active[-1][1], 3) if active else None
            leading = round(first - w['source_start_seconds'], 3) if first is not None else None
            trailing = round(w['source_end_seconds'] - last, 3) if last is not None else None
            row = {'window': w['window'], 'source_seconds': [w['source_start_seconds'], w['source_end_seconds']],
                   'first_threshold_activity_seconds': first, 'last_threshold_activity_seconds': last,
                   'leading_hold_seconds': leading, 'trailing_hold_seconds': trailing,
                   'asr_request_head_match': asr['request_head_match'],
                   'asr_request_tail_match': asr['request_tail_match'],
                   'asr_script_jumps': asr['possible_noncontiguous_script_jumps'],
                   'local_cut_signoffs': [s for s in audit['human_listening_signoffs'] if s['scope'].startswith(lid + f' A{n:02d}')],
                   'full_window_audible_review': asr['audible_review']}
            assert row['full_window_audible_review']['reviewer'] is None
            presenter.append(row)
            if leading is not None and leading >= 1.0:
                findings.append({'lesson_id': lid, 'time_seconds': w['source_start_seconds'], 'window': w['window'],
                                 'kind': 'native_presenter_leading_hold', 'measured_seconds': leading,
                                 'scope': 'source_threshold_only_not_audible_verdict'})
            if trailing is not None and trailing >= 1.0:
                findings.append({'lesson_id': lid, 'time_seconds': last, 'window': w['window'],
                                 'kind': 'native_presenter_trailing_hold', 'measured_seconds': trailing,
                                 'scope': 'source_threshold_only_not_audible_verdict'})
            if not asr['request_head_match'] or not asr['request_tail_match']:
                findings.append({'lesson_id': lid, 'time_seconds': w['source_start_seconds'], 'window': w['window'],
                                 'kind': 'existing_asr_window_text_mismatch',
                                 'head_match': asr['request_head_match'], 'tail_match': asr['request_tail_match'],
                                 'scope': 'diagnostic_only_cut_signoff_does_not_approve_full_window'})
        transitions = []
        for before, after in zip(windows, windows[1:]):
            boundary = before['source_end_seconds']
            crossing = [x for x in vtt if x['start_seconds'] < boundary - .05 and x['end_seconds'] > boundary + .05]
            pre = active_spans(silence, max(0, boundary-.35), boundary)
            post = active_spans(silence, boundary, min(windows[-1]['source_end_seconds'], boundary+.35))
            row = {'from': before['window'], 'to': after['window'], 'source_boundary_seconds': boundary,
                   'planned_boundary_seconds': before['end_seconds'],
                   'threshold_activity_within_350ms_before': bool(pre),
                   'threshold_activity_within_350ms_after': bool(post),
                   'source_vtt_cues_crossing_boundary': crossing}
            transitions.append(row)
            if crossing:
                findings.append({'lesson_id': lid, 'time_seconds': boundary, 'window': f"{before['window']}→{after['window']}",
                                 'kind': 'source_vtt_cue_crosses_window_boundary',
                                 'cue_count': len(crossing), 'cue_seconds': [[x['start_seconds'],x['end_seconds']] for x in crossing],
                                 'scope': 'caption_reference_collision_requires_final_timing_check'})
            if before['kind'] == 'presenter' and after['kind'] == 'cutaway' and post:
                findings.append({'lesson_id': lid, 'time_seconds': boundary, 'window': f"{before['window']}→{after['window']}",
                                 'kind': 'source_audio_threshold_activity_after_presenter_boundary',
                                 'scope': 'review_native_audio_and_selected_cut_at_boundary'})
        for action in lesson['native_edit_actions']:
            if action['decision'] == 'coordinated_native_move_governs_sentence_continuity':
                findings.append({'lesson_id': lid, 'time_seconds': action['c02_target_seconds'][1],
                                 'window': 'C02→P03', 'kind': 'coordinated_join_zero_transition_reserve',
                                 'moved_opening_target_seconds': action['moved_opening_target_seconds'],
                                 'scope': 'final_presenter_matched_voice_required_to_qualify_fit'})
        if cutaway:
            findings.append({'lesson_id': lid, 'time_seconds': cutaway[0]['source_seconds'][0],
                             'window': 'all_cutaways', 'kind': 'native_source_cutaway_narration_absent',
                             'cutaway_count': len(cutaway),
                             'total_silent_gap_seconds': round(sum(x['duration_seconds'] for x in cutaway), 3),
                             'maximum_threshold_activity_seconds': max(x['threshold_activity_seconds'] for x in cutaway),
                             'scope': 'current_native_source_only_not_future_narrated_edit'})
        results.append({'lesson_id': lid, 'source': {'path': str(source), 'sha256': sha(source)},
                        'captions': {'path': str(caption), 'sha256': sha(caption), 'cue_count': len(vtt)},
                        'presenter_windows': presenter, 'cutaway_windows': cutaway, 'transitions': transitions,
                        'source_silence_threshold_dbfs': -45, 'minimum_silence_event_seconds': .12})
        print(f"{lid}: {len(presenter)} presenter windows, {len(transitions)} boundaries, {len([f for f in findings if f['lesson_id']==lid])} findings", flush=True)
    OUT_PATH = OUT / (f'tranche-l01-l{args.through:02d}.json' if args.through < 16 else 'full-l01-l16.json')
    (ROOT / OUT).mkdir(parents=True, exist_ok=True)
    output = {'schema_version': 1, 'status': 'source_threshold_and_asr_diagnostic_only',
              'source_edl': {'path': str(EDL), 'sha256': sha(EDL)},
              'source_asr_audit': {'path': str(ASR), 'sha256': sha(ASR)},
              'lesson_count': len(results), 'presenter_window_count': sum(len(x['presenter_windows']) for x in results),
              'transition_count': sum(len(x['transitions']) for x in results),
              'findings': findings, 'lessons': results,
              'limits': ['FFmpeg threshold activity is not an audible speech judgment.',
                         'ASR mismatches are diagnostic and cannot override local clip signoffs.',
                         'Current source VTT cues are references; final narration captions need a separate render and sync audit.',
                         'No final presenter-matched voice exists for C02 fit or transition listening.']}
    (ROOT / OUT_PATH).write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
    print(f'Wrote {OUT_PATH}: {len(findings)} timecoded findings')


if __name__ == '__main__':
    main()
