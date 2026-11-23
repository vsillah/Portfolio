"""Build an owner-rights overlay without changing the approved source map."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
RECEIPT = HERE / 'owner-release-receipt-2026-11-20.json'
OVERLAY = HERE / 'rights-overlay-v1.json'


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> dict:
    receipt = json.loads(RECEIPT.read_text())
    source_path = ROOT / receipt['sourceMap']['path']
    if digest(source_path) != receipt['sourceMap']['sha256']:
        raise ValueError('owner authorization source-map hash does not match')
    source = json.loads(source_path.read_text())
    records = source['records']
    if [record['lessonId'] for record in records] != receipt['coveredLessons']:
        raise ValueError('owner authorization lesson set differs from source map')
    if receipt['approvedStackedCodeHead'] != '11fc4cb663028240016d144364e8ac4030b3372e':
        raise ValueError('stacked approval head changed')
    return {
        'schemaVersion': 1,
        'sourceMap': receipt['sourceMap'],
        'ownerReleaseReceipt': {
            'path': str(RECEIPT.relative_to(ROOT)),
            'sha256': digest(RECEIPT),
        },
        'previousStatePreservedInSourceMap': True,
        'qualification': 'owner_rights_confirmed_for_identified_workshop_distribution_only; no execution or release',
        'records': [{
            'lessonId': record['lessonId'],
            'priorRightsScope': record['rightsScope'],
            'currentVideoSha256': record['currentVideo']['sha256'],
            'currentCaptionSha256': record['currentCaption']['sha256'],
            'scriptSha256': record['script']['sha256'],
            'versionedTranscriptSha256': record['versionedTranscript']['sha256'],
            'approvedRightsScope': 'public_open_learning_workshop_playback_and_ordinary_delivery_for_identified_assets',
        } for record in records],
        'unboundCandidateRights': 'not_asserted_by_this_exact_source_map_receipt',
        'independentUnidentifiedAssetRights': 'not_asserted_by_this_exact_source_map_receipt',
    }


if __name__ == '__main__':
    OVERLAY.write_text(json.dumps(build(), indent=2) + '\n')
    print(f'Built {OVERLAY.name} for 13 exact source-map records')
