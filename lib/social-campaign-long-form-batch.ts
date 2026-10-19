import { deterministicSha256Hex } from '@/lib/deterministic-sha256.mjs'
import {
  LONG_FORM_FRAMEWORK_LIBRARY,
  LONG_FORM_FRAMEWORK_LIBRARY_VERSION,
  LONG_FORM_SCRIPT_INTELLIGENCE_VERSION,
  evaluateLongFormScriptIntelligence,
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
export const SOCIAL_CAMPAIGN_LONG_FORM_DRAFT_VERSION = 'campaign-long-form-draft-packet/v1' as const
export const SOCIAL_CAMPAIGN_LONG_FORM_BATCH_VERSION = 'campaign-long-form-batch/v1' as const
export const SOCIAL_CAMPAIGN_LONG_FORM_BATCH_LIMIT = 10

export type CampaignLongFormDraftPacket = {
  version: typeof SOCIAL_CAMPAIGN_LONG_FORM_DRAFT_VERSION
  packet_id: string
  candidate_id: string
  campaign_identity: string
  social_content_id: string
  content_version: string
  input_version: string
  framework_receipt_id: string
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
  limit: number
  scanned: number
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

function frameworkBlockers(candidate: CampaignPreparationCandidate, receipt: CampaignLongFormScriptInputReceipt | null, now: Date) {
  const recovery = receipt?.source_href || `/admin/content/video-generation?campaign=${encodeURIComponent(candidate.campaign_identity)}&review=script-intelligence`
  if (!receipt) return [blocker('long_form_framework_missing', 'A version-bound long-form Script Intelligence input receipt is required.', 'Complete Script Intelligence inputs', recovery)]
  const blockers: CampaignPreparationBlocker[] = []
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
  if (!receipt.topic.trim() || !receipt.promise.trim() || receipt.expected_duration_seconds < 180) blockers.push(blocker('long_form_script_contract', 'Topic, promise, and a duration of at least three minutes are required.', 'Complete script contract', recovery))
  if (receipt.topic_outlier_evidence.length < 3) blockers.push(blocker('long_form_topic_evidence', 'At least three attributable current same-topic comparisons are required.', 'Expand live topic evidence', recovery))
  if (receipt.creator_distance.status !== 'passed' || receipt.creator_distance.voice_profile !== 'vambah-approved') blockers.push(blocker('long_form_creator_distance', 'A passed creator-distance and approved voice receipt is required.', 'Complete originality distance', recovery))
  return blockers
}

function scriptBeats(candidate: CampaignPreparationCandidate, receipt: CampaignLongFormScriptInputReceipt): LongFormScriptBeat[] {
  const topic = receipt.topic
  const promise = receipt.promise
  const product = candidate.product_label
  const proof = candidate.deliverables.youtube.description || candidate.deliverables.linkedin.copy
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
    beat('campaign-hook', 0, 7, 'hook', `If you are trying to understand ${topic}, the hardest part is separating a strong story from a claim the evidence cannot carry. ${product} gives us a practical way to examine that problem through visible product proof, current source evidence, and a review path that keeps every conclusion honest.`, visual(0, `Open on the approved ${product} product view.`), `On-screen question: What can ${product} actually prove?`),
    beat('campaign-open-loop', 7, 27, 'open_loop', `By the end, I will show you ${promise}. We will inspect the problem, walk through the approved ${product} evidence, test the lesson against current topic comparisons, and close with the exact boundary between what the product demonstrates and what still needs measurement.`, visual(0, `Move from the viewer problem into the ${product} interface.`), 'Chapter card: Problem, proof, boundary.'),
    beat('campaign-frame', 27, 43, 'frame', `The starting point is simple: access and operating reality shape outcomes. A useful product story must show what someone can see, what action becomes easier, and which burden is reduced. It also has to name the limit, because confidence without a visible basis creates more work instead of less.`, visual(1, 'Show the workflow before-and-after state.'), 'Pull quote emphasizing visible evidence.'),
    beat('campaign-proof', 43, 63, 'proof', `Here is the first-party proof for ${product}. ${proof} I am using the approved product view and its bound evidence receipt, so the claim stays next to the screen, interaction, or artifact that supports it. Nothing in this walkthrough depends on a generic illustration or an unverified outcome.`, visual(1, `Walk through the approved ${product} product evidence.`), 'Zoom to the exact control or result being discussed.'),
    beat('campaign-teaching-one', 63, 86, 'teaching', `The first lesson is alignment. The opening promise, the product evidence, and the practical takeaway must describe the same problem. When those pieces drift apart, the script may sound polished while the viewer is left carrying the work of connecting them. The review receipt makes that drift visible before approval.`, visual(2, 'Show the evidence-to-claim binding and source trace.'), 'Switch from product view to evidence receipt.'),
    beat('campaign-rehook-one', 86, 101, 'rehook', `But alignment alone is not enough. The next question is whether current public attention supports this exact topic, or whether we are borrowing momentum from a different conversation. That distinction decides whether the idea is timely, merely interesting, or still Unscored.`, visual(2, 'Show included and excluded live topic comparisons.'), 'On-screen label: Same topic or borrowed attention?'),
    beat('campaign-teaching-two', 101, 126, 'teaching', `The live comparison set answers that question with attributable sources, observation dates, channel baselines, and declared outlier thresholds. Included sources must match the topic and remain fresh. Excluded sources stay visible with a reason. Saved playlist examples can shape taste, but they carry zero performance weight and cannot manufacture confidence.`, visual(2, 'Walk through current topic evidence and exclusions.'), 'Change layout to selected versus excluded sources.'),
    beat('campaign-teaching-three', 126, 145, 'teaching', `Originality creates the next boundary. The framework can teach structure: open a loop, place proof beside the claim, renew attention, and earn the call to action. The final words, examples, moral frame, and product lesson must remain original. Creator distance is checked as evidence, not assumed from good intentions.`, visual(3, 'Show the creator-distance and originality receipt.'), 'Highlight structure versus copied language.'),
    beat('campaign-rehook-two', 145, 151, 'rehook', `So the final test is practical: did this script deliver ${promise}, with proof the viewer can inspect and limits the viewer can understand?`, visual(3, 'Return to the approved product proof.'), 'On-screen return to the opening promise.'),
    beat('campaign-payoff', 151, 160, 'payoff', `The result is ${promise}. ${product} becomes a demonstrated practice rather than an abstract claim: the viewer can see the product, follow the reasoning, inspect the evidence, and understand the boundary before deciding what to do next.`, null, null),
    beat('campaign-conclusion', 160, 170, 'conclusion', `A trustworthy product story does not ask confidence to outrun proof. It connects the problem, the visible product behavior, the current evidence, and the limitation in one clear line. That is how technology can reduce burden while preserving the dignity and judgment of the person using it.`, null, null),
    beat('campaign-cta', 170, 180, 'cta', `Open the source trace and inspect one ${product} proof decision for yourself. If the evidence and promise match, send this review-only script to the separate Decision Queue. If they do not, return it with the exact blocker before any render or provider gate opens.`, null, null),
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
      evaluation_receipt: evaluation,
      external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES,
    },
  }
}

