import { deterministicSha256Hex } from '@/lib/deterministic-sha256.mjs'
import { inspectSocialScriptTemplateReceipt, type SocialScriptTemplateReceipt } from '@/lib/social-script-template-receipt'
import {
  LONG_FORM_FRAMEWORK_LIBRARY,
  LONG_FORM_FRAMEWORK_LIBRARY_VERSION,
  LONG_FORM_SCRIPT_INTELLIGENCE_VERSION,
  evaluateLongFormScriptIntelligence,
  kickLabLongFormQaBeats,
  type LongFormScriptBeat,
  type LongFormScriptReview,
  type LongFormScriptReviewInput,
} from '@/lib/long-form-script-intelligence'
import {
  SOCIAL_CAMPAIGN_EXTERNAL_GATES,
  SOCIAL_CAMPAIGN_LONG_FORM_INPUT_VERSION,
  evaluateCampaignPreparationCandidate,
  type CampaignLongFormScriptInputReceipt,
  type CampaignPreparationBlocker,
  type CampaignPreparationCandidate,
} from '@/lib/social-campaign-package-preparation'

export const SOCIAL_CAMPAIGN_LONG_FORM_BATCH_KIND = 'social_campaign_long_form_batch'
export const SOCIAL_CAMPAIGN_LONG_FORM_DRAFT_VERSION = 'campaign-long-form-draft-packet/v2' as const
export const SOCIAL_CAMPAIGN_LONG_FORM_BATCH_VERSION = 'campaign-long-form-batch/v2' as const
export const SOCIAL_CAMPAIGN_LONG_FORM_CHUNK_SIZE = 10

export type CustomerFacingCopyFinding = {
  beat_id: string
  code: string
  matched_text: string
}

export type CustomerFacingCopyReceipt = {
  version: 'customer-facing-copy-check/v1'
  status: 'passed' | 'blocked'
  scanned_beat_ids: string[]
  findings: CustomerFacingCopyFinding[]
}

export type CampaignLongFormDraftPacket = {
  version: typeof SOCIAL_CAMPAIGN_LONG_FORM_DRAFT_VERSION
  packet_id: string
  candidate_id: string
  campaign_identity: string
  social_content_id: string
  content_version: string
  input_version: string
  framework_receipt_id: string
  script_template_receipt: SocialScriptTemplateReceipt
  product_proof_receipt_id: string
  originality_receipt_id: string
  privacy_receipt_id: string
  title_thumbnail_receipt_id: string
  title_thumbnail_distinct: true
  product_evidence_bindings: Array<{
    product_proof_receipt_id: string
    artifact_href: string
    content_version: string
    claim_beat_ids: string[]
    privacy_receipt_id: string
  }>
  status: 'prepared_for_human_review'
  prepared_at: string
  title: string
  script_text: string
  beats: LongFormScriptBeat[]
  customer_facing_copy_receipt: CustomerFacingCopyReceipt
  evaluation_receipt: LongFormScriptReview
  external_gates: typeof SOCIAL_CAMPAIGN_EXTERNAL_GATES
}

export type CampaignLongFormProjection = {
  candidate_id: string
  campaign_identity: string
  product_label: string
  state: 'ready' | 'blocked' | 'unscored'
  ready: boolean
  blockers: CampaignPreparationBlocker[]
  packet: CampaignLongFormDraftPacket | null
}

export type CampaignLongFormBatch = {
  version: typeof SOCIAL_CAMPAIGN_LONG_FORM_BATCH_VERSION
  batch_id: string
  input_fingerprint: string
  total: number
  scanned: number
  chunk_size: number
  chunks_processed: number
  chunks: Array<{
    chunk_index: number
    chunk_id: string
    candidate_ids: string[]
    scanned: number
    prepared: number
    blocked: number
  }>
  prepared_count: number
  blocked_count: number
  deferred_count: number
  remaining: number
  prepared: CampaignLongFormDraftPacket[]
  blocked: CampaignLongFormProjection[]
  external_gates: typeof SOCIAL_CAMPAIGN_EXTERNAL_GATES
}

function stable(value: unknown) {
  return JSON.stringify(value, (_key, entry) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)))
      : entry
  ))
}

function hash(value: unknown) {
  return `sha256:${deterministicSha256Hex(stable(value))}`
}

function timestamp(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : ''
}

function blocker(code: string, message: string, recoveryLabel: string, recoveryHref: string): CampaignPreparationBlocker {
  return { code, message, recovery_label: recoveryLabel, recovery_href: recoveryHref }
}

