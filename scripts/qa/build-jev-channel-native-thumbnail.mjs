import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const driveRoot = '/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Artifacts /Promotional /1. ATAS YouTube Channel'
const subjectSource = path.join(driveRoot, 'Assets/Thumbnails/V Subject/V YT Thumbnail Curious.jpg')
const struggleSource = path.join(driveRoot, 'Video Collections/0. ATAS Zero Series Origins/V0.2 ATAS Intro/Stills/ATAS_thumbnail_StruggletoSystem.png')
const stealSource = path.join(driveRoot, 'Video Collections/1. ATAS First Series Tools/V1.3 Make.com Tool Explainer /Stills/StealThis_VThumbnail.png')
const shortsBaselineSource = '/Users/vambahsillah/Projects/Portfolio.worktrees/stop-counting-ai-licenses-media/artifacts/human-qa/stop-counting-ai-licenses-2026-10-16/short-thumbnail-baseline.png'
const fieldGuide = path.resolve('artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-operator-field-guide.png')
const liveCohortSource = path.resolve('artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/cohort.json')
const logoSource = path.resolve('public/amadutown-logo-upscaled.png')
const publicRoot = path.resolve('public/review-assets/social-content')
const baselineRoot = path.join(publicRoot, 'jev-first-party-baselines')
const output = path.join(publicRoot, 'jev-youtube-short-thumbnail-v4.png')
const artifactOutput = path.resolve('artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/jev-youtube-short-thumbnail-v4.png')
const receiptOutput = path.resolve('artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/thumbnail-selection-receipt.json')

function hash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

const [subjectBytes, fieldBytes, logoBytes, struggleBytes, stealBytes, shortsBaselineBytes, liveCohortBytes] = await Promise.all([
  readFile(subjectSource), readFile(fieldGuide), readFile(logoSource), readFile(struggleSource), readFile(stealSource), readFile(shortsBaselineSource), readFile(liveCohortSource),
])

const subject = await sharp(subjectBytes)
  .resize({ width: 930, height: 930, fit: 'cover' })
  .composite([{ input: Buffer.from('<svg width="930" height="930"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset="0.78" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="930" height="930" fill="url(#f)"/></svg>'), blend: 'dest-in' }])
  .png()
  .toBuffer()

const proof = await sharp(fieldBytes)
  .extract({ left: 20, top: 165, width: 1102, height: 365 })
  .resize({ width: 940, height: 312, fit: 'cover' })
  .png()
  .toBuffer()

const logo = await sharp(logoBytes).resize({ height: 116, fit: 'inside' }).png().toBuffer()

const overlay = Buffer.from(`<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#173b60"/><stop offset="1" stop-color="#061525"/></radialGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-opacity="0.45"/></filter>
  </defs>
  <rect width="1080" height="1920" fill="url(#glow)"/>
  <path d="M0 0H1080V240L0 430Z" fill="#0a1d31"/>
  <rect x="62" y="66" width="956" height="8" rx="4" fill="#f8c515"/>
  <text x="72" y="138" fill="#f8c515" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="800" letter-spacing="5">JEV  •  HUMAN DECISION OWNERSHIP</text>
  <text x="68" y="330" fill="#ffffff" font-size="122" font-family="Arial, Helvetica, sans-serif" font-weight="900">AI SCORED IT.</text>
  <rect x="64" y="392" width="952" height="188" rx="28" fill="#ff7468" filter="url(#shadow)"/>
  <text x="102" y="520" fill="#07182b" font-size="112" font-family="Arial, Helvetica, sans-serif" font-weight="900">WHO DECIDES?</text>
  <rect x="64" y="635" width="952" height="344" rx="30" fill="#ffffff" stroke="#f8c515" stroke-width="10" filter="url(#shadow)"/>
  <text x="86" y="1033" fill="#b8c9da" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="700">THE SCORE INFORMS THE CALL.</text>
  <text x="86" y="1082" fill="#ffffff" font-size="42" font-family="Arial, Helvetica, sans-serif" font-weight="900">A HUMAN STILL OWNS IT.</text>
</svg>`)

