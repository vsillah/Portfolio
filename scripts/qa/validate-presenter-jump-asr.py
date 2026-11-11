#!/usr/bin/env python3
"""Compare full-clip ASR before/after on local native jump candidates."""
import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates'
AUDIT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/presenter-audio-asr-audit.json'


def words(value):
    return [word.lower().replace('’', "'") for word in re.findall(r"[\w’']+", value)]


def contains(haystack, needle):
    return bool(needle) and any(haystack[index:index + len(needle)] == needle
                                for index in range(len(haystack) - len(needle) + 1))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def transcribe(job, audit_rows, models, cli, scratch):
    receipt = json.loads((ROOT / job['receipt']).read_text())
    lesson, window = receipt['lesson_id'], receipt['presenter_window']
    media = ROOT / receipt['candidate_path']
    assert sha(media) == receipt['candidate_sha256']
    wav = scratch / f'{lesson}-{window}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(media), '-vn', '-ac', '1', '-ar', '16000',
                    '-y', str(wav)], check=True, capture_output=True)
    after = {}
    for name, model in models.items():
        output = scratch / f'{lesson}-{window}-{name}'
        subprocess.run([str(cli), '-m', str(model), '-f', str(wav), '-otxt', '-of', str(output), '-nt'],
                       check=True, capture_output=True)
        after[name] = ' '.join(pathlib.Path(str(output) + '.txt').read_text().split())
    source_row = next(row for row in audit_rows if row['lesson_id'] == lesson and row['presenter_window'] == window)
    before = {'base.en': source_row['asr_transcript'], 'small.en': source_row['small_en_transcript']}
    intended = receipt['intended_words']
    if receipt['orientation'] == 'tail':
        removed = words(intended['removed_later_phrase_start'])[:4]
        retained = words(intended['retained_approved_words_end'])[-4:]
    else:
        removed = words(intended['removed_earlier_phrase_end'])[-4:]
        retained = words(intended['retained_approved_words_start'])[:4]
    # The L15 aligner skipped the first two words of "Chapter 24". Keep the
    # preceding complete sentence as the retained probe, not a chapter token.
    if (lesson, window) == ('L15', 'A01'):
        retained = words('between those two moments')
    checks = {name: {'removed_phrase_in_before': contains(words(before[name]), removed),
                     'removed_phrase_in_after': contains(words(after[name]), removed),
                     'retained_phrase_in_after': contains(words(after[name]), retained)}
              for name in models}
    passed = all(flags['removed_phrase_in_before'] and not flags['removed_phrase_in_after']
                 and flags['retained_phrase_in_after'] for flags in checks.values())
    return {'lesson_id': lesson, 'presenter_window': window, 'orientation': receipt['orientation'],
            'candidate_sha256': receipt['candidate_sha256'], 'removed_probe_words': ' '.join(removed),
            'retained_probe_words': ' '.join(retained), 'before_transcripts': before,
            'after_transcripts': after, 'model_checks': checks,
            'status': 'machine_comparison_not_audible_signoff',
            'machine_result': ('passed_removed_phrase_and_retained_context' if passed
                               else 'blocked_retained_word_boundary_uncertain')}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--whisper-cli', type=pathlib.Path,
                        default=pathlib.Path('/tmp/accelerated-whisper/build/bin/whisper-cli'))
    parser.add_argument('--base-model', type=pathlib.Path,
                        default=pathlib.Path('/tmp/accelerated-whisper/models/ggml-base.en.bin'))
    parser.add_argument('--small-model', type=pathlib.Path,
                        default=pathlib.Path('/tmp/accelerated-whisper/models/ggml-small.en.bin'))
    args = parser.parse_args()
    models = {'base.en': args.base_model, 'small.en': args.small_model}
    assert args.whisper_cli.exists() and all(model.exists() for model in models.values())
    manifest = json.loads((OUT / 'manifest.json').read_text())
    audit = json.loads(AUDIT.read_text())
    jobs = [row for row in manifest['results'] if row['status'] != 'blocked']
    with tempfile.TemporaryDirectory(prefix='accelerated-jump-asr-') as tmp:
        scratch = pathlib.Path(tmp)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda job: transcribe(job, audit['windows'], models,
                                                            args.whisper_cli, scratch), jobs))
    output = {'schema_version': 1, 'status': 'machine_diagnostic_only',
              'models': [{'name': name, 'sha256': sha(path)} for name, path in models.items()],
              'candidate_count': len(results), 'results': results,
              'machine_pass_count': sum(r['machine_result'].startswith('passed') for r in results),
              'machine_blocked_count': sum(r['machine_result'].startswith('blocked') for r in results),
              'machine_blocked_windows': [r['lesson_id'] + ' ' + r['presenter_window'] for r in results
                                          if r['machine_result'].startswith('blocked')]}
    (OUT / 'asr-validation.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(f"Machine pass {output['machine_pass_count']}; blocked {output['machine_blocked_windows']}")


if __name__ == '__main__':
    main()
