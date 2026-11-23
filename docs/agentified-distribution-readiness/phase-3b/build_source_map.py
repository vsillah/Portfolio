"""Regenerate Phase 3B source identities and script-derived transcripts."""

import hashlib
import json
from pathlib import Path
from transcript_provenance import assert_word_match, script_narration

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
BASELINE = ROOT / 'docs/agentified-distribution-readiness/phase-2/qualification-manifest.json'
IDS = {'L01', *(f'L{number:02d}' for number in range(5, 17))}


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            sha.update(block)
    return sha.hexdigest()


def checked(path: str, expected: str) -> dict:
    relative = path.lstrip('/')
    if path.startswith('/'):
        relative = f'public/{relative}'
    actual = digest(ROOT / relative)
    if actual != expected:
        raise ValueError(f'source drift: {relative}: {actual} != {expected}')
    return {'path': relative, 'sha256': actual}


baseline = json.loads(BASELINE.read_text())
current = json.loads((ROOT / 'lib/agentified-illustrated-bindings.json').read_text())['bindings']
records = []
transcripts = []
for lesson in baseline['lessons']:
    if lesson['id'] not in IDS:
        continue
    assets = lesson['assets']
    script = checked(lesson['script']['path'], lesson['script']['sha256'])
    caption = checked(current[lesson['id']]['captions'], current[lesson['id']]['captionsSha256'])
    narration = script_narration((ROOT / script['path']).read_text())
    word_count = assert_word_match(lesson['id'], narration, (ROOT / caption['path']).read_text())
    transcript_path = f'docs/agentified-distribution-readiness/phase-3b/transcripts/{lesson["id"]}-{script["sha256"][:12]}.txt'
    transcript_bytes = narration.encode('utf-8')
    transcripts.append((transcript_path, transcript_bytes))
    records.append({
        'lessonId': lesson['id'],
        'script': script,
        'originalVideo': checked(assets['composite']['path'], assets['composite']['sha256']),
        'currentVideo': checked(current[lesson['id']]['video'], current[lesson['id']]['compositeSha256']),
        'currentCaption': caption,
        'currentDurationSeconds': current[lesson['id']]['durationSeconds'],
        'originalCaption': checked(assets['captions']['path'], assets['captions']['sha256']),
        'oldUnattributedTranscriptSha256': lesson['transcript']['bindingSha256'],
        'spokenWordingReview': 'pending_contextual_listening',
        'versionedTranscript': {
            'path': transcript_path,
            'sha256': hashlib.sha256(transcript_bytes).hexdigest(),
            'sourceScriptSha256': script['sha256'],
            'boundCaptionSha256': caption['sha256'],
            'normalizedWordCount': word_count,
            'derivation': 'eight Spoken narration — read in full cells, in order; outer table quotes removed',
        },
        'rightsScope': 'visual_preproduction_only; final distribution unconfirmed',
    })

assert len(records) == 13
output = {
    'schemaVersion': 1,
    'baseCommit': '9f31a4db904b3cf1b4e097191a3df32f13e8f8c9',
    'lineageManifest': 'docs/agentified-distribution-readiness/phase-2/qualification-manifest.json',
    'method': 'SHA-256 of exact bytes; script-derived transcript and bound VTT normalized word sequence equality; no character-level or full-audio equivalence inferred',
    'records': records,
}
for relative, contents in transcripts:
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(contents)
(HERE / 'source-map-v1.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'Verified {len(records)} source identities and script-derived transcript/VTT word sequences; full audio wording review remains pending')
