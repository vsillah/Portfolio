import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputRoot = path.resolve(root, 'public/review-assets/social-content/youtube-packaging')
const sourceProofRoot = path.resolve(root, 'public/review-assets/social-content/source-proof')
const logoPath = path.resolve(root, 'public/amadutown-logo-upscaled.png')

const jobs = [
  {
    id: 'dark-castle',
    cohortPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/cohort.json'),
    expectedCohortId: 'cohort:youtube:chess-decision-learning:20261018:v1',
    sourcePath: path.resolve(root, 'public/review-assets/social-content/dark-castle-customer-facing-poster.png'),
    sourcePublicPath: '/review-assets/social-content/dark-castle-customer-facing-poster.png',
    sourceReceipt: 'sha256:e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78',
    sourceLabel: 'Dark Castle gameplay proof',
    title: 'I Rebuilt the Chess Lesson Around the Decision',
    hook: ['REMEMBER', 'THE WHY'],
    hookExact: 'REMEMBER THE WHY',
    accent: '#F5C518',
    crop: { left: 125, top: 150, width: 990, height: 765 },
    output: 'dark-castle-remember-the-why.png',
    receipt: 'dark-castle-thumbnail-selection-receipt.json',
  },
  {
    id: 'ai-audit',
    cohortPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/cohort.json'),
    expectedCohortId: 'cohort:youtube:ai-cost-audit-roi:20261018:v1',
    sourcePath: path.resolve(root, 'public/audit_calculator_img.png'),
    sourcePublicPath: '/review-assets/social-content/source-proof/ai-audit-calculator.png',
    sourceReceipt: 'sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97',
    sourceLabel: 'AI Audit Calculator result screen',
    title: 'The AI Cost That Never Appears on the Invoice',
    hook: ['WHO OWNS', 'THE CLEANUP?'],
    hookExact: 'WHO OWNS THE CLEANUP?',
    accent: '#E0B52F',
    crop: { left: 35, top: 120, width: 1335, height: 1030 },
    output: 'ai-audit-who-owns-the-cleanup.png',
    receipt: 'ai-audit-thumbnail-selection-receipt.json',
    stageSourceAs: path.resolve(sourceProofRoot, 'ai-audit-calculator.png'),
  },
]

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function assertCanonicalInputs(job, cohort) {
  if (cohort.status !== 'approved' || cohort.cohort_id !== job.expectedCohortId) throw new Error(`${job.id}: cohort is not the expected approved receipt.`)
  if (cohort.target?.format !== 'long_form' || cohort.target?.aspect_ratio !== '16:9') throw new Error(`${job.id}: cohort is not bound to long-form 16:9 YouTube.`)
  if (cohort.selection_gate?.ready !== true || cohort.selection_gate.qualified_sample_size < cohort.selection_gate.minimum_sample_size) throw new Error(`${job.id}: cohort did not meet its declared sample gate.`)
  if (!cohort.included?.every((sample) => sample.youtube_url && sample.source_thumbnail_url && sample.thumbnail_path && sample.transcription_provenance && sample.channel_baseline_size >= 4 && Number.isFinite(sample.normalized_performance_score))) throw new Error(`${job.id}: at least one live sample lacks source, capture, transcription, channel baseline, or numerical evidence.`)
  if (cohort.candidate_copy_pair?.title !== job.title || cohort.candidate_copy_pair?.thumbnail_hook !== job.hookExact || cohort.candidate_copy_pair?.exact_strings_are_distinct !== true) throw new Error(`${job.id}: exact title-thumbnail copy binding is missing or stale.`)
  if (cohort.candidate_copy_pair?.performance_claim !== 'unscored' || cohort.candidate_copy_pair?.support_scope !== 'editorial_hypothesis_only') throw new Error(`${job.id}: unsupported copy-pair performance claim.`)
}

function overlay(job) {
  const lineHeight = job.id === 'ai-audit' ? 90 : 104
  const firstY = job.id === 'ai-audit' ? 290 : 280
  const fontSize = job.id === 'ai-audit' ? 76 : 88
  const lines = job.hook.map((line, index) => `<tspan x="62" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="panel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#061426" stop-opacity="1"/><stop offset="0.78" stop-color="#061426" stop-opacity="0.98"/><stop offset="1" stop-color="#061426" stop-opacity="0"/></linearGradient></defs>
    <rect width="690" height="720" fill="url(#panel)"/>
    <rect x="62" y="${firstY - 86}" width="98" height="8" rx="4" fill="${job.accent}"/>
    <text x="62" y="${firstY}" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="-2">${lines}</text>
  </svg>`)
}

await mkdir(outputRoot, { recursive: true })
await mkdir(sourceProofRoot, { recursive: true })

for (const job of jobs) {
  const cohort = JSON.parse(await readFile(job.cohortPath, 'utf8'))
  assertCanonicalInputs(job, cohort)
  if (job.stageSourceAs) await copyFile(job.sourcePath, job.stageSourceAs)

  const background = await sharp(job.sourcePath).resize(1280, 720, { fit: 'cover' }).modulate({ brightness: 0.34, saturation: 0.78 }).blur(11).png().toBuffer()
  const product = await sharp(job.sourcePath).extract(job.crop).resize(760, 620, { fit: 'cover', position: 'centre' }).sharpen().png().toBuffer()
  const logo = await sharp(logoPath).resize({ height: 108 }).png().toBuffer()
  const outputPath = path.join(outputRoot, job.output)

  await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#061426' } })
    .composite([
      { input: background, left: 0, top: 0 },
      { input: product, left: 520, top: 50 },
      { input: overlay(job), left: 0, top: 0 },
      { input: logo, left: 62, top: 54 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath)

  const outputBytes = await readFile(outputPath)
  const outputPublicPath = `/review-assets/social-content/youtube-packaging/${job.output}`
  const receipt = {
    version: 'youtube-thumbnail-selection/v1',
    receipt_id: `thumbnail:${job.id}:youtube-long-form:20261018:v1`,
    cohort_id: cohort.cohort_id,
    observed_at: cohort.observed_at,
    title: job.title,
    thumbnail_hook: job.hookExact,
    target: { channel: 'youtube', format: 'long_form', width: 1280, height: 720, aspect_ratio: '16:9' },
    candidate_copy_pair: cohort.candidate_copy_pair,
    adopted_traits: cohort.adopted_traits,
    rejected_traits: cohort.rejected_traits,
    selection_rationale: 'One first-party product idea carries the image. The short hook adds tension without repeating the title. Public examples bound the editorial pattern; they do not supply the composition or a causal performance claim.',
    first_party_source: { label: job.sourceLabel, artifact_url: job.sourcePublicPath, receipt_id: job.sourceReceipt, rights_status: 'owned_product_proof' },
    output: { artifact_url: outputPublicPath, width: 1280, height: 720, aspect_ratio: '16:9', sha256: sha256(outputBytes) },
    external_gates: { provider_generation: false, upload: false, platform_draft: false, schedule: false, publish: false, external_send: false, production_write: false },
  }
  await writeFile(path.join(path.dirname(job.cohortPath), job.receipt), `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify({ receipt_id: receipt.receipt_id, output: outputPublicPath, sha256: receipt.output.sha256 }))
}
