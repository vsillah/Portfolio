#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(path.join(here, 'audit-boundaries.json'), 'utf8'))
const stamp = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const artDirection = {
  L01: 'paper sources and receipt trail', L02: 'decision fork and consequence', L03: 'claim-to-source evidence chain', L04: 'correction and memory gate',
  L05: 'operating map', L06: 'authority slip and boundary', L07: 'small pod handoffs', L08: 'test cases and rejection paths',
  L09: 'metrics ladder and review posture', L10: 'spend envelope and conditional decision', L11: 'mission-control cockpit', L12: 'scoped proof packet',
  L13: 'research proposal and unrun gate', L14: 'queue, trace, and memory panels', L15: 'six-beat workday', L16: 'operating-file audit stack',
}
const md = [
  '# Agentified L01–L16 final-composite presentation audit',
  '',
  'Source: exact `origin/main` commit `f0931f3860e042507ee5aba83f220eb57cfd3eb5`. This audit sampled one frame 1.5 seconds after every actual scene boundary and one frame at each scene midpoint in the sixteen learner-bound final composites. `audit-boundaries.json` records exact media paths, hashes, timestamps, source bindings, and frame paths. These are observed learner frames, not storyboard-only renders.',
  '',
  '## Decision',
  '',
  'All sixteen lesson presentations need visual repair before renewed learner-media Human QA. All 128 scene positions show at least one visual defect. Nineteen scenes contain an approved source diagram, but the existing renderer places each in a small contain box with large empty side fields; portrait diagrams are especially hard to read. The remaining 109 positions use a repeated text/placeholder pattern, opening/closing empty field, or countdown-only activity. This does not mean every narration sentence or approved plate is defective; the presentation composition is.',
  '',
  'At L01 00:37 the current frame has a heading and small “Illustrative case: Harbor Learning Circle” label over a large empty field. A real corrected proposal is at [`frames/l01-01-corrected-proposal.png`](frames/l01-01-corrected-proposal.png). Its illustrated source notes and linked brief make the evidence trail legible without changing approved narration. The customer-facing frame keeps the case name and removes the source-handling label. Source prompt, hash, scoped rights, and accessibility text are in its receipt.',
  '',
  'The current Accelerated treatment was checked as a visual reference (`public/accelerated/lessons/l01/approved-ee09bf72/...` at 00:40 and L13 review composite at 01:30). Its large physical artifact, generous type, and strong color grouping are useful cues. It also has text-led frames, so it is not a blanket pass standard. No Accelerated asset was changed or copied.',
  '',
  '## Defect matrix',
  '',
  '| Scene | Observed interval; samples | Observed defect | Art direction | Evidence |',
  '| --- | --- | --- | --- | --- |',
]
for (const row of data.rows) {
  const lesson = row.scene_id.slice(0, 3)
  const sceneNumber = Number(row.scene_id.slice(-2))
  const copy = row.audience_copy.join(' ')
  const defects = []
  if (row.approved_visuals.length) defects.push('Approved diagram reduced to disconnected thumbnail; weak focal hierarchy and tiny embedded labels')
  else if (sceneNumber === 1) defects.push('Large empty field with heading; text-only teaching frame')
  else if (sceneNumber === 8) defects.push('Text-led closing with empty field or small presenter inset')
  else if (sceneNumber === 7) defects.push('Repeated placeholder card and countdown; missing worked artifact')
  else defects.push('Repeated generic Operating File placeholder; teaching claim remains text-only')
  if (/[→]|->/.test(copy)) defects.push('Programming-style arrow sequence')
  if (/\b[a-z]+_[a-z_]+\b|[<>{}\[\]`]/.test(copy)) defects.push('Code-like notation')
  if (copy.length > 105 || copy.split(/[•/]/).length > 6) defects.push('Dense copy at video size')
  if (copy.includes(' / ')) defects.push('Slash-delimited list lacks visual grouping')
  const direction = row.approved_visuals.length
    ? `Integrate the approved diagram as a readable hero in the ${artDirection[lesson]} composition; add a concise text equivalent.`
    : sceneNumber === 7 ? `Show the learner's ${artDirection[lesson]} work artifact beside the protected countdown.`
    : sceneNumber === 8 ? `Show the completed ${artDirection[lesson]} artifact as the closing visual.`
    : `Draw a scene-specific ${artDirection[lesson]} illustration or diagram; keep copy concise.`
  md.push(`| ${row.scene_id} | ${stamp(row.start_seconds)}–${stamp(row.end_seconds)}; ${stamp(row.boundary_sample_seconds)}, ${stamp(row.midpoint_sample_seconds)} | ${defects.join('; ')} | ${direction} | [boundary](${row.frames.boundary}), [midpoint](${row.frames.midpoint}) |`)
}
md.push('', '## Source and rights boundary', '',
  'The nineteen visual uses in `scene-production/packets/L01.json` through `L16.json` bind registered Agentified publication plates to their specific lesson scenes. `visual-review/packets.json` records approved rights for those bound uses. The preflight did not infer permission to use those plates in unrelated scenes or products. Repo-local illustration bases and rendered publication plates were inspected. The AmaduTown Drive company-material and workshop folders were searched for diagrams and PDFs; no unapproved third-party artwork was selected. The new L01 paper-source illustration is an original, project-local asset scoped to this remediation and carries a prompt, SHA-256, and accessibility description.',
  '', '## Protected media boundary', '',
  'This audit has not changed learner playback, presenter footage, narration, captions, timing, or Operating File bindings. Future visual-only composites must prove those stream and timeline invariants against the hashes in `audit-boundaries.json` before any learner binding changes.', '')
writeFileSync(path.join(here, 'defect-matrix.md'), md.join('\n'))
console.log(`Wrote ${data.rows.length} defect rows`)
