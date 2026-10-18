import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputRoot = path.resolve(root, 'public/review-assets/social-content/youtube-packaging')
const sourceProofRoot = path.resolve(root, 'public/review-assets/social-content/source-proof')
const logoPath = path.resolve(root, 'public/amadutown-logo-upscaled.png')
const vambahPortraitPath = path.resolve(root, 'public/Profile_Photo_1.jpg')
const batchIdentity = 'social-campaign-youtube:20261018:v2'

const jobs = [
  {
    id: 'dark-castle',
    decisionReceiptPath: path.resolve(root, 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'),
    expectedDecisionReceiptId: 'decision:thumbnail:dark-castle:20261018:v1',
    expectedCohortId: 'cohort:youtube:chess-decision-learning:20261018:v1',
    sourcePath: path.resolve(root, 'public/review-assets/social-content/dark-castle-customer-facing-poster.png'),
    sourcePublicPath: '/review-assets/social-content/dark-castle-customer-facing-poster.png',
    sourceReceipt: 'sha256:e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78',
    sourceLabel: 'Dark Castle gameplay proof',
    title: 'I Rebuilt the Chess Lesson Around the Decision',
    hook: ['REMEMBER THE WHY'],
    hookExact: 'REMEMBER THE WHY',
    accent: '#F5C518',
    output: 'dark-castle-remember-the-why-v2.png',
    receipt: 'dark-castle-thumbnail-selection-receipt.json',
    composition: {
      version: 'youtube-thumbnail-composition/v1',
      layout_family: 'full-bleed-decision-board-bottom-hook',
      dominant_subject: 'Owned Dark Castle board position with the decision square highlighted',
      focal_hierarchy: ['board position', 'highlighted decision square and consequence arrow', 'bottom-band hook'],
      text_placement: 'bottom band spanning the board',
      batch_identity: batchIdentity,
      composition_signature: 'board-full-bleed|decision-ring|hook-bottom-band',
      exception_basis: 'none',
      exception_receipt_ids: [],
    },
  },
  {
    id: 'ai-audit',
    decisionReceiptPath: path.resolve(root, 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/thumbnail-decision-receipt.json'),
    expectedDecisionReceiptId: 'decision:thumbnail:ai-audit:20261018:v1',
    expectedCohortId: 'cohort:youtube:ai-cost-audit-roi:20261018:v1',
    sourcePath: path.resolve(root, 'public/audit_calculator_img.png'),
    sourcePublicPath: '/review-assets/social-content/source-proof/ai-audit-calculator.png',
    sourceReceipt: 'sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97',
    sourceLabel: 'AI Audit Calculator result screen',
    title: 'The AI Cost That Never Appears on the Invoice',
    hook: ['WHO OWNS', 'THE CLEANUP?'],
    hookExact: 'WHO OWNS THE CLEANUP?',
    accent: '#E0B52F',
    output: 'ai-audit-who-owns-the-cleanup-v2.png',
    receipt: 'ai-audit-thumbnail-selection-receipt.json',
    stageSourceAs: path.resolve(sourceProofRoot, 'ai-audit-calculator.png'),
    composition: {
      version: 'youtube-thumbnail-composition/v1',
      layout_family: 'human-anchor-tilted-calculator-question',
      dominant_subject: 'Approved first-party Vambah portrait confronting the owned calculator result',
      focal_hierarchy: ['human anchor', 'ownership question', 'tilted calculator result'],
      text_placement: 'upper center between portrait and calculator',
      batch_identity: batchIdentity,
      composition_signature: 'human-left|question-upper-center|calculator-tilted-right',
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
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#061426" stop-opacity="0"/><stop offset="0.34" stop-color="#061426" stop-opacity="0.9"/><stop offset="1" stop-color="#061426"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect y="430" width="1280" height="290" fill="url(#bottom)"/>
    <circle cx="651" cy="323" r="63" fill="none" stroke="${job.accent}" stroke-width="12" filter="url(#glow)"/>
    <path d="M 713 326 C 830 332, 892 395, 961 470" fill="none" stroke="${job.accent}" stroke-width="10" stroke-linecap="round"/>
    <path d="M 950 438 L 967 474 L 928 465" fill="${job.accent}"/>
    <rect x="64" y="559" width="150" height="9" rx="4.5" fill="${job.accent}"/>
    <text x="64" y="650" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="82" font-weight="900" letter-spacing="-2">${escapeXml(job.hookExact)}</text>
    <text x="1000" y="690" fill="#FFFFFF" opacity="0.72" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">MOVE → CONSEQUENCE</text>
  </svg>`)
}

function aiAuditOverlay(job) {
  const lines = job.hook.map((line, index) => `<tspan x="520" dy="${index === 0 ? 0 : 78}">${escapeXml(line)}</tspan>`).join('')
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#061426" stop-opacity="0.05"/><stop offset="0.42" stop-color="#061426" stop-opacity="0.32"/><stop offset="0.5" stop-color="#061426" stop-opacity="0.9"/><stop offset="1" stop-color="#061426"/></linearGradient></defs>
    <rect width="1280" height="720" fill="url(#shade)"/>
    <rect x="482" width="8" height="720" fill="${job.accent}"/>
    <circle cx="1132" cy="102" r="58" fill="${job.accent}"/>
    <text x="1132" y="112" text-anchor="middle" fill="#061426" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900" letter-spacing="1">COST</text>
    <rect x="520" y="126" width="106" height="9" rx="4.5" fill="${job.accent}"/>
    <text x="520" y="214" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="900" letter-spacing="-2">${lines}</text>
  </svg>`)
}

async function renderThumbnail(job, outputPath) {
  const logo = await sharp(logoPath).resize({ height: job.id === 'dark-castle' ? 76 : 68 }).png().toBuffer()
  if (job.id === 'dark-castle') {
    const board = await sharp(job.sourcePath).extract({ left: 238, top: 298, width: 505, height: 505 }).resize(720, 720).sharpen().png().toBuffer()
    const ambient = await sharp(board).resize(1280, 720, { fit: 'cover' }).modulate({ brightness: 0.28, saturation: 0.62 }).blur(18).png().toBuffer()
    await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#061426' } })
      .composite([
        { input: ambient, left: 0, top: 0 },
        { input: board, left: 280, top: 0 },
        { input: darkCastleOverlay(job), left: 0, top: 0 },
        { input: logo, left: 1152, top: 30 },
      ])
      .png({ compressionLevel: 9 })
      .toFile(outputPath)
    return
  }

  const portrait = await sharp(vambahPortraitPath).extract({ left: 430, top: 0, width: 1050, height: 1800 }).resize(490, 720, { fit: 'cover', position: 'north' }).modulate({ brightness: 0.86, saturation: 0.88 }).png().toBuffer()
  const calculator = await sharp(job.sourcePath).extract({ left: 35, top: 120, width: 1335, height: 1030 }).resize(610, 350, { fit: 'cover' }).sharpen().png().toBuffer()
  const calculatorCard = await sharp({ create: { width: 638, height: 378, channels: 4, background: '#F5C518' } })
    .composite([{ input: calculator, left: 14, top: 14 }])
    .rotate(-3, { background: '#061426' })
    .png()
    .toBuffer()
  await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#061426' } })
    .composite([
      { input: portrait, left: 0, top: 0 },
      { input: aiAuditOverlay(job), left: 0, top: 0 },
      { input: calculatorCard, left: 620, top: 342 },
      { input: logo, left: 1190, top: 630 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath)
}

await mkdir(outputRoot, { recursive: true })
await mkdir(sourceProofRoot, { recursive: true })
await copyFile(vambahPortraitPath, path.resolve(sourceProofRoot, 'vambah-approved-profile.jpg'))

for (const job of jobs) {
  const decision = JSON.parse(await readFile(job.decisionReceiptPath, 'utf8'))
  assertCanonicalInputs(job, decision)
  if (job.stageSourceAs) await copyFile(job.sourcePath, job.stageSourceAs)

  const outputPath = path.join(outputRoot, job.output)
  await renderThumbnail(job, outputPath)

  const outputBytes = await readFile(outputPath)
  const outputPublicPath = `/review-assets/social-content/youtube-packaging/${job.output}`
  const receipt = {
    version: 'youtube-thumbnail-selection/v3',
    receipt_id: `thumbnail:${job.id}:youtube-long-form:20261018:v2`,
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
      ? 'The owned board is the first-read object. A highlighted decision square and consequence arrow make the lesson visible before the bottom-band hook. Public examples bound the editorial pattern; they do not supply the composition or a causal performance claim.'
      : 'The approved first-party human anchor faces the owned calculator result. The ownership question sits above the product proof instead of reusing the board candidate’s full-bleed layout. Public examples bound the editorial pattern; they do not supply the composition or a causal performance claim.',
    first_party_source: { label: job.sourceLabel, artifact_url: job.sourcePublicPath, receipt_id: job.sourceReceipt, rights_status: 'owned_product_proof' },
    first_party_supporting_sources: job.id === 'ai-audit' ? [{ label: 'Approved Vambah profile portrait', artifact_url: '/review-assets/social-content/source-proof/vambah-approved-profile.jpg', receipt_id: 'sha256:2731bee4ee0b356fcb957ae84142d89cc0b6a35f49778aef5fb0f19a8d45c6ed', rights_status: 'approved_first_party_portrait' }] : [],
    composition: job.composition,
    output: { artifact_url: outputPublicPath, width: 1280, height: 720, aspect_ratio: '16:9', sha256: sha256(outputBytes) },
    external_gates: { provider_generation: false, upload: false, platform_draft: false, schedule: false, publish: false, external_send: false, production_write: false },
  }
  await writeFile(path.join(path.dirname(job.decisionReceiptPath), job.receipt), `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify({ receipt_id: receipt.receipt_id, output: outputPublicPath, sha256: receipt.output.sha256 }))
}