const CUSTOMER_FACING_CONTAMINATION_RULES: Array<{ code: string; pattern: RegExp }> = [
  { code: 'review_workflow', pattern: /\b(?:review[- ]only|decision queue|approval workflow|before approval|approved script)\b/i },
  { code: 'operator_blocker', pattern: /\b(?:exact blocker|return it with|recovery path)\b/i },
  { code: 'production_gate', pattern: /\b(?:render|provider|production|publishing|external) gates?\b/i },
  { code: 'receipt_language', pattern: /\b(?:receipt|input fingerprint|source trace)\b/i },
  { code: 'calibration_mechanics', pattern: /\b(?:unscored|zero[- ]weight|performance weight|channel baseline|outlier threshold|observation date|creator distance)\b/i },
  { code: 'selection_mechanics', pattern: /\b(?:included|excluded|selected) sources?\b/i },
]

export function inspectCustomerFacingScript(beats: LongFormScriptBeat[]): CustomerFacingCopyReceipt {
  const findings = beats.flatMap((beat) => CUSTOMER_FACING_CONTAMINATION_RULES.flatMap(({ code, pattern }) => {
    const match = beat.text.match(pattern)
    return match ? [{ beat_id: beat.id, code, matched_text: match[0] }] : []
  }))
  return {
    version: 'customer-facing-copy-check/v1',
    status: findings.length ? 'blocked' : 'passed',
    scanned_beat_ids: beats.map((beat) => beat.id),
    findings,
  }
}

function frameworkBlockers(candidate: CampaignPreparationCandidate, receipt: CampaignLongFormScriptInputReceipt | null, now: Date) {
  const recovery = receipt?.source_href || `/admin/content/video-generation?campaign=${encodeURIComponent(candidate.campaign_identity)}&review=script-intelligence`
  if (!receipt) return [blocker('long_form_framework_missing', 'A version-bound long-form Script Intelligence input receipt is required.', 'Complete Script Intelligence inputs', recovery)]
  const blockers: CampaignPreparationBlocker[] = []
  const template = inspectSocialScriptTemplateReceipt({ receipt: receipt.script_template_receipt, contentId: candidate.social_content_id, candidateId: candidate.candidate_id, contentVersion: candidate.content_version, sourceReceiptId: receipt.receipt_id, now })
  blockers.push(...template.blockers.map((message) => blocker('script_template_not_ready', message, 'Record current script template', recovery)))
  if (receipt.version !== SOCIAL_CAMPAIGN_LONG_FORM_INPUT_VERSION) blockers.push(blocker('long_form_framework_version', 'The long-form framework input version is unsupported.', 'Refresh framework receipt', recovery))
  if (receipt.status !== 'passed') blockers.push(blocker('long_form_framework_blocked', 'The long-form framework receipt has not passed.', 'Resolve framework receipt', recovery))
  if (
    receipt.campaign_identity !== candidate.campaign_identity
    || receipt.candidate_id !== candidate.candidate_id
    || timestamp(receipt.content_updated_at) !== timestamp(candidate.content_version)
  ) blockers.push(blocker('long_form_identity_binding', 'The long-form framework receipt is not bound to this campaign, candidate, and content version.', 'Rebind framework receipt', recovery))
  if (!timestamp(receipt.observed_at) || !timestamp(receipt.fresh_until) || Date.parse(receipt.fresh_until) <= now.getTime()) blockers.push(blocker('long_form_framework_stale', 'The long-form framework receipt is missing or stale.', 'Refresh long-form evidence', recovery))
  if (receipt.framework_library_version !== LONG_FORM_FRAMEWORK_LIBRARY_VERSION) blockers.push(blocker('long_form_library_version', 'The framework receipt does not use the canonical long-form library version.', 'Re-run canonical Script Intelligence', recovery))
  const requiredRules = LONG_FORM_FRAMEWORK_LIBRARY.rules.map((rule) => rule.id)
  if (requiredRules.some((rule) => !receipt.framework_rule_ids.includes(rule))) blockers.push(blocker('long_form_framework_rules', 'The framework receipt is missing one or more canonical derived rules.', 'Complete framework rule binding', recovery))
  if (!receipt.topic.trim() || !receipt.promise.trim() || receipt.expected_duration_seconds < 480 || receipt.expected_duration_seconds > 720 || receipt.delivery_words_per_minute < 120 || receipt.delivery_words_per_minute > 180) blockers.push(blocker('long_form_script_contract', 'Topic, promise, an 8-12 minute duration, and a delivery rate between 120 and 180 WPM are required.', 'Complete script contract', recovery))
  if (receipt.product_evidence_ids.length < 3) blockers.push(blocker('long_form_product_evidence', 'At least three campaign-specific product evidence bindings are required.', 'Bind product evidence', recovery))
  if (receipt.topic_outlier_evidence.length < 3) blockers.push(blocker('long_form_topic_evidence', 'At least three attributable current same-topic comparisons are required.', 'Expand live topic evidence', recovery))
  if (receipt.creator_distance.status !== 'passed' || receipt.creator_distance.voice_profile !== 'vambah-approved') blockers.push(blocker('long_form_creator_distance', 'A passed creator-distance and approved voice receipt is required.', 'Complete originality distance', recovery))
  return blockers
}