const rendered = await sharp({ create: { width: 1080, height: 1920, channels: 4, background: '#061525' } })
  .composite([
    { input: overlay, left: 0, top: 0 },
    { input: proof, left: 70, top: 651 },
    { input: subject, left: 90, top: 1120 },
    { input: logo, left: 884, top: 1770 },
  ])
  .png()
  .toBuffer()

await mkdir(baselineRoot, { recursive: true })
await mkdir(path.dirname(artifactOutput), { recursive: true })
await Promise.all([
  copyFile(struggleSource, path.join(baselineRoot, 'struggle-to-system.png')),
  copyFile(stealSource, path.join(baselineRoot, 'steal-this.png')),
  copyFile(shortsBaselineSource, path.join(baselineRoot, 'approved-short-baseline.png')),
  writeFile(output, rendered),
  writeFile(artifactOutput, rendered),
])

const receipt = {
  version: 'jev-thumbnail-selection/v4',
  receipt_id: 'thumbnail:jev:youtube-shorts:20261018:v4',
  baseline_receipt_id: 'thumbnail-outlier-review/2026-10-16',
  public_cohort_id: 'cohort:youtube_shorts:ai-governance-copy-pair:20261018:v2',
  observed_at: '2026-10-18T12:00:00.000Z',
  title: 'AI Scored It. Who Makes the Call?',
  headline: 'AI SCORED IT. / WHO DECIDES?',
  decision: 'advance_for_human_qa',
  composition: 'A 9:16 first-party AmaduTown Shorts composition: approved Vambah subject, short tension hook, one Jev product-proof object, and established navy/yellow/coral brand treatment.',
  aspect_ratio: '9:16',
  copy_pair: {
    title: 'AI Scored It. Who Makes the Call?',
    thumbnail_hook: 'AI SCORED IT. / WHO DECIDES?',
    relationship: 'near_duplicate',
    exact_strings_are_distinct: true,
    strategy_status: 'conservative_unscored',
    rationale: 'The strings are different but preserve the same decision-ownership promise. The live cohort does not have enough distinct-pair samples to support a complementary-teaser performance claim.',
    source_example_video_ids: ['gTHQpAkgjy4', 'sA6UA2fMNHg', 'SQEMkQu0b6o'],
  },
  source_assets: [
    { path: subjectSource, sha256: hash(subjectBytes), use: 'approved Vambah subject', status: 'verified_openable' },
    { path: fieldGuide, sha256: hash(fieldBytes), use: 'approved Jev product proof', status: 'verified_openable' },
    { path: logoSource, sha256: hash(logoBytes), use: 'AmaduTown brand treatment', status: 'verified_openable' },
    { path: shortsBaselineSource, sha256: hash(shortsBaselineBytes), use: 'approved 9:16 Shorts structure', status: 'verified_openable' },
    { path: liveCohortSource, sha256: hash(liveCohortBytes), use: 'fresh topic-specific copy-pair evidence', status: 'verified_openable' },
  ],
  element_bindings: [
    { element: 'subject', source: 'V YT Thumbnail Curious.jpg', support: 'supports', limitation: 'Does not support the exact hook, product claim, or public performance.' },
    { element: 'hook', source: 'approved first-party thumbnail library', support: 'supports', limitation: 'Supports short tension-led treatment, not the exact wording.' },
    { element: 'product_proof', source: 'Jev operator field guide', support: 'supports', limitation: 'Does not support audience or platform-performance claims.' },
    { element: 'aspect_ratio', source: 'approved Short baseline receipt', support: 'supports', limitation: 'Supports 1080×1920 9:16 only.' },
    { element: 'brand_treatment', source: 'AmaduTown first-party baselines and logo', support: 'supports', limitation: 'Does not support public-outlier claims.' },
  ],
  public_outlier_boundary: 'The eight included public Shorts are topic-specific copy-pair and normalized-performance context only. They do not provide brand, subject, aspect-ratio, or candidate design-fit authority.',
  output: { width: 1080, height: 1920, aspect_ratio: '9:16', sha256: hash(rendered), public_path: '/review-assets/social-content/jev-youtube-short-thumbnail-v4.png' },
  rights_receipts: ['rights:jev:owned-public-assets-20261014'],
  privacy_receipt: 'privacy:jev:public-safe-20261014',
  provider_calls_executed: 0,
}
await writeFile(receiptOutput, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt.output, null, 2))
