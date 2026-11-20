#!/usr/bin/env python3
"""Rebuild the Phase 3A locked evidence packet. No provider or learner writes."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
PHASE2 = json.loads((HERE.parent / 'phase-2/qualification-manifest.json').read_text())
SOURCE = json.loads((ROOT / 'agentified/workshop/l02-l04-native-source/provider-receipts.json').read_text())
DRIVE = Path('/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions')
MEDIA_EXT = {'.mp4', '.mov', '.m4a', '.wav', '.mp3', '.webm', '.srt', '.vtt'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def file_sha(path):
    return sha(path.read_bytes())

def write_json(name, value):
    (HERE / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def spoken_rows(path):
    return re.findall(r'^\|[^|]+\|\s*[“"](.+?)[”"]\s*\|', path.read_text(), re.M)

def words(value):
    return re.findall(r'[a-z0-9]+', value.lower().replace('’', "'"))

lessons = {x['id']: x for x in PHASE2['lessons']}
drive_files = [p for p in DRIVE.rglob('*') if p.is_file()] if DRIVE.exists() else []
drive_media = [p for p in drive_files if p.suffix.lower() in MEDIA_EXT]
drive_named = [p for p in drive_files if re.search(r'agentified|l0[234].*(?:narrat|lesson)|(?:narrat|lesson).*l0[234]', p.name, re.I)]

search = {
    'schema_version': 1,
    'base_commit': 'c0149ac93e01caf924ddb4d22184a164895a41f5',
    'phase2_evidence_base_commit': PHASE2['baseCommit'],
    'status': 'negative_for_exact_approved_complete_L02_L04_recordings_in_checked_local_and_mounted_paths',
    'method': 'recursive filename and media inventory, existing provider/source receipt review, script/hash and duration comparison for potential matches',
    'roots_checked': [
        '/Users/vambahsillah/Projects/Portfolio',
        '/Users/vambahsillah/Projects/Portfolio/docs',
        '/Users/vambahsillah/Projects/Portfolio/public',
        '/Users/vambahsillah/Projects/Portfolio/design-files',
        '/Users/vambahsillah/Projects/Portfolio/n8n-exports',
        str(DRIVE), str(DRIVE / 'Artifacts /Company Materials/'),
        str(ROOT / 'agentified/workshop'),
    ],
    'mounted_drive_file_count': len(drive_files),
    'mounted_drive_media_count': len(drive_media),
    'mounted_drive_agentified_or_L02_L04_narration_filename_count': len(drive_named),
    'mounted_drive_media_scope_note': 'Drive media inventory consists of other named projects, Accelerated audiobook/chapter audio, promotional assets, and client project footage; no Agentified L02-L04 source identity or canonical-script receipt was located. Unrelated private paths are intentionally omitted.',
    'limitations': ['Mounted Drive is a local snapshot, not a live provider account or cloud-wide search.', 'Audio content of unrelated Drive media was not transcribed.', 'A complete recording outside checked paths remains possible.'],
    'lessons': [],
}

for id in ('L02', 'L03', 'L04'):
    item = lessons[id]
    script = ROOT / item['script']['path']
    assert file_sha(script) == item['script']['sha256']
    rows = spoken_rows(script)
    assert len(rows) == 8
    full = '\n\n'.join(rows)
    source_job = next(x for x in SOURCE['jobs'] if x['lesson_id'] == id)
    native = ROOT / source_job['native_path']
    assert file_sha(native) == source_job['native_sha256']
    search['lessons'].append({
        'id': id, 'script_path': item['script']['path'], 'script_file_sha256': item['script']['sha256'],
        'spoken_word_count': len(words(full)), 'spoken_character_count': len(full),
        'existing_native_path': source_job['native_path'], 'existing_native_sha256': source_job['native_sha256'],
        'existing_native_duration_seconds': source_job['native_duration_seconds'],
        'bound_source_path': item['assets']['source']['path'],
        'bound_composite_path': item['assets']['composite']['path'],
        'bound_caption_path': item['assets']['captions']['path'],
        'phase2_caption_word_count': item['captions']['captionWordCount'],
        'phase2_silence': item['media']['silence'],
        'match_result': 'rejected_as_complete_recording: native source covers short presenter windows; current teaching audio silent and captions omit most script',
    })
    proposal = {
        'schema_version': 1, 'status': 'locked_provider_free_proposal_only', 'lesson_id': id,
        'canonical_script_path': item['script']['path'], 'canonical_script_file_sha256': item['script']['sha256'],
        'spoken_rows_sha256': [sha(x.encode()) for x in rows],
        'spoken_text_sha256': sha(full.encode()), 'spoken_text_utf8': full,
        'spoken_character_count': len(full), 'spoken_utf8_bytes': len(full.encode()),
        'spoken_word_count': len(words(full)), 'spoken_row_count': len(rows),
        'existing_presenter_source': {'path': source_job['native_path'], 'sha256': source_job['native_sha256'], 'duration_seconds': source_job['native_duration_seconds']},
        'identity_precedent': {'look_name': SOURCE['look']['name'], 'look_id': SOURCE['look']['id'], 'voice_id': SOURCE['voice']['id'], 'source_receipt': 'agentified/workshop/l02-l04-native-source/provider-receipts.json', 'status': 'exact_existing_L02_L04_review_source_identity; new purpose-specific use approval required'},
        'expected_output': {'scope': 'one complete lesson, all eight exact canonical narration rows', 'format': 'single continuous lossless or high-quality audio master with timing/transcript receipt', 'duration': 'script estimate only; verify native duration and sentence alignment before local composite', 'captions': 'regenerate from exact words after audio alignment; desktop and 390x844 contextual MP4 review required', 'presenter': 'preserve existing native presenter footage and audio at normal speed/pitch; avoid double speech'},
        'input_limits': {'required_minimum_characters': len(full), 'provider_limit_verified': False, 'gate': 'verify documented single-job character limit and output duration before any request; stop if insufficient'},
        'privacy_rights': {'inputs': 'canonical synthetic workshop script only; omit real participant records and secret IDs', 'existing_short_source_rights': 'review_only', 'new_voice_likeness_use': 'purpose_specific_confirmation_required', 'final_distribution': 'not_authorized'},
        'cost_request': {'current_authorized_spend_usd': 0, 'proposed_aggregate_hard_ceiling_usd': 9.99, 'vendor_quote_verified': False, 'gate': 'obtain exact metered price, fees and enforceable aggregate cap before seeking separate execution authority; stop if total cannot be capped below ceiling'},
        'execution_allowed': False, 'provider_contact_allowed': False, 'generation_allowed': False, 'spend_allowed': False,
        'automatic_retries': 0, 'manual_retries': 0, 'learner_binding_allowed': False,
    }
    write_json(f'{id.lower()}-whole-lesson-proposal.json', proposal)

write_json('search-manifest.json', search)

# One local caption correction candidate. The earlier long cue ends at the next
# cue's start, leaving all words and every other timestamp byte-for-byte intact.
vtt_path = ROOT / 'public/agentified/lessons/l10/approved-a2dfdec5/agentified-l10-native-captions.vtt'
original = vtt_path.read_text()
old = '00:02:53.660 --> 00:03:05.000\nGive the envelope an exact illustrative amount, named course counterparty, purpose, window, one-or-zero retry limit, trace, human approver, and revocation condition.'
new = old.replace('00:03:05.000', '00:03:04.360')
assert original.count(old) == 1
candidate = original.replace(old, new)
out = HERE / 'l10-captions-candidate.vtt'
out.write_text(candidate)
write_json('l10-caption-receipt.json', {
    'source_path': str(vtt_path.relative_to(ROOT)), 'source_sha256': file_sha(vtt_path),
    'candidate_path': str(out.relative_to(ROOT)), 'candidate_sha256': file_sha(out),
    'change': 'end of one seven-field envelope cue 03:05.000 -> 03:04.360; next cue starts 03:04.360',
    'words_unchanged': words(original) == words(candidate), 'other_timings_unchanged': True,
    'audio_sync': 'requires contextual listening before binding', 'learner_binding_changed': False,
})
