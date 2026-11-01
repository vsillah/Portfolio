import type { ContentStatus, SocialContentItem, SocialContentPublish } from '@/lib/social-content'

export type SocialContentLifecycleStep = 'context' | 'copy' | 'visuals' | 'draft' | 'submit' | 'status'
export type SocialContentLifecycleState = 'approved' | 'in_review' | 'pending' | 'blocked' | 'rejected'

export type LifecycleItem = Partial<Pick<SocialContentItem,
  | 'id'
  | 'status'
  | 'platform'
  | 'post_text'
  | 'cta_text'
  | 'cta_url'
  | 'voiceover_text'
  | 'youtube_title'
  | 'youtube_description'
  | 'companion_post_text'
  | 'carousel_slides'
  | 'rag_context'
  | 'target_platforms'
  | 'image_url'
  | 'video_url'
  | 'carousel_slide_urls'
  | 'platform_post_id'
  | 'published_at'
  | 'updated_at'
>> & {
  publishes?: Partial<Pick<SocialContentPublish, 'status' | 'platform_post_id' | 'platform_post_url' | 'published_at'>>[]
}

export type SocialContentLifecycleMismatch = {
  step: SocialContentLifecycleStep
  missingStep: SocialContentLifecycleStep
  message: string
  recoveryAction: string
}

export type SocialContentLifecycleProjection = {
  steps: Record<SocialContentLifecycleStep, {
    state: SocialContentLifecycleState
    rawState: SocialContentLifecycleState
    mismatch: SocialContentLifecycleMismatch | null
  }>
  firstIncompleteStep: SocialContentLifecycleStep | null
  mismatches: SocialContentLifecycleMismatch[]
}

export type SocialContentCopyQualityFinding = {
  code: string
  label: string
  field: string
  excerpt: string
  severity: 'high' | 'medium'
}

export type SocialContentCopyQualityGate = {
  status: 'passed' | 'blocked'
  findings: SocialContentCopyQualityFinding[]
  checkedFields: string[]
  summary: string
  recoveryAction: string
}

export type SocialPublicCopyField = {
  field: string
  text: string
}

const LIFECYCLE_ORDER: SocialContentLifecycleStep[] = ['context', 'copy', 'visuals', 'draft', 'submit', 'status']

