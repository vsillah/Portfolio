import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { buildFinalQualityReceipt, sha256 as qualitySha256 } from './youtube-thumbnail-quality-contract.mjs'

const root = process.cwd()
const outputRoot = path.resolve(root, 'public/review-assets/social-content/youtube-packaging')
const sourceProofRoot = path.resolve(root, 'public/review-assets/social-content/source-proof')
const logoPath = path.resolve(root, 'public/amadutown-logo-upscaled.png')
const displayFontPath = path.resolve(root, 'public/fonts/inter-latin-variable.ttf')
const batchIdentity = 'social-campaign-youtube:20261018:v6'
const tasteReceiptPath = path.resolve(root, 'artifacts/research/youtube-thumbnail-taste-reference-2026-10-18/receipt.json')

function requiredIdentityRemix(prefix, campaignKey, publicFilename) {
  const imagePath = process.env[`${prefix}_HEYGEN_IMAGE_PATH`]
  const sourceUrl = process.env[`${prefix}_HEYGEN_IMAGE_URL`]
  const receiptId = process.env[`${prefix}_HEYGEN_IDENTITY_RECEIPT_ID`]
  const lookId = process.env[`${prefix}_HEYGEN_LOOK_ID`]
  const environment = process.env[`${prefix}_HEYGEN_ENVIRONMENT`]
  if (!imagePath || !sourceUrl || !receiptId || !lookId || !environment) {
    throw new Error(`${campaignKey}: fresh preflight-approved HeyGen Pro identity remix is required.`)
  }
  if (!/^https:\/\//.test(sourceUrl) || !/^heygen:identity-remix:[a-z0-9:-]+:v\d+$/.test(receiptId)) {
    throw new Error(`${campaignKey}: HeyGen image URL or identity-remix receipt is invalid.`)
  }
  return {
    campaignKey,
    imagePath: path.resolve(imagePath),
    sourceUrl,
    receiptId,
    lookId,
    environment,
    stagedPath: path.resolve(sourceProofRoot, publicFilename),
    publicPath: `/review-assets/social-content/source-proof/${publicFilename}`,
  }
}

const identityRemixes = {
  darkCastle: requiredIdentityRemix('DARK_CASTLE', 'dark-castle', 'dark-castle-heygen-identity-v4.png'),
  aiAudit: requiredIdentityRemix('AI_AUDIT', 'ai-audit', 'ai-audit-heygen-identity-v4.png'),
}

if (
  identityRemixes.darkCastle.imagePath === identityRemixes.aiAudit.imagePath
  || identityRemixes.darkCastle.sourceUrl === identityRemixes.aiAudit.sourceUrl
  || identityRemixes.darkCastle.lookId === identityRemixes.aiAudit.lookId
  || identityRemixes.darkCastle.environment === identityRemixes.aiAudit.environment
) {
  throw new Error('The Dark Castle and AI Audit thumbnails require distinct preflight-approved HeyGen Pro assets, looks, and environments.')
}

