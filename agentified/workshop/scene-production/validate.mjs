import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPacket, here, repo, sha } from './build.mjs'
import { validate as validateVisuals } from '../visual-review/validate.mjs'

const required = (value) => typeof value === 'string' && value.length > 0

export function validatePacket(packet, expected = buildPacket(Number(packet?.id?.slice(1)))) {
  const errors = []
  if (JSON.stringify(packet) !== JSON.stringify(expected)) errors.push(`${packet?.id}: packet differs from approved script and schema`)
  if (packet?.scenes?.length !== 8) errors.push(`${packet?.id}: eight scenes required`)
  if (packet?.batch !== Math.floor((Number(packet?.id?.slice(1)) - 1) / 4) + 1) errors.push(`${packet?.id}: review batch mismatch`)
  const cover = JSON.parse(readFileSync(path.join(repo, 'agentified/workshop/visual-review/packets.json'))).cover_hold
  if (packet?.package_cover?.path !== cover.jpg.path || packet?.package_cover?.sha256 !== cover.jpg.sha256 || packet?.package_cover?.approval_record !== cover.approval.record || packet?.package_cover?.use !== 'package_identity_only' || sha(readFileSync(path.join(repo, cover.jpg.path))) !== cover.jpg.sha256 || /\.svg$/i.test(packet?.package_cover?.path ?? '')) errors.push(`${packet?.id}: canonical cover binding changed`)
  let cursor = 0
  for (const [index, scene] of (packet?.scenes ?? []).entries()) {
    if (scene.start_seconds !== cursor || scene.end_seconds <= cursor) errors.push(`${packet.id}: timing gap or overlap at scene ${index + 1}`)
    cursor = scene.end_seconds
    if (!required(scene.narration_exact) || !required(scene.on_screen_copy_exact) || !required(scene.composition) || !required(scene.motion) || !required(scene.audio_ownership) || !required(scene.transition) || !required(scene.accessibility?.text_equivalent)) errors.push(`${packet.id}: incomplete scene ${index + 1}`)
    if (scene.status !== 'provider_free_review_only') errors.push(`${packet.id}: execution state changed`)
    const cues = scene.captions ?? []
    if (!cues.length || cues[0].start_seconds !== scene.start_seconds || cues.at(-1).end_seconds > scene.end_seconds || cues.some((cue, i) => cue.end_seconds <= cue.start_seconds || (i && cue.start_seconds < cues[i - 1].end_seconds))) errors.push(`${packet.id}: caption timing invalid at scene ${index + 1}`)
    const normalized = (value) => value.replace(/\s+/g, ' ').trim()
    if (normalized(cues.map((cue) => cue.text).join('')) !== normalized(scene.narration_exact.replace(/^“|”$/g, ''))) errors.push(`${packet.id}: caption text mismatch at scene ${index + 1}`)
    if (scene.avatar_window) {
      const { start_seconds: from, end_seconds: to, state } = scene.avatar_window
      const boundaries = [scene.start_seconds, ...cues.flatMap((cue) => [cue.start_seconds, cue.end_seconds]), scene.end_seconds]
      if (state !== 'reserved_unfilled' || from < scene.start_seconds || to > scene.end_seconds || from >= to || !boundaries.includes(from) || !boundaries.includes(to)) errors.push(`${packet.id}: presenter handoff cuts a sentence at scene ${index + 1}`)
    }
    if (!Array.isArray(scene.audience_copy) || scene.audience_copy.some((line) => /\b(?:fixture|placeholder|QA note|production note|source hash|api key|password|token)\b|\/Users\/|https?:\/\//i.test(line))) errors.push(`${packet.id}: audience copy leakage at scene ${index + 1}`)
    for (const visual of scene.approved_visuals ?? []) {
      const approval = JSON.parse(readFileSync(path.join(repo, 'agentified/workshop/visual-review/packets.json'))).lessons.find((x) => x.id === packet.id)?.visuals.find((x) => x.source_path === visual.path)
      if (!approval || approval.approval.record !== visual.approval_record || approval.register_sha256 !== visual.sha256 || sha(readFileSync(path.join(repo, visual.path))) !== visual.sha256) errors.push(`${packet.id}: visual source or approval mismatch`)
      const png = readFileSync(path.join(repo, visual.path))
      if (png.toString('ascii', 1, 4) !== 'PNG' || png.readUInt32BE(16) < 1200 || png.readUInt32BE(20) < 1200) errors.push(`${packet.id}: visual dimensions invalid`)
    }
  }
  if (cursor !== packet?.timing_seconds) errors.push(`${packet?.id}: total timing mismatch`)
  if (packet?.boundaries?.provider_execution !== 'disabled' || packet?.boundaries?.customer_release !== 'held_pending_editorial_and_final_audio_review' || packet?.boundaries?.accelerated_sam_media !== 'lineage_only_excluded') errors.push(`${packet?.id}: provider, customer release, or SAM boundary changed`)
  if (packet?.continuity?.case !== 'Harbor Learning Circle' || packet?.continuity?.owner !== 'Morgan') errors.push(`${packet?.id}: Harbor continuity changed`)
  return errors
}

export function validateAll(count = 16) {
  const visualErrors = validateVisuals(JSON.parse(readFileSync(path.join(repo, 'agentified/workshop/visual-review/packets.json'))))
  const errors = [...visualErrors]
  for (let i = 1; i <= count; i++) {
    const id = `L${String(i).padStart(2, '0')}`
    let packet
    try { packet = JSON.parse(readFileSync(path.join(here, 'packets', `${id}.json`))) }
    catch { errors.push(`${id}: packet missing`); continue }
    errors.push(...validatePacket(packet))
  }
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = process.argv[2] === 'L01-L04' ? 4 : 16
  const errors = validateAll(count)
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log(`L01–L${String(count).padStart(2, '0')}: approved source bindings, exact scripts, captions, scene timing, dimensions, privacy, and authority pass.`)
}
