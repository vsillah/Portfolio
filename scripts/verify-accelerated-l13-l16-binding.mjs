import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = 'artifacts/accelerated-l13-l16-native-composite-2026-11-04'
const originalApprovalPath = 'docs/accelerated-course-modules/l13-l16-learner-binding/human-qa-approval-receipt.json'
const reviewReceiptPath = 'docs/accelerated-course-modules/l13-l16-learner-binding/correction-review-receipt.json'
const correctionApprovalPath = 'docs/accelerated-course-modules/l13-l16-learner-binding/correction-human-qa-approval-receipt.json'
const read = (file) => readFileSync(path.join(root, file), 'utf8')
const digest = (file) => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')
const requireMatch = (ok, detail) => { if (!ok) throw new Error(`Accelerated L13-L16 correction: ${detail}`) }
const original = Object.freeze({
  L13: '4a2974b8a645ca5e7f8b18d91ea1a9e2da7cdc91ec201c8294411443950b87fe',
  L14: 'cf675c5ed4e1aa69c6a2654b58b38614d040562403cc00bfac233e13ae3bc485',
  L15: '2db525fa4b63656d68d60556df294edda23dbb5d459891bc4ca6917c53fd1dd7',
  L16: '89c3c66873f6e32246d89ae7402c98d2d8a52b5a7a25fb4571914564ba0d63e5',
})
const corrected = Object.freeze({
  L13: '0ae3ce8516cd4a754aab0da6debad03b7085b6d7bc2c61f459fb8bb0ff2a7bf1',
  L14: '2b178dd6a64f8b619c0f64544d2e655ae73b7dba3b93775aef91d18e0407a143',
  L15: '67d066c87bd2af6a3bf1184b66e329cd17b928f41842da3d3d35cabd230d68f3',
  L16: '5ee4267cac68f05d587225c994d9156a53a2051cc36e059141be997d16161bc0',
})
export function verifyAcceleratedL13L16Binding({ originalApproval = JSON.parse(read(originalApprovalPath)), reviewReceipt = JSON.parse(read(reviewReceiptPath)), correctionApproval = JSON.parse(read(correctionApprovalPath)) } = {}) {
  const historicalBatch = JSON.parse(read(`${source}/batch-receipt.json`))
  const correctionBatch = JSON.parse(read(`${source}/correction-batch-receipt.json`))
  requireMatch(originalApproval.schema_version === '1.0' && originalApproval.receipt_type === 'accelerated_l13_l16_human_qa_approval' && originalApproval.status === 'approved', 'historical approval missing or stale')
  const approval = originalApproval.approval_source
  requireMatch(approval?.delegated_task_source_thread_id === '019ef636-39d4-7180-953c-660515b5604a' && approval?.approval_message_id === 'msg_0b99e4d3546af239016aec153875dc819c8eb1e036e4e399db' && approval?.reviewer === 'Vambah Sillah' && approval?.reviewed_pr === 1206 && approval?.reviewed_pr_head === '59a1d13862553e517ea8a47e26d07afe53bf410f' && approval?.merged_source_commit === '6814e6a5b01ab75555f5de46742a0a715bf9dfb5', 'historical approval source mismatch')
  requireMatch(originalApproval.external_actions_authorized === false && originalApproval.pre_approval_batch_receipt === `${source}/batch-receipt.json`, 'historical approval scope mismatch')
  requireMatch(historicalBatch.status === 'human_qa_pending' && JSON.stringify(historicalBatch.composite_sha256) === JSON.stringify(original), 'historical batch drift')
  requireMatch(JSON.stringify(originalApproval.bindings) === JSON.stringify(original), 'historical approval hash drift')
  requireMatch(reviewReceipt.schema_version === '1.0' && reviewReceipt.receipt_type === 'accelerated_l13_l16_visual_correction_review' && reviewReceipt.status === 'human_qa_pending' && reviewReceipt.approval_message_id === null, 'correction review state mismatch')
  requireMatch(reviewReceipt.reviewed_pr === 1208 && reviewReceipt.historical_human_qa_approval_receipt === originalApprovalPath && reviewReceipt.correction_batch_receipt === `${source}/correction-batch-receipt.json` && reviewReceipt.external_actions_authorized === false && reviewReceipt.provider_calls === 0, 'correction review scope mismatch')
  requireMatch(JSON.stringify(reviewReceipt.original_composite_sha256) === JSON.stringify(original) && JSON.stringify(reviewReceipt.candidate_composite_sha256) === JSON.stringify(corrected), 'correction hash mismatch')
  requireMatch(correctionBatch.status === 'human_qa_pending' && correctionBatch.source_batch_receipt === `${source}/batch-receipt.json` && correctionBatch.external_actions_authorized === false && correctionBatch.provider_calls === 0 && JSON.stringify(correctionBatch.corrected_composite_sha256) === JSON.stringify(corrected), 'correction batch mismatch')
  requireMatch(JSON.stringify(reviewReceipt.presenter_panel) === JSON.stringify({ x: 986, y: 190, width: 870, height: 490, border: 10 }), 'presenter inset mismatch')
  requireMatch(correctionApproval.schema_version === '1.0' && correctionApproval.receipt_type === 'accelerated_l13_l16_visual_correction_human_qa_approval' && correctionApproval.status === 'approved', 'correction approval missing or stale')
  const correctionSource = correctionApproval.approval_source
  requireMatch(correctionSource?.delegated_task_source_thread_id === '019ef636-39d4-7180-953c-660515b5604a' && correctionSource?.approval_message_id === 'msg_0b99e4d3546af239016aec59debcf0819c90d326076b320885' && correctionSource?.reviewed_pr === 1208 && correctionSource?.reviewed_candidate_head === 'ff0f14b12273ef30f19b5cd32c227a973480e4ad' && correctionSource?.reviewer === 'Vambah Sillah', 'correction approval source mismatch')
  requireMatch(correctionApproval.pre_approval_review_receipt === reviewReceiptPath && correctionApproval.historical_human_qa_approval_receipt === originalApprovalPath && correctionApproval.external_actions_authorized === false, 'correction approval scope mismatch')
  requireMatch(JSON.stringify(correctionApproval.bindings) === JSON.stringify(corrected), 'correction approval hash mismatch')
  for (const [id, hash] of Object.entries(corrected)) {
    const low = id.toLowerCase()
    const manifest = JSON.parse(read(`${source}/${low}/composite-manifest.json`))
    const composite = JSON.parse(read(`${source}/${low}/composite-receipt.json`))
    const originalMedia = `${source}/${low}/accelerated-${low}-native-composite.mp4`
    const srt = `docs/accelerated-course-modules/l13-l16-guided-video/${low}-storyboard.srt`
    const target = `public/accelerated/lessons/${low}/review-${hash.slice(0, 8)}/accelerated-${low}-native-composite.mp4`
    const captions = `public/accelerated/lessons/${low}/review-${hash.slice(0, 8)}/${low}-captions.vtt`
    const transcriptPath = `docs/accelerated-course-modules/l13-l16-learner-binding/${low}-transcript.json`
    requireMatch(manifest.output_sha256 === hash && composite.composite?.sha256 === hash, `${id} receipt or composite mismatch`)
    requireMatch(JSON.stringify(manifest.presenter_panel) === JSON.stringify(reviewReceipt.presenter_panel), `${id} panel mismatch`)
    requireMatch([originalMedia, srt, target, captions, transcriptPath].every((file) => existsSync(path.join(root, file))), `${id} missing media`)
    requireMatch(digest(originalMedia) === hash && digest(target) === hash, `${id} media hash mismatch`)
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
  console.log('Accelerated L13-L16 historical and correction approvals verified')
}
