"""Verify every versioned transcript against its hashed script and bound VTT."""

import hashlib
import json
import re
from pathlib import Path
from transcript_provenance import EXPECTED_COUNTS, assert_word_match, script_narration

ROOT = Path(__file__).resolve().parents[3]
MAP = Path(__file__).resolve().parent / 'source-map-v1.json'


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


records = json.loads(MAP.read_text())['records']
if {record['lessonId'] for record in records} != set(EXPECTED_COUNTS):
    raise ValueError('eligible lesson set changed')
for record in records:
    lesson_id = record['lessonId']
    script = record['script']
    caption = record['currentCaption']
    transcript = record['versionedTranscript']
    for source in (script, caption, transcript):
        path = ROOT / source['path']
        if digest(path) != source['sha256']:
            raise ValueError(f'{lesson_id} source drift: {path}')
    if transcript['sourceScriptSha256'] != script['sha256'] or transcript['boundCaptionSha256'] != caption['sha256']:
        raise ValueError(f'{lesson_id} transcript source binding changed')
    expected = script_narration((ROOT / script['path']).read_text())
    actual = (ROOT / transcript['path']).read_text()
    if actual != expected:
        raise ValueError(f'{lesson_id} transcript differs from versioned script narration cells')
    count = assert_word_match(lesson_id, actual, (ROOT / caption['path']).read_text())
    if count != transcript['normalizedWordCount']:
        raise ValueError(f'{lesson_id} word count changed')
    if lesson_id == 'L10':
        receipt = json.loads((MAP.parent / 'l10-acoustic-receipt.json').read_text())
        candidate_path = ROOT / 'agentified/workshop/phase-3b-review/L10/agentified-l10-caption-timed.vtt'
        if digest(candidate_path) != receipt['correctedVttSha256']:
            raise ValueError('L10 corrected caption candidate drifted')
        candidate = candidate_path.read_text()
        assert_word_match('L10', actual, candidate)
        if candidate.count('00:02:53.660 --> 00:03:05.000') != 1 or candidate.count('00:03:05.520 --> 00:03:06.300') != 1:
            raise ValueError('L10 corrected join timing changed')
        timings = re.findall(r'(\d\d:\d\d:\d\d\.\d\d\d) --> (\d\d:\d\d:\d\d\.\d\d\d)', candidate)
        def milliseconds(stamp: str) -> int:
            hours, minutes, rest = stamp.split(':')
            seconds, millis = rest.split('.')
            return (int(hours) * 3600 + int(minutes) * 60 + int(seconds)) * 1000 + int(millis)
        if any(milliseconds(left[1]) > milliseconds(right[0]) for left, right in zip(timings, timings[1:])):
            raise ValueError('L10 corrected cues overlap')
print(f'PASS: {len(records)} script-bound transcript artifacts match their bound VTT normalized word sequences')
