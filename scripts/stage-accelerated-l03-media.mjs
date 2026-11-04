import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = {
  composite: 'public/accelerated/lessons/l03/approved-02b9c3ea/accelerated-l03-native-composite.mp4',
  captions: 'docs/accelerated-course-modules/l02-l04-guided-video/l03-storyboard.srt',
  script: 'docs/accelerated-course-modules/curriculum/scripts/L03.md',
  manifest: 'docs/accelerated-course-modules/l03-native-composite/composite-manifest.json',
  receipt: 'docs/accelerated-course-modules/l03-native-composite/composite-receipt.json',
  approval: 'docs/accelerated-course-modules/l03-native-composite/human-qa-approval-receipt.json',
  deviation: 'docs/accelerated-course-modules/l03-native-composite/resolution-deviation-receipt.json',
  l01Video: 'public/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4',
  l01Captions: 'public/accelerated/lessons/l01/approved-ee09bf72/l01-approved-captions.vtt',
  l02Video: 'public/accelerated/lessons/l02/approved-ded23edb/accelerated-l02-native-composite.mp4',
  l02Captions: 'public/accelerated/lessons/l02/approved-ded23edb/l02-captions.vtt',
}

const approvalIdentity = {
  messageId: '01a1a7dd-1768-7aa2-ae4d-94873644fe8c',
  reviewedPr: 1200,
  reviewedPrHead: '3fb377f9c57feaaad77644b309991b0e22d95143',
  reviewer: 'Vambah Sillah',
}
const expected = {
  composite: '02b9c3ea941c22ffaf87b3bc4e4c4612951499af15485e0261910fad6014053a',
  source: '064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198',
  captions: 'ee59adb3cd88e195c25bebaeb04ca0f9b78cc42c7291b1300b205f5958a917de',
  script: '41d9233ab15a1922748e455da8d31af1c33f356a4f569740121526a92cce8f6e',
  deviation: 'f6cd2f7a060859efadd8f3021877d91eccd4ac3b6314a74ce716c84effd7f7f2',
  l01Video: 'ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a',
  l01Captions: 'ceb998e79c84eb564548d155602a83b7cc1725d5b764a723ab6cd931b093184f',
  l02Video: 'ded23edb31cd957689617e3d132f1360957ffe3a60bb5274f478f910b09e3af6',
  l02Captions: 'ce7d486748d32b43e2aa9a4f53d6682b3168b66c71527b935e510666edec71fd',
}

function read(name, base = root) { return readFileSync(path.join(base, files[name])) }
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex') }
function assertHash(name, base) {
  const actual = hash(read(name, base))
  if (actual !== expected[name]) throw new Error(`Accelerated ${name} hash mismatch: ${actual}`)
}

export function validateL03HumanQaApproval(approval) {
  if (!approval || approval.status !== 'approved') {
    throw new Error('Accelerated L03 Human QA approval is absent or pending')
  }
  if (approval.receipt_type !== 'accelerated_guided_video_human_qa_approval' ||
      approval.project !== 'Portfolio' || approval.lesson !== 'Accelerated L03' ||
      approval.approval?.message_id !== approvalIdentity.messageId ||
      approval.approval?.reviewed_pr !== approvalIdentity.reviewedPr ||
      approval.approval?.reviewed_pr_head !== approvalIdentity.reviewedPrHead ||
      approval.reviewer?.identity !== approvalIdentity.reviewer) {
    throw new Error('Accelerated L03 Human QA approval is stale or identity-mismatched')
  }
  if (approval.bindings?.composite_sha256 !== expected.composite ||
      approval.bindings?.provider_source_sha256 !== expected.source ||
      approval.bindings?.script_sha256 !== expected.script ||
      approval.bindings?.captions_source_sha256 !== expected.captions ||
      approval.external_actions_authorized !== false) {
    throw new Error('Accelerated L03 Human QA approval artifact binding mismatch')
  }
  return approval
}

export function validateAndStageL03(base = root) {
  for (const name of ['composite', 'captions', 'script', 'deviation', 'l01Video', 'l01Captions', 'l02Video', 'l02Captions']) assertHash(name, base)
  const manifest = JSON.parse(read('manifest', base))
  const receipt = JSON.parse(read('receipt', base))
  const approval = validateL03HumanQaApproval(JSON.parse(read('approval', base)))
  const deviation = JSON.parse(read('deviation', base))
  if (manifest.lesson !== 'Accelerated L03' || receipt.lesson !== manifest.lesson || deviation.lesson !== manifest.lesson ||
      manifest.source_commit !== '7663edf66b7eb6c88d7129ae331199616ae44345' ||
      manifest.output_sha256 !== expected.composite || receipt.composite?.sha256 !== expected.composite ||
      manifest.source_sha256 !== expected.source || receipt.approved_source_sha256 !== expected.source || deviation.source_sha256 !== expected.source ||
      manifest.script_sha256 !== expected.script || manifest.captions_sha256 !== expected.captions ||
      manifest.resolution_deviation_receipt_sha256 !== expected.deviation || receipt.resolution_deviation_receipt_sha256 !== expected.deviation ||
      manifest.output_duration_seconds !== 540 || manifest.output_frames !== 13500 || receipt.composite?.duration_seconds !== 540 ||
      receipt.composite?.video_frames !== 13500 || deviation.status !== 'approved') {
    throw new Error('Accelerated L03 identity or approved source lineage mismatch')
  }
  if (approval.bindings.pre_approval_composite_receipt !== files.receipt) {
    throw new Error('Accelerated L03 Human QA approval receipt lineage mismatch')
  }
  const srt = read('captions', base).toString('utf8').trim().replace(/\r\n/g, '\n')
  const cues = srt.split(/\n\n+/).map((block, index) => {
    const lines = block.split('\n')
    const time = lines[1]?.match(/^(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})$/)
    if (Number(lines[0]) !== index + 1 || !time || lines.length < 3) throw new Error(`Invalid L03 caption cue ${index + 1}`)
    return { start: time[1].replace(',', '.'), end: time[2].replace(',', '.'), text: lines.slice(2).join(' ') }
  })
  if (cues.length !== 85 || cues[0].start !== '00:00:00.000' || cues.at(-1).end !== '00:09:00.000') {
    throw new Error('Accelerated L03 captions do not cover the approved lesson')
  }
  const vtt = `WEBVTT\n\n${cues.map((cue) => `${cue.start} --> ${cue.end}\n${cue.text}`).join('\n\n')}\n`
  const transcript = { source_srt_sha256: expected.captions, cues: cues.map((cue) => ({ ...cue, start: cue.start.slice(3), end: cue.end.slice(3) })) }
  writeFileSync(path.join(base, 'public/accelerated/lessons/l03/approved-02b9c3ea/l03-captions.vtt'), vtt)
  writeFileSync(path.join(base, 'docs/accelerated-course-modules/l03-native-composite/l03-learner-transcript.json'), `${JSON.stringify(transcript, null, 2)}\n`)
  console.log('Accelerated L03 exact media and captions staged')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) validateAndStageL03()
