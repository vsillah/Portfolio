#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEvidenceTable } from './check-evidence-table.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const sourceCommit = 'cb44c2389b4281aac7dae33d835363ae35c42ea2';
const ids = ['L09', 'L10', 'L11', 'L12'];
const frozenPackets = {
  L09: '5bbe9c3259a039e1b008fe10d59c2c067aca21f8858f750d6fb1231dcf800f80',
  L10: '265b07c07604510aee75e39fd0ef658e05cba86f8db01e1b2fd3c41d85f38459',
  L11: '1302b2a29c6b0bcec3d1d049bc7b53de25ab9a8d72c3dfa65dc7af368297fde1',
  L12: '8ec927a1785e5cc9aa1f910d2c998d704334ba0587d0d803d0cff60d1d9bf84b',
};
const sha = (value) => createHash('sha256').update(value).digest('hex');
const read = (relative) => readFileSync(path.join(root, relative));
const load = (relative) => JSON.parse(read(relative));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const hash = (relative) => sha(read(relative));
const round = (value) => Number(value.toFixed(3));
const normalize = (value) => value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const unquote = (value) => value.trim().replace(/^[“"]/, '').replace(/[”"]$/, '').trim();
const coverMapPath = 'docs/qa/agentified-lesson-covers/source-map.json';
const visualRegisterPath = 'agentified/workshop/visual-review/packets.json';
const sourceRegisterPath = 'agentified/workshop/source-register.json';
const crosswalkPath = 'agentified/workshop/curriculum-crosswalk.json';
const windowsPath = 'agentified/workshop/scene-production/presenter-windows.json';
const budgetPath = 'agentified/workshop/provider-budget-authorization.json';
const covers = load(coverMapPath).posters;
const reservations = load(windowsPath).windows;
const budget = load(budgetPath);
assert(budget.aggregate_cash_cap === 100 && budget.controls.separate_exact_job_or_batch_binding_required, 'Project budget control drift');

