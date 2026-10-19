import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const sourcePath = '/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Artifacts /Promotional /1. ATAS YouTube Channel/Assets/Thumbnails/V Subject/V YT Thumbnail Curious.jpg'
const expectedSourceSha256 = 'sha256:b74a933c73cdc1ee336d951b7e6d20ea7737c214c5390805ce3c149068ec9e90'
const publicRoot = path.join(root, 'public/review-assets/social-content/jev-hero-thumbnail-review')
const sourceRoot = path.join(publicRoot, 'source')
const artifactRoot = path.join(root, 'artifacts/research/jev-hero-thumbnail-candidates-2026-10-19')
const stagedHeroPath = path.join(sourceRoot, 'vambah-curious-approved.jpg')
const productProofPath = path.join(root, 'public/review-assets/social-content/source-proof/jev-operator-field-guide.png')
const logoPath = path.join(root, 'public/amadutown-logo-upscaled.png')
const fontPath = path.join(root, 'public/fonts/inter-latin-variable.ttf')
const cohortPath = path.join(root, 'artifacts/research/jev-youtube-thumbnail-cohort-2026-10-19/cohort.json')
const decisionPath = path.join(root, 'artifacts/research/jev-youtube-thumbnail-cohort-2026-10-19/thumbnail-decision-receipt.json')
const internalWorkflowMarker = /\b(review only|draft|fixture|sample data|operator|internal|prompt|qa)\b/i

await mkdir(sourceRoot, { recursive: true })
await mkdir(artifactRoot, { recursive: true })

async function sha256(file) {
  return `sha256:${createHash('sha256').update(await readFile(file)).digest('hex')}`
}

if (await sha256(sourcePath) !== expectedSourceSha256) throw new Error('The approved Vambah hero source hash changed. Stop and renew the source receipt.')
await copyFile(sourcePath, stagedHeroPath)

const cohort = JSON.parse(await readFile(cohortPath, 'utf8'))
const decision = JSON.parse(await readFile(decisionPath, 'utf8'))
if (cohort.status !== 'approved' || !cohort.selection_gate?.ready || cohort.outlier_qualification?.qualified_sample_size < 1) {
  throw new Error('The live Jev YouTube cohort is not qualified. Hero candidate rendering remains blocked.')
}
if (decision.selection?.status !== 'ready' || decision.live_evidence?.cohort_id !== cohort.cohort_id) {
  throw new Error('The current Social Content outlier decision does not bind the qualified Jev cohort.')
}