function scriptBeats(candidate: CampaignPreparationCandidate, receipt: CampaignLongFormScriptInputReceipt): LongFormScriptBeat[] {
  if (candidate.campaign_identity === 'kicklab') return kickLabLongFormQaBeats()
  const topic = receipt.topic
  const promise = receipt.promise
  const product = candidate.product_label
  const storyboard = candidate.deliverables.youtube.storyboard
  const visual = (index: number, fallback: string) => storyboard[index] || fallback
  const beat = (
    id: string,
    start: number,
    end: number,
    role: LongFormScriptBeat['role'],
    text: string,
    broll: string | null = null,
    interrupt: string | null = null,
  ): LongFormScriptBeat => ({ id, start_seconds: start, end_seconds: end, role, text, broll_cue: broll, pattern_interrupt: interrupt })
  return [
    beat('campaign-hook', 0, 7, 'hook', `If you are trying to understand ${topic}, the hardest part is separating a strong story from a claim the evidence cannot carry. ${product} gives us a practical way to examine that problem through visible product behavior, current public examples, and clear limits.`, visual(0, `Open on the ${product} product view.`), `On-screen question: What can ${product} actually prove?`),
    beat('campaign-open-loop', 7, 27, 'open_loop', `By the end, I will show you ${promise}. We will inspect the problem, walk through ${product} in action, compare the lesson with what people are discussing now, and name the boundary between what the product demonstrates and what still needs measurement.`, visual(0, `Move from the viewer problem into the ${product} interface.`), 'Chapter card: Problem, proof, boundary.'),
    beat('campaign-frame', 27, 43, 'frame', `The starting point is simple: access and operating reality shape outcomes. A useful product story must show what someone can see, what action becomes easier, and which burden is reduced. It also has to name the limit, because confidence without a visible basis creates more work instead of less.`, visual(1, 'Show the workflow before-and-after state.'), 'Pull quote emphasizing visible evidence.'),
    beat('campaign-proof', 43, 63, 'proof', `Here is what ${product} shows. The interface makes the workflow visible, so the claim stays next to the screen, interaction, or artifact that supports it. Nothing in this walkthrough depends on a generic illustration or an outcome we cannot verify.`, visual(1, `Walk through the ${product} product evidence.`), 'Zoom to the exact control or result being discussed.'),
    beat('campaign-teaching-one', 63, 86, 'teaching', `The first lesson is alignment. The opening promise, the product behavior, and the practical takeaway must describe the same problem. When those pieces drift apart, the story may sound polished while the viewer is left carrying the work of connecting them. Keeping the claim beside the demonstration makes that drift easier to see.`, visual(2, 'Show the claim beside the product behavior.'), 'Switch from the problem to the demonstrated result.'),
    beat('campaign-rehook-one', 86, 101, 'rehook', `But alignment alone is not enough. The next question is whether people are discussing this exact topic now, or whether we are borrowing momentum from a different conversation. That distinction helps us decide whether the idea is timely, useful later, or simply unrelated.`, visual(2, 'Show recent public examples from the same topic.'), 'On-screen label: Same topic or borrowed attention?'),
    beat('campaign-teaching-two', 101, 126, 'teaching', `Recent public examples help us compare the questions people are asking and the problems they are trying to solve. They can inform timing, but they cannot prove a product claim. That proof still has to come from what the product visibly does and where its limits are clear.`, visual(2, 'Walk through recent public examples, then return to the product.'), 'Move from public conversation back to demonstrated behavior.'),
    beat('campaign-teaching-three', 126, 145, 'teaching', `Originality creates the next boundary. Other creators can teach structure: open a loop, place proof beside the claim, renew attention, and earn the call to action. The final words, examples, moral frame, and product lesson still have to be our own.`, visual(3, 'Show structural inspiration beside original product examples.'), 'Highlight structure versus original language.'),
    beat('campaign-rehook-two', 145, 151, 'rehook', `So the final test is practical: did this explanation deliver ${promise}, with proof the viewer can inspect and limits the viewer can understand?`, visual(3, 'Return to the product proof.'), 'On-screen return to the opening promise.'),
    beat('campaign-payoff', 151, 160, 'payoff', `The result is ${promise}. ${product} becomes a demonstrated practice rather than an abstract claim: the viewer can see the product, follow the reasoning, inspect the evidence, and understand the boundary before deciding what to do next.`, null, null),
    beat('campaign-conclusion', 160, 170, 'conclusion', `A trustworthy product story does not ask confidence to outrun proof. It connects the problem, the visible product behavior, the current evidence, and the limitation in one clear line. That is how technology can reduce burden while preserving the dignity and judgment of the person using it.`, null, null),
    beat('campaign-cta', 170, 180, 'cta', `Explore the public ${product} link, compare what you see with the sources in the description, and tell me which part would reduce the most friction in your own work. If this kind of practical product breakdown is useful, subscribe for the next one.`, null, null),
  ]
}

