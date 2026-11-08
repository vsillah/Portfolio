import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileHash = (relative) => sha(readFileSync(path.join(root, relative)));
const load = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const bound = (relative, expected, use) => {
  const actual = fileHash(relative);
  assert(actual === expected, `Source drift ${relative}: ${actual} != ${expected}`);
  return { path: relative, sha256: actual, use };
};
const round = (value) => Number(value.toFixed(3));
const coverMapPath = 'docs/qa/agentified-lesson-covers/source-map.json';
const visualRegisterPath = 'agentified/workshop/visual-review/packets.json';
const sourceRegisterPath = 'agentified/workshop/source-register.json';
const crosswalkPath = 'agentified/workshop/curriculum-crosswalk.json';
const storyboardWindowsPath = 'agentified/workshop/scene-production/presenter-windows.json';
const frozenPacketHashes = Object.freeze({
  L05: '86aaa74a5227a137ba7287a794410410f268edace44a6fbc0be2b862487c723a',
  L06: '60f993e3514e353095f5180d541900553298c0f5d9a773c3fd22dad279f361af',
  L07: 'fefbdc1e3cf386b7220284ace5ac8c818030f2c8e8b8c94db9c3f7a83e8dcf87',
  L08: '50786f210a2661019764b0dee80c38a189e8d3c8cf530238fd1c8f880a64e436',
});
const frozenDurations = Object.freeze({ L05: [28.258, 5], L06: [23.687, 9], L07: [23.673, 4], L08: [29.682, 2] });
const budgetPath = 'agentified/workshop/provider-budget-authorization.json';
const l01ProviderReceiptPath = 'agentified/workshop/l01-native-source/provider-receipt.json';
const l01IdentityReceiptPath = 'agentified/workshop/l01-guided-video-preflight/identity-voice-use-approval-receipt.json';
const l01CompositePath = 'agentified/workshop/l01-native-composite/agentified-l01-native-composite.mp4';
const l01SourcePath = 'agentified/workshop/l01-native-source/agentified-l01-heygen-native-source.mp4';
const map = load(coverMapPath);
const storyboardWindows = load(storyboardWindowsPath).windows;
const budget = load(budgetPath);
const l01Receipt = load(l01ProviderReceiptPath);
const l01Identity = load(l01IdentityReceiptPath);
assert(map.baseCommit === 'db010ebfe7c14a378fb4ff2102af48c1b1954293', 'Cover provenance changed');
assert(budget.aggregate_cash_cap === 100 && budget.controls.separate_exact_job_or_batch_binding_required, 'Budget authority changed');
assert(l01Receipt.provider_usage.credit_cost === 15 && l01Receipt.wallet.wallet_debit === 0 && l01Receipt.job_controls.submitted_jobs === 1, 'L01 cost precedent changed');
assert(fileHash(l01SourcePath) === l01Receipt.native_source.sha256, 'L01 source precedent drift');
assert(l01Identity.approval.use === 'Agentified L01 review-only source' && l01Identity.approval.exclusions.includes('other lessons'), 'L01 identity scope changed');