const STEP_LABELS: Record<SocialContentLifecycleStep, string> = {
  context: 'Context',
  copy: 'Copy',
  visuals: 'Amina Visuals',
  draft: 'Draft',
  submit: 'Submit',
  status: 'Status',
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function excerptAround(text: string, index: number, length: number) {
  const start = Math.max(0, index - 48)
  const end = Math.min(text.length, index + length + 72)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`
}

const PROMPT_LEAKAGE_PATTERNS: Array<{
  code: string
  label: string
  severity: 'high' | 'medium'
  pattern: RegExp
}> = [
  {
    code: 'draft_seed_instruction', label: 'Unconverted draft seed', severity: 'high',
    pattern: /(?:^|\n)\s*(?:AutoResearch\s+)?draft\s+seed\s*:/i,
  },
  {
    code: 'editorial_brief_field', label: 'Editorial brief field in public copy', severity: 'high',
    pattern: /\b(?:CTA role|Source boundary)\s*:/i,
  },
  {
    code: 'copy_conversion_instruction', label: 'Agent copy-conversion instruction', severity: 'high',
    pattern: /\b(?:shaka\/content agents|content agents|agents)\s+must\s+(?:convert|rewrite|turn)\b[^.!?\n]{0,120}\b(?:channel|public|final)\s+copy\b/i,
  },
  {
    code: 'cta_writing_instruction', label: 'CTA writing instruction in final copy', severity: 'high',
    pattern: /\b(?:conversation\s+)?CTA\s+(?:should|must)\s+(?:ask|invite|encourage|direct)\b/i,
  },
  {
    code: 'role_prompt_fragment',
    label: 'Embedded system/developer/user prompt fragment',
    severity: 'high',
    pattern: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:system|developer|user|assistant)\s+(?:prompt|message|instructions?)\s*:/i,
  },
  {
    code: 'xml_prompt_tag',
    label: 'Prompt XML tag leaked into copy',
    severity: 'high',
    pattern: /<\/?(?:system|developer|user|assistant|codex_delegation|instructions?|input)\b[^>]*>/i,
  },
  {
    code: 'agent_directive',
    label: 'Internal agent directive leaked into copy',
    severity: 'high',
    pattern: /\b(?:internal\s+)?(?:agent|captain|codex|shaka|amina)\s+(?:instruction|instructions|directive|prompt|qa block|handoff|worktree|lane)\b/i,
  },
  {
    code: 'rewrite_instruction',
    label: 'Rewrite instruction leaked into final copy',
    severity: 'high',
    pattern: /\b(?:rewrite|revise|generate|write)\s+(?:this|the|it|as|into|in the voice of)\b/i,
  },
  {
    code: 'forbidden_content_instruction',
    label: 'Forbidden-content instruction leaked into copy',
    severity: 'high',
    pattern: /\b(?:do not|don't)\s+include\b/i,
  },
  {
    code: 'planning_scaffold',
    label: 'Planning or checklist scaffold leaked into copy',
    severity: 'medium',
    pattern: /(?:^|\n)\s*(?:plan|checklist|todo|acceptance criteria|validation|qa notes?|debug|tool output|provenance|source register)\s*:/i,
  },
  {
    code: 'checkbox_scaffold',
    label: 'Checklist syntax leaked into copy',
    severity: 'medium',
    pattern: /(?:^|\n)\s*[-*]\s*\[[ xX]\]\s+\S+/,
  },
  {
    code: 'tool_debug_metadata',
    label: 'Tool, provenance, or debug metadata leaked into copy',
    severity: 'high',
    pattern: /\b(?:externalRequests|unexpectedRequests|idempotencyKey|rag_context|pass_to_human|current_gate|publish_gate|blocked_actions|tool_call|function_call)\b/i,
  },
  {
    code: 'model_refusal_meta',
    label: 'Model/meta response text leaked into copy',
    severity: 'medium',
    pattern: /\b(?:as an ai|i (?:cannot|can't) comply|i don't have access to|knowledge cutoff)\b/i,
  },
  {
    code: 'third_person_author_name',
    label: 'Third-person author reference in public copy',
    severity: 'high',
    pattern: /\bVambah\b/i,
  },
  {
    code: 'private_email_address',
    label: 'Email address in public copy',
    severity: 'high',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    code: 'private_phone_number',
    label: 'Phone number in public copy',
    severity: 'high',
    pattern: /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/,
  },
  {
    code: 'production_script_label',
    label: 'Production or reviewer label leaked into audience script',
    severity: 'high',
    pattern: /(?:^|\n)\s*(?:opening hook|context|why i can speak to it|core argument|proof walkthrough|reviewer note|operating takeaway|cover\/opening|voiceover|proof moment|caption bridge|\d+-\d+s (?:hook|tension|proof cue)|quick cut|plain-language point|close)\s*:/i,
  },
]

const SPOKEN_CUSTOMER_COPY_FIELD = /^(?:voiceover_text|youtube\.(?:opening_hook|first_30_seconds|full_video_script)|youtube_shorts\.(?:hook|first_30_seconds|script)|instagram_reels\.(?:hook|script)|tiktok\.(?:hook|script))$/

const SPOKEN_SYSTEM_DISCLOSURE_PATTERN = /\b(?:(?:this|the)\s+(?:(?:ai\s+audit|product|interface)\s+)?(?:screenshot|screen|demo|example|walkthrough|calculator)\s+(?:(?:is|was)\s+(?:using|built\s+with|shown\s+with)|uses)\s+(?:sample|synthetic|mock|demo|placeholder|test)\s+data|(?:sample|synthetic|mock|demo|placeholder|test)\s+data\s+(?:is|was|are|were)\s+(?:being\s+)?used|for\s+(?:demo|demonstration|testing)\s+purposes\s+only)\b/i

function collectFinalCopyFields(item: LifecycleItem): Array<{ field: string; text: string }> {
  const fields: Array<{ field: string; text: string }> = []
  const add = (field: string, value: unknown) => {
    const text = asString(value)
    if (text) fields.push({ field, text })
  }

  add('post_text', item.post_text)
  add('cta_text', item.cta_text)
  add('companion_post_text', item.companion_post_text)
  add('voiceover_text', item.voiceover_text)
  add('youtube_title', item.youtube_title)
  add('youtube_description', item.youtube_description)

  asArray(item.carousel_slides).forEach((slide, index) => {
    const record = asRecord(slide)
    if (!record) return
    for (const key of ['eyebrow', 'headline', 'subhead', 'body', 'blockquote', 'cta_label', 'caption'] as const) {
      add(`carousel_slides.${index}.${key}`, record[key])
    }
  })

  return fields
}

export function validateSocialPublicCopyFields(fields: SocialPublicCopyField[]): SocialContentCopyQualityGate {
  const findings: SocialContentCopyQualityFinding[] = []

  for (const field of fields) {
    for (const leakagePattern of PROMPT_LEAKAGE_PATTERNS) {
      const match = leakagePattern.pattern.exec(field.text)
      if (!match) continue
      findings.push({
        code: leakagePattern.code,
        label: leakagePattern.label,
        field: field.field,
        excerpt: excerptAround(field.text, match.index, match[0].length),
        severity: leakagePattern.severity,
      })
    }

    if (SPOKEN_CUSTOMER_COPY_FIELD.test(field.field)) {
      const disclosureMatch = SPOKEN_SYSTEM_DISCLOSURE_PATTERN.exec(field.text)
      if (disclosureMatch) {
        findings.push({
          code: 'spoken_system_disclosure',
          label: 'Production disclosure leaked into spoken customer copy',
          field: field.field,
          excerpt: excerptAround(field.text, disclosureMatch.index, disclosureMatch[0].length),
          severity: 'high',
        })
      }
    }
  }

  return {
    status: findings.some((finding) => finding.severity === 'high') ? 'blocked' : findings.length ? 'blocked' : 'passed',
    findings,
    checkedFields: fields.map((field) => field.field),
    summary: findings.length
      ? `Final copy quality gate found ${findings.length} customer-facing copy issue${findings.length === 1 ? '' : 's'}.`
      : 'Final copy quality gate passed.',
    recoveryAction: findings.length
      ? 'Revise the public copy to remove internal prompts, production notes, tool/debug metadata, and planning scaffolding. Put required disclosures in channel metadata or rewrite them as natural audience-facing language before human approval.'
      : 'Continue to the normal copy review gate.',
  }
}

export function validateSocialContentFinalCopyQuality(item: LifecycleItem): SocialContentCopyQualityGate {
  return validateSocialPublicCopyFields(collectFinalCopyFields(item))
}

export function socialContentFinalCopyQualityFailure(
  qualityGate: SocialContentCopyQualityGate,
  lifecycleStep: SocialContentLifecycleStep = 'copy',
) {
  if (qualityGate.status !== 'blocked') return null
  return {
    error: 'Final copy quality gate blocked prompt leakage before human approval.',
    lifecycle_step: lifecycleStep,
    current_gate: 'final_copy_quality',
    revision_state: 'revision_needed',
    blockers: qualityGate.findings.map((finding) => `${finding.label} in ${finding.field}`),
    recovery_action: qualityGate.recoveryAction,
    quality_gate: qualityGate,
  }
}

function gateApproved(ragContext: Record<string, unknown> | null, key: string) {
  return asString(asRecord(asRecord(ragContext?.section_gate_reviews)?.[key])?.status) === 'approved'
}

function hasApprovedTextOnlyXEvidence(ragContext: Record<string, unknown> | null) {
  const batchApproval = asRecord(ragContext?.x_batch_approval)
  const approvedScope = new Set(asArray(batchApproval?.approved_scope).map(asString))
  return asString(batchApproval?.status) === 'approved'
    && ['copy', 'source_distance_review', 'privacy_review'].every((scope) => approvedScope.has(scope))
    && asString(asRecord(ragContext?.privacy_review)?.status) === 'approved'
    && asString(asRecord(ragContext?.source_distance_review)?.status) === 'approved'
}

export function isDurableCopyApprovedStatus(status: unknown): status is Extract<ContentStatus, 'approved' | 'scheduled' | 'published'> {
  return status === 'approved' || status === 'scheduled' || status === 'published'
}

export function hasSubmissionOrPublishEvidence(item: LifecycleItem) {
  if (item.status === 'scheduled' || item.status === 'published') return true
  if (asString(item.platform_post_id) || asString(item.published_at)) return true
  return (item.publishes ?? []).some((publish) => (
    publish.status === 'published'
    || Boolean(asString(publish.platform_post_id))
    || Boolean(asString(publish.platform_post_url))
    || Boolean(asString(publish.published_at))
  ))
}

export function hasActualPublishedEvidence(item: LifecycleItem) {
  if (item.status === 'published') return true
  if (asString(item.platform_post_id) || asString(item.published_at)) return true
  return (item.publishes ?? []).some((publish) => (
    publish.status === 'published'
    || Boolean(asString(publish.platform_post_id))
    || Boolean(asString(publish.platform_post_url))
    || Boolean(asString(publish.published_at))
  ))
}

export function hasSocialContentContextEvidence(item: LifecycleItem) {
  const ragContext = asRecord(item.rag_context)
  const sourceRecorded = Boolean(
    asString(ragContext?.launch_packet_path)
    || asString(ragContext?.source_packet_path)
    || asString(ragContext?.source_packet)
    || asString(ragContext?.approved_packet_path)
    || asString(ragContext?.content_packet_id)
    || asString(ragContext?.goal_id)
    || asString(ragContext?.launch_draft_asset_id)
    || asString(ragContext?.calendar_item_id)
    || asArray(ragContext?.provenance).length
    || asArray(ragContext?.source_ids).length
    || asArray(ragContext?.source_lineage).length
  )
  const calibrationRecorded = Boolean(
    asRecord(ragContext?.calibration)
    || asString(ragContext?.campaign_name)
    || asString(ragContext?.channel)
    || asString(ragContext?.platform)
    || asArray(item.target_platforms).length
  )
  const claimsRecorded = Boolean(
    asString(ragContext?.approval_boundary)
    || asString(ragContext?.challenger_status)
    || asArray(ragContext?.approval_checklist).length
    || asArray(ragContext?.required_fixes).length
    || ragContext?.pass_to_human === true
  )

  return sourceRecorded && (calibrationRecorded || claimsRecorded || ragContext?.pass_to_human === true)
}

export function hasSocialContentVisualPrerequisites(item: LifecycleItem) {
  const ragContext = asRecord(item.rag_context)
  const hasVisualAsset = Boolean(
    asString(item.image_url)
    || asString(item.video_url)
    || asArray(item.carousel_slide_urls).length
  )
  const targetPlatforms = asArray(item.target_platforms).map(asString).filter(Boolean)
  const targetsX = targetPlatforms.some((platform) => platform.toLowerCase() === 'x')
  const targetsOnlyX = targetPlatforms.length > 0
    && targetPlatforms.every((platform) => platform.toLowerCase() === 'x')
  if (!hasVisualAsset && targetsX) {
    return targetsOnlyX && hasApprovedTextOnlyXEvidence(ragContext)
  }
  const productionAssets = asRecord(ragContext?.production_assets)
  const privacyReady = asString(asRecord(productionAssets?.video_redaction_manifest)?.status) === 'ready'
    || gateApproved(ragContext, 'privacy')
  return hasReceiptBackedLinkedInVisualApproval(item) || Boolean(
    gateApproved(ragContext, 'visual_assets')
    && gateApproved(ragContext, 'asset_packet')
    && gateApproved(ragContext, 'privacy')
  ) || Boolean(hasSubmissionOrPublishEvidence(item) && hasVisualAsset && (productionAssets || privacyReady))
}

/** Projects the later immutable review chain when the old visual-assets flag was never written. */
export function hasReceiptBackedLinkedInVisualApproval(item: LifecycleItem) {
  const context = asRecord(item.rag_context)
  const handoff = asRecord(context?.linkedin_draft_handoff)
  const lineage = asRecord(handoff?.canonical_decision_lineage)
  const reviews = asRecord(context?.section_gate_reviews)
  const mobile = asRecord(context?.mobile_decision_review)
  const mobileReceipts = asRecord(mobile?.receipts)
  const handoffReceipts = asRecord(handoff?.evidence_receipts)
  const candidate = asRecord(handoff?.candidate_projection)
  const storedCandidate = asRecord(context?.copy_review_candidate_projection)
  const hash = asString(context?.approved_visual_sha256)
  const submission = asRecord(context?.platform_submission_gate)
  if (item.platform !== 'linkedin' || asString(handoff?.version) !== 'linkedin_draft_handoff_v2'
    || asString(context?.current_gate) !== 'platform_submission'
    || asString(handoff?.social_content_id) !== asString(item.id)
    || handoff?.external_execution !== false || !lineage || !reviews || !mobileReceipts
    || !handoffReceipts || !candidate || !storedCandidate
    || !/^sha256:[a-f0-9]{64}$/.test(hash)
    || asString(candidate.visual_sha256) !== hash
    || asString(storedCandidate.visual_sha256) !== hash
    || asString(candidate.image_url) !== asString(item.image_url)
    || asString(storedCandidate.image_url) !== asString(item.image_url)
    || !asString(item.image_url)
    || ['post_text', 'cta_text', 'cta_url', 'image_url', 'visual_sha256'].some((key) =>
      asString(candidate[key]) !== asString(storedCandidate[key]))
    || asString(candidate.post_text) !== asString(item.post_text)
    || asString(candidate.cta_text) !== asString(item.cta_text)
    || asString(candidate.cta_url) !== asString(item.cta_url)
    || (submission?.status === 'approved' && (
      !asString(submission.decision_receipt_id)
      || asString(submission.decision_receipt_id) !== asString(context?.latest_internal_decision_receipt_id)
      || asString(submission.context_reconciliation_receipt) !== asString(asRecord(mobileReceipts.source)?.receipt_id)
    ))) return false

  const decisions = [
    ['visual_review', 'visual_review_receipt_id'],
    ['asset_packet', 'asset_packet_receipt_id'],
    ['privacy', 'privacy_receipt_id'],
  ] as const
  const ids = decisions.map(([key, lineageKey]) => {
    const review = asRecord(reviews[key])
    const id = asString(review?.decision_receipt_id)
    return review?.status === 'approved' && id === asString(lineage[lineageKey]) ? id : ''
  })
  const copyId = asString(lineage.copy_receipt_id)
  if (!copyId || ids.some((id) => !id) || new Set([copyId, ...ids]).size !== 4
    || asString(handoff.privacy_decision_receipt_id) !== ids[2]) return false

  const packetVersion = asString(mobile?.content_updated_at)
  const handoffVersion = asString(asRecord(handoffReceipts.source)?.content_updated_at)
  if (!packetVersion || !handoffVersion) return false
  for (const key of ['source', 'visual', 'privacy'] as const) {
    const current = asRecord(mobileReceipts[key])
    const prior = asRecord(handoffReceipts[key])
    const expectedStatus = key === 'privacy' ? 'passed' : 'approved'
    if (!current || !prior || asString(current.status) !== expectedStatus
      || asString(prior.status) !== expectedStatus
      || !asString(current.receipt_id)
      || asString(current.receipt_id) !== asString(prior.receipt_id)
      || asString(current.content_updated_at) !== packetVersion
      || asString(prior.content_updated_at) !== handoffVersion) return false
  }
  const visual = asRecord(mobileReceipts.visual)
  return asString(visual?.asset_sha256) === hash
    || asString(visual?.receipt_id).endsWith(hash)
}

export function deriveSocialContentLifecycleProjection(input: {
  item: LifecycleItem
  rawStates?: Partial<Record<SocialContentLifecycleStep, SocialContentLifecycleState>>
}): SocialContentLifecycleProjection {
  const { item } = input
  const ragContext = asRecord(item.rag_context)
  const submissionOrPublishEvidence = hasSubmissionOrPublishEvidence(item)
  const actualPublishedEvidence = hasActualPublishedEvidence(item)
  const copyQualityGate = validateSocialContentFinalCopyQuality(item)
  const rawStates: Record<SocialContentLifecycleStep, SocialContentLifecycleState> = {
    context: hasSocialContentContextEvidence(item) ? 'approved' : 'pending',
    copy: isDurableCopyApprovedStatus(item.status) ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending',
    visuals: hasSocialContentVisualPrerequisites(item) ? 'approved' : 'pending',
    draft: asRecord(ragContext?.linkedin_draft_handoff) || (item.publishes?.length ?? 0) > 0 || submissionOrPublishEvidence ? 'approved' : 'pending',
    submit: asString(asRecord(ragContext?.platform_submission_gate)?.status) === 'approved' || submissionOrPublishEvidence ? 'approved' : 'pending',
    status: actualPublishedEvidence ? 'approved' : 'pending',
    ...input.rawStates,
  }
  if (copyQualityGate.status === 'blocked' && rawStates.copy !== 'rejected') {
    rawStates.copy = 'blocked'
  }
  const steps = {} as SocialContentLifecycleProjection['steps']
  const mismatches: SocialContentLifecycleMismatch[] = []

  for (const step of LIFECYCLE_ORDER) {
    const priorMissing = LIFECYCLE_ORDER.slice(0, LIFECYCLE_ORDER.indexOf(step))
      .find((prior) => steps[prior].state !== 'approved')
    const rawState = rawStates[step]
    if (rawState === 'approved' && priorMissing) {
      const mismatch = {
        step,
        missingStep: priorMissing,
        message: `${STEP_LABELS[step]} has downstream evidence, but ${STEP_LABELS[priorMissing]} is not approved.`,
        recoveryAction: `Recover ${STEP_LABELS[priorMissing]} before treating ${STEP_LABELS[step]} as approved.`,
      }
      mismatches.push(mismatch)
      steps[step] = { state: 'blocked', rawState, mismatch }
    } else {
      steps[step] = { state: rawState, rawState, mismatch: null }
    }
  }

  return {
    steps,
    firstIncompleteStep: LIFECYCLE_ORDER.find((step) => steps[step].state !== 'approved') ?? null,
    mismatches,
  }
}

export function lifecyclePrerequisiteFailure(
  projection: SocialContentLifecycleProjection,
  targetStep: SocialContentLifecycleStep,
) {
  const missingStep = LIFECYCLE_ORDER.slice(0, LIFECYCLE_ORDER.indexOf(targetStep))
    .find((step) => projection.steps[step].state !== 'approved')
  if (!missingStep) return null
  const mismatch = projection.steps[targetStep].mismatch
  return {
    error: 'Social Content lifecycle prerequisite blocked.',
    lifecycle_step: targetStep,
    missing_prerequisite: missingStep,
    missing_prerequisite_label: STEP_LABELS[missingStep],
    blockers: [
      mismatch?.message ?? `${STEP_LABELS[targetStep]} requires ${STEP_LABELS[missingStep]} approval first.`,
    ],
    recovery_action: mismatch?.recoveryAction ?? `Approve or recover ${STEP_LABELS[missingStep]} before continuing.`,
    lifecycle: projection.steps,
  }
}
