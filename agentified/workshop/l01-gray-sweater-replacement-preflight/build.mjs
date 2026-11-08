import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileHash = (relative) => sha(readFileSync(path.join(root, relative)));
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const currentMainCommit = 'e51b09b746256e1c6825d249438bcd4a0e6f181e';
const originalPath = 'agentified/workshop/l01-guided-video-preflight/request-candidate.json';
const original = readJson(originalPath);

assert(
  original.candidate_sha256 === '3d36d889ffb65d63e6a6bd4f0b315c00ed25162e329c0303acec09656c5114cb',
  'Approved L01 request candidate drifted',
);
assert(original.presenter_windows.length === 2, 'L01 presenter-window count changed');
assert(original.presenter_windows[0].narration_sha256 === 'a74e9c21c24d9b6f4b730d66d38458502da809b27446b40dd3b57074183360b1', 'L01 opening passage drifted');
assert(original.presenter_windows[1].narration_sha256 === '00cc15136e5f5d627a96371e223d39835886770122d09900f78069ba4793fdac', 'L01 closing passage drifted');
assert(original.provider_free_closing_card.duration_seconds === 17, 'L01 provider-free close drifted');
assert(fileHash('agentified/workshop/l01-guided-video-preflight/identity-voice-use-approval-receipt.json') === '8d9f5a94b0c8b68f23ae099da502de32c151109ca54847d4a43e3ed98d386534', 'Historical green-sweater approval receipt changed');
assert(fileHash('agentified/workshop/l01-native-source/provider-receipt.json') === '4e0f63a4f0d58d68b949549dc969f9f84cd84d99552b88c3990fbbaa4535baf5', 'Historical L01 provider receipt changed');
assert(fileHash('agentified/workshop/l01-native-source/agentified-l01-heygen-native-source.mp4') === 'f98f0208620f4085d0eb05322e969ee912a0b5b02222ca8da4871a7a43320fa0', 'Historical L01 native source changed');

const candidate = structuredClone(original);
delete candidate.candidate_sha256;
candidate.schema_version = 3;
candidate.status = 'provider_free_replacement_candidate_pending_identity_approval';
candidate.authorized_source_commit = currentMainCommit;
candidate.supersedes_candidate_sha256 = original.candidate_sha256;
candidate.replacement_reason = 'Replace the visually inconsistent green-sweater presenter and blue source background with the established Agentified gray-sweater treatment.';
candidate.approved_identity_voice_binding = null;
candidate.proposed_identity_voice_binding = {
  status: 'pending_exact_l01_approval',
  look: {
    name: 'Vambah Gray Sweater',
    id: '7275ba9035f94b31ad589dda6532d002',
  },
  voice: {
    name: 'Vambah avatar-native voice',
    id: '14b592b937744404a4fa7c01aafd7dbe',
    type: 'avatar-native voice',
  },
  scope: 'Agentified L01 replacement review-only source',
};
candidate.production.composition = 'Remove the source background provider-free, preserve the gray-sweater presenter at native speed and aspect ratio, and keep the presenter clear of captions, teaching copy, worksheet fields, and diagram labels.';
candidate.boundaries.rights = 'The gray-sweater look and avatar-native voice require exact purpose-specific approval for this L01 replacement. Existing L02-L04 approval does not extend to L01.';
candidate.boundaries.release = 'Provider execution, learner playback replacement, publication, and distribution remain blocked pending exact identity approval, one-job execution authority, native-source review, and a corrected composite receipt.';
candidate.execution_gates = [
  'Receive exact purpose-specific approval for the gray-sweater look and avatar-native voice for this L01 replacement only.',
  'Preserve both exact sentence-complete passages, presenter endpoints, and the provider-free 17-second closing evidence card.',
  'Verify current wallet balance and auto-reload off before one single-attempt job; no purchase, overage, or retry.',
  'Fail closed on source, identity, voice, passage, timing, privacy, debit, or output drift.',
  'Complete native-source, background-removal, caption, accessibility, and final-composite Human QA before changing learner playback.',
];
candidate.candidate_sha256 = sha(JSON.stringify(candidate));

const receipt = {
  schema_version: 1,
  status: 'validated_provider_free_replacement_preflight',
  generated_at: '2026-11-08T00:00:00Z',
  source_commit: currentMainCommit,
  original_request_sha256: original.candidate_sha256,
  replacement_request_sha256: candidate.candidate_sha256,
  provider_calls: 0,
  media_generated: 0,
  spend_usd: 0,
  checks: {
    exact_two_passages_preserved: true,
    passage_hashes_preserved: true,
    presenter_windows_preserved: true,
    provider_free_closing_card_preserved: true,
    gray_sweater_identity_proposed: true,
    background_removal_required: true,
    execution_blocked: true,
    existing_green_source_excluded_from_replacement: true,
  },
  unresolved: [
    'purpose-specific L01 gray-sweater identity and voice-use approval',
    'current wallet and auto-reload verification',
    'single-job provider execution authorization',
    'native source and corrected composite Human QA',
  ],
};

for (const [name, value] of [['request-candidate.json', candidate], ['validation-receipt.json', receipt]]) {
  const destination = path.join(here, name);
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (process.argv.includes('--check')) {
    assert(readFileSync(destination, 'utf8') === body, `${name} is stale`);
  } else {
    writeFileSync(destination, body);
  }
}

console.log(`L01 gray-sweater replacement candidate ${candidate.candidate_sha256}`);