export function projectCampaignLongFormDraft(candidate: CampaignPreparationCandidate, now = new Date()): CampaignLongFormProjection {
  const base = evaluateCampaignPreparationCandidate(candidate, now)
  if (!base.ready) return {
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    product_label: candidate.product_label,
    state: base.state,
    ready: false,
    blockers: base.blockers,
    packet: null,
  }
  const receipt = candidate.long_form_script_input ?? null
  const blockers = frameworkBlockers(candidate, receipt, now)
  if (blockers.length || !receipt) return {
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    product_label: candidate.product_label,
    state: receipt?.status === 'unscored' ? 'unscored' : 'blocked',
    ready: false,
    blockers,
    packet: null,
  }
  const beats = scriptBeats(candidate, receipt)
  if (beats.map((beat) => beat.id).join('|') !== receipt.script_template_receipt!.applied_beat_ids.join('|')) return {
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    product_label: candidate.product_label,
    state: 'blocked', ready: false, packet: null,
    blockers: [blocker('script_template_beat_mismatch', 'Applied script beats do not match the recorded template receipt.', 'Re-evaluate script template', receipt.source_href)],
  }
  const customerFacingCopyReceipt = inspectCustomerFacingScript(beats)
  if (customerFacingCopyReceipt.status !== 'passed') return {
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    product_label: candidate.product_label,
    state: 'blocked',
    ready: false,
    blockers: customerFacingCopyReceipt.findings.map((finding) => blocker(
      `customer_facing_contamination_${finding.code}`,
      `Spoken beat ${finding.beat_id} contains internal workflow language: ${finding.matched_text}.`,
      'Rewrite customer-facing spoken copy',
      receipt.source_href,
    )),
    packet: null,
  }
  const scriptVersion = hash({
    candidate_id: candidate.candidate_id,
    candidate_input_version: candidate.input_version,
    receipt,
    beats,
  })
  const input: LongFormScriptReviewInput = {
    version: LONG_FORM_SCRIPT_INTELLIGENCE_VERSION,
    script_id: `campaign-long-form:${candidate.campaign_identity}`,
    script_version: scriptVersion,
    topic: receipt.topic,
    promise: receipt.promise,
    evaluated_at: receipt.observed_at,
    expected_duration_seconds: receipt.expected_duration_seconds,
    delivery_words_per_minute: receipt.delivery_words_per_minute,
    product_evidence_ids: receipt.product_evidence_ids,
    beats,
    topic_outlier_evidence: receipt.topic_outlier_evidence,
    creator_distance: receipt.creator_distance,
    framework_rule_ids: receipt.framework_rule_ids,
  }
  const evaluation = evaluateLongFormScriptIntelligence(input)
  if (!evaluation.approval_ready) return {
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    product_label: candidate.product_label,
    state: evaluation.status === 'unscored' ? 'unscored' : 'blocked',
    ready: false,
    blockers: evaluation.blockers.map((message, index) => blocker(
      `long_form_evaluation_${index + 1}`,
      message,
      'Repair long-form script input',
      receipt.source_href,
    )),
    packet: null,
  }
  const packetId = `campaign-long-form-${hash({ candidate: candidate.candidate_id, scriptVersion, review: evaluation.input_fingerprint }).slice(7, 31)}`
  return {
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    product_label: candidate.product_label,
    state: 'ready',
    ready: true,
    blockers: [],
    packet: {
      version: SOCIAL_CAMPAIGN_LONG_FORM_DRAFT_VERSION,
      packet_id: packetId,
      candidate_id: candidate.candidate_id,
      campaign_identity: candidate.campaign_identity,
      social_content_id: candidate.social_content_id,
      content_version: candidate.content_version,
      input_version: candidate.input_version,
      framework_receipt_id: receipt.receipt_id,
      script_template_receipt: receipt.script_template_receipt!,
      product_proof_receipt_id: candidate.receipts.product_proof.receipt_id,
      originality_receipt_id: candidate.receipts.originality.receipt_id,
      privacy_receipt_id: candidate.receipts.privacy.receipt_id,
      title_thumbnail_receipt_id: candidate.receipts.outlier.receipt_id,
      title_thumbnail_distinct: true,
      product_evidence_bindings: [{
        product_proof_receipt_id: candidate.receipts.product_proof.receipt_id,
        artifact_href: candidate.deliverables.linkedin.visual_href || candidate.deliverables.youtube.thumbnail_href,
        content_version: candidate.content_version,
        claim_beat_ids: ['campaign-proof'],
        privacy_receipt_id: candidate.receipts.privacy.receipt_id,
      }],
      status: 'prepared_for_human_review',
      prepared_at: receipt.observed_at,
      title: candidate.deliverables.youtube.title,
      script_text: beats.map((beat) => beat.text).join('\n\n'),
      beats,
      customer_facing_copy_receipt: customerFacingCopyReceipt,
      evaluation_receipt: evaluation,
      external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES,
    },
  }
}