export function projectCampaignLongFormBatch(candidates: CampaignPreparationCandidate[], now = new Date()): CampaignLongFormBatch {
  const bounded = candidates.slice(0, SOCIAL_CAMPAIGN_LONG_FORM_BATCH_LIMIT)
  const projections = bounded.map((candidate) => projectCampaignLongFormDraft(candidate, now))
  const inputFingerprint = hash(bounded.map((candidate) => ({
    candidate_id: candidate.candidate_id,
    input_version: candidate.input_version,
    long_form_receipt: candidate.long_form_script_input ?? null,
  })))
  return {
    version: SOCIAL_CAMPAIGN_LONG_FORM_BATCH_VERSION,
    batch_id: `campaign-long-form-batch-${inputFingerprint.slice(7, 31)}`,
    input_fingerprint: inputFingerprint,
    limit: SOCIAL_CAMPAIGN_LONG_FORM_BATCH_LIMIT,
    scanned: bounded.length,
    prepared: projections.flatMap((projection) => projection.packet ? [projection.packet] : []),
    blocked: projections.filter((projection) => !projection.ready),
    external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES,
  }
}

export function campaignLongFormBatchIdempotencyKey(batch: CampaignLongFormBatch) {
  return `social-campaign-long-form-batch:${batch.input_fingerprint}`
}
