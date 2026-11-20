"""Regenerate the bounded Phase 3B source identity map without asserting speech review."""

import hashlib
import json
from pathlib import Path

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
records = []
for lesson in baseline['lessons']:
    if lesson['id'] not in IDS:
        continue
    assets = lesson['assets']
    records.append({
        'lessonId': lesson['id'],
        'script': checked(lesson['script']['path'], lesson['script']['sha256']),
        'originalVideo': checked(assets['composite']['path'], assets['composite']['sha256']),
        'originalCaption': checked(assets['captions']['path'], assets['captions']['sha256']),
        'oldUnattributedTranscriptSha256': lesson['transcript']['bindingSha256'],
        'spokenWordingReview': 'pending_contextual_listening',
        'versionedTranscript': None,
        'rightsScope': 'visual_preproduction_only; final distribution unconfirmed',
    })

assert len(records) == 13
output = {
    'schemaVersion': 1,
    'baseCommit': '9f31a4db904b3cf1b4e097191a3df32f13e8f8c9',
    'lineageManifest': 'docs/agentified-distribution-readiness/phase-2/qualification-manifest.json',
    'method': 'SHA-256 of exact bytes; no ASR, acoustic review, or transcript equivalence inferred',
    'records': records,
}
(HERE / 'source-map-v1.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'Verified {len(records)} source identity records; spoken wording remains pending')
