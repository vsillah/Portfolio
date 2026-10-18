import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputRoot = path.resolve(root, 'public/review-assets/social-content/youtube-packaging')
const sourceProofRoot = path.resolve(root, 'public/review-assets/social-content/source-proof')
const logoPath = path.resolve(root, 'public/amadutown-logo-upscaled.png')
const batchIdentity = 'social-campaign-youtube:20261018:v3'

function requiredIdentityRemix(prefix, campaignKey, publicFilename, alternatePublicFilename) {
  const imagePath = process.env[`${prefix}_HEYGEN_IMAGE_PATH`]
  const sourceUrl = process.env[`${prefix}_HEYGEN_IMAGE_URL`]
  const receiptId = process.env[`${prefix}_HEYGEN_IDENTITY_RECEIPT_ID`]
  const lookId = process.env[`${prefix}_HEYGEN_LOOK_ID`]
  const environment = process.env[`${prefix}_HEYGEN_ENVIRONMENT`]
  const alternateImagePath = process.env[`${prefix}_HEYGEN_ALTERNATE_IMAGE_PATH`]
  const alternateSourceUrl = process.env[`${prefix}_HEYGEN_ALTERNATE_IMAGE_URL`]
  const alternateLookId = process.env[`${prefix}_HEYGEN_ALTERNATE_LOOK_ID`]
  const alternateEnvironment = process.env[`${prefix}_HEYGEN_ALTERNATE_ENVIRONMENT`]
  if (!imagePath || !sourceUrl || !receiptId || !lookId || !environment || !alternateImagePath || !alternateSourceUrl || !alternateLookId || !alternateEnvironment) {
    throw new Error(`${campaignKey}: fresh HeyGen Pro identity remix is required. Supply primary and alternate ${prefix}_HEYGEN image paths, source URLs, look IDs, environments, and the campaign identity receipt.`)
  }
  if (!/^https:\/\//.test(sourceUrl) || !/^https:\/\//.test(alternateSourceUrl) || !/^heygen:identity-remix:[a-z0-9:-]+:v\d+$/.test(receiptId)) {
    throw new Error(`${campaignKey}: HeyGen image URL or identity-remix receipt is invalid.`)
  }
  if (imagePath === alternateImagePath || sourceUrl === alternateSourceUrl || lookId === alternateLookId) throw new Error(`${campaignKey}: primary and alternate HeyGen looks must be distinct.`)
  return {
    campaignKey,
    imagePath: path.resolve(imagePath),
    sourceUrl,
    receiptId,
    lookId,
    environment,
    stagedPath: path.resolve(sourceProofRoot, publicFilename),
    publicPath: `/review-assets/social-content/source-proof/${publicFilename}`,
    alternate: {
      imagePath: path.resolve(alternateImagePath),
      sourceUrl: alternateSourceUrl,
      lookId: alternateLookId,
      environment: alternateEnvironment,
      stagedPath: path.resolve(sourceProofRoot, alternatePublicFilename),
      publicPath: `/review-assets/social-content/source-proof/${alternatePublicFilename}`,
    },
  }
}

const identityRemixes = {
  darkCastle: requiredIdentityRemix('DARK_CASTLE', 'dark-castle', 'dark-castle-heygen-identity-v3.png', 'dark-castle-heygen-identity-alternate-v3.png'),
  aiAudit: requiredIdentityRemix('AI_AUDIT', 'ai-audit', 'ai-audit-heygen-identity-v3.png', 'ai-audit-heygen-identity-alternate-v3.png'),
}

if (
  identityRemixes.darkCastle.imagePath === identityRemixes.aiAudit.imagePath
  || identityRemixes.darkCastle.sourceUrl === identityRemixes.aiAudit.sourceUrl
  || identityRemixes.darkCastle.lookId === identityRemixes.aiAudit.lookId
  || identityRemixes.darkCastle.environment === identityRemixes.aiAudit.environment
) {
  throw new Error('The Dark Castle and AI Audit thumbnails require distinct HeyGen Pro image assets, approved looks, and background environments.')
}

