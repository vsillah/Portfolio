#!/usr/bin/env python3
"""Build a provider-free, source-bound Accelerated narration planning pack."""
import argparse
import hashlib
import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
COURSE = ROOT / 'docs/accelerated-course-modules'
RECEIPT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/composite-receipt.json'
ASR_AUDIT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/presenter-audio-asr-audit.json'
OUTPUT = COURSE / 'narration-production-pack-2026-11-10.json'
WORD = re.compile(r"[\w’']+")
NARRATION = re.compile(r'```narration\n(.*?)\n```', re.S)
VOICE_ID = '14b592b937744404a4fa7c01aafd7dbe'
MAX_REQUEST_CHARS = 5000


def sha(data):
    return hashlib.sha256(data).hexdigest()


def norm(value):
    return value.lower().replace('’', "'")


def relative(path):
    return str(path.relative_to(ROOT))


def match_words(haystack, needle, start=0):
    for at in range(start, len(haystack) - len(needle) + 1):
        if haystack[at:at + len(needle)] == needle:
            return at, at + len(needle)
    raise ValueError('Presenter text is absent from approved narration')


def sentence_complete(value):
    return bool(re.search(r'[.!?][”"\']?\s*$', value.strip()))


def split_jobs(cutaways):
    """Pack whole sentence-complete cutaway windows under the documented limit."""
    groups = []
    pending = []
    for window in cutaways:
        assert sentence_complete(window['text'])
        candidate = pending + [window]
        if len('\n\n'.join(part['text'] for part in candidate)) > MAX_REQUEST_CHARS:
            assert pending, f"Window {window['id']} exceeds the request limit"
            groups.append(pending)
            pending = [window]
        else:
            pending = candidate
    if pending:
        groups.append(pending)
    jobs = []
    for index, parts in enumerate(groups, 1):
        payload = '\n\n'.join(part['text'] for part in parts)
        assert 1 <= len(payload) <= MAX_REQUEST_CHARS
        jobs.append({'id': f'J{index:02d}', 'window_ids': [part['id'] for part in parts],
                     'text': payload, 'character_count': len(payload),
                     'text_sha256': sha(payload.encode()),
                     'historical_credit_estimate': math.ceil(len(payload) / 400)})
    assert [id for job in jobs for id in job['window_ids']] == [part['id'] for part in cutaways]
    assert [part for job in groups for part in job] == cutaways
    return jobs


