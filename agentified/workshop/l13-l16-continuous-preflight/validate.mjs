#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEvidenceTable } from './check-evidence-table.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
export const sha = (value) => createHash('sha256').update(value).digest('hex');
export const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fileHash = (relative) => sha(readFileSync(path.join(root, relative)));
const load = (file) => JSON.parse(readFileSync(path.join(here, file), 'utf8'));
const normalize = (value) => value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const unquote = (value) => value.trim().replace(/^[“"]/, '').replace(/[”"]$/, '').trim();
const checkSelfHash = (object, field, label) => { const { [field]: expected, ...payload } = object; assert(sha(JSON.stringify(payload)) === expected, `${label} identity drift`); };

export function validateCandidate(candidate, receipt, packet, registry, presenterRecord, hash = fileHash) {
  const id = candidate.lesson_id;
  checkSelfHash(candidate, 'candidate_sha256', `${id} candidate`);
  assert(candidate.packet_sha256 === hash(candidate.packet_path), `${id} source packet drift`);
  assert(candidate.script_sha256 === hash(packet.script_path) && candidate.script_sha256 === packet.script_sha256, `${id} source script drift`);
  assert(candidate.provider_jobs_submitted === 0 && candidate.current_execution_cap_usd === 0 && !candidate.execution_allowed && !candidate.provider_contact_allowed && !candidate.spend_allowed && !candidate.publication_allowed, `${id} provider boundary drift`);
  assert(candidate.cover.use.includes('video locked') && receipt.learner_playback_locked, `${id} learner playback drift`);
  assert(candidate.source_bindings.every((source) => hash(source.path) === source.sha256), `${id} bound source drift`);
  assert(candidate.presenter_passages.length === 2 && presenterRecord.windows.length === 2, `${id} presenter count drift`);
  for (let i = 0; i < 2; i++) {
    const window = candidate.presenter_passages[i], source = presenterRecord.windows[i];
    assert(JSON.stringify(window) === JSON.stringify(source), `${id} presenter manifest drift`);
    assert(window.scene_id === `${id}-${i ? '08' : '01'}` && window.passage_sha256 === sha(window.passage_exact) && /[.!?][”’"']?$/.test(window.passage_exact.trim()), `${id} presenter passage drift`);
    assert(window.storyboard_reservation.state === 'reserved_unfilled' && window.native_media_path === null && window.native_media_sha256 === null, `${id} presenter media/rights drift`);
  }
  assert(candidate.offscreen_narration.text_sha256 === sha(candidate.offscreen_narration.text) && candidate.offscreen_narration.new_audio_path === null && candidate.offscreen_narration.new_audio_sha256 === null, `${id} narration request drift`);
  assert(candidate.offscreen_narration.segments.map((segment) => segment.text).join('\n\n') === candidate.offscreen_narration.text && candidate.offscreen_narration.segments.every((segment) => sha(segment.text) === segment.sha256), `${id} narration segment drift`);
  const cues = candidate.timing.cues;
  assert(cues[0].start_seconds === 0 && cues.every((cue, i) => !i || cues[i - 1].end_seconds === cue.start_seconds), `${id} caption gap or overlap`);
  const pauses = cues.filter((cue) => cue.speaker === 'guided_work_pause');
  assert(pauses.length === 1 && pauses[0].scene_id === `${id}-07` && pauses[0].end_seconds - pauses[0].start_seconds === 45, `${id} guided-work timing drift`);
  assert(candidate.timing.ordinary_gap_limit_seconds === 2.5 && candidate.timing.guided_work_pause_seconds === 45 && candidate.timing.no_fixed_ten_minute_padding, `${id} timing policy drift`);
  assert(candidate.timing.proposed_continuous_seconds === Math.max(cues.at(-1).end_seconds, candidate.timing.closing_card.end_seconds), `${id} final clock drift`);
  const spoken = cues.filter((cue) => cue.speaker !== 'guided_work_pause');
  for (const scene of packet.scenes) {
    const actual = spoken.filter((cue) => cue.scene_id === scene.id).map((cue) => cue.text).join('');
    assert(normalize(actual) === normalize(unquote(scene.narration_exact)), `${scene.id} caption/script drift`);
    assert(JSON.stringify(candidate.scenes.find((item) => item.scene_id === scene.id)?.audience_copy_exact) === JSON.stringify(scene.audience_copy), `${scene.id} audience copy drift`);
  }
  assert(normalize(packet.scenes.map((scene) => spoken.filter((cue) => cue.scene_id === scene.id && cue.speaker === 'offscreen_narrator').map((cue) => cue.text).join('')).join(' ')) === normalize(candidate.offscreen_narration.text), `${id} narrator text drift`);
  assert(candidate.visuals.length === registry.visuals.length, `${id} visual count drift`);
  for (const visual of candidate.visuals) {
    const approved = registry.visuals.find((item) => item.source_path === visual.path);
    assert(approved && approved.register_sha256 === visual.sha256 && hash(visual.path) === visual.sha256, `${id} approved visual asset drift`);
    assert(approved.rights.status === 'approved' && approved.rights.workshop_redistribution === 'approved_for_bound_agentified_lesson_uses' && approved.approval.status === 'approved' && approved.approval.record === visual.approval_record, `${id} visual rights drift`);
    assert(visual.text_equivalent.length >= 70 && !/needs final|pending|placeholder/i.test(visual.text_equivalent) && visual.treatment.includes('contain region'), `${id} visual accessibility drift`);
  }
  assert(receipt.candidate_sha256 === candidate.candidate_sha256 && receipt.packet_sha256 === candidate.packet_sha256 && receipt.script_sha256 === candidate.script_sha256 && receipt.speech_text_sha256 === candidate.offscreen_narration.text_sha256, `${id} validation receipt drift`);
  assert(receipt.provider_calls === 0 && receipt.audio_generated === 0 && receipt.spend_usd === 0 && receipt.presenter_and_voice_rights === 'purpose_specific_approval_pending', `${id} rights/spend receipt drift`);
  return true;
}

export function validatePackage() {
  const batch = load('batch-manifest.json');
  checkSelfHash(batch, 'batch_sha256', 'Batch');
  const manifest = load('presenter-window-manifest.json');
  checkSelfHash(manifest, 'manifest_sha256', 'Presenter manifest');
  assert(batch.source_commit === '5d61cadff39b46d5d17add8e06370cc25a18de41' && manifest.source_commit === batch.source_commit && batch.presenter_window_manifest_sha256 === manifest.manifest_sha256, 'Base or presenter binding drift');
  assert(batch.lessons.length === 4 && batch.lessons.map((item) => item.lesson_id).join(',') === 'L13,L14,L15,L16', 'Batch lesson set drift');
  assert(batch.provider_calls === 0 && batch.audio_generated === 0 && batch.spend_usd === 0 && batch.current_execution_cap_usd === 0 && batch.learner_playback_locked && !batch.production_binding_allowed && !batch.customer_release_allowed, 'Batch execution/learner lock drift');
  const registry = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/visual-review/packets.json'), 'utf8')).lessons;
  for (const lesson of batch.lessons) {
    const id = lesson.lesson_id;
    const candidate = load(`${id.toLowerCase()}-request-candidate.json`);
    const receipt = load(`${id.toLowerCase()}-validation-receipt.json`);
    const packet = JSON.parse(readFileSync(path.join(root, candidate.packet_path), 'utf8'));
    const source = registry.find((item) => item.id === id);
    const presenter = manifest.lessons.find((item) => item.lesson_id === id);
    assert(source && presenter, `${id} source or presenter manifest missing`);
    validateCandidate(candidate, receipt, packet, source, presenter);
    assert(lesson.candidate_sha256 === candidate.candidate_sha256 && lesson.packet_sha256 === candidate.packet_sha256 && lesson.script_sha256 === candidate.script_sha256, `${id} batch summary drift`);
  }
  checkEvidenceTable(readFileSync(path.join(here, 'README.md'), 'utf8'), batch);
  const capture = load('review-capture-receipt.json');
  assert(capture.batch_sha256 === batch.batch_sha256 && capture.review_html_sha256 === sha(readFileSync(path.join(here, 'review.html'))), 'Review capture source drift');
  assert(capture.walkthroughs.length === 2 && capture.walkthroughs.every((item) => sha(readFileSync(path.join(here, item.path))) === item.sha256 && item.states_checked === 18 && item.countdowns_verified === 4 && item.customer_copy_audited), 'Review MP4 identity or coverage drift');
  assert(capture.interaction_results.length === 3 && capture.interaction_results.map((item) => item.width).join(',') === '320,768,1280' && capture.interaction_results.every((item) => item.actions_checked === 18 && item.disabled_reasons_checked === 2 && !item.overflow), 'Responsive interaction coverage drift');
  return batch.batch_sha256;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`L13–L16 provider-free package validated: ${validatePackage()}`);