const files = [];
const summary = [];
for (const id of ids) {
  const packetPath = `agentified/workshop/scene-production/packets/${id}.json`;
  assert(hash(packetPath) === frozenPackets[id], `${id} frozen packet drift`);
  const packet = load(packetPath);
  const cover = covers.find((item) => item.lesson === id);
  assert(cover && packet.id === id && packet.scenes.length === 8, `${id} packet/cover missing`);
  assert(packet.script_sha256 === hash(packet.script_path) && packet.script_sha256 === cover.scriptSha256, `${id} script drift`);
  assert(packet.approved_visual_packet_sha256 === hash(visualRegisterPath), `${id} visual register drift`);
  assert(packet.source_register_sha256 === hash(sourceRegisterPath) && packet.crosswalk_sha256 === hash(crosswalkPath), `${id} source lineage drift`);
  assert(packet.package_cover.sha256 === hash(packet.package_cover.path) && cover.canonicalCoverSha256 === packet.package_cover.sha256, `${id} package cover drift`);
  assert(cover.outputSha256 === hash(cover.output) && cover.mediaStatus === 'static-cover; video locked' && cover.rightsStatus === 'approved_for_bound_agentified_lesson_uses', `${id} poster status drift`);
  assert(packet.boundaries.provider_execution === 'disabled' && packet.boundaries.accelerated_sam_media === 'lineage_only_excluded', `${id} provider/lineage boundary drift`);
  assert(packet.continuity.case === 'Harbor Learning Circle' && packet.continuity.owner === 'Morgan' && packet.operating_file.revision === Number(id.slice(1)), `${id} case/workbook continuity drift`);

  const presenter = packet.scenes.filter((scene) => scene.avatar_window).map((scene) => {
    const reserve = scene.avatar_window;
    assert(JSON.stringify(reservations[scene.id]) === JSON.stringify(reserve) && reserve.state === 'reserved_unfilled', `${scene.id} presenter reservation drift`);
    const cues = scene.captions.filter((cue) => cue.start_seconds >= reserve.start_seconds && cue.end_seconds <= reserve.end_seconds);
    assert(cues.length && cues[0].start_seconds === reserve.start_seconds, `${scene.id} presenter cue start drift`);
    const text = cues.map((cue) => cue.text).join('').trim();
    assert(/[.!?][”’"']?$/.test(text) && normalize(unquote(scene.narration_exact)).includes(normalize(text)), `${scene.id} incomplete presenter sentence`);
    return { scene_id: scene.id, storyboard_reservation: reserve, passage_exact: text, passage_sha256: sha(text), provisional_speech_seconds: round(cues.at(-1).end_seconds - cues[0].start_seconds), caption_count: cues.length, native_media_path: null, native_media_sha256: null };
  });
  assert(presenter.length === 2 && presenter[0].scene_id === `${id}-01` && presenter[1].scene_id === `${id}-08`, `${id} presenter windows changed`);
  assert(presenter[0].provisional_speech_seconds === presenter[0].storyboard_reservation.end_seconds, `${id} intro window mismatch`);

  const opening = normalize(presenter[0].passage_exact);
  const closing = normalize(presenter[1].passage_exact);
  const narrationSegments = packet.scenes.map((scene, index) => {
    let value = normalize(unquote(scene.narration_exact));
    if (index === 0) { assert(value.startsWith(opening), `${id} opening prefix drift`); value = value.slice(opening.length).trim(); }
    if (index === 7) { assert(value.endsWith(closing), `${id} closing suffix drift`); value = value.slice(0, -closing.length).trim(); }
    return { scene_id: scene.id, text: value, sha256: sha(value) };
  });
  assert(narrationSegments.every((segment) => segment.text && /[.!?][”’"']?$/.test(segment.text)), `${id} narration handoff incomplete`);
  const speechText = narrationSegments.map((segment) => segment.text).join('\n\n');

  const cues = [];
  let cursor = 0;
  for (const [index, scene] of packet.scenes.entries()) {
    assert(scene.captions.length > 0 && scene.captions[0].start_seconds >= scene.start_seconds, `${scene.id} caption bounds`);
    const sourceText = normalize(unquote(scene.narration_exact));
    const captionText = normalize(scene.captions.map((cue) => cue.text).join(''));
    assert(sourceText === captionText, `${scene.id} narration/caption text drift`);
    for (let i = 0; i < scene.captions.length; i++) {
      const cue = scene.captions[i];
      if (i) assert(scene.captions[i - 1].end_seconds === cue.start_seconds, `${scene.id} internal caption gap`);
      const duration = round(cue.end_seconds - cue.start_seconds);
      assert(duration > 0, `${scene.id} invalid cue`);
      const speaker = index === 0 && cue.end_seconds <= presenter[0].storyboard_reservation.end_seconds ? 'presenter' : index === 7 && cue.start_seconds >= presenter[1].storyboard_reservation.start_seconds ? 'presenter' : 'offscreen_narrator';
      cues.push({ scene_id: scene.id, speaker, start_seconds: round(cursor), end_seconds: round(cursor + duration), text: cue.text.trim(), source_start_seconds: cue.start_seconds, source_end_seconds: cue.end_seconds });
      cursor = round(cursor + duration);
    }
    if (index === 6) {
      cues.push({ scene_id: scene.id, speaker: 'guided_work_pause', start_seconds: round(cursor), end_seconds: round(cursor + 45), text: scene.exercise_prompt_exact, visual: 'visible synchronized countdown from 45 to 0; no music' });
      cursor = round(cursor + 45);
    }
  }
  const cardSeconds = round(presenter[1].storyboard_reservation.end_seconds - packet.scenes[7].captions.at(-1).end_seconds);
  assert(cardSeconds > 0 && cardSeconds <= 10, `${id} closing card duration drift`);
  const closingCard = { scene_id: `${id}-08`, start_seconds: round(cursor), end_seconds: round(cursor + cardSeconds), duration_seconds: cardSeconds, audience_copy_exact: packet.scenes[7].audience_copy, treatment: 'approved provider-free ending copy' };
  cursor = closingCard.end_seconds;
  assert(cues[0].start_seconds === 0 && cues.every((cue, i) => !i || cues[i - 1].end_seconds === cue.start_seconds), `${id} provisional timeline gap`);
  const spoken = cues.filter((cue) => cue.speaker !== 'guided_work_pause');
  assert(normalize(spoken.map((cue) => cue.text).join(' ')) === normalize(packet.scenes.map((scene) => unquote(scene.narration_exact)).join(' ')), `${id} omitted/duplicated transcript`);
  const offscreen = spoken.filter((cue) => cue.speaker === 'offscreen_narrator');
  assert(normalize(offscreen.map((cue) => cue.text).join(' ')) === normalize(speechText), `${id} offscreen request mismatch`);
  const visuals = packet.scenes.flatMap((scene) => scene.approved_visuals.map((visual) => {
    assert(hash(visual.path) === visual.sha256, `${scene.id} visual drift`);
    return { scene_id: scene.id, path: visual.path, sha256: visual.sha256, use: visual.use, text_equivalent: scene.accessibility.text_equivalent };
  }));
  assert(visuals.some((visual) => visual.scene_id === cover.sceneId && visual.path === cover.approvedVisualPath && visual.sha256 === cover.approvedVisualSha256), `${id} poster plate mismatch`);
  const sources = [packetPath, packet.script_path, packet.package_cover.path, coverMapPath, cover.output, visualRegisterPath, sourceRegisterPath, crosswalkPath, windowsPath, packet.workbook_source.path, ...packet.chapter_sources.map((item) => item.path), ...visuals.map((item) => item.path)];
  const sourceBindings = [...new Set(sources)].map((source) => ({ path: source, sha256: hash(source) }));
  assert(packet.workbook_source.sha256 === hash(packet.workbook_source.path) && packet.chapter_sources.every((item) => item.sha256 === hash(item.path)), `${id} workbook/chapter drift`);
  const candidate = {
    schema_version: 1, status: 'provider_free_review_candidate', lesson_id: id, source_commit: sourceCommit,
    packet_path: packetPath, packet_sha256: hash(packetPath), script_sha256: packet.script_sha256,
    execution_allowed: false, provider_contact_allowed: false, spend_allowed: false, publication_allowed: false,
    provider_jobs_submitted: 0, automatic_retries: 0, manual_retries: 0, current_execution_cap_usd: 0,
    proposed_identity: { look_name: 'Gray Sweater', look_id: '7275ba9035f94b31ad589dda6532d002', avatar_group_id: '5796a337512c43bbbdaa77c1cefc295f', offscreen_voice_id: '4f53988b1c314610b514db98432fd0ef', status: 'historical precedent only; L09-L12 purpose-specific rights pending' },
    presenter_passages: presenter, offscreen_narration: { text: speechText, text_sha256: sha(speechText), word_count: speechText.split(/\s+/).length, segments: narrationSegments, new_audio_path: null, new_audio_sha256: null },
    timing: { status: 'provisional_cue_derived; native_audio_required', original_storyboard_seconds: packet.timing_seconds, proposed_continuous_seconds: cursor, spoken_seconds: round(cursor - 45 - cardSeconds), ordinary_gap_limit_seconds: 2.5, actual_native_timing_seconds: null, no_fixed_ten_minute_padding: true, cues, guided_work_pause_seconds: 45, closing_card: closingCard, rule: 'Retain exact speech in order; change picture only at a sentence-complete spoken handoff; one speaker at a time; preserve native presenter source frame rate and audio; re-time captions after native recordings.' },
    visuals, cover: { path: cover.output, sha256: cover.outputSha256, use: 'static poster and internal animatic only; video locked' },
    continuity: { case: packet.continuity.case, owner: packet.continuity.owner, operating_file: packet.operating_file, chapter_sources: packet.chapter_sources, source_ids_policy: 'protected synthetic trace only; no source IDs in provider request' },
    source_bindings: sourceBindings,
    gates: ['purpose-specific L09-L12 look and voice approval', 'fresh provider quote, balance and enforceable one-job and batch caps', 'separate exact execution authorization', 'native audio timing and sentence-level edit audit', 'caption, diagram alt, mobile/desktop and final MP4 review'],
    stop_conditions: ['source, rights, identity, voice or packet drift', 'uncertain job outcome or provider error; no retry', 'cost cap uncertainty or unexpected debit', 'narration omission, repetition or altered meaning', 'ordinary gap over 2.5 seconds', 'topic cut before sentence-complete handoff', 'visual clipping, label collision or unreadable captions'],
  };
  candidate.candidate_sha256 = sha(JSON.stringify(candidate));
  const receipt = { lesson_id: id, candidate_sha256: candidate.candidate_sha256, packet_sha256: candidate.packet_sha256, script_sha256: candidate.script_sha256, speech_text_sha256: candidate.offscreen_narration.text_sha256, source_binding_count: sourceBindings.length, approved_visual_count: visuals.length, provisional_continuous_seconds: cursor, guided_pause_seconds: 45, provider_calls: 0, audio_generated: 0, spend_usd: 0, status: 'validated_provider_free; execution_blocked' };
  files.push([`${id.toLowerCase()}-request-candidate.json`, candidate], [`${id.toLowerCase()}-validation-receipt.json`, receipt]);
  summary.push(receipt);
}
const batch = { schema_version: 1, source_commit: sourceCommit, status: 'provider_free_L09-L12_preflight_validated; execution_blocked', lessons: summary, provider_calls: 0, audio_generated: 0, spend_usd: 0, current_execution_cap_usd: 0, project_budget_path: budgetPath, project_budget_sha256: hash(budgetPath), project_aggregate_cash_ceiling_usd: budget.aggregate_cash_cap, current_balance: null, binding_quotes: null, enforceable_job_caps: null, aggregate_cumulative_spend: null, maximum_later_jobs: 4, retries: 0, rights_status: 'L09-L12 purpose-specific look and voice approval pending', production_binding_allowed: false, customer_release_allowed: false };
batch.batch_sha256 = sha(JSON.stringify(batch));
files.push(['batch-manifest.json', batch]);
if (process.argv.includes('--check')) checkEvidenceTable(readFileSync(path.join(here, 'README.md'), 'utf8'), batch);
for (const [name, value] of files) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const output = path.join(here, name);
  if (process.argv.includes('--check')) assert(readFileSync(output, 'utf8') === body, `${name} stale`);
  else writeFileSync(output, body);
}
console.log(`L09-L12 batch ${batch.batch_sha256}; ${summary.length} lessons; provisional cue timing; no provider calls`);
