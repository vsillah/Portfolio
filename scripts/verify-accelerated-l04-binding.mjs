import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = 'docs/accelerated-course-modules/l04-learner-binding'
const media = 'public/accelerated/lessons/l04/approved-b239a55b'
const expected = {
  message: 'msg_0b99e4d3546af239016aebc1eebe94819c8508b64284d53437',
  sourceCommit: '30289b59511c661ccf38e3a4279248cb4dc1de0d',
  implementationHead: '81e1548b124bee3d304e6a722f2093d2713b6fee',
  composite: 'b239a55b2ac28cad77ccea5af6df10c9ec91ddb48d7810f9021e6c68f28c1613',
  source: 'cf8f8e78c48a8f4471e0a4bb53b57b4f71f3ad52d30f92cf356482b4d1be9c3e',
  script: '3b6a268fa8d19a6207451d9647fdd400acc9b90202900c5640884291f27d489f',
  captions: 'a183b1c2b5e100f449eb12481b314d09bd65d11aa0b81321c8499ac5bd03474c',
  packet: '370d7b9295c35eeeabb9f5da4b78170942979b06830d2321dcd3c63f1e563240',
}
const read = (file, base = root) => readFileSync(path.join(base, file))
const json = (file, base = root) => JSON.parse(read(file, base))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
function checkHash(file, expectedHash, base) {
  if (hash(read(file, base)) !== expectedHash) throw new Error(`Accelerated L04 hash mismatch: ${file}`)
}

export function validateApproval(receipts) {
  if (!Array.isArray(receipts) || receipts.length !== 1) throw new Error('L04 Human QA approval absent or duplicate')
  const r = receipts[0]
  if (r?.status !== 'approved') throw new Error('L04 Human QA approval pending')
  if (r.receipt_type !== 'accelerated_guided_video_human_qa_approval' ||
      r.project !== 'Portfolio' || r.lesson !== 'Accelerated L04' ||
      r.reviewer?.identity !== 'Vambah Sillah' ||
      r.approval?.message_id !== expected.message ||
      r.approval?.source_commit !== expected.sourceCommit ||
      r.approval?.implementation_head !== expected.implementationHead ||
      r.bindings?.composite_sha256 !== expected.composite ||
      r.bindings?.provider_source_sha256 !== expected.source ||
      r.bindings?.script_sha256 !== expected.script ||
      r.bindings?.captions_source_sha256 !== expected.captions ||
      r.bindings?.pre_approval_composite_receipt !== `${dir}/composite-receipt.json` ||
      r.external_actions_authorized !== false) throw new Error('L04 Human QA approval stale or identity-mismatched')
  return r
}

export function validateReconciliation(receipt, packet) {
  if (!receipt || receipt.status !== 'reconciled') throw new Error('L04 caption reconciliation absent or pending')
  if (receipt.receipt_type !== 'accelerated_l04_caption_count_reconciliation' ||
      receipt.lesson !== 'Accelerated L04' ||
      receipt.approval_message_id !== expected.message ||
      receipt.implementation_head !== expected.implementationHead ||
      receipt.bindings?.original_packet_sha256 !== expected.packet ||
      receipt.bindings?.approved_srt_sha256 !== expected.captions ||
      receipt.bindings?.composite_sha256 !== expected.composite ||
      receipt.evidence?.srt_numeric_cue_headers !== '1-94' ||
      receipt.evidence?.srt_timestamp_rows !== 94 ||
      receipt.evidence?.composite_subtitle_packets !== 94 ||
      receipt.evidence?.composite_subtitle_frames !== 94 ||
      receipt.evidence?.original_packet_caption_cues_field !== 95 ||
      packet?.media?.caption_cues !== 95) throw new Error('L04 caption reconciliation stale or mismatched')
}

export function verifyL04Binding(base = root) {
  const approvalNames = readdirSync(path.join(base, dir)).filter((name) => /^human-qa.*approval.*\.json$/.test(name) && name !== 'human-qa-source-approval-receipt.json')
  validateApproval(approvalNames.map((name) => json(`${dir}/${name}`, base)))
  checkHash(`${media}/accelerated-l04-native-composite.mp4`, expected.composite, base)
  checkHash('docs/accelerated-course-modules/l02-l04-guided-video/l04-storyboard.srt', expected.captions, base)
  checkHash('docs/accelerated-course-modules/curriculum/scripts/L04.md', expected.script, base)
  checkHash(`${dir}/final-human-qa-packet.json`, expected.packet, base)
  const packet = json(`${dir}/final-human-qa-packet.json`, base)
  validateReconciliation(json(`${dir}/caption-count-reconciliation-receipt.json`, base), packet)
  const manifest = json(`${dir}/composite-manifest.json`, base)
  const composite = json(`${dir}/composite-receipt.json`, base)
  const provider = json(`${dir}/provider-receipt.json`, base)
  const sourceApproval = json(`${dir}/human-qa-source-approval-receipt.json`, base)
  if (manifest.source_commit !== expected.sourceCommit || composite.source_commit !== expected.sourceCommit ||
      manifest.output_sha256 !== expected.composite || composite.composite?.sha256 !== expected.composite ||
      packet.composite_sha256 !== expected.composite || manifest.source_sha256 !== expected.source ||
      provider.artifact?.sha256 !== expected.source || sourceApproval.approved_source_sha256 !== expected.source ||
      manifest.script_sha256 !== expected.script || packet.script_sha256 !== expected.script ||
      manifest.captions_sha256 !== expected.captions || packet.captions_sha256 !== expected.captions ||
      composite.human_qa?.composite_status !== 'pending') throw new Error('L04 approved source lineage mismatch')
  const srt = read('docs/accelerated-course-modules/l02-l04-guided-video/l04-storyboard.srt', base).toString('utf8').trim().replace(/\r\n/g, '\n')
  const blocks = srt.split(/\n\n+/)
  if (blocks.length !== 94 || blocks.some((block, i) => Number(block.split('\n')[0]) !== i + 1) ||
      (srt.match(/-->/g) ?? []).length !== 94) throw new Error('L04 caption count mismatch')
  const transcript = json(`${dir}/l04-learner-transcript.json`, base)
  const vtt = read(`${media}/l04-captions.vtt`, base).toString('utf8')
  if (transcript.source_srt_sha256 !== expected.captions || transcript.cues?.length !== 94 ||
      (vtt.match(/-->/g) ?? []).length !== 94) throw new Error('L04 learner captions or transcript mismatch')
  return true
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyL04Binding()
  console.log('Accelerated L04 approval and media binding verified')
}