const jobs = [
  {
    id: 'dark-castle',
    decisionReceiptPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'),
    expectedDecisionReceiptId: 'decision:thumbnail:dark-castle:20261018:v2',
    expectedCohortId: 'cohort:youtube:chess-decision-learning:20261018:v1',
    sourcePath: path.resolve(root, 'public/review-assets/social-content/dark-castle-customer-facing-poster.png'),
    sourcePublicPath: '/review-assets/social-content/dark-castle-customer-facing-poster.png',
    sourceReceipt: 'sha256:e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78',
    sourceLabel: 'Dark Castle gameplay proof',
    identityRemix: identityRemixes.darkCastle,
    title: 'I Rebuilt the Chess Lesson Around the Decision',
    hook: ['REMEMBER THE WHY'],
    hookExact: 'REMEMBER THE WHY',
    accent: '#F5C518',
    output: 'dark-castle-remember-the-why-v3.png',
    receipt: 'dark-castle-thumbnail-selection-receipt.json',
    composition: {
      version: 'youtube-thumbnail-composition/v1',
      layout_family: 'teacher-board-proof-split',
      dominant_subject: 'Fresh campaign-specific approved Vambah identity remix teaching beside the owned Dark Castle board proof',
      focal_hierarchy: ['approved human anchor', 'owned board position', 'short learning hook'],
      text_placement: 'bottom left over the identity environment',
      batch_identity: batchIdentity,
      composition_signature: 'identity-left|board-right|hook-bottom-left',
      exception_basis: 'none',
      exception_receipt_ids: [],
    },
  },
  {
    id: 'ai-audit',
    decisionReceiptPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'),
    expectedDecisionReceiptId: 'decision:thumbnail:ai-audit:20261018:v2',
    expectedCohortId: 'cohort:youtube:ai-cost-audit-roi:20261018:v1',
    sourcePath: path.resolve(root, 'public/audit_calculator_img.png'),
    sourcePublicPath: '/review-assets/social-content/source-proof/ai-audit-calculator.png',
    sourceReceipt: 'sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97',
    sourceLabel: 'AI Audit Calculator result screen',
    identityRemix: identityRemixes.aiAudit,
    title: 'The AI Cost That Never Appears on the Invoice',
    hook: ['WHO OWNS', 'THE CLEANUP?'],
    hookExact: 'WHO OWNS THE CLEANUP?',
    accent: '#E0B52F',
    output: 'ai-audit-who-owns-the-cleanup-v3.png',
    receipt: 'ai-audit-thumbnail-selection-receipt.json',
    stageSourceAs: path.resolve(sourceProofRoot, 'ai-audit-calculator.png'),
    composition: {
      version: 'youtube-thumbnail-composition/v1',
      layout_family: 'human-anchor-simplified-score-proof',
      dominant_subject: 'Fresh campaign-specific approved Vambah identity remix confronting the owned calculator result',
      focal_hierarchy: ['ownership question', 'approved human anchor', 'simplified owned score card'],
      text_placement: 'left field above the score proof',
      batch_identity: batchIdentity,
      composition_signature: 'question-left|score-card-left|portrait-right',
      exception_basis: 'none',
      exception_receipt_ids: [],
    },
  },
]

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function assertCanonicalInputs(job, decision) {
  if (decision.version !== 'youtube-thumbnail-decision-receipt/v1' || decision.route !== 'social-content-outlier-decision/v1' || decision.receipt_id !== job.expectedDecisionReceiptId) throw new Error(`${job.id}: input is not the expected Social Content decision receipt.`)
  if (decision.content_version !== '2026-10-18T00:00:00.000Z' || !/^decision:[a-z0-9:-]+:v\d+$/.test(decision.output_version)) throw new Error(`${job.id}: decision receipt is not version-bound to the current content.`)
  const { version, receipt_id, route, input_version, output_version, selection, ...decisionInput } = decision
  if (input_version !== sha256(Buffer.from(JSON.stringify(decisionInput)))) throw new Error(`${job.id}: decision receipt input fingerprint does not match its evidence payload.`)
  const live = decision.live_evidence
  if (live?.cohort_id !== job.expectedCohortId || !Array.isArray(live.normalization_formula) || live.normalization_formula.length === 0) throw new Error(`${job.id}: decision receipt lacks the expected normalized live cohort.`)
  if (!Date.parse(live.observed_at) || !Date.parse(live.fresh_until) || Date.parse(live.fresh_until) < Date.now()) throw new Error(`${job.id}: live topic evidence is missing or stale.`)
  const included = live.comparisons?.filter((sample) => sample.decision === 'included') ?? []
  const qualified = included.filter((sample) => sample.outlier_qualified)
  if (included.length < live.minimum_sample_size) throw new Error(`${job.id}: live cohort did not meet its declared sample gate.`)
  if (!included.every((sample) => sample.source_url && sample.decision_reason && Number.isFinite(sample.view_count) && Number.isFinite(sample.subscriber_count) && sample.published_at && sample.observed_at && sample.channel_baseline_size >= 4 && Number.isFinite(sample.normalized_performance_score))) throw new Error(`${job.id}: at least one live comparison lacks source, metrics, normalization, or decision evidence.`)
  if (!Number.isFinite(live.outlier_threshold) || qualified.length === 0 || qualified.some((sample) => sample.normalized_performance_score < live.outlier_threshold)) throw new Error(`${job.id}: live evidence does not satisfy the declared outlier threshold.`)
  if (decision.candidate_identity?.title !== job.title || decision.candidate_identity?.thumbnail_hook !== job.hookExact || decision.candidate_identity?.composition_signature !== job.composition.composition_signature) throw new Error(`${job.id}: exact candidate identity or selected composition is missing or stale.`)
  if (decision.candidate_copy_pair?.title !== job.title || decision.candidate_copy_pair?.thumbnail_hook !== job.hookExact || decision.candidate_copy_pair?.exact_strings_are_distinct !== true) throw new Error(`${job.id}: exact title-thumbnail copy binding is missing or stale.`)
  if (decision.candidate_copy_pair?.performance_claim !== 'unscored' || decision.candidate_copy_pair?.support_scope !== 'editorial_hypothesis_only') throw new Error(`${job.id}: unsupported copy-pair performance claim.`)
  if ((decision.user_preference_signals ?? []).some((signal) => signal.performance_weight !== 0 || signal.evidence_role !== 'taste_calibration_only' || signal.performance_status !== 'unscored' || !signal.captured_at || !signal.item_identities?.length)) throw new Error(`${job.id}: user preference evidence crossed its taste-calibration-only boundary.`)
  if (selection?.status !== 'ready' || selection.selected_composition !== job.composition.layout_family || selection.product_proof_binding !== decision.candidate_identity.product_proof_receipt_id) throw new Error(`${job.id}: upstream selection is not Ready for this exact composition and product proof.`)
}