def build():
    receipt = json.loads(RECEIPT.read_text())
    audit = json.loads(ASR_AUDIT.read_text())
    assert len(receipt['composites']) == 16
    assert audit['source_receipt_sha256'] == sha(RECEIPT.read_bytes())
    assert len(audit['windows']) == 64
    lessons = []
    for index, media in enumerate(receipt['composites'], 1):
        lesson_id = f'L{index:02d}'
        assert media['lesson_id'] == lesson_id
        script = COURSE / f'curriculum/scripts/{lesson_id}.md'
        requests = list(COURSE.glob(f'**/{lesson_id.lower()}-heygen-request.json')) if index > 1 else [COURSE / 'l01-guided-video/heygen-request.json']
        assert len(requests) == 1, (lesson_id, requests)
        request = requests[0]
        script_bytes, request_bytes = script.read_bytes(), request.read_bytes()
        req = json.loads(request_bytes)
        assert req['source_script_sha256'] == sha(script_bytes)
        sections = NARRATION.findall(script_bytes.decode())
        assert sections, lesson_id
        narration = ' '.join(section.strip() for section in sections)
        words = list(WORD.finditer(narration))
        tokens = [norm(word.group()) for word in words]
        presenter_spans = []
        cursor = 0
        for segment in req['segments']:
            expected = [norm(word) for word in WORD.findall(segment['narration_text'])]
            span = match_words(tokens, expected, cursor)
            presenter_spans.append(list(span))
            cursor = span[1]
        assert len(presenter_spans) == len(media['presenter_windows']) == 4
        adjustments = []
        if lesson_id == 'L01':
            # Native audio in the approved composite crosses two draft request boundaries.
            first_page = [norm(word) for word in WORD.findall("Let's make the first page of your decision file")]
            start, end = match_words(tokens, first_page, presenter_spans[1][1])
            assert presenter_spans[2][0] == start
            presenter_spans[2][0] = end
            offer = [norm(word) for word in WORD.findall('It could be whether to change an onboarding step, simplify a service request, or test a different way to explain an offer')]
            start, end = match_words(tokens, offer, presenter_spans[2][1] - 4)
            assert start == presenter_spans[2][1] - 4
            presenter_spans[2][1] = end
            adjustments = [
                {'boundary': 'A02 tail / C02 to A03', 'change': 'C02 currently includes “Let’s make the first page of your decision file.”; A03 starts “It starts with a decision, not a tool.”', 'audio_evidence': 'Both full-window ASR models and a seven-second native tail identify A02 speaking the first-page sentence after “public proof.” Word-level ASR places it near 245.13–248.23 s. The intervening cutaway contains roughly 185 approved-script words, so the current source audio jumps ahead and this candidate repeats that sentence.', 'status': 'blocked: audible confirmation and native A02 trim or alternate edit decision required'},
                {'boundary': 'A03 to C03', 'change': 'A03 completes the example through “offer.”; C03 begins at the following sentence.', 'audio_evidence': 'Isolated native tail 355.5–359.0 s transcribes “or test a different way to explain an offer”; native silence begins near 358.95 s.', 'status': 'ASR-assisted candidate; listening confirmation required'},
            ]
        assert all(presenter_spans[n][1] < presenter_spans[n + 1][0] for n in range(3)), lesson_id
        slices = []
        last = 0
        for at, (start, end) in enumerate(presenter_spans):
            if start > last:
                slices.append(('cutaway', last, start, None))
            slices.append(('presenter', start, end, at))
            last = end
        if last < len(words):
            slices.append(('cutaway', last, len(words), None))
        kinds = [kind for kind, *_ in slices]
        assert kinds[:7] == ['presenter', 'cutaway', 'presenter', 'cutaway', 'presenter', 'cutaway', 'presenter'], lesson_id
        assert kinds[7:] in ([], ['cutaway']), lesson_id
        windows = []
        covered = []
        for kind, start, end, media_index in slices:
            leading = words[start].start()
            trailing = words[end].start() if end < len(words) else len(narration)
            value = narration[leading:trailing].strip()
            assert value
            covered.extend(range(start, end))
            window = {'id': f'{kind[0].upper()}{len([w for w in windows if w["kind"] == kind]) + 1:02d}', 'kind': kind,
                      'word_start': start, 'word_end_exclusive': end, 'word_count': end - start,
                      'character_count': len(value), 'text_sha256': sha(value.encode()), 'text': value}
            if kind == 'presenter':
                window['native_media_start_seconds'], window['native_media_end_seconds'] = media['presenter_windows'][media_index]
                window['request_segment_id'] = req['segments'][media_index]['id']
            else:
                assert sentence_complete(value), (lesson_id, window['id'], value[-80:])
                assert start > 0 and sentence_complete(narration[words[start - 1].start():words[start].start()]), (lesson_id, window['id'], 'start')
                cutaway_index = len([w for w in windows if w['kind'] == 'cutaway'])
                window['planned_start_seconds'] = media['presenter_windows'][cutaway_index][1]
                window['planned_end_seconds'] = (media['presenter_windows'][cutaway_index + 1][0]
                                                 if cutaway_index + 1 < 4 else media['duration_seconds'])
                window['planned_duration_seconds'] = round(window['planned_end_seconds'] - window['planned_start_seconds'], 3)
            windows.append(window)
        assert covered == list(range(len(words))), lesson_id
        assert [norm(word) for window in windows for word in WORD.findall(window['text'])] == tokens, lesson_id
        cutaways = [w for w in windows if w['kind'] == 'cutaway']
        speech_text = '\n\n'.join(w['text'] for w in cutaways)
        jobs = split_jobs(cutaways)
        assert '\n\n'.join(job['text'] for job in jobs) == speech_text
        paths = {name: ROOT / media[key] for name, key in [('native_source', 'source_path'), ('current_visual', 'output_path'), ('captions', 'caption_path')]}
        for name, key in [('native_source', 'source_sha256'), ('current_visual', 'output_sha256'), ('captions', 'caption_sha256')]:
            assert sha(paths[name].read_bytes()) == media[key], (lesson_id, name)
        diagnostic = [w for w in audit['windows'] if w['lesson_id'] == lesson_id]
        assert len(diagnostic) == 4
        assert all(w['source_media_sha256'] == media['source_sha256'] for w in diagnostic)
        assert all(w['approved_script_sha256'] == sha(script_bytes) for w in diagnostic)
        lessons.append({'lesson_id': lesson_id, 'source_script': {'path': relative(script), 'sha256': sha(script_bytes)},
                        'presenter_request': {'path': relative(request), 'sha256': sha(request_bytes)},
                        'native_source': {'path': relative(paths['native_source']), 'sha256': media['source_sha256']},
                        'current_visual': {'path': relative(paths['current_visual']), 'sha256': media['output_sha256']},
                        'captions': {'path': relative(paths['captions']), 'sha256': media['caption_sha256']},
                        'narration_word_count': len(words), 'windows': windows, 'native_audio_adjustments': adjustments,
                        'audio_alignment': {'status': 'blocked_pending_audible_confirmation_and_native_edit_decision',
                                            'request_head_mismatches': sum(not w['request_head_match'] for w in diagnostic),
                                            'request_tail_mismatches': sum(not w['request_tail_match'] for w in diagnostic),
                                            'possible_noncontiguous_script_jumps': sum(bool(w['possible_noncontiguous_script_jumps']) for w in diagnostic)},
                        'lesson_cutaway_text': {'window_count': len(cutaways), 'text': speech_text,
                                                'character_count': len(speech_text),
                                                'word_count': sum(w['word_count'] for w in cutaways),
                                                'text_sha256': sha(speech_text.encode())},
                        'speech_jobs': jobs})
    total_chars = sum(sum(j['character_count'] for j in l['speech_jobs']) for l in lessons)
    estimated_credits = sum(sum(j['historical_credit_estimate'] for j in l['speech_jobs']) for l in lessons)
    job_count = sum(len(l['speech_jobs']) for l in lessons)
    return {'schema_version': 1, 'status': 'blocked_native_audio_alignment_review_only_provider_free',
            'method': 'Sequential provider-safe speech jobs per lesson; each job contains whole sentence-complete cutaway windows joined with two newlines. Align to native presenter audio and render from word timestamps and silence.',
            'voice_id': VOICE_ID, 'source_receipt': {'path': relative(RECEIPT), 'sha256': sha(RECEIPT.read_bytes())},
            'audio_audit': {'path': relative(ASR_AUDIT), 'sha256': sha(ASR_AUDIT.read_bytes()),
                            'status': 'machine_diagnostic_only; all 64 windows unresolved for audible confirmation and native edit decision'},
            'credit_plan': {'job_count': job_count, 'request_character_limit': MAX_REQUEST_CHARS,
                            'limit_source': 'https://developers.heygen.com/docs/voices/heygen-voice-speech#request-fields',
                            'route_compatibility_gate': 'The 5,000-character limit is documented for POST /v3/models/audio/tts; confirm the actual subscription create_speech route and voice support before submission. A separate model card suggests 10,000, so this pack uses the conservative 5,000 limit.',
                            'total_submitted_characters': total_chars, 'historical_credit_estimate': estimated_credits,
                            'proposed_aggregate_subscription_credit_cap': math.ceil(estimated_credits * 1.25),
                            'cap_basis': 'Planning allowance of 25% above the observed Agentified 1 credit per started 400 characters; this is not a provider quote or enforced cap.',
                            'required_gate': 'Confirm the connected subscription account, voice entitlement, live per-job quote, aggregate debit ceiling, sufficient balance, no auto-reload, and a fail-closed no-retry control before any submission.',
                            'cash_spend_authorized_usd': 0}, 'lessons': lessons}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='Verify the committed pack matches current source artifacts')
    args = parser.parse_args()
    output = json.dumps(build(), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        assert OUTPUT.read_text() == output, 'Narration production pack is stale'
        print('Narration pack matches all 16 source and media bindings.')
    else:
        OUTPUT.write_text(output)
        print(f'Wrote {relative(OUTPUT)}')