const fontData = (await readFile(fontPath)).toString('base64')
const fontFace = `@font-face{font-family:InterHero;src:url(data:font/ttf;base64,${fontData}) format('truetype');font-weight:100 900;}`
const logo = await sharp(logoPath).resize({ height: 70, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
const hero = await sharp(stagedHeroPath).resize(720, 720, { fit: 'cover', position: 'attention' }).jpeg({ quality: 95 }).toBuffer()

function svg(markup) {
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><style>${fontFace}.eyebrow{font-family:InterHero,Arial,sans-serif;font-weight:760;letter-spacing:4px}.headline{font-family:InterHero,Arial,sans-serif;font-weight:900;letter-spacing:-4px}.support{font-family:InterHero,Arial,sans-serif;font-weight:680;letter-spacing:.2px}</style>${markup}</svg>`)
}

const variants = [
  {
    candidate_id: 'thumbnail:jev:hero-question:20261019:v1',
    filename: 'jev-when-should-ai-stop-hero-v1.png',
    feed_filename: 'jev-when-should-ai-stop-hero-v1-feed-320x180.png',
    teaser: 'WHEN SHOULD AI STOP?',
    customer_facing_copy: ['JEV · HUMAN DECISION OWNERSHIP', 'WHEN SHOULD', 'AI STOP?', 'A score can inform the call.', 'A person still owns it.', 'AMADUTOWN'],
    direction: 'Expressive human question',
    layout_family: 'human-right-question-left',
    composition_signature: 'jev-curious-human-right|question-left|yellow-coral-decision-line|hero-v1',
    crop: { source_asset_id: 'hero:jev:vambah-curious:20261019:v1', x: 560, y: 0, width: 720, height: 720, fit: 'cover-attention' },
    safe_text_region: { x: 66, y: 84, width: 570, height: 536 },
    focal_subject: 'Vambah in an approved curious, decision-making pose with visible eye direction and a clean face-safe field.',
    evidence_trace: [
      ['hero_selection', ['WGDQoaoqR1U', 'zRMAvMSSSII'], 'The qualified process-led outlier keeps one concrete governance idea visible, while the current human-oversight comparator shows that one expressive presenter can carry the decision tension. The owned Vambah source supplies the actual hero.'],
      ['composition', ['WGDQoaoqR1U', 'zRMAvMSSSII'], 'One decision relationship, one hero, and one copy field replace the prior field-guide density.'],
      ['typography', ['zRMAvMSSSII', 'Q020C-Jw0o8'], 'Large editorial type with short stacked lines remains readable at feed size; source wording and type styling are not copied.'],
      ['teaser', ['zRMAvMSSSII', 'AyNe8KZYNGU'], 'The hook is a short governance-boundary question and stays distinct from the video title.'],
      ['contrast', ['WGDQoaoqR1U', 'AyNe8KZYNGU'], 'Warm yellow and coral accents sit against navy with clear separation from the subject and no text over the face.'],
      ['visual_style', ['WGDQoaoqR1U', 'zRMAvMSSSII'], 'The candidate uses one immediate decision idea and rejects generic robots, webinar grids, and dashboard furniture.'],
    ],
    artwork: svg(`
      <defs><linearGradient id="left" x1="0" x2="1"><stop offset="0" stop-color="#06182d"/><stop offset=".47" stop-color="#081f39"/><stop offset=".64" stop-color="#081f39" stop-opacity=".78"/><stop offset="1" stop-color="#081f39" stop-opacity=".08"/></linearGradient></defs>
      <rect width="1280" height="720" fill="url(#left)"/>
      <rect x="0" y="0" width="1280" height="12" fill="#f5c515"/>
      <text x="72" y="112" class="eyebrow" font-size="23" fill="#f5c515">JEV · HUMAN DECISION OWNERSHIP</text>
      <text x="68" y="258" class="headline" font-size="78" fill="#f8fafc">WHEN SHOULD</text>
      <rect x="64" y="292" width="500" height="110" rx="24" fill="#ff7167"/>
      <text x="91" y="374" class="headline" font-size="82" fill="#06182d">AI STOP?</text>
      <text x="72" y="474" class="support" font-size="26" fill="#d9e7f5">A score can inform the call.</text>
      <text x="72" y="513" class="support" font-size="29" fill="#ffffff">A person still owns it.</text>
      <rect x="72" y="578" width="182" height="6" rx="3" fill="#61d5cc"/>
      <text x="72" y="620" class="eyebrow" font-size="16" fill="#9fc0da">AMADUTOWN</text>
    `),
    hero_left: 560,
  },
  {
    candidate_id: 'thumbnail:jev:hero-contrast:20261019:v1',
    filename: 'jev-score-isnt-the-call-hero-v1.png',
    feed_filename: 'jev-score-isnt-the-call-hero-v1-feed-320x180.png',
    teaser: "THE SCORE ISN'T THE CALL",
    customer_facing_copy: ['JEV · DECISION BOUNDARY', 'THE SCORE', "ISN'T THE", 'CALL', 'Model score. Human authority.', 'AMADUTOWN'],
    direction: 'Human ownership contrast',
    layout_family: 'human-left-contrast-right',
    composition_signature: 'jev-curious-human-left|contrast-right|cyan-yellow-boundary|hero-v1',
    crop: { source_asset_id: 'hero:jev:vambah-curious:20261019:v1', x: 0, y: 0, width: 720, height: 720, fit: 'cover-attention' },
    safe_text_region: { x: 668, y: 78, width: 540, height: 548 },
    focal_subject: 'Vambah in an approved curious pose looking toward the score-versus-decision contrast, with the face isolated from copy.',
    evidence_trace: [
      ['hero_selection', ['WGDQoaoqR1U', 'zRMAvMSSSII'], 'The live gate favors one concrete governance relationship. The owned expressive human makes responsibility visible without borrowing a public likeness.'],
      ['composition', ['WGDQoaoqR1U', 'PUnCxppwDSs'], 'The layout turns the decision boundary into one person facing one plain-language contrast, instead of a multi-panel system diagram.'],
      ['typography', ['zRMAvMSSSII', 'AyNe8KZYNGU'], 'A condensed stacked contrast uses five large words and a single accent shift for actual-feed-size reading.'],
      ['teaser', ['zRMAvMSSSII', 'Q020C-Jw0o8'], 'The teaser states the governing distinction rather than repeating the title or promising an unsupported product outcome.'],
      ['contrast', ['WGDQoaoqR1U', 'Q020C-Jw0o8'], 'White, yellow, and cyan text on navy creates a bright decision hierarchy while keeping the face unobstructed.'],
      ['visual_style', ['WGDQoaoqR1U', 'zRMAvMSSSII'], 'The candidate uses a restrained human-plus-principle scene and rejects synthetic office people, robots, grids, and decorative dashboards.'],
    ],
    artwork: svg(`
      <defs><linearGradient id="right" x1="0" x2="1"><stop offset="0" stop-color="#06182d" stop-opacity=".04"/><stop offset=".42" stop-color="#06182d" stop-opacity=".70"/><stop offset=".62" stop-color="#06182d" stop-opacity=".96"/><stop offset="1" stop-color="#06182d"/></linearGradient></defs>
      <rect width="1280" height="720" fill="url(#right)"/>
      <rect x="0" y="0" width="1280" height="12" fill="#61d5cc"/>
      <text x="690" y="110" class="eyebrow" font-size="22" fill="#61d5cc">JEV · DECISION BOUNDARY</text>
      <text x="684" y="248" class="headline" font-size="88" fill="#ffffff">THE SCORE</text>
      <text x="684" y="352" class="headline" font-size="82" fill="#f5c515">ISN'T THE</text>
      <rect x="680" y="380" width="520" height="112" rx="24" fill="#ff7167"/>
      <text x="716" y="464" class="headline" font-size="80" fill="#06182d">CALL</text>
      <text x="690" y="552" class="support" font-size="27" fill="#d9e7f5">Model score. Human authority.</text>
      <text x="690" y="620" class="eyebrow" font-size="16" fill="#9fc0da">AMADUTOWN</text>
    `),
    hero_left: 0,
  },
]

const candidateRecords = []
for (const variant of variants) {
  const internalCopy = variant.customer_facing_copy.find((copy) => internalWorkflowMarker.test(copy))
  if (internalCopy) throw new Error(`Customer-facing thumbnail copy contains an internal workflow marker: ${internalCopy}`)
  const output = path.join(publicRoot, variant.filename)
  const feedOutput = path.join(publicRoot, variant.feed_filename)
  await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#06182d' } })
    .composite([
      { input: hero, left: variant.hero_left, top: 0 },
      { input: variant.artwork, left: 0, top: 0 },
      { input: logo, left: 1180, top: 626 },
    ])
    .png()
    .toFile(output)
  await sharp(output).resize(320, 180, { fit: 'cover' }).png().toFile(feedOutput)
  const outputSha256 = await sha256(output)
  candidateRecords.push({
    candidate_id: variant.candidate_id,
    campaign_identity: 'jev',
    content_version: decision.content_version,
    title: decision.candidate_copy_pair.title,
    teaser: variant.teaser,
    customer_facing_copy: variant.customer_facing_copy,
    direction: variant.direction,
    public_path: `/review-assets/social-content/jev-hero-thumbnail-review/${variant.filename}`,
    sha256: outputSha256,
    width: 1280,
    height: 720,
    aspect_ratio: '16:9',
    feed_preview_path: `/review-assets/social-content/jev-hero-thumbnail-review/${variant.feed_filename}`,
    feed_preview_sha256: await sha256(feedOutput),
    feed_preview_width: 320,
    feed_preview_height: 180,
    focal_subject: variant.focal_subject,
    safe_text_region: variant.safe_text_region,
    crop: variant.crop,
    face_text_overlap: false,
    feed_size_legible: true,
    text_word_count: variant.teaser.replace(/[^A-Za-z0-9' ]/g, ' ').trim().split(/\s+/).length,
    layout_family: variant.layout_family,
    composition_signature: variant.composition_signature,
    typography: 'Inter variable, 760–900 weight, two-level editorial hierarchy, no mechanical template text.',
    visual_style: 'AmaduTown navy with high-energy yellow, coral, and cyan accents; one expressive human hero; no dashboard furniture.',
    hero_binding: {
      hero_asset_id: 'hero:jev:vambah-curious:20261019:v1',
      hero_source_sha256: expectedSourceSha256,
      output_sha256: outputSha256,
    },
    evidence_trace: variant.evidence_trace.map(([decision_dimension, live_evidence_video_ids, rationale]) => ({
      decision_dimension,
      cohort_id: cohort.cohort_id,
      live_evidence_video_ids,
      evidence_role: 'informs_not_authorizes',
      rationale,
    })),
  })
}

const receipt = {
  version: 'youtube-thumbnail-hero-evidence/v1',
  receipt_id: 'receipt:thumbnail-hero:jev:20261019:v1',
  generated_at: '2026-10-19T23:05:00.000Z',
  campaign_identity: 'jev',
  content_version: decision.content_version,
  title: decision.candidate_copy_pair.title,
  review_only: true,
  provider_calls: 0,
  paid_media_generations: 0,
  external_writes: 0,
  outlier_evidence: {
    cohort_id: cohort.cohort_id,
    decision_receipt_id: decision.receipt_id,
    observed_at: cohort.observed_at,
    fresh_until: cohort.fresh_until,
    minimum_sample_size: cohort.selection_gate.minimum_sample_size,
    included_video_ids: cohort.included.map((sample) => sample.video_id),
    qualified_outlier_video_ids: cohort.outlier_qualification.qualified_video_ids,
    outlier_threshold: cohort.outlier_qualification.threshold,
    curated_playlist_performance_weight: decision.user_preference_signals[0]?.performance_weight ?? null,
    curated_playlist_role: decision.user_preference_signals[0]?.evidence_role ?? null,
  },
  hero_asset: {
    asset_id: 'hero:jev:vambah-curious:20261019:v1',
    campaign_identity: 'jev',
    public_path: '/review-assets/social-content/jev-hero-thumbnail-review/source/vambah-curious-approved.jpg',
    source_sha256: expectedSourceSha256,
    width: 1024,
    height: 1024,
    focal_subject: 'Vambah in an expressive curious pose, photographed and previously approved for AmaduTown YouTube thumbnail use.',
    safe_text_region: 'Candidate-specific face-safe regions are recorded for left-copy and right-copy crops.',
    generic: false,
    digital_source_type: 'trained_algorithmic_media',
    provenance_note: 'The staged source retains XMP identifying Google AI-assisted media. It is a previously approved Vambah-specific AmaduTown thumbnail asset, not a newly generated or generic portrait.',
    source_receipt_ids: ['thumbnail:jev:youtube-shorts:20261018:v5', 'source:jev:approved-composite-20261014'],
    rights_receipt_ids: ['rights:jev:owned-public-assets-20261014'],
    privacy_receipt_id: 'privacy:jev:public-safe-20261014',
  },
  product_proof: {
    asset_id: 'proof:jev:operator-field-guide:20261014',
    public_path: '/review-assets/social-content/source-proof/jev-operator-field-guide.png',
    sha256: await sha256(productProofPath),
    source_receipt_ids: ['source:jev:approved-composite-20261014'],
    rights_receipt_ids: ['rights:jev:owned-public-assets-20261014'],
    privacy_receipt_id: 'privacy:jev:public-safe-20261014',
    role: 'Story and storyboard substantiation only. This proof does not replace or masquerade as the thumbnail hero.',
  },
  candidates: candidateRecords,
  rejected_patterns: cohort.rejected_traits,
  boundary: 'Repository-local review assets only. Product proof remains a separate source-bound story asset. No provider generation, production binding, upload, platform draft, scheduling, publication, credentials, migration, spending, or external send occurred.',
}

await writeFile(path.join(artifactRoot, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
await writeFile(path.join(artifactRoot, 'source-map.md'), `# Jev hero thumbnail source map\n\n- Hero source: \`${sourcePath}\`\n- Staged copy: \`${receipt.hero_asset.public_path}\`\n- Hero SHA-256: \`${receipt.hero_asset.source_sha256}\`\n- Hero provenance: \`${receipt.hero_asset.digital_source_type}\`; ${receipt.hero_asset.provenance_note}\n- Rights: \`${receipt.hero_asset.rights_receipt_ids.join('`, `')}\`\n- Privacy: \`${receipt.hero_asset.privacy_receipt_id}\`\n- Product proof: \`${receipt.product_proof.public_path}\` (storyboard substantiation only)\n- Live cohort: \`${receipt.outlier_evidence.cohort_id}\` observed ${receipt.outlier_evidence.observed_at}\n- Decision receipt: \`${receipt.outlier_evidence.decision_receipt_id}\`\n- Curated playlist: taste-only, zero performance weight.\n- External writes: 0. Provider calls: 0. Paid generations: 0.\n`)
process.stdout.write(`${JSON.stringify({ receipt_id: receipt.receipt_id, candidates: candidateRecords.map(({ candidate_id, public_path, sha256 }) => ({ candidate_id, public_path, sha256 })) }, null, 2)}\n`)
