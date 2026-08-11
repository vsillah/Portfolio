import type { ContentStatus, SocialContentItem, SocialContentPublish } from '@/lib/social-content'

export type SocialContentLifecycleStep = 'context' | 'copy' | 'visuals' | 'draft' | 'submit' | 'status'
export type SocialContentLifecycleState = 'approved' | 'in_review' | 'pending' | 'blocked' | 'rejected'

type LifecycleItem = Partial<Pick<SocialContentItem,
  | 'status'
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

function gateApproved(ragContext: Record<string, unknown> | null, key: string) {
  return asString(asRecord(asRecord(ragContext?.section_gate_reviews)?.[key])?.status) === 'approved'
}

export function isDurableCopyApprovedStatus(status: unknown): status is Extract<ContentStatus, 'approved' | 'scheduled' | 'published'> {
  return status === 'approved' || status === 'scheduled' || status === 'published'
}

export function hasSuccessfulPublishEvidence(item: LifecycleItem) {
  if (item.status === 'scheduled' || item.status === 'published') return true
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
  const productionAssets = asRecord(ragContext?.production_assets)
  const privacyReady = asString(asRecord(productionAssets?.video_redaction_manifest)?.status) === 'ready'
    || gateApproved(ragContext, 'privacy')
  return Boolean(
    gateApproved(ragContext, 'visual_assets')
    && gateApproved(ragContext, 'asset_packet')
    && gateApproved(ragContext, 'privacy')
  ) || Boolean(hasSuccessfulPublishEvidence(item) && hasVisualAsset && (productionAssets || privacyReady))
}

export function deriveSocialContentLifecycleProjection(input: {
  item: LifecycleItem
  rawStates?: Partial<Record<SocialContentLifecycleStep, SocialContentLifecycleState>>
}): SocialContentLifecycleProjection {
  const { item } = input
  const ragContext = asRecord(item.rag_context)
  const successfulPublishEvidence = hasSuccessfulPublishEvidence(item)
  const rawStates: Record<SocialContentLifecycleStep, SocialContentLifecycleState> = {
    context: hasSocialContentContextEvidence(item) ? 'approved' : 'pending',
    copy: isDurableCopyApprovedStatus(item.status) ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending',
    visuals: hasSocialContentVisualPrerequisites(item) ? 'approved' : 'pending',
    draft: asRecord(ragContext?.linkedin_draft_handoff) || (item.publishes?.length ?? 0) > 0 || successfulPublishEvidence ? 'approved' : 'pending',
    submit: asString(asRecord(ragContext?.platform_submission_gate)?.status) === 'approved' || successfulPublishEvidence ? 'approved' : 'pending',
    status: successfulPublishEvidence ? 'approved' : 'pending',
    ...input.rawStates,
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
