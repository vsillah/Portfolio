#!/usr/bin/env python3
"""Compare full local A02/A03 review MP4s with approved sentence order."""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences'
PACK = ROOT / 'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json'
AUDIT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/presenter-audio-asr-audit.json'
CLI = pathlib.Path('/tmp/accelerated-whisper/build/bin/whisper-cli')
MODELS = {'base.en': pathlib.Path('/tmp/accelerated-whisper/models/ggml-base.en.bin'),
          'small.en': pathlib.Path('/tmp/accelerated-whisper/models/ggml-small.en.bin')}
RETAINED_END = {'L05': 'between views', 'L06': 'ledger IDs', 'L08': 'small exercise'}


def words(value):
    return re.findall(r"[\w’']+", value.lower().replace('’', "'"))


def contains(haystack, needle):
    return bool(needle) and any(haystack[i:i+len(needle)] == needle
                                for i in range(len(haystack)-len(needle)+1))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def transcribe(job, scratch):
    lid, kind, model, path = job
    wav = scratch / f'{lid}-{kind}-{model}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn',
                    '-ac', '1', '-ar', '16000', '-y', str(wav)],
                   check=True, capture_output=True)
    output = scratch / f'{lid}-{kind}-{model}'
    subprocess.run([str(CLI), '-m', str(MODELS[model]), '-f', str(wav),
                    '-otxt', '-of', str(output), '-nt'], check=True, capture_output=True)
    return lid, kind, model, ' '.join(pathlib.Path(str(output)+'.txt').read_text().split())


def main():
    assert CLI.exists() and all(x.exists() for x in MODELS.values())
    pack = json.loads(PACK.read_text())
    audit = json.loads(AUDIT.read_text())['windows']
    manifest = json.loads((OUT / 'manifest.json').read_text())
    jobs = []
    receipts = {}
    for row in manifest['results']:
        receipt = json.loads((ROOT / row['receipt']).read_text())
        lid = receipt['lesson_id']
        receipts[lid] = receipt
        for kind, key, hash_key in [('a02', 'a02_candidate_path', 'a02_candidate_sha256'),
                                    ('a03', 'a03_restored_path', 'a03_restored_sha256')]:
            path = ROOT / receipt[key]
            assert sha(path) == receipt[hash_key]
            for model in MODELS:
                jobs.append((lid, kind, model, path))
    with tempfile.TemporaryDirectory(prefix='accelerated-coordinated-asr-') as tmp:
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            transcripts = list(pool.map(lambda job: transcribe(job, pathlib.Path(tmp)), jobs))
    lookup = {(lid, kind, model): text for lid, kind, model, text in transcripts}
    results = []
    for lid, receipt in receipts.items():
        lesson = next(x for x in pack['lessons'] if x['lesson_id'] == lid)
        script = ' '.join(re.findall(r'```narration\n(.*?)\n```',
                                     (ROOT / lesson['source_script']['path']).read_text(), re.S))
        tokens = words(script)
        windows = [x for x in lesson['windows'] if x['kind'] == 'presenter']
        a02, a03 = windows[1:3]
        c02 = next(x for x in lesson['windows'] if x['kind'] != 'presenter'
                   and x['word_start'] == a02['word_end_exclusive'])
        opening = words(receipt['approved_sentence_opening'])
        following = words(receipt['approved_following_words'])
        approved_a03 = tokens[a03['word_start']:a03['word_end_exclusive']]
        assert contains(approved_a03, opening + following)
        assert not contains(tokens[c02['word_start']:c02['word_end_exclusive']], opening)
        original_a02 = next(x for x in audit if x['lesson_id'] == lid and x['presenter_window'] == 'A02')
        original_a03 = next(x for x in audit if x['lesson_id'] == lid and x['presenter_window'] == 'A03')
        checks = {}
        for model in MODELS:
            a02_words = words(lookup[(lid, 'a02', model)])
            a03_words = words(lookup[(lid, 'a03', model)])
            checks[model] = {
                'original_a02_has_opening': contains(words(original_a02['asr_transcript'] if model == 'base.en' else original_a02['small_en_transcript']), opening),
                'original_a03_starts_following': contains(words(original_a03['asr_transcript'] if model == 'base.en' else original_a03['small_en_transcript'])[:12], following),
                'candidate_a02_retains_end': contains(a02_words, words(RETAINED_END[lid])),
                'candidate_a02_omits_moved_opening': not contains(a02_words, opening),
                'candidate_a03_starts_joined_sentence': contains(a03_words[:len(opening)+len(following)+3], opening+following),
            }
        passed = all(all(flags.values()) for flags in checks.values())
        results.append({'lesson_id': lid, 'source_sha256': receipt['source_sha256'],
                        'a02_candidate_sha256': receipt['a02_candidate_sha256'],
                        'a03_restored_sha256': receipt['a03_restored_sha256'],
                        'approved_a03_head_words': ' '.join(approved_a03[:len(opening)+len(following)]),
                        'approved_c02_tail_words': ' '.join(tokens[c02['word_end_exclusive']-12:c02['word_end_exclusive']]),
                        'models': {model: {'a02_transcript': lookup[(lid,'a02',model)],
                                           'a03_transcript': lookup[(lid,'a03',model)],
                                           'checks': checks[model]} for model in MODELS},
                        'machine_result': 'passed_local_sentence_move_not_timeline_ready' if passed else 'blocked',
                        'audible_signoff': False, 'timeline_fit_verified': False})
    output = {'schema_version': 1, 'status': 'machine_diagnostic_only',
              'models': [{'name': name, 'sha256': sha(path)} for name, path in MODELS.items()],
              'candidate_count': len(results), 'machine_pass_count': sum(x['machine_result'].startswith('passed') for x in results),
              'results': results}
    (OUT / 'asr-validation.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
    print(f"Machine pass {output['machine_pass_count']}/{output['candidate_count']}")


if __name__ == '__main__':
    main()
