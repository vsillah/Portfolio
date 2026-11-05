import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = 'artifacts/accelerated-l13-l16-native-composite-2026-11-04'
const receiptPath = 'docs/accelerated-course-modules/l13-l16-learner-binding/human-qa-approval-receipt.json'
const read = (file) => readFileSync(path.join(root, file), 'utf8')
const digest = (file) => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')
const requireMatch = (ok, detail) => { if (!ok) throw new Error(`Accelerated L13-L16 binding: ${detail}`) }
const expected = Object.freeze({
  L13: '4a2974b8a645ca5e7f8b18d91ea1a9e2da7cdc91ec201c8294411443950b87fe',
  L14: 'cf675c5ed4e1aa69c6a2654b58b38614d040562403cc00bfac233e13ae3bc485',
  L15: '2db525fa4b63656d68d60556df294edda23dbb5d459891bc4ca6917c53fd1dd7',
  L16: '89c3c66873f6e32246d89ae7402c98d2d8a52b5a7a25fb4571914564ba0d63e5',
})
export function verifyAcceleratedL13L16Binding({ receipt = JSON.parse(read(receiptPath)) } = {}) {
  const batch = JSON.parse(read(`${source}/batch-receipt.json`))
  requireMatch(receipt.schema_version === '1.0' && receipt.receipt_type === 'accelerated_l13_l16_human_qa_approval' && receipt.status === 'approved', 'approval missing or stale')
  const approval = receipt.approval_source
  requireMatch(approval?.delegated_task_source_thread_id === '019ef636-39d4-7180-953c-660515b5604a' && approval?.approval_message_id === 'msg_0b99e4d3546af239016aec153875dc819c8eb1e036e4e399db' && approval?.reviewer === 'Vambah Sillah' && approval?.reviewed_pr === 1206 && approval?.reviewed_pr_head === '59a1d13862553e517ea8a47e26d07afe53bf410f' && approval?.merged_source_commit === '6814e6a5b01ab75555f5de46742a0a715bf9dfb5', 'approval source mismatch')
  requireMatch(receipt.external_actions_authorized === false && receipt.pre_approval_batch_receipt === `${source}/batch-receipt.json`, 'approval scope mismatch')
  requireMatch(batch.status === 'human_qa_pending' && JSON.stringify(batch.lessons) === JSON.stringify(Object.keys(expected)), 'historical batch receipt mismatch')
  for (const [id, hash] of Object.entries(expected)) {
    const low = id.toLowerCase()
    const manifest = JSON.parse(read(`${source}/${low}/composite-manifest.json`))
    const composite = JSON.parse(read(`${source}/${low}/composite-receipt.json`))
    const original = `${source}/${low}/accelerated-${low}-native-composite.mp4`
    const srt = `docs/accelerated-course-modules/l13-l16-guided-video/${low}-storyboard.srt`
    const target = `public/accelerated/lessons/${low}/approved-${hash.slice(0, 8)}/accelerated-${low}-native-composite.mp4`
    const captions = `public/accelerated/lessons/${low}/approved-${hash.slice(0, 8)}/${low}-captions.vtt`
    const transcriptPath = `docs/accelerated-course-modules/l13-l16-learner-binding/${low}-transcript.json`
    requireMatch(receipt.bindings?.[id] === hash && batch.composite_sha256?.[id] === hash && manifest.output_sha256 === hash && composite.composite?.sha256 === hash, `${id} receipt or composite mismatch`)
    requireMatch([original, srt, target, captions, transcriptPath].every((file) => existsSync(path.join(root, file))), `${id} missing media`)
    requireMatch(digest(original) === hash && digest(target) === hash, `${id} media hash mismatch`)
    requireMatch(manifest.source_sha256 === composite.approved_source_sha256 && digest(srt) === manifest.captions_sha256 && digest(`docs/accelerated-course-modules/curriculum/scripts/${id}.md`) === manifest.script_sha256, `${id} source mismatch`)
    const cues = read(srt).trim().split(/\r?\n\r?\n/).map((block) => {
      const [, timing, ...lines] = block.split(/\r?\n/)
      const [start, end] = timing.split(' --> ')
      requireMatch(Boolean(start && end && lines.length), `${id} malformed caption`)
      return { start: start.replace(',', '.').slice(3), end: end.replace(',', '.').slice(3), text: lines.join(' ') }
    })
    const vtt = `WEBVTT\n\n${cues.map((cue) => `00:${cue.start} --> 00:${cue.end}\n${cue.text}`).join('\n\n')}\n`
    requireMatch(read(captions) === vtt && JSON.stringify(JSON.parse(read(transcriptPath))) === JSON.stringify({ source_srt_sha256: manifest.captions_sha256, cues }), `${id} caption or transcript mismatch`)
  }
  return true
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  verifyAcceleratedL13L16Binding()
  console.log('Accelerated L13-L16 approval and exact learner media verified')
}
