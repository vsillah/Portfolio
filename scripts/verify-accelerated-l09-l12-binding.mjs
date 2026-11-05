import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = 'artifacts/accelerated-l09-l12-native-composite-2026-11-04'
const approval = JSON.parse(readFileSync(path.join(root, 'docs/accelerated-course-modules/l09-l12-learner-binding/human-qa-approval-receipt.json')))
const batch = JSON.parse(readFileSync(path.join(root, source, 'batch-receipt.json')))
const ids = ['L09', 'L10', 'L11', 'L12']
const approvedHashes = {
  L09: '0abafea5f81201d7a5d0f03ed5cb7209c82057c75e4f3811aae86863cd38ae2a',
  L10: '7beb8af5894653da01ee7bd902a87e76819f2bd4da7116993e79ecbb135e8297',
  L11: '1dcb3b035096c8d15e11c1168dbc4008e179e0052eb374cf70f10ca8c0ba6fc0',
  L12: '39294821b1e9aec78c5e58dec7fe3f174158b0bf536670962a0829a731593f6c',
}
const digest = (file) => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')
const requireMatch = (condition, message) => { if (!condition) throw new Error(`Accelerated learner binding: ${message}`) }

requireMatch(approval.status === 'approved' && approval.receipt_type === 'accelerated_l09_l12_human_qa_approval', 'approval missing or stale')
requireMatch(approval.approval_source?.reviewed_pr === 1204 && approval.approval_source?.reviewed_pr_head === 'd176054f79c00d4b7b7b7e17e379918a0b15ce98' && approval.approval_source?.merged_base_commit === 'adaf7ec28c839867cda56c419be57381e1b154bd', 'approval source mismatch')
requireMatch(approval.external_actions_authorized === false && approval.pre_approval_batch_receipt === `${source}/batch-receipt.json`, 'approval scope mismatch')
requireMatch(batch.lessons?.length === 4 && batch.status === 'human_qa_pending', 'historical batch receipt mismatch')

for (const id of ids) {
  const low = id.toLowerCase()
  const mediaSource = `${source}/${low}/accelerated-${low}-native-composite.mp4`
  const srtSource = `docs/accelerated-course-modules/l09-l12-guided-video/${low}-storyboard.srt`
  const manifest = JSON.parse(readFileSync(path.join(root, source, low, 'composite-manifest.json')))
  const composite = JSON.parse(readFileSync(path.join(root, source, low, 'composite-receipt.json')))
  const batchLesson = batch.lessons.find((item) => item.lesson === id)
  const expected = approvedHashes[id]
  requireMatch(approval.bindings?.[id] === expected && batchLesson?.composite_sha256 === expected && manifest.output_sha256 === expected && composite.composite?.sha256 === expected && digest(mediaSource) === expected, `${id} composite mismatch`)
  requireMatch(batchLesson.source_sha256 === manifest.source_sha256 && composite.approved_source_sha256 === manifest.source_sha256, `${id} source mismatch`)
  requireMatch(digest(srtSource) === manifest.captions_sha256 && digest(`docs/accelerated-course-modules/curriculum/scripts/${id}.md`) === manifest.script_sha256, `${id} caption or script mismatch`)

  const cues = readFileSync(path.join(root, srtSource), 'utf8').trim().split(/\r?\n\r?\n/).map((block) => {
    const [, timing, ...lines] = block.split(/\r?\n/)
    const [start, end] = timing.split(' --> ')
    requireMatch(Boolean(start && end && lines.length), `${id} malformed caption cue`)
    return { start: start.replace(',', '.').slice(3), end: end.replace(',', '.').slice(3), text: lines.join(' ') }
  })
  const transcript = { source_srt_sha256: manifest.captions_sha256, cues }
  const vtt = `WEBVTT\n\n${cues.map((cue) => `${`00:${cue.start}`} --> ${`00:${cue.end}`}\n${cue.text}`).join('\n\n')}\n`
  const mediaDir = `public/accelerated/lessons/${low}/approved-${expected.slice(0, 8)}`
  const mediaTarget = `${mediaDir}/accelerated-${low}-native-composite.mp4`
  const captionsTarget = `${mediaDir}/${low}-captions.vtt`
  const transcriptTarget = `docs/accelerated-course-modules/l09-l12-learner-binding/${low}-transcript.json`
  requireMatch([mediaTarget, captionsTarget, transcriptTarget].every((file) => existsSync(path.join(root, file))), `${id} staged media missing`)
  requireMatch(digest(mediaTarget) === expected && readFileSync(path.join(root, captionsTarget), 'utf8') === vtt && JSON.stringify(JSON.parse(readFileSync(path.join(root, transcriptTarget)))) === JSON.stringify(transcript), `${id} staged media or transcript mismatch`)
}

console.log('Accelerated L09-L12 approval and exact learner media verified')
