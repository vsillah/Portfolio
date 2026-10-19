import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sha256, validateGenerationBrief } from './youtube-thumbnail-quality-contract.mjs'

const root = process.cwd()
const tasteReceipt = JSON.parse(await readFile(path.resolve(root, 'artifacts/research/youtube-thumbnail-taste-reference-2026-10-18/receipt.json'), 'utf8'))
const jobs = [
  {
    directory: 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18',
    campaign: 'dark-castle',
  },
  {
    directory: 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18',
    campaign: 'ai-audit',
  },
]

let blocked = false
for (const job of jobs) {
  const directory = path.resolve(root, job.directory)
  const brief = JSON.parse(await readFile(path.join(directory, 'thumbnail-generation-brief-v6.json'), 'utf8'))
  const decision = JSON.parse(await readFile(path.join(directory, 'thumbnail-decision-receipt.json'), 'utf8'))
  const validation = validateGenerationBrief({ brief, decision, tasteReceipt })
  const receipt = {
    version: 'youtube-thumbnail-generation-preflight/v1',
    receipt_id: `preflight:${job.campaign}:youtube-thumbnail:${brief.content_version}:v1`,
    status: validation.status,
    failures: validation.failures,
    campaign_id: brief.campaign_id,
    content_version: brief.content_version,
    brief_id: brief.brief_id,
    brief_input_version: sha256(Buffer.from(JSON.stringify(brief))),
    decision_receipt_id: decision.receipt_id,
    decision_input_version: decision.input_version,
    decision_output_version: decision.output_version,
    live_cohort_id: decision.live_evidence.cohort_id,
    live_evidence_fresh_until: decision.live_evidence.fresh_until,
    playlist_receipt_id: tasteReceipt.receipt_id,
    playlist_input_version: tasteReceipt.input_version,
    playlist_performance_weight: 0,
    playlist_performance_status: 'unscored',
    teaser_word_count: validation.teaser_word_count,
    heygen_generation_allowed: validation.status === 'passed',
  }
  await writeFile(path.join(directory, 'thumbnail-generation-preflight-v6.json'), `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify({ campaign: job.campaign, status: receipt.status, failures: receipt.failures, receipt_id: receipt.receipt_id }))
  if (receipt.status !== 'passed') blocked = true
}
if (blocked) process.exitCode = 1
