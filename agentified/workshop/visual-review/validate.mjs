import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const read = (p) => readFileSync(path.join(repo, p))
const expectedCrosswalk = 'b098490598a40d870c9cd80c214780b83ffc95ae4b0ed6d78de1c1d1f1abea6e'
const expectedSourceMap = '825e5ca6426854867cb72271cbd77db358c79c3d8adf04e282865894b44aaae5'
const expectedApprovalRecord = 'msg_03aad1e9d96279fd016aef0d09fd8c87d29a24d2af1b4ccdb8'

export function validate(packet, { readSource = read, today = '2026-11-07' } = {}) {
  const errors = []
  const crosswalk = JSON.parse(readSource('agentified/workshop/curriculum-crosswalk.json'))
  const register = JSON.parse(readSource('agentified/workshop/source-register.json'))
  const sources = new Map(register.sources.map((source) => [source.path, source]))
  if (packet.base_commit !== 'de1e01f04393963db6fe93962af47c0bd77439d5') errors.push('base commit mismatch')
  if (packet.crosswalk_sha256 !== expectedCrosswalk || sha(readSource('agentified/workshop/curriculum-crosswalk.json')) !== expectedCrosswalk) errors.push('crosswalk drift')
  if (packet.source_map_sha256 !== expectedSourceMap || sha(readSource('agentified/manuscript/visuals/source-map.md')) !== expectedSourceMap) errors.push('source map drift')
  if (packet.lessons?.length !== 16) errors.push('missing lesson packet')
  const sourceMap = readSource('agentified/manuscript/visuals/source-map.md').toString()
  for (const lesson of crosswalk.lessons) {
    const id = `L${String(lesson.lesson).padStart(2, '0')}`
    const item = packet.lessons?.find((entry) => entry.id === id)
    if (!item || packet.lessons.filter((entry) => entry.id === id).length !== 1) { errors.push(`${id}: missing or duplicate identity`); continue }
    if (item.title !== lesson.title || item.operating_file_artifact !== lesson.operating_file_artifact || JSON.stringify(item.workbook_outputs) !== JSON.stringify(lesson.workbook_outputs)) errors.push(`${id}: curriculum identity mismatch`)
    if (!item.script_path?.startsWith(`agentified/workshop/scripts/${id}-`)) { errors.push(`${id}: script identity missing`); continue }
    let script
    try { script = readSource(item.script_path).toString() } catch { errors.push(`${id}: missing script`); continue }
    if (sha(script) !== item.script_sha256) errors.push(`${id}: script hash drift`)
    if (item.visuals?.length !== lesson.visual_candidates.length) errors.push(`${id}: visual count mismatch`)
    for (const visualPath of lesson.visual_candidates) {
      const visual = item.visuals?.find((entry) => entry.source_path === visualPath)
      if (!visual || item.visuals.filter((entry) => entry.source_path === visualPath).length !== 1) { errors.push(`${id}: missing visual identity ${visualPath}`); continue }
      const registered = sources.get(visualPath)
      if (!registered || visual.source_identity !== path.basename(visualPath) || visual.register_sha256 !== registered.sha256 || visual.source_map_path !== 'agentified/manuscript/visuals/source-map.md' || !sourceMap.includes(path.basename(visualPath))) errors.push(`${id}: source mismatch ${visualPath}`)
      try { if (sha(readSource(visualPath)) !== visual.register_sha256) errors.push(`${id}: visual hash drift ${visualPath}`) } catch { errors.push(`${id}: missing visual ${visualPath}`) }
      if (!visual.script_passage || !script.split('\n').includes(visual.script_passage) || !visual.script_passage.includes(visualPath)) errors.push(`${id}: passage mismatch ${visualPath}`)
      if (visual.rights?.status !== 'approved' || !visual.rights.attribution || visual.rights.author_review !== 'approved' || visual.rights.workshop_redistribution !== 'approved_for_bound_agentified_lesson_uses') errors.push(`${id}: rights approval mismatch ${visualPath}`)
      if (!visual.accessibility?.text_alternative || !visual.accessibility?.spoken_equivalent || !visual.accessibility?.color_independent || !visual.accessibility?.motion_treatment) errors.push(`${id}: accessibility omission ${visualPath}`)
      if (!visual.intended_production_use || visual.disposition !== 'approved_for_production_packets_and_provider_free_animatics') errors.push(`${id}: approval disposition invalid ${visualPath}`)
      if (visual.approval?.status !== 'approved' || visual.approval.record !== expectedApprovalRecord) errors.push(`${id}: visual approval mismatch ${visualPath}`)
      if (visual.approval?.expires_at && visual.approval.expires_at <= today) errors.push(`${id}: stale approval ${visualPath}`)
      if (visual.blocker !== null) errors.push(`${id}: stale visual blocker ${visualPath}`)
    }
  }
  const cover = packet.cover_hold
  if (!cover || cover.disposition !== 'approved_canonical_jpg' || cover.jpg?.path !== 'public/agentified-cover.jpg' || cover.jpg.sha256 !== sources.get(cover.jpg.path)?.sha256 || cover.svg !== undefined || cover.approval?.status !== 'approved') errors.push('canonical book-cover approval mismatch')
  else if (sha(readSource(cover.jpg.path)) !== cover.jpg.sha256) errors.push(`cover hash drift ${cover.jpg.path}`)
  const sam = packet.sam_lineage
  if (!sam?.original_drive_path?.endsWith('/Accelerated_infographic.png') || sam?.local_source_path !== 'agentified/source-assets/accelerated/accelerated-sam-infographic.png' || sam?.local_sha256 !== sources.get(sam?.local_source_path)?.sha256 || sam?.workshop_use !== 'blocked_pending_rights_and_design_review') errors.push('SAM lineage or rights mismatch')
  else if (sha(readSource(sam.local_source_path)) !== sam.local_sha256) errors.push('SAM source hash drift')
  if (packet.authority !== 'approved_visual_preproduction_only' || packet.external_execution !== 'disabled' || packet.visual_approval?.record !== expectedApprovalRecord) errors.push('authority boundary changed')
  for (const frame of ['L01-receipt.md', 'L06-permission.md', 'L16-audit.md']) {
    let content
    try { content = readSource(`agentified/workshop/visual-review/frames/${frame}`).toString() }
    catch { errors.push(`missing storyboard frame ${frame}`); continue }
    if (/\/Users\/|https?:\/\/|!\[[^\]]*\]\([^)]*\)|\b(?:fixture|placeholder|production note|QA note|source hash|api key|password|token)\b/i.test(content)) errors.push(`storyboard frame leakage ${frame}`)
  }
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packet = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'packets.json')))
  const errors = validate(packet)
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log('Agentified L01–L16: 19 approved visual bindings, script passages, hashes, rights, accessibility, and external-execution gates pass.')
}
