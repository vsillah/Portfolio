#!/usr/bin/env python3
"""Validate immutable Phase 3A proposals and the one local caption candidate."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
phase2 = json.loads((HERE.parent / 'phase-2/qualification-manifest.json').read_text())
search = json.loads((HERE / 'search-manifest.json').read_text())
by_id = {x['id']: x for x in phase2['lessons']}
assert search['base_commit'] == 'c0149ac93e01caf924ddb4d22184a164895a41f5'
assert [x['id'] for x in search['lessons']] == ['L02', 'L03', 'L04']

def sha(data):
    return hashlib.sha256(data).hexdigest()

for id in ('L02', 'L03', 'L04'):
    p = json.loads((HERE / f'{id.lower()}-whole-lesson-proposal.json').read_text())
    baseline = by_id[id]
    script = ROOT / p['canonical_script_path']
    assert sha(script.read_bytes()) == p['canonical_script_file_sha256'] == baseline['script']['sha256']
    rows = re.findall(r'^\|[^|]+\|\s*[“"](.+?)[”"]\s*\|', script.read_text(), re.M)
    assert len(rows) == 8 and '\n\n'.join(rows) == p['spoken_text_utf8']
    assert sha(p['spoken_text_utf8'].encode()) == p['spoken_text_sha256']
    assert len(p['spoken_text_utf8']) == p['spoken_character_count']
    assert len(p['spoken_text_utf8'].encode()) == p['spoken_utf8_bytes']
    assert len(re.findall(r'[a-z0-9]+', p['spoken_text_utf8'].lower().replace('’', "'"))) == p['spoken_word_count']
    native = ROOT / p['existing_presenter_source']['path']
    assert sha(native.read_bytes()) == p['existing_presenter_source']['sha256']
    assert not any(p[k] for k in ('execution_allowed', 'provider_contact_allowed', 'generation_allowed', 'spend_allowed', 'learner_binding_allowed'))
    assert p['cost_request']['current_authorized_spend_usd'] == 0 and not p['cost_request']['vendor_quote_verified']
    assert p['input_limits']['required_minimum_characters'] == p['spoken_character_count'] and not p['input_limits']['provider_limit_verified']

receipt = json.loads((HERE / 'l10-caption-receipt.json').read_text())
source = ROOT / receipt['source_path']
candidate = ROOT / receipt['candidate_path']
old = source.read_text(); new = candidate.read_text()
assert sha(source.read_bytes()) == receipt['source_sha256'] == by_id['L10']['assets']['captions']['sha256']
assert sha(candidate.read_bytes()) == receipt['candidate_sha256']
assert old.replace('00:02:53.660 --> 00:03:05.000', '00:02:53.660 --> 00:03:04.360') == new
assert new.count('00:02:53.660 --> 00:03:04.360') == 1
times = []
for a,b in re.findall(r'([0-9:.]+) --> ([0-9:.]+)', new):
    def sec(s):
        h,m,s=s.split(':'); return int(h)*3600+int(m)*60+float(s)
    times.append((sec(a),sec(b)))
assert all(b > a for a,b in times)
assert all(times[i][0] >= times[i-1][1] - .01 for i in range(1,len(times)))
print('Phase 3A: three locked full-script proposals, native hashes, and non-overlapping L10 VTT pass.')
