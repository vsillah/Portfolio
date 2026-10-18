import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { buildFinalQualityReceipt, sha256 as qualitySha256 } from './youtube-thumbnail-quality-contract.mjs'

const root = process.cwd()
const outputRoot = path.resolve(root, 'public/review-assets/social-content/youtube-packaging')
const sourceProofRoot = path.resolve(root, 'public/review-assets/social-content/source-proof')
const logoPath = path.resolve(root, 'public/amadutown-logo-upscaled.png')
const batchIdentity = 'social-campaign-youtube:20261018:v5'
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
    briefPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-generation-brief-v5.json'),
    preflightPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-generation-preflight-v5.json'),
    qualityReceiptPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-final-quality-v5.json'),
    inspectionReceiptPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-post-generation-inspection-v5.json'),
    expectedDecisionReceiptId: 'decision:thumbnail:dark-castle:20261018:v4',
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
    output: 'dark-castle-remember-the-why-v5.png',
    receipt: 'dark-castle-thumbnail-selection-receipt.json',
    composition: {
      version: 'youtube-thumbnail-composition/v1',
      layout_family: 'navy-teacher-gold-decision',
      dominant_subject: 'Expressive Vambah teacher in a clean bordered card pointing toward one gold-framed owned chess decision',
      focal_hierarchy: ['expressive pointing teacher', 'three-word near-white and gold hook', 'gold-framed owned board proof'],
      text_placement: 'upper right on a solid ink field outside the inspected face-clearance box',
      batch_identity: batchIdentity,
      composition_signature: 'teacher-card-left|navy-hook-top-right|gold-board-proof-bottom-right|polished-v5',
      exception_basis: 'none',
      exception_receipt_ids: [],
    },
  },
  {
    id: 'ai-audit',
    decisionReceiptPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'),
    briefPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-generation-brief-v5.json'),
    preflightPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-generation-preflight-v5.json'),
    qualityReceiptPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-final-quality-v5.json'),
    inspectionReceiptPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-post-generation-inspection-v5.json'),
    expectedDecisionReceiptId: 'decision:thumbnail:ai-audit:20261018:v4',
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
    output: 'ai-audit-who-owns-the-cleanup-v5.png',
    receipt: 'ai-audit-thumbnail-selection-receipt.json',
    stageSourceAs: path.resolve(sourceProofRoot, 'ai-audit-calculator.png'),
    composition: {
      version: 'youtube-thumbnail-composition/v1',
      layout_family: 'ink-auditor-cyan-score',
      dominant_subject: 'Wide-eyed Vambah audit reaction in a cyan-bordered card facing one gold-framed owned 5/10 result',
      focal_hierarchy: ['four-word near-white accountability question', 'expressive audit reaction', 'gold-framed owned 5/10 score proof'],
      text_placement: 'upper left on a solid ink field',
      batch_identity: batchIdentity,
      composition_signature: 'dark-copy-left|gold-score-left|cyan-reaction-right|polished-v5',
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
    <rect width="1280" height="720" fill="#061426"/>
    <rect x="656" y="0" width="624" height="720" fill="#0B3D91"/>
    <rect x="24" y="24" width="608" height="672" rx="28" fill="none" stroke="${job.accent}" stroke-width="8"/>
    <rect x="696" y="54" width="118" height="12" rx="6" fill="${job.accent}"/>
    <text x="696" y="146" fill="#F8FAFC" font-family="Arial, Helvetica, sans-serif" font-size="70" font-weight="900" letter-spacing="-3">REMEMBER</text>
    <text x="696" y="230" fill="${job.accent}" font-family="Arial, Helvetica, sans-serif" font-size="82" font-weight="900" letter-spacing="-4">THE WHY</text>
    <rect x="696" y="316" width="520" height="336" rx="24" fill="#F8FAFC" stroke="${job.accent}" stroke-width="10"/>
    <rect x="720" y="340" width="472" height="288" rx="14" fill="none" stroke="#061426" stroke-width="6"/>
    <circle cx="1004" cy="466" r="55" fill="none" stroke="${job.accent}" stroke-width="12"/>
  </svg>`)
}

function aiAuditOverlay(job) {
  const lines = job.hook.map((line, index) => `<tspan x="58" dy="${index === 0 ? 0 : 76}">${escapeXml(line)}</tspan>`).join('')
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <rect width="1280" height="720" fill="#061426"/>
    <rect x="704" y="0" width="576" height="720" fill="#00B8D9"/>
    <rect x="720" y="22" width="538" height="676" rx="28" fill="none" stroke="${job.accent}" stroke-width="8"/>
    <rect x="58" y="62" width="118" height="12" rx="6" fill="${job.accent}"/>
    <text x="58" y="178" fill="#F8FAFC" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="900" letter-spacing="-3">${lines}</text>
    <text x="62" y="464" fill="${job.accent}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="2">REAL AUDIT RESULT</text>
    <rect x="54" y="484" width="600" height="182" rx="22" fill="#F8FAFC" stroke="${job.accent}" stroke-width="10"/>
    <rect x="76" y="506" width="556" height="138" rx="12" fill="none" stroke="#061426" stroke-width="5"/>
  </svg>`)
}

async function renderThumbnail(job, outputPath) {
  const logo = await sharp(logoPath).resize({ height: job.id === 'dark-castle' ? 76 : 68 }).png().toBuffer()
  if (job.id === 'dark-castle') {
    const identity = await sharp(job.identityRemix.imagePath).resize(600, 664, { fit: 'cover', position: 'attention' }).modulate({ brightness: 1.06, saturation: 1.16 }).sharpen().png().toBuffer()
    const board = await sharp(job.sourcePath).extract({ left: 238, top: 298, width: 505, height: 505 }).resize(472, 288, { fit: 'cover' }).modulate({ brightness: 1.02, saturation: 1.35 }).sharpen().png().toBuffer()
    await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#061426' } })
      .composite([
        { input: darkCastleOverlay(job), left: 0, top: 0 },
        { input: identity, left: 28, top: 28 },
        { input: board, left: 720, top: 340 },
        { input: logo, left: 1180, top: 620 },
      ])
      .png({ compressionLevel: 9 })
      .toFile(outputPath)
    return
  }

  const portrait = await sharp(job.identityRemix.imagePath).resize(530, 668, { fit: 'cover', position: 'attention' }).modulate({ brightness: 1.07, saturation: 1.15 }).sharpen().png().toBuffer()
  const calculator = await sharp(job.sourcePath).extract({ left: 35, top: 410, width: 650, height: 150 }).resize(556, 138, { fit: 'cover' }).modulate({ saturation: 1.18 }).sharpen().png().toBuffer()
  await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#061426' } })
    .composite([
      { input: aiAuditOverlay(job), left: 0, top: 0 },
      { input: portrait, left: 724, top: 26 },
      { input: calculator, left: 76, top: 506 },
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
    version: 'youtube-thumbnail-selection/v5',
    receipt_id: `thumbnail:${job.id}:youtube-long-form:20261018:v5`,
    supersedes_failed_receipt_id: `thumbnail:${job.id}:youtube-long-form:20261018:v4`,
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
      ? 'A crisp cobalt and ink composition separates the expressive teacher, three-word hook, and gold-framed owned board proof. Public examples bind taste only and carry zero performance weight.'
      : 'A crisp ink and cyan composition separates the near-white ownership question, expressive audit reaction, and gold-framed owned score proof. Public examples bind taste only and carry zero performance weight.',
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