export function projectCampaignLongFormBatch(candidates: CampaignPreparationCandidate[], now = new Date()): CampaignLongFormBatch {
  const ordered = [...candidates].sort((left, right) => left.campaign_identity.localeCompare(right.campaign_identity) || left.candidate_id.localeCompare(right.candidate_id))
  const chunkInputs = Array.from({ length: Math.ceil(ordered.length / SOCIAL_CAMPAIGN_LONG_FORM_CHUNK_SIZE) }, (_, index) => ordered.slice(index * SOCIAL_CAMPAIGN_LONG_FORM_CHUNK_SIZE, (index + 1) * SOCIAL_CAMPAIGN_LONG_FORM_CHUNK_SIZE))
  const projections = chunkInputs.flatMap((chunk) => chunk.map((candidate) => projectCampaignLongFormDraft(candidate, now)))
  const inputFingerprint = hash(ordered.map((candidate) => ({
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    input_version: candidate.input_version,
    long_form_receipt: candidate.long_form_script_input ?? null,
  })))
  const chunks = chunkInputs.map((chunk, index) => {
    const chunkProjections = projections.slice(index * SOCIAL_CAMPAIGN_LONG_FORM_CHUNK_SIZE, index * SOCIAL_CAMPAIGN_LONG_FORM_CHUNK_SIZE + chunk.length)
    const candidateIds = chunk.map((candidate) => candidate.candidate_id)
    return {
      chunk_index: index + 1,
      chunk_id: `campaign-long-form-chunk-${hash({ index: index + 1, candidate_ids: candidateIds }).slice(7, 31)}`,
      candidate_ids: candidateIds,
      scanned: chunk.length,
      prepared: chunkProjections.filter((projection) => projection.ready).length,
      blocked: chunkProjections.filter((projection) => !projection.ready).length,
    }
  })
  const prepared = projections.flatMap((projection) => projection.packet ? [projection.packet] : [])
  const blocked = projections.filter((projection) => !projection.ready)
  return {
    version: SOCIAL_CAMPAIGN_LONG_FORM_BATCH_VERSION,
    batch_id: `campaign-long-form-batch-${inputFingerprint.slice(7, 31)}`,
    input_fingerprint: inputFingerprint,
    total: ordered.length,
    scanned: ordered.length,
    chunk_size: SOCIAL_CAMPAIGN_LONG_FORM_CHUNK_SIZE,
    chunks_processed: chunks.length,
    chunks,
    prepared_count: prepared.length,
    blocked_count: blocked.length,
    deferred_count: 0,
    remaining: 0,
    prepared,
    blocked,
    external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES,
  }
}

export function campaignLongFormBatchIdempotencyKey(batch: CampaignLongFormBatch) {
  return `social-campaign-long-form-batch:${batch.input_fingerprint}`
}