function darkCastleOverlay(job) {
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="split" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#061426" stop-opacity="0.18"/><stop offset="0.40" stop-color="#061426" stop-opacity="0.46"/><stop offset="0.54" stop-color="#061426" stop-opacity="0.92"/><stop offset="1" stop-color="#061426" stop-opacity="0.08"/></linearGradient>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#061426" stop-opacity="0"/><stop offset="0.42" stop-color="#061426" stop-opacity="0.72"/><stop offset="1" stop-color="#061426" stop-opacity="0.96"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="1280" height="720" fill="url(#split)"/>
    <rect x="0" y="420" width="590" height="300" fill="url(#bottom)"/>
    <circle cx="931" cy="323" r="63" fill="none" stroke="${job.accent}" stroke-width="12" filter="url(#glow)"/>
    <rect x="58" y="500" width="126" height="10" rx="5" fill="${job.accent}"/>
    <text x="58" y="590" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="900" letter-spacing="-2">REMEMBER</text>
    <text x="58" y="680" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="900" letter-spacing="-3">THE WHY</text>
  </svg>`)
}

function aiAuditOverlay(job) {
  const lines = job.hook.map((line, index) => `<tspan x="58" dy="${index === 0 ? 0 : 76}">${escapeXml(line)}</tspan>`).join('')
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#061426"/><stop offset="0.58" stop-color="#061426"/><stop offset="0.62" stop-color="#061426" stop-opacity="0.35"/><stop offset="0.68" stop-color="#061426" stop-opacity="0.06"/><stop offset="1" stop-color="#061426" stop-opacity="0.02"/></linearGradient></defs>
    <rect width="1280" height="720" fill="url(#shade)"/>
    <rect x="765" width="8" height="720" fill="${job.accent}"/>
    <rect x="58" y="82" width="108" height="9" rx="4.5" fill="${job.accent}"/>
    <text x="58" y="175" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="900" letter-spacing="-2">${lines}</text>
    <text x="70" y="495" fill="${job.accent}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="1">REAL AUDIT RESULT</text>
  </svg>`)
}

