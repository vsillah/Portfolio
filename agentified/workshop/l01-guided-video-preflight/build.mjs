import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const here = path.dirname(fileURLToPath(import.meta.url));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileHash = (relative) => sha(readFileSync(path.join(root, relative)));
const json = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const packetPath = 'agentified/workshop/scene-production/packets/L01.json';
const coverMapPath = 'docs/qa/agentified-lesson-covers/source-map.json';
const packet = json(packetPath);
const map = json(coverMapPath);
const poster = map.posters.find((item) => item.lesson === 'L01');
const authorizedSourceCommit = '63ad5911294534d111f0696346682cc79c52fdc3';
const identityApproval = {
  approved_by: 'Vambah Sillah',
  approval_date: '2026-11-07',
  provider: 'HeyGen',
  use: 'Agentified L01 review-only source',
  look: { name: 'Vambah green sweater', id: '329ae68b92d342f6a4362cc656d486a0' },
  voice: { name: 'Vambah green sweater', id: '14b592b937744404a4fa7c01aafd7dbe', type: 'avatar-native voice' },
  inputs: ['approved public material', 'approved synthetic teaching material', 'approved book material', 'approved Agentified workshop assets'],
  exclusions: ['other lessons', 'publication', 'distribution', 'provider training reuse', 'automatic retries', 'credential or account changes'],
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const bound = (relative, expected, use) => {
  const actual = fileHash(relative);
  assert(actual === expected, `Source drift: ${relative}: ${actual} != ${expected}`);
  return { path: relative, sha256: actual, use };
};

assert(packet.id === 'L01' && packet.timing_seconds === 540, 'Unexpected lesson or duration');
assert(map.baseCommit === 'db010ebfe7c14a378fb4ff2102af48c1b1954293', 'Cover map provenance drift');
assert(poster.scriptSha256 === packet.script_sha256, 'Poster and packet script mismatch');
assert(poster.approvedVisualSha256 === '1f5d13085c97dc9937bdd30362a17729b95d1401775706faa474bfe87858b669', 'Approved plate changed');
assert(poster.canonicalCoverSha256 === packet.package_cover.sha256, 'Package cover mismatch');
assert(poster.mediaStatus === 'static-cover; video locked', 'Cover media status changed');

const scenes = packet.scenes;
const windows = scenes.filter((scene) => scene.avatar_window).map((scene) => {
  const { start_seconds: start, end_seconds: end, state } = scene.avatar_window;
  assert(state === 'reserved_unfilled', `${scene.id} presenter window is no longer empty`);
  const cues = scene.captions.filter((cue) => cue.start_seconds >= start && cue.end_seconds <= end);
  assert(cues.length > 0 && cues[0].start_seconds === start, `${scene.id} start is not a caption boundary`);
  const passage = cues.map((cue) => cue.text).join('').trim();
  assert(/[.!?][”']?$/.test(passage), `${scene.id} passage ends mid-sentence`);
  assert(scene.narration_exact.includes(passage), `${scene.id} passage diverges from exact narration`);
  const presenterEnd = scene.id === 'L01-08' ? cues.at(-1).end_seconds : end;
  return {
    id: scene.id, start_seconds: start, end_seconds: presenterEnd,
    original_reserved_end_seconds: end,
    presenter_duration_seconds: Number((presenterEnd - start).toFixed(3)),
    narration_exact: passage, narration_sha256: sha(passage),
    caption_cues: cues,
    caption_end_seconds: cues.at(-1).end_seconds,
    provider_free_tail_seconds: Number((end - presenterEnd).toFixed(3)),
    timing_status: 'approved_sentence_complete_presenter_window',
  };
});
assert(windows.length === 2 && windows[0].id === 'L01-01' && windows[1].id === 'L01-08', 'Presenter window set changed');
assert(windows[0].provider_free_tail_seconds === 0 && windows[1].provider_free_tail_seconds === 17, 'Presenter timing correction changed');
const sourceBindings = [
  bound(packetPath, fileHash(packetPath), 'production_packet'),
  bound(packet.script_path, packet.script_sha256, 'approved_narration_source'),
  bound(coverMapPath, fileHash(coverMapPath), 'static_cover_source_map'),
  bound('agentified/workshop/visual-review/packets.json', packet.approved_visual_packet_sha256, 'approved_visual_register'),
  bound('agentified/workshop/source-register.json', packet.source_register_sha256, 'source_register'),
  bound('agentified/workshop/curriculum-crosswalk.json', packet.crosswalk_sha256, 'curriculum_crosswalk'),
  bound(packet.workbook_source.path, packet.workbook_source.sha256, 'workbook_lineage'),
  ...packet.chapter_sources.map((item) => bound(item.path, item.sha256, 'chapter_lineage')),
  bound(packet.package_cover.path, packet.package_cover.sha256, 'package_identity_only'),
  bound(poster.approvedVisualPath, poster.approvedVisualSha256, 'approved_L01-04_diagram_only'),
  bound(poster.output, poster.outputSha256, 'static_locked_poster_only'),
  bound(poster.identityReference, poster.identityReferenceSha256, 'local_static_cover_identity_reference_only'),
  bound(poster.avatarSource, poster.avatarSourceSha256, 'local_static_cover_cutout_only'),
  bound(poster.logo, poster.logoSha256, 'static_cover_logo_only'),
];
const presenterManifest = {
  schema_version: 1,
  status: 'approved_l01_execution_timing',
  authorized_source_commit: authorizedSourceCommit,
  source_storyboard_manifest: {
    path: 'agentified/workshop/scene-production/presenter-windows.json',
    sha256: fileHash('agentified/workshop/scene-production/presenter-windows.json'),
    treatment: 'historical storyboard reservation; preserved unchanged',
  },
  lesson_id: 'L01',
  lesson_duration_seconds: 540,
  provider_presenter_windows: windows.map(({ id, start_seconds, end_seconds, presenter_duration_seconds, narration_sha256 }) => ({
    id, start_seconds, end_seconds, presenter_duration_seconds, narration_sha256,
  })),
  provider_free_closing_card: {
    scene_id: 'L01-08', start_seconds: 523, end_seconds: 540, duration_seconds: 17,
    treatment: 'approved closing evidence card; no presenter footage or generated voice',
  },
};
const request = {
  schema_version: 2, status: 'provider_free_request_candidate_locked', provider_candidate: 'HeyGen', lesson_id: 'L01',
  authorized_source_commit: authorizedSourceCommit,
  correction_scope: 'sentence-complete presenter windows plus provider-free closing evidence card',
  prior_scene_packet_merge: map.baseCommit,
  execution_allowed: false, provider_contact_allowed: false, upload_allowed: false,
  avatar_generation_allowed: false, voice_generation_allowed: false, publish_allowed: false,
  spend_cap_usd: 0, automatic_retries: 0, requested_job_limit: 1,
  one_job_candidate_key: sha(`${packet.script_sha256}:${fileHash(packetPath)}:${poster.outputSha256}:L01:two-passages:closing-card`),
  lesson_duration_seconds: 540,
  presenter_duration_seconds: Number(windows.reduce((sum, window) => sum + window.presenter_duration_seconds, 0).toFixed(3)),
  scripted_speech_span_seconds: Number(windows.reduce((sum, window) => sum + window.presenter_duration_seconds, 0).toFixed(3)),
  conditional_generated_duration_seconds: 23.431,
  provider_billable_duration_seconds: null,
  duration_note: 'Generate only the two exact sentence-complete passages in one continuous source. The expected scripted span is 23.431 seconds before provider pacing. The 17-second L01-08 tail is provider-free and remains inside the unchanged 09:00 lesson.',
  format_candidate: { master: '1920x1080 16:9', frame_rate: 30, portrait: 'separate 1080x1920 reflow after review' },
  presenter_windows: windows,
  provider_free_closing_card: {
    scene_id: 'L01-08', start_seconds: 523, end_seconds: 540, duration_seconds: 17,
    treatment: 'Hold the approved closing evidence card without presenter footage or generated voice; preserve the existing plate binding, lesson timing, captions and reduced-motion behavior.',
  },
  approved_identity_voice_binding: {
    receipt: 'identity-voice-use-approval-receipt.json',
    receipt_sha256: sha(JSON.stringify(identityApproval)),
    look: identityApproval.look,
    voice: identityApproval.voice,
    scope: identityApproval.use,
  },
  revised_presenter_window_manifest: {
    receipt: 'presenter-window-manifest.json',
    receipt_sha256: sha(JSON.stringify(presenterManifest)),
  },
  one_job_payload_boundary: {
    passages: windows.map(({ id, narration_exact, narration_sha256 }) => ({ id, narration_exact, narration_sha256 })),
    treatment: 'Submit the two passages as one continuous script in one job, then split and place the native source provider-free at the approved sentence boundaries.',
  },
  production: {
    composition: 'Keep presenter clear of captions, teaching copy, and worksheet fields; preserve approved diagram aspect ratio and never overlay its labels.',
    plate_use: { scene: poster.sceneId, path: poster.approvedVisualPath, sha256: poster.approvedVisualSha256, alt_text: 'First receipt diagram showing a bounded job and the source trail needed to review its output.' },
    package_cover: { path: packet.package_cover.path, sha256: packet.package_cover.sha256, use: 'package identity only; no scene plate use' },
    static_poster: { path: poster.output, sha256: poster.outputSha256, alt_text: poster.altText, media_status: poster.mediaStatus },
    captions: 'Exact packet cues are provisional. Time an independent caption track to the approved final mix; retain full transcript, reading order, contrast and portrait-safe caption band.',
    reduced_motion: 'Use instant cuts; no required information may depend on motion.',
    audio_ownership: 'One speaker at a time. If separately approved native presenter audio owns a window, mute the matching narrator span; never layer both. Preserve source MP4 frame rate, frame count, duration and lip sync in reproducible FFmpeg composite.',
  },
  source_bindings: sourceBindings,
  boundaries: {
    evidence: 'Synthetic Harbor Learning Circle and Morgan only; no participant, customer, admin, private chat, or live operational records.',
    rights: 'Vambah approved the named private look and avatar-native voice for this Agentified L01 review-only source. The grant does not extend to other lessons, publication, distribution, provider training reuse or credential changes.',
    lineage: 'Accelerated SAM media is reference lineage only and excluded from Agentified output.',
    release: 'Customer-facing audio, provider execution, video playback and publication remain held pending recorded timing, transcript/copy, accessibility, rights and separate authorization.',
  },
  execution_gates: [
    'Preserve the exact purpose-specific identity and voice-use receipt and fail closed on look, voice, provider or scope drift.',
    'Preserve both sentence-complete presenter endpoints and the provider-free 17-second closing evidence card.',
    'Obtain a binding one-job quote, known billable duration and an enforceable total below the separately authorized limit; no split jobs or retry.',
    'Complete privacy, source, customer-copy, accessibility and final composite transcript review.',
    'Receive separate exact provider execution authorization; this draft conveys none.',
  ],
  cap_options_for_later_decision: [
    { option: 'provider_hard_cap', condition: 'Account or API enforces one job, no retry and a maximum total charge before submission; fail closed if unavailable.' },
    { option: 'prepaid_single_job', condition: 'Prepaid balance or single-use allocation is technically restricted to one job and exact capped total; fail closed if renewal or overage is possible.' },
    { option: 'no_execution', condition: 'Use if neither enforceable option exists. A price estimate or manual promise is insufficient.' },
  ],
};
request.supersedes_candidate_sha256 = '9798ff87f0eb36d6e9479c1ea324e2506715baba78a5b9f936d6e43e1a9f3c10';
request.candidate_sha256 = sha(JSON.stringify(request));
const receipt = {
  schema_version: 2, status: 'validated_local_candidate', provider_calls: 0, media_generated: 0, spend_usd: 0,
  request_sha256: request.candidate_sha256,
  source_binding_count: sourceBindings.length,
  source_bindings_sha256: sha(JSON.stringify(sourceBindings)),
  checks: [
    'exact source hashes match current files', 'script and cover map agree', 'both passages reconstruct complete sentences from exact packet captions',
    'presenter windows end at sentence boundaries', '17-second closing tail is bound to a provider-free evidence card',
    'purpose-specific look and avatar-native voice approval is bound by hash', 'provider execution and spending are disabled',
  ],
  unresolved: ['binding one-job quote and enforceable cap', 'provider support for the exact look and two passages within one job', 'final native-source timing, transcript and rendered accessibility review'],
};
const approvalReceipt = {
  schema_version: 1,
  status: 'approved_for_named_review_only_source',
  authorized_source_commit: authorizedSourceCommit,
  approval: identityApproval,
  approval_sha256: sha(JSON.stringify(identityApproval)),
  provider_execution_allowed: false,
  upload_allowed: false,
  media_generation_allowed: false,
  spend_allowed: false,
  automatic_retries: 0,
};
const outputs = [
  ['request-candidate.json', request],
  ['validation-receipt.json', receipt],
  ['identity-voice-use-approval-receipt.json', approvalReceipt],
  ['presenter-window-manifest.json', presenterManifest],
];
for (const [name, data] of outputs) {
  const destination = path.join(here, name);
  const body = `${JSON.stringify(data, null, 2)}\n`;
  if (process.argv.includes('--check')) assert(readFileSync(destination, 'utf8') === body, `${name} is stale`);
  else writeFileSync(destination, body);
}
console.log(`L01 provider-free candidate ${request.candidate_sha256}; ${sourceBindings.length} bindings; ${windows.length} windows; ${request.presenter_duration_seconds}s presenter span; ${request.provider_free_closing_card.duration_seconds}s provider-free close`);
