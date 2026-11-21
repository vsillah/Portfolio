"""Verify owner-release receipt and overlay exact binding."""

import json
from build_rights_overlay import OVERLAY, RECEIPT, build

expected = build()
actual = json.loads(OVERLAY.read_text())
if actual != expected:
    raise ValueError('owner rights overlay differs from exact receipt/source map')
receipt = json.loads(RECEIPT.read_text())
if receipt['status'] != 'owner_rights_confirmed_for_identified_workshop_distribution':
    raise ValueError('owner release status changed')
if receipt['approvedUse']['accessModel'] != 'guest access with optional sign-in for saved progress':
    raise ValueError('access model changed')
if 'publication or release' not in receipt['executionNotAuthorized']:
    raise ValueError('release execution boundary missing')
if any(record['priorRightsScope'] != 'visual_preproduction_only; final distribution unconfirmed' for record in actual['records']):
    raise ValueError('prior preproduction rights lineage changed')
print(f'PASS: owner rights receipt binds {len(actual["records"])} exact source-map records; release execution remains blocked')