async function renderThumbnail(job, outputPath) {
  const logo = await sharp(logoPath).resize({ height: job.id === 'dark-castle' ? 76 : 68 }).png().toBuffer()
  if (job.id === 'dark-castle') {
    const identity = await sharp(job.identityRemix.imagePath).resize(560, 720, { fit: 'cover', position: 'attention' }).modulate({ brightness: 0.82, saturation: 0.9 }).png().toBuffer()
    const board = await sharp(job.sourcePath).extract({ left: 238, top: 298, width: 505, height: 505 }).resize(720, 720).sharpen().png().toBuffer()
    const ambient = await sharp(board).resize(1280, 720, { fit: 'cover' }).modulate({ brightness: 0.28, saturation: 0.62 }).blur(18).png().toBuffer()
    await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#061426' } })
      .composite([
        { input: ambient, left: 0, top: 0 },
        { input: identity, left: 0, top: 0 },
        { input: board, left: 560, top: 0 },
        { input: darkCastleOverlay(job), left: 0, top: 0 },
        { input: logo, left: 54, top: 32 },
      ])
      .png({ compressionLevel: 9 })
      .toFile(outputPath)
    return
  }

  const portrait = await sharp(job.identityRemix.imagePath).resize(510, 720, { fit: 'cover', position: 'attention' }).modulate({ brightness: 0.86, saturation: 0.88 }).png().toBuffer()
  const calculator = await sharp(job.sourcePath).extract({ left: 35, top: 410, width: 650, height: 150 }).resize(600, 140, { fit: 'cover' }).sharpen().png().toBuffer()
  const calculatorCard = await sharp({ create: { width: 620, height: 160, channels: 4, background: '#F5C518' } })
    .composite([{ input: calculator, left: 10, top: 10 }])
    .png()
    .toBuffer()
  await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#061426' } })
    .composite([
      { input: portrait, left: 770, top: 0 },
      { input: aiAuditOverlay(job), left: 0, top: 0 },
      { input: calculatorCard, left: 58, top: 510 },
      { input: logo, left: 1180, top: 625 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath)
}

await mkdir(outputRoot, { recursive: true })
await mkdir(sourceProofRoot, { recursive: true })

for (const job of jobs) {
  const decision = JSON.parse(await readFile(job.decisionReceiptPath, 'utf8'))
  assertCanonicalInputs(job, decision)
  if (job.stageSourceAs) await copyFile(job.sourcePath, job.stageSourceAs)
  await sharp(job.identityRemix.imagePath).png({ compressionLevel: 9 }).toFile(job.identityRemix.stagedPath)
  await sharp(job.identityRemix.alternate.imagePath).png({ compressionLevel: 9 }).toFile(job.identityRemix.alternate.stagedPath)

  const outputPath = path.join(outputRoot, job.output)
  await renderThumbnail(job, outputPath)

  const outputBytes = await readFile(outputPath)
  const outputPublicPath = `/review-assets/social-content/youtube-packaging/${job.output}`
  const receipt = {
    version: 'youtube-thumbnail-selection/v3',
    receipt_id: `thumbnail:${job.id}:youtube-long-form:20261018:v3`,
    decision_receipt_id: decision.receipt_id,
    decision_input_version: decision.input_version,
    decision_output_version: decision.output_version,
    content_version: decision.content_version,
    cohort_id: decision.live_evidence.cohort_id,
    observed_at: decision.live_evidence.observed_at,
    title: job.title,
    thumbnail_hook: job.hookExact,
    target: { channel: 'youtube', format: 'long_form', width: 1280, height: 720, aspect_ratio: '16:9' },
    candidate_copy_pair: decision.candidate_copy_pair,
    adopted_traits: decision.adopted_traits,
    rejected_traits: decision.rejected_traits,
    user_preference_contribution: decision.user_preference_signals.map((signal) => ({
      source_url: signal.source_url,
      captured_at: signal.captured_at,
      item_count: signal.item_identities.length,
      applied_traits: signal.applied_traits,
      evidence_role: signal.evidence_role,
      performance_weight: signal.performance_weight,
      performance_status: signal.performance_status,
    })),
    selection_rationale: job.id === 'dark-castle'
      ? 'The short learning hook and owned board position read as one idea at feed size. One highlighted decision square supplies the proof object. Public examples bound the editorial pattern; they do not supply the composition or a causal performance claim.'
      : 'The ownership question and approved first-party human anchor form the first read. One cropped owned score card supplies product proof without turning the thumbnail into a dashboard. Public examples bound the editorial pattern; they do not supply the composition or a causal performance claim.',
    first_party_source: { label: job.sourceLabel, artifact_url: job.sourcePublicPath, receipt_id: job.sourceReceipt, rights_status: 'owned_product_proof' },
    first_party_supporting_sources: [{
      label: `Fresh HeyGen Pro identity remix for ${job.id === 'dark-castle' ? 'Dark Castle Chess' : 'AI Audit Calculator'}`,
      artifact_url: job.identityRemix.publicPath,
      source_url: job.identityRemix.sourceUrl,
      receipt_id: job.identityRemix.receiptId,
      rights_status: 'approved_identity_remix_review_only',
      look_id: job.identityRemix.lookId,
      background_environment: job.identityRemix.environment,
      sha256: sha256(await readFile(job.identityRemix.imagePath)),
    }],
    identity_remix_rotation: {
      provider: 'heygen_pro',
      generation_receipt_id: job.identityRemix.receiptId,
      included_credit_count: 1,
      primary: {
        artifact_url: job.identityRemix.publicPath,
        source_url: job.identityRemix.sourceUrl,
        look_id: job.identityRemix.lookId,
        background_environment: job.identityRemix.environment,
        sha256: sha256(await readFile(job.identityRemix.imagePath)),
        role: 'selected_primary',
      },
      alternates: [{
        artifact_url: job.identityRemix.alternate.publicPath,
        source_url: job.identityRemix.alternate.sourceUrl,
        look_id: job.identityRemix.alternate.lookId,
        background_environment: job.identityRemix.alternate.environment,
        sha256: sha256(await readFile(job.identityRemix.alternate.imagePath)),
        role: 'governed_rotation_input',
      }],
    },
    composition: job.composition,
    output: { artifact_url: outputPublicPath, width: 1280, height: 720, aspect_ratio: '16:9', sha256: sha256(outputBytes) },
    external_gates: { provider_generation: false, upload: false, platform_draft: false, schedule: false, publish: false, external_send: false, production_write: false },
  }
  await writeFile(path.join(path.dirname(job.decisionReceiptPath), job.receipt), `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify({ receipt_id: receipt.receipt_id, output: outputPublicPath, sha256: receipt.output.sha256 }))
}