const output = [];
const lessons = [];
for (const lessonId of ['L05', 'L06', 'L07', 'L08']) {
  const packetPath = `agentified/workshop/scene-production/packets/${lessonId}.json`;
  assert(fileHash(packetPath) === frozenPacketHashes[lessonId], `${lessonId} packet drift from bound source`);
  const packet = load(packetPath);
  const poster = map.posters.find((item) => item.lesson === lessonId);
  assert(packet.id === lessonId && poster && packet.scenes.length === 8, `${lessonId} packet or poster missing`);
  assert(packet.script_sha256 === poster.scriptSha256, `${lessonId} script and poster disagree`);
  assert(packet.approved_visual_packet_sha256 === fileHash(visualRegisterPath), `${lessonId} visual register drift`);
  assert(packet.source_register_sha256 === fileHash(sourceRegisterPath), `${lessonId} source register drift`);
  assert(packet.crosswalk_sha256 === fileHash(crosswalkPath), `${lessonId} crosswalk drift`);
  assert(packet.package_cover.sha256 === poster.canonicalCoverSha256, `${lessonId} JPG cover drift`);
  assert(poster.mediaStatus === 'static-cover; video locked' && poster.rightsStatus === 'approved_for_bound_agentified_lesson_uses', `${lessonId} static poster status drift`);
  assert(packet.boundaries.provider_execution === 'disabled' && packet.boundaries.authority.startsWith('prepare_only') && packet.boundaries.accelerated_sam_media === 'lineage_only_excluded', `${lessonId} authority drift`);
  assert(packet.continuity.case === 'Harbor Learning Circle' && packet.continuity.owner === 'Morgan', `${lessonId} continuity drift`);
  const visualScene = packet.scenes.find((scene) => scene.id === poster.sceneId);
  assert(visualScene?.approved_visuals?.some((visual) => visual.path === poster.approvedVisualPath && visual.sha256 === poster.approvedVisualSha256), `${lessonId} plate is not approved in scene`);
  const windows = packet.scenes.filter((scene) => scene.avatar_window).map((scene) => {
    const reserve = scene.avatar_window;
    const global = storyboardWindows[scene.id];
    assert(global && JSON.stringify(global) === JSON.stringify(reserve) && reserve.state === 'reserved_unfilled', `${scene.id} immutable reservation drift`);
    const cues = scene.captions.filter((cue) => cue.start_seconds >= reserve.start_seconds && cue.end_seconds <= reserve.end_seconds);
    assert(cues.length && cues[0].start_seconds === reserve.start_seconds, `${scene.id} missing caption start`);
    for (let i = 1; i < cues.length; i++) assert(cues[i - 1].end_seconds === cues[i].start_seconds, `${scene.id} caption gap`);
    const passage = cues.map((cue) => cue.text).join('').trim();
    assert(/[.!?][”’"']?$/.test(passage) && scene.narration_exact.includes(passage), `${scene.id} incomplete or changed sentence`);
    const presenterEnd = cues.at(-1).end_seconds;
    return {
      scene_id: scene.id, reserved_start_seconds: reserve.start_seconds,
      reserved_end_seconds: reserve.end_seconds, presenter_start_seconds: reserve.start_seconds,
      presenter_end_seconds: presenterEnd, expected_scripted_duration_seconds: round(presenterEnd - reserve.start_seconds),
      provider_free_tail_seconds: round(reserve.end_seconds - presenterEnd),
      narration_exact: passage, narration_sha256: sha(passage), caption_cues: cues,
      audio_ownership: 'presenter audio only in this exact span if separately authorized; mute overlapping narrator audio',
    };
  });
  assert(windows.length === 2 && windows[0].scene_id === `${lessonId}-01` && windows[1].scene_id === `${lessonId}-08`, `${lessonId} presenter window count changed`);
  assert(windows[0].provider_free_tail_seconds === 0 && windows[1].provider_free_tail_seconds > 0, `${lessonId} closing-card boundary drift`);
  const last = windows[1];
  const closingCard = {
    scene_id: last.scene_id, start_seconds: last.presenter_end_seconds, end_seconds: last.reserved_end_seconds,
    duration_seconds: last.provider_free_tail_seconds,
    audience_copy_exact: packet.scenes.at(-1).audience_copy,
    treatment: 'provider-free hold of approved ending copy; no presenter footage, generated voice, or new claim',
  };
  assert(closingCard.end_seconds === packet.timing_seconds, `${lessonId} closing card does not end lesson`);
  const sources = [
    bound(packetPath, fileHash(packetPath), 'approved_production_packet'),
    bound(packet.script_path, packet.script_sha256, 'approved_exact_script'),
    bound(coverMapPath, fileHash(coverMapPath), 'static_cover_map'),
    bound(visualRegisterPath, packet.approved_visual_packet_sha256, 'approved_visual_register'),
    bound(sourceRegisterPath, packet.source_register_sha256, 'source_register'),
    bound(crosswalkPath, packet.crosswalk_sha256, 'curriculum_crosswalk'),
    bound(storyboardWindowsPath, fileHash(storyboardWindowsPath), 'immutable_storyboard_windows'),
    bound(packet.workbook_source.path, packet.workbook_source.sha256, 'Operating_File_workbook'),
    ...packet.chapter_sources.map((item) => bound(item.path, item.sha256, 'chapter_lineage')),
    bound(packet.package_cover.path, packet.package_cover.sha256, 'package_identity_only'),
    bound(poster.approvedVisualPath, poster.approvedVisualSha256, `approved_${poster.sceneId}_diagram_only`),
    bound(poster.output, poster.outputSha256, 'static_YouTube_style_lesson_cover_only'),
    bound(poster.identityReference, poster.identityReferenceSha256, 'local_static_cover_identity_reference_only'),
    bound(poster.avatarSource, poster.avatarSourceSha256, 'local_static_cover_cutout_only'),
    bound(poster.logo, poster.logoSha256, 'static_cover_logo_only'),
    bound(l01IdentityReceiptPath, fileHash(l01IdentityReceiptPath), 'L01_identity_precedent_not_L05-L08_authority'),
  ];
  assert(sources.length === 15 + packet.chapter_sources.length, `${lessonId} source inventory count drift`);
  assert(new Set(sources.map((item) => item.path)).size === sources.length, `${lessonId} duplicate source binding`);
  const expectedDuration = round(windows.reduce((sum, item) => sum + item.expected_scripted_duration_seconds, 0));
  assert(expectedDuration === frozenDurations[lessonId][0] && closingCard.duration_seconds === frozenDurations[lessonId][1], `${lessonId} timing drift`);
  const request = {
    schema_version: 1, status: 'provider_free_batch_request_candidate_locked', lesson_id: lessonId,
    source_base_commit: '5dccdea98336b495677b128daff0f0cf9f74b09c', provider_candidate: 'HeyGen Avatar IV',
    execution_allowed: false, provider_contact_allowed: false, upload_allowed: false,
    generation_allowed: false, spend_allowed: false, publication_allowed: false,
    requested_job_limit: 1, automatic_retries: 0, manual_retries: 0, current_spend_cap_usd: 0,
    conditional_one_job_cash_ceiling_usd: null,
    one_job_candidate_key: sha(`${packet.script_sha256}:${fileHash(packetPath)}:${poster.outputSha256}:${lessonId}:two-passages:closing-card`),
    lesson_duration_seconds: packet.timing_seconds,
    expected_scripted_provider_duration_seconds: expectedDuration,
    actual_provider_duration_seconds: null, actual_billable_duration_seconds: null,
    duration_note: 'Expected duration sums exact provisional caption spans only. Provider pacing, source duration, billable duration and final placement are unknown until a separately authorized job and native-source timing audit.',
    format_candidate: { orientation: 'landscape', resolution: '1080p', source_frame_rate: 'preserve_native', composite_frame_rate: 30 },
    presenter_windows: windows, presenter_duration_seconds: expectedDuration,
    provider_free_evidence_card: { scene_id: visualScene.id, audience_copy_exact: visualScene.audience_copy, approved_diagram_path: poster.approvedVisualPath, approved_diagram_sha256: poster.approvedVisualSha256, treatment: 'local approved diagram and source-aware audience copy; no provider footage or generated voice' },
    provider_free_closing_card: closingCard,
    one_job_payload_boundary: { passages: windows.map((item) => ({ scene_id: item.scene_id, narration_exact: item.narration_exact, narration_sha256: item.narration_sha256 })), treatment: 'Two exact passages in one continuous native source; split at audited sentence boundary and place locally. No third passage or automatic regeneration.' },
    identity_voice: { selected_look_name: null, selected_look_id: null, selected_avatar_group_id: null, selected_voice_id: null, source_precedent: l01IdentityReceiptPath, status: 'execution_identity_unselected; purpose_specific_L05-L08_approval_required', l01_approval_not_reusable: true, no_photo_or_cutout_upload_allowed: true },
    assets: { approved_diagram: { scene_id: poster.sceneId, path: poster.approvedVisualPath, sha256: poster.approvedVisualSha256, use: visualScene.approved_visuals.find((item) => item.path === poster.approvedVisualPath).use }, package_jpg: { path: packet.package_cover.path, sha256: packet.package_cover.sha256, use: 'package identity only' }, lesson_cover: { path: poster.output, sha256: poster.outputSha256, alt_text: poster.altText, media_status: poster.mediaStatus } },
    continuity: { case: packet.continuity.case, owner: packet.continuity.owner, operating_file: packet.operating_file, source_ids_scope: 'protected synthetic trace only; do not speak IDs or send to provider' },
    accessibility: { caption_source: packetPath, caption_status: 'exact text, provisional timing', caption_handoff_receipt: { source_packet_sha256: fileHash(packetPath), cue_counts: windows.map((item) => ({ scene_id: item.scene_id, count: item.caption_cues.length, text_sha256: item.narration_sha256 })), final_sync_status: 'pending_native_audio' }, transcript: 'reconstruct exact scene narration; final rendered transcript audit required', diagram_text_alternative: visualScene.accessibility.text_equivalent, diagram_alt_status: 'scene_specific_final_alt_required_before_learner_release', reading_order: 'title, teaching copy, visual, captions', contrast: 'review at delivery resolution', reduced_motion: 'instant cuts; no information depends on animation', caption_band: 'keep clear of presenter and diagram labels in landscape and portrait' },
    audio: { new_audio_path: null, new_audio_sha256: null, new_audio_status: 'none_generated', l01_native_source_precedent_sha256: l01Receipt.native_source.sha256, l01_native_composite_precedent_sha256: fileHash(l01CompositePath), ownership: 'one speaker at a time; native presenter audio replaces matching narrator span, never layers with it; preserve source frame count, rate, duration and lip sync in reproducible FFmpeg composite' },
    source_bindings: sources,
    boundaries: { privacy: packet.boundaries.privacy, authority: packet.boundaries.authority, customer_release: packet.boundaries.customer_release, rights: 'Static cover approval does not authorize talking-avatar or voice use for this lesson. Execution identity remains unselected.', lineage: packet.boundaries.accelerated_sam_media },
    no_retry_record: { jobs_submitted: 0, automatic_retries: 0, manual_retries: 0, allowed_if_later_authorized: 'one submission for this exact request; stop on uncertain outcome' },
    execution_gates: ['purpose-specific L05-L08 look and voice consent and selected execution identity', 'binding quote and enforceable one-job cap for each lesson and aggregate batch', 'current balance and credit check without purchase or auto-reload', 'final native source split/timing and caption audit', 'scene-specific diagram alt text, contrast and reduced-motion review', 'separate exact batch execution authorization'],
  };
  request.request_sha256 = sha(JSON.stringify(request));
  const receipt = {
    schema_version: 1, status: 'validated_provider_free_candidate', lesson_id: lessonId,
    request_sha256: request.request_sha256, script_sha256: packet.script_sha256,
    packet_sha256: sources[0].sha256, poster_sha256: poster.outputSha256,
    diagram_sha256: poster.approvedVisualSha256, package_jpg_sha256: packet.package_cover.sha256,
    new_audio_sha256: null, source_binding_count: sources.length,
    expected_scripted_provider_duration_seconds: expectedDuration,
    provider_free_closing_card_seconds: closingCard.duration_seconds,
    spend_usd: 0, provider_calls: 0, media_generated: 0,
    unresolved: ['L05-L08 purpose-specific identity and voice rights', 'current provider quote, credits and cap control', 'recorded pacing and caption sync', 'final scene-specific diagram alt and native-composite review'],
  };
  lessons.push({ lesson_id: lessonId, title: packet.title, request_sha256: request.request_sha256, script_sha256: packet.script_sha256, packet_sha256: sources[0].sha256, poster_sha256: poster.outputSha256, diagram_sha256: poster.approvedVisualSha256, new_audio_sha256: null, source_binding_count: sources.length, expected_scripted_provider_duration_seconds: expectedDuration, closing_card_seconds: closingCard.duration_seconds, lesson_duration_seconds: packet.timing_seconds });
  output.push([`${lessonId.toLowerCase()}-request-candidate.json`, request], [`${lessonId.toLowerCase()}-validation-receipt.json`, receipt]);
}
for (const lesson of lessons) {
  const request = output.find(([name]) => name === `${lesson.lesson_id.toLowerCase()}-request-candidate.json`)?.[1];
  const receipt = output.find(([name]) => name === `${lesson.lesson_id.toLowerCase()}-validation-receipt.json`)?.[1];
  assert(request && receipt && lesson.source_binding_count === request.source_bindings.length && receipt.source_binding_count === request.source_bindings.length, `${lesson.lesson_id} receipt/source inventory count mismatch`);
}
const batch = {
  schema_version: 1, status: 'provider_free_batch_preflight_validated', source_base_commit: '5dccdea98336b495677b128daff0f0cf9f74b09c',
  lessons, aggregate_expected_scripted_provider_duration_seconds: round(lessons.reduce((sum, item) => sum + item.expected_scripted_provider_duration_seconds, 0)),
  aggregate_provider_free_closing_card_seconds: round(lessons.reduce((sum, item) => sum + item.closing_card_seconds, 0)), maximum_jobs_if_later_authorized: 4, jobs_submitted_now: 0,
  cost_cap_evidence: {
    project_authorization_path: budgetPath, project_authorization_sha256: fileHash(budgetPath), authorized_aggregate_cash_cap_usd: 100,
    l01_historical_receipt_path: l01ProviderReceiptPath, l01_historical_receipt_sha256: fileHash(l01ProviderReceiptPath),
    l01_historical_billable_seconds: 19, l01_historical_credits: 15, l01_historical_wallet_debit_usd: 0,
    current_credits: null, current_wallet_balance_usd: null, project_cash_spent_to_date_usd: null, provider_quote_per_lesson_usd: null,
    proposed_later_cash_ceiling_per_lesson_usd: null, proposed_later_batch_cash_ceiling_usd: null,
    current_execution_cash_cap_usd: 0, cap_enforcement_verified: false,
    note: 'Historical L01 usage is not a quote for L05-L08 or a complete project ledger. No current provider read occurred. Execution requires fresh binding quotes, current balances and cumulative spend, plus an enforceable per-job and aggregate limit; no credit purchase or auto-reload.',
    cap_options: [
      'Provider-enforced per-job and batch maximum, with one submission per lesson and no retries.',
      'Prepaid or wallet allocation technically capped to the same amounts, with auto-reload and overage disabled.',
      'If neither mechanism can be verified before submission, stop without executing.',
    ],
  },
  composite_input: { base_animatic: 'agentified/workshop/scene-production/review.html', native_source_paths: [null, null, null, null], source_audio_hashes: [null, null, null, null], one_speaker_at_a_time: true, preserve_native_source: true, final_caption_sync_pending: true, provider_free_closing_cards: true },
  rights_status: 'blocked_pending_purpose_specific_L05-L08_identity_and_voice_approval',
  source_audit: `${lessons.map((item) => `${item.lesson_id} ${item.source_binding_count}`).join(', ')} exact source bindings; sentence-complete passages, storyboard windows, poster and plate rights, Harbor continuity, Operating File revisions 5-8, privacy and execution boundaries checked`,
};
batch.batch_sha256 = sha(JSON.stringify(batch));
if (process.argv.includes('--check')) {
  const readme = readFileSync(path.join(here, 'README.md'), 'utf8');
  assert(readme.includes(`batch SHA-256 \`${batch.batch_sha256}\``), 'Authorization batch hash drift');
  assert(readme.includes(`source commit \`${batch.source_base_commit}\``), 'Authorization source commit drift');
  for (const lesson of lessons) {
    for (const key of ['script_sha256', 'packet_sha256', 'request_sha256']) {
      assert(readme.includes(`\`${lesson[key]}\``), `${lesson.lesson_id} authorization ${key} drift`);
    }
    assert(readme.includes(`[${lesson.lesson_id}_MAX_USD]`), `${lesson.lesson_id} cap placeholder missing`);
  }
  for (const field of ['[HEYGEN_ACCOUNT_ID]', '[LOOK_NAME_AND_ID]', '[AVATAR_GROUP_ID]', '[VOICE_ID]', '[RIGHTS_RECEIPT_ID]', '[BATCH_MAX_USD]']) {
    assert(readme.includes(field), `Authorization placeholder ${field} missing`);
  }
}
output.push(['batch-validation-receipt.json', batch]);
for (const [name, data] of output) {
  const body = `${JSON.stringify(data, null, 2)}\n`;
  const destination = path.join(here, name);
  if (process.argv.includes('--check')) assert(readFileSync(destination, 'utf8') === body, `${name} is stale`);
  else writeFileSync(destination, body);
}
console.log(`L05-L08 batch ${batch.batch_sha256}; ${lessons.length} lessons; ${batch.aggregate_expected_scripted_provider_duration_seconds}s expected scripted source; ${batch.aggregate_provider_free_closing_card_seconds}s provider-free closing cards; no provider calls`);
