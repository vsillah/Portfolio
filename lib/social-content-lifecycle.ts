import type { ContentStatus, SocialContentItem, SocialContentPublish } from '@/lib/social-content'

export type SocialContentLifecycleStep = 'context' | 'copy' | 'visuals' | 'draft' | 'submit' | 'status'
export type SocialContentLifecycleState = 'approved' | 'in_review' | 'pending' | 'blocked' | 'rejected'

export type LifecycleItem = Partial<Pick<SocialContentItem,
  | 'status'
  | 'post_text'
  | 'cta_text'
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
]

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

export function validateSocialContentFinalCopyQuality(item: LifecycleItem): SocialContentCopyQualityGate {
  const fields = collectFinalCopyFields(item)
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
  }

  return {
    status: findings.some((finding) => finding.severity === 'high') ? 'blocked' : findings.length ? 'blocked' : 'passed',
    findings,
    checkedFields: fields.map((field) => field.field),
    summary: findings.length
      ? `Final copy quality gate found ${findings.length} prompt/meta-instruction leakage pattern${findings.length === 1 ? '' : 's'}.`
      : 'Final copy quality gate passed.',
    recoveryAction: findings.length
      ? 'Revise the public copy to remove internal prompts, agent instructions, tool/debug metadata, and planning scaffolding before human approval.'
      : 'Continue to the normal copy review gate.',
  }
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
    || asString(ragContext?.content_packet_id)
    || asString(ragContext?.goal_id)
    || asString(ragContext?.launch_draft_asset_id)
    || asString(ragContext?.calendar_item_id)
    || asArray(ragContext?.provenance).length
    || asArray(ragContext?.source_ids).length
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
  return Boolean(
    gateApproved(ragContext, 'visual_assets')
    && gateApproved(ragContext, 'asset_packet')
    && gateApproved(ragContext, 'privacy')
  ) || Boolean(hasSubmissionOrPublishEvidence(item) && hasVisualAsset && (productionAssets || privacyReady))
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