const jobs = [
  {
    id: 'dark-castle',
    decisionReceiptPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'),
    briefPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-generation-brief-v6.json'),
    preflightPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-generation-preflight-v6.json'),
    qualityReceiptPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-final-quality-v6.json'),
    inspectionReceiptPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-post-generation-inspection-v6.json'),
    expectedDecisionReceiptId: 'decision:thumbnail:dark-castle:20261018:v5',
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
    output: 'dark-castle-remember-the-why-v6.png',
    receipt: 'dark-castle-thumbnail-selection-receipt.json',
    composition: {
      version: 'youtube-thumbnail-composition/v1',
      layout_family: 'integrated-chess-decision-scene',
      dominant_subject: 'Expressive Vambah teacher inside one shared studio atmosphere, pointing along a curved gold path to the owned chess decision',
      focal_hierarchy: ['expressive pointing teacher', 'treated WHY display hook', 'integrated owned board proof'],
      text_placement: 'upper right within the shared atmosphere and outside the inspected face-clearance box',
      batch_identity: batchIdentity,
      composition_signature: 'shared-chess-studio|gesture-arc-to-board|display-hook-depth|cohesive-v6',
      exception_basis: 'none',
      exception_receipt_ids: [],
    },
  },
  {
    id: 'ai-audit',
    decisionReceiptPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'),
    briefPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-generation-brief-v6.json'),
    preflightPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-generation-preflight-v6.json'),
    qualityReceiptPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-final-quality-v6.json'),
    inspectionReceiptPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-post-generation-inspection-v6.json'),
    expectedDecisionReceiptId: 'decision:thumbnail:ai-audit:20261018:v5',
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
    output: 'ai-audit-who-owns-the-cleanup-v6.png',
    receipt: 'ai-audit-thumbnail-selection-receipt.json',
    stageSourceAs: path.resolve(sourceProofRoot, 'ai-audit-calculator.png'),
    composition: {
      version: 'youtube-thumbnail-composition/v1',
      layout_family: 'integrated-audit-cleanup-scene',
      dominant_subject: 'Wide-eyed Vambah reaction inside one shared office atmosphere, presenting the integrated owned 5/10 result',
      focal_hierarchy: ['expressive audit reaction', 'treated CLEANUP display question', 'integrated owned 5/10 score proof'],
      text_placement: 'upper left within the shared atmosphere and outside the inspected face-clearance box',
      batch_identity: batchIdentity,
      composition_signature: 'shared-audit-office|gesture-curve-to-score|display-question-depth|cohesive-v6',
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
      <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#061426" stop-opacity=".08"/><stop offset=".52" stop-color="#061426" stop-opacity=".42"/><stop offset="1" stop-color="#061426" stop-opacity=".96"/></linearGradient>
      <filter id="shadow"><feGaussianBlur stdDeviation="8"/></filter>
      <style>@font-face{font-family:PortfolioDisplay;src:url('file://${displayFontPath}') format('truetype');font-weight:100 900}.display{font-family:PortfolioDisplay,sans-serif;font-weight:900}</style>
    </defs>
    <rect width="1280" height="720" fill="url(#shade)"/>
    <ellipse cx="1005" cy="535" rx="250" ry="142" fill="${job.accent}" opacity=".18" filter="url(#shadow)"/>
    <path d="M575 438 C705 420 710 540 845 515" fill="none" stroke="#061426" stroke-width="24" opacity=".62"/>
    <path d="M575 438 C705 420 710 540 845 515" fill="none" stroke="${job.accent}" stroke-width="11" stroke-linecap="round"/>
    <path d="M823 494 L856 514 L824 533" fill="none" stroke="${job.accent}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="678" y="134" fill="#061426" opacity=".55" class="display" font-size="72" letter-spacing="-4" transform="translate(5 7)">REMEMBER</text>
    <text x="678" y="134" fill="#F8FAFC" class="display" font-size="72" letter-spacing="-4">REMEMBER</text>
    <rect x="672" y="160" width="430" height="102" rx="20" fill="#061426" opacity=".72" transform="rotate(-2 672 160)"/>
    <text x="694" y="240" fill="${job.accent}" class="display" font-size="92" letter-spacing="-6" transform="rotate(-2 694 240)">THE WHY</text>
    <path d="M700 260 Q892 282 1080 252" fill="none" stroke="${job.accent}" stroke-width="10" stroke-linecap="round"/>
  </svg>`)
}

function aiAuditOverlay(job) {
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#061426" stop-opacity=".9"/><stop offset=".55" stop-color="#061426" stop-opacity=".5"/><stop offset="1" stop-color="#00B8D9" stop-opacity=".06"/></linearGradient>
      <filter id="shadow"><feGaussianBlur stdDeviation="9"/></filter>
      <style>@font-face{font-family:PortfolioDisplay;src:url('file://${displayFontPath}') format('truetype');font-weight:100 900}.display{font-family:PortfolioDisplay,sans-serif;font-weight:900}</style>
    </defs>
    <rect width="1280" height="720" fill="url(#shade)"/>
    <ellipse cx="382" cy="550" rx="290" ry="130" fill="#00B8D9" opacity=".2" filter="url(#shadow)"/>
    <path d="M834 544 C735 612 688 548 600 548" fill="none" stroke="#061426" stroke-width="24" opacity=".64"/>
    <path d="M834 544 C735 612 688 548 600 548" fill="none" stroke="${job.accent}" stroke-width="11" stroke-linecap="round"/>
    <path d="M624 525 L590 548 L623 570" fill="none" stroke="${job.accent}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="63" y="166" fill="#000" opacity=".55" class="display" font-size="78" letter-spacing="-4" transform="translate(5 7)">${escapeXml(job.hook[0])}</text>
    <text x="58" y="166" fill="#F8FAFC" class="display" font-size="78" letter-spacing="-4">${escapeXml(job.hook[0])}</text>
    <rect x="48" y="178" width="585" height="92" rx="18" fill="#00B8D9" opacity=".88" transform="rotate(-2 48 178)"/>
    <text x="58" y="250" fill="#061426" class="display" font-size="82" letter-spacing="-5" transform="rotate(-2 58 250)">THE CLEANUP?</text>
    <path d="M60 274 Q310 302 566 268" fill="none" stroke="${job.accent}" stroke-width="10" stroke-linecap="round"/>
    <text x="84" y="444" fill="${job.accent}" class="display" font-size="22" letter-spacing="2">REAL AUDIT RESULT</text>
  </svg>`)
}

async function renderThumbnail(job, outputPath) {
  const logo = await sharp(logoPath).resize({ height: job.id === 'dark-castle' ? 76 : 68 }).png().toBuffer()
  if (job.id === 'dark-castle') {
    const background = await sharp(job.identityRemix.imagePath).resize(1280, 720, { fit: 'cover' }).blur(16).modulate({ brightness: .62, saturation: 1.35 }).png().toBuffer()
    const identityMask = Buffer.from('<svg width="760" height="720"><defs><linearGradient id="f"><stop offset="0" stop-color="white"/><stop offset=".78" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="760" height="720" fill="url(#f)"/></svg>')
    const identity = await sharp(job.identityRemix.imagePath).resize(760, 720, { fit: 'cover', position: 'attention' }).modulate({ brightness: 1.05, saturation: 1.12 }).sharpen().ensureAlpha().composite([{ input: identityMask, blend: 'dest-in' }]).png().toBuffer()
    const board = await sharp(job.sourcePath).extract({ left: 238, top: 298, width: 505, height: 505 }).resize(410, 250, { fit: 'cover' }).modulate({ brightness: 1.02, saturation: 1.35 }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: job.accent }).rotate(-5, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).sharpen().png().toBuffer()
    await sharp(background)
      .composite([
        { input: identity, left: 0, top: 0 },
        { input: darkCastleOverlay(job), left: 0, top: 0 },
        { input: board, left: 820, top: 390 },
        { input: logo, left: 1180, top: 620 },
      ])
      .png({ compressionLevel: 9 })
      .toFile(outputPath)
    return
  }

  const background = await sharp(job.identityRemix.imagePath).resize(1280, 720, { fit: 'cover' }).blur(18).modulate({ brightness: .78, saturation: 1.3 }).png().toBuffer()
  const portraitMask = Buffer.from('<svg width="700" height="720"><defs><linearGradient id="f"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".2" stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient></defs><rect width="700" height="720" fill="url(#f)"/></svg>')
  const portrait = await sharp(job.identityRemix.imagePath).resize(700, 720, { fit: 'cover', position: 'attention' }).modulate({ brightness: 1.06, saturation: 1.12 }).sharpen().ensureAlpha().composite([{ input: portraitMask, blend: 'dest-in' }]).png().toBuffer()
  const calculator = await sharp(job.sourcePath).extract({ left: 35, top: 410, width: 650, height: 150 }).resize(500, 116, { fit: 'cover' }).modulate({ saturation: 1.18 }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: job.accent }).rotate(3, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).sharpen().png().toBuffer()
  await sharp(background)
    .composite([
      { input: portrait, left: 580, top: 0 },
      { input: aiAuditOverlay(job), left: 0, top: 0 },
      { input: calculator, left: 74, top: 478 },
      { input: logo, left: 1180, top: 622 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath)
}

await mkdir(outputRoot, { recursive: true })
await mkdir(sourceProofRoot, { recursive: true })
const tasteReceipt = JSON.parse(await readFile(tasteReceiptPath, 'utf8'))
const blockedJobs = []

for (const job of jobs) {
  const decision = JSON.parse(await readFile(job.decisionReceiptPath, 'utf8'))
  const brief = JSON.parse(await readFile(job.briefPath, 'utf8'))
  const preflightReceipt = JSON.parse(await readFile(job.preflightPath, 'utf8'))
  assertCanonicalInputs(job, decision)
  if (job.stageSourceAs) await copyFile(job.sourcePath, job.stageSourceAs)
  await sharp(job.identityRemix.imagePath).png({ compressionLevel: 9 }).toFile(job.identityRemix.stagedPath)

  const outputPath = path.join(outputRoot, job.output)
  await renderThumbnail(job, outputPath)
  const outputBytes = await readFile(outputPath)
  const outputPublicPath = `/review-assets/social-content/youtube-packaging/${job.output}`
  const feedPreviewFilename = job.output.replace(/\.png$/, '-feed-320x180.png')
  const feedPreviewPath = path.join(outputRoot, feedPreviewFilename)
  await sharp(outputBytes).resize(320, 180, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(feedPreviewPath)
  const feedPreviewBytes = await readFile(feedPreviewPath)
  let inspectionReceipt = null
  try {
    inspectionReceipt = JSON.parse(await readFile(job.inspectionReceiptPath, 'utf8'))
  } catch {}
  const qualityReceipt = await buildFinalQualityReceipt({ brief, decision, tasteReceipt, outputPath, feedPreviewPath, sourceImagePath: job.identityRemix.imagePath, inspectionReceipt, preflightReceipt })
  await writeFile(job.qualityReceiptPath, `${JSON.stringify(qualityReceipt, null, 2)}\n`)
  if (qualityReceipt.status !== 'passed') {
    blockedJobs.push(`${job.id}: ${qualityReceipt.failures.join('; ')}`)
    console.error(`${job.id}: final raster blocked before Human QA`)
    continue
  }
  const receipt = {
    version: 'youtube-thumbnail-selection/v6',
    receipt_id: `thumbnail:${job.id}:youtube-long-form:20261018:v6`,
    supersedes_failed_receipt_id: `thumbnail:${job.id}:youtube-long-form:20261018:v5`,
    decision_receipt_id: decision.receipt_id,
    decision_input_version: decision.input_version,
    decision_output_version: decision.output_version,
    content_version: brief.content_version,
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
      ? 'One shared chess-studio atmosphere connects the expressive teacher, treated WHY hook, curved gesture path, and overlapping owned board proof. Public examples bind taste only and carry zero performance weight.'
      : 'One shared audit-office atmosphere connects the expressive reaction, treated CLEANUP question, curved presenting path, and overlapping owned score proof. Public examples bind taste only and carry zero performance weight.',
    first_party_source: { label: job.sourceLabel, artifact_url: job.sourcePublicPath, receipt_id: job.sourceReceipt, rights_status: 'owned_product_proof' },
    first_party_supporting_sources: [{
      label: `Fresh HeyGen Pro identity remix for ${job.id === 'dark-castle' ? 'Dark Castle Chess' : 'AI Audit Calculator'}`,
      artifact_url: job.identityRemix.publicPath,
      source_url: job.identityRemix.sourceUrl,
      receipt_id: job.identityRemix.receiptId,
      rights_status: 'approved_identity_remix_review_only',
      look_id: job.identityRemix.lookId,
      background_environment: job.identityRemix.environment,
      expression_label: qualityReceipt.face_assessment.expression_label,
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
      alternates: [],
    },
    composition: job.composition,
    generation_preflight: { receipt_id: preflightReceipt.receipt_id, status: preflightReceipt.status, brief_input_version: preflightReceipt.brief_input_version },
    final_quality_gate: { receipt_id: qualityReceipt.receipt_id, status: qualityReceipt.status, output_sha256: qualityReceipt.output_sha256, feed_preview_sha256: qualityReceipt.feed_preview_sha256, inspection_receipt_id: qualityReceipt.post_generation_inspection_receipt_id, metrics: qualityReceipt.metrics, playlist_visual_similarity: qualityReceipt.playlist_visual_similarity, color_polish: qualityReceipt.color_polish, spatial_layout: qualityReceipt.spatial_layout, face_assessment: qualityReceipt.face_assessment, feed_copy_inspection: qualityReceipt.feed_copy_inspection },
    output: { artifact_url: outputPublicPath, width: 1280, height: 720, aspect_ratio: '16:9', sha256: sha256(outputBytes) },
    feed_size_preview: { artifact_url: `/review-assets/social-content/youtube-packaging/${feedPreviewFilename}`, width: 320, height: 180, sha256: qualitySha256(feedPreviewBytes), status: 'passed' },
    provider_generation: { provider: 'heygen_pro', occurred: true, receipt_id: job.identityRemix.receiptId, future_calls_authorized: false },
    external_gates: { provider_generation: false, upload: false, platform_draft: false, schedule: false, publish: false, external_send: false, production_write: false },
  }
  await writeFile(path.join(path.dirname(job.decisionReceiptPath), job.receipt), `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify({ receipt_id: receipt.receipt_id, output: outputPublicPath, sha256: receipt.output.sha256 }))
}
if (blockedJobs.length) throw new Error(`Final raster gate blocked:\n${blockedJobs.join('\n')}`)
