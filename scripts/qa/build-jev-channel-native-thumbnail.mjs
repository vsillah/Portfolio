import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const presenterPoster = path.resolve('artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first/jev-youtube-presenter-first-poster.png')
const legacyThumbnail = path.resolve('artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first/jev-youtube-thumbnail.png')
const fieldGuide = path.resolve('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-operator-field-guide.png')
const output = path.resolve('public/review-assets/social-content/jev-youtube-thumbnail-v2.png')
const artifactOutput = path.resolve('artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/jev-youtube-thumbnail-v2.png')
const receiptOutput = path.resolve('artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/thumbnail-selection-receipt.json')

function hash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

const presenterBytes = await readFile(presenterPoster)
const legacyThumbnailBytes = await readFile(legacyThumbnail)
const fieldBytes = await readFile(fieldGuide)

const presenter = await sharp(presenterBytes)
  .extract({ left: 40, top: 500, width: 390, height: 235 })
  .resize({ width: 700, height: 422, fit: 'cover' })
  .composite([{ input: Buffer.from('<svg width="700" height="422"><defs><linearGradient id="f" x1="0" x2="1"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset="0.12" stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient></defs><rect width="700" height="422" fill="url(#f)"/></svg>'), blend: 'dest-in' }])
  .png()
  .toBuffer()

const scorePanel = await sharp(fieldBytes)
  .extract({ left: 32, top: 210, width: 300, height: 330 })
  .resize({ width: 300, height: 330, fit: 'cover' })
  .png()
  .toBuffer()

const headline = 'AI SCORED IT'
const question = 'WHO DECIDES?'
const overlay = Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#061525"/>
  <path d="M0 0H760L620 720H0Z" fill="#0a1d31"/>
  <circle cx="1180" cy="80" r="310" fill="#132f4b"/>
  <rect x="54" y="48" width="654" height="7" rx="3.5" fill="#f8c515"/>
  <text x="56" y="110" fill="#f8c515" font-size="25" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="5">JEV  •  AI GOVERNANCE</text>
  <text x="54" y="215" fill="#ffffff" font-size="74" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(headline)}</text>
  <text x="52" y="380" fill="#f8c515" font-size="170" font-family="Arial, Helvetica, sans-serif" font-weight="900">81%</text>
  <rect x="54" y="408" width="590" height="112" rx="18" fill="#ff6f61"/>
  <text x="82" y="483" fill="#07182b" font-size="62" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(question)}</text>
  <text x="58" y="572" fill="#b8c9da" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">A score can inform the call.</text>
  <text x="58" y="608" fill="#ffffff" font-size="29" font-family="Arial, Helvetica, sans-serif" font-weight="800">A HUMAN STILL OWNS IT.</text>
  <rect x="930" y="58" width="296" height="326" rx="22" fill="#ffffff" stroke="#f8c515" stroke-width="8"/>
  <rect x="950" y="78" width="256" height="286" rx="10" fill="#07182b"/>
</svg>`)

const rendered = await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#061525' } })
  .composite([
    { input: overlay, left: 0, top: 0 },
    { input: scorePanel, left: 928, top: 56 },
    { input: presenter, left: 580, top: 298 },
  ])
  .png()
  .toBuffer()

await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, rendered)
await writeFile(path.resolve('public/review-assets/social-content/jev-youtube-thumbnail.png'), legacyThumbnailBytes)
await writeFile(artifactOutput, rendered)

const receipt = {
  version: 'jev-thumbnail-selection/v2',
  receipt_id: 'thumbnail:jev:youtube-shorts:20261018:v2',
  cohort_id: 'cohort:youtube_shorts:ai-governance-decision:20261018:v1',
  observed_at: '2026-10-18T16:00:00.000Z',
  title: 'AI Scored It 81%. Who Makes the Call?',
  headline: 'AI SCORED IT 81% / WHO DECIDES?',
  decision: 'advance_for_human_qa',
  composition: 'Presenter-led AmaduTown/Jev composition with one concrete score, one decision question, and one approved score-panel proof crop.',
  source_assets: [
    { path: path.relative(process.cwd(), presenterPoster), sha256: hash(presenterBytes), use: 'approved presenter crop' },
    { path: path.relative(process.cwd(), fieldGuide), sha256: hash(fieldBytes), use: 'approved Jev score-panel proof crop' },
  ],
  research_influence: {
    adopted: ['dominant human anchor', 'short high-contrast hook', 'concrete decision tension', 'single product-proof object'],
    rejected: ['copied source wording or pixels', 'generic AI imagery', 'multi-panel explainer density', 'candidate performance claims'],
  },
  output: { width: 1280, height: 720, sha256: hash(rendered), public_path: '/review-assets/social-content/jev-youtube-thumbnail-v2.png' },
  rights_receipts: ['rights:jev:owned-public-assets-20261014'],
  privacy_receipt: 'privacy:jev:public-safe-20261014',
  provider_calls_executed: 0,
}
await writeFile(receiptOutput, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt.output, null, 2))
