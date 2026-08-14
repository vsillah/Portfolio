import type { SocialContentItem, SocialContentPublish, SocialPlatform } from '@/lib/social-content'
import type {
  SocialContentLifecycleProjection,
  SocialContentLifecycleState,
  SocialContentLifecycleStep,
} from '@/lib/social-content-lifecycle'
import vercelConfig from '@/vercel.json'

export type PublicationProjectionState =
  | 'scheduled'
  | 'ready_unscheduled'
  | 'submitting'
  | 'published'
  | 'failed'
  | 'blocked'
  | 'cancelled'
  | 'skipped'
  | 'ambiguous'

export type PublicationProjectionTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate'

export type PublicationProjection = {
  platform: SocialPlatform
  state: PublicationProjectionState
  stateLabel: string
  headline: string
  explanation: string
  owner: string
  nextAction: string
  waitingOnYou: string
  tone: PublicationProjectionTone
  scheduledTime: string | null
  publishedTime: string | null
  lastMaterialUpdate: string | null
  permalink: string | null
  rawStatus: string
  reason: string | null
}

type ProjectionDateOptions = {
  locale?: string
  timeZone?: string
}

type PublicationProjectionInput = ProjectionDateOptions & {
  item: Pick<SocialContentItem, 'status' | 'scheduled_for' | 'updated_at'>
  publish: Pick<
    SocialContentPublish,
    | 'platform'
    | 'status'
    | 'platform_post_id'
    | 'platform_post_url'
    | 'error_message'
    | 'published_at'
    | 'updated_at'
  >
  now?: Date
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
}

const SCHEDULED_PUBLISH_CRON = vercelConfig.crons.find(
  (cron) => cron.path === '/api/cron/social-content-scheduled-publish',
)

const SCHEDULED_PUBLISH_CADENCE = SCHEDULED_PUBLISH_CRON?.schedule === '0 * * * *'
  ? 'hourly'
  : null

const PUBLICATION_PREREQUISITE_STEPS: SocialContentLifecycleStep[] = [
  'context',
  'copy',
  'visuals',
  'draft',
  'submit',
]

const LIFECYCLE_STEP_DETAILS: Record<SocialContentLifecycleStep, {
  label: string
  owner: string
  nextAction: (state: SocialContentLifecycleState) => string
  waitingOnYou: (state: SocialContentLifecycleState) => string
}> = {
  context: {
    label: 'Context',
    owner: 'Shaka / Amina',
    nextAction: () => 'Record or recover the attributable source basis, audience calibration, and claim constraints.',
    waitingOnYou: () => 'Yes - context recovery decision',
  },
  copy: {
    label: 'Copy',
    owner: 'Vambah / Shaka',
    nextAction: () => 'Complete the editorial decision before downstream publication work can proceed.',
    waitingOnYou: () => 'Yes - editorial decision',
  },
  visuals: {
    label: 'Amina Visuals',
    owner: 'Amina',
    nextAction: (state) => state === 'pending'
      ? 'Amina must complete the applicable visual, privacy, rights, and source-distance evidence.'
      : 'Resolve or approve the visual, privacy, and rights review before publication can proceed.',
    waitingOnYou: (state) => state === 'pending'
      ? 'No - Amina owns the next action'
      : 'Yes - visual/privacy review or exception',
  },
  draft: {
    label: 'Draft',
    owner: 'Publishing lane',
    nextAction: (state) => state === 'pending'
      ? 'Create the governed platform draft handoff.'
      : 'Resolve or approve the platform draft handoff.',
    waitingOnYou: (state) => state === 'pending'
      ? 'No - Publishing lane owns the next action'
      : 'Yes - draft handoff review',
  },
  submit: {
    label: 'Submit',
    owner: 'Publishing lane',
    nextAction: () => 'Complete the explicit provider-submission gate before hosted automation can run.',
    waitingOnYou: () => 'Yes - submit decision',
  },
  status: {
    label: 'Status',
    owner: 'Publishing reconciliation lane',
    nextAction: () => 'Reconcile provider evidence before treating publication as complete.',
    waitingOnYou: () => 'No - internal reconciliation required',
  },
}

export function formatPublicationDate(
  value: string | null | undefined,
  options: ProjectionDateOptions = {},
): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(options.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(date)
}

function projection(
  input: PublicationProjectionInput,
  values: Omit<PublicationProjection, 'platform' | 'rawStatus' | 'lastMaterialUpdate'>,
): PublicationProjection {
  return {
    platform: input.publish.platform,
    rawStatus: String(input.publish.status || 'unknown'),
    lastMaterialUpdate: formatPublicationDate(
      input.publish.updated_at || input.item.updated_at,
      input,
    ),
    ...values,
  }
}

export function derivePublicationProjection(input: PublicationProjectionInput): PublicationProjection {
  const queueStatus = String(input.item.status || '').toLowerCase()
  const rawStatus = String(input.publish.status || '').toLowerCase()
  const platformLabel = PLATFORM_LABELS[input.publish.platform] || input.publish.platform
  const scheduledTime = formatPublicationDate(input.item.scheduled_for, input)
  const publishedTime = formatPublicationDate(input.publish.published_at, input)
  const providerEvidence = Boolean(
    input.publish.platform_post_id
    || input.publish.platform_post_url
    || input.publish.published_at,
  )
  const cancellationMessage = input.publish.error_message?.startsWith('Scheduled publication cancelled by ')
    ? input.publish.error_message
    : null

  if (rawStatus === 'published' && providerEvidence) {
    return projection(input, {
      state: 'published',
      stateLabel: 'Published',
      headline: `Published on ${platformLabel}`,
      explanation: publishedTime
        ? `The provider confirmed publication at ${publishedTime}.`
        : 'The provider confirmed publication. A publication timestamp was not recorded.',
      owner: 'Published / analytics monitoring',
      nextAction: 'Monitor post signals and imported comments.',
      waitingOnYou: 'No',
      tone: 'green',
      scheduledTime,
      publishedTime,
      permalink: input.publish.platform_post_url,
      reason: null,
    })
  }

  if (rawStatus === 'cancelled' || queueStatus === 'cancelled' || (rawStatus === 'skipped' && cancellationMessage)) {
    return projection(input, {
      state: 'cancelled',
      stateLabel: 'Cancelled',
      headline: `${platformLabel} publication cancelled`,
      explanation: 'Scheduled publication intent was cancelled before provider submission. The content and provider history were preserved.',
      owner: 'Publishing lane',
      nextAction: 'No provider action will run unless a new governed publication intent is created.',
      waitingOnYou: 'No',
      tone: 'slate',
      scheduledTime,
      publishedTime,
      permalink: input.publish.platform_post_url,
      reason: cancellationMessage,
    })
  }

  if (rawStatus === 'skipped') {
    return projection(input, {
      state: 'skipped',
      stateLabel: 'Skipped',
      headline: `${platformLabel} publication skipped`,
      explanation: input.publish.error_message
        ? `The provider handoff was skipped; no publication was confirmed. ${input.publish.error_message}`
        : 'The provider handoff was intentionally skipped; no publication was confirmed.',
      owner: 'Publishing lane',
      nextAction: 'Review the recorded decision before creating a new publication intent.',
      waitingOnYou: 'No',
      tone: 'slate',
      scheduledTime,
      publishedTime,
      permalink: input.publish.platform_post_url,
      reason: input.publish.error_message,
    })
  }

  if (rawStatus === 'failed' || input.publish.error_message) {
    const reason = input.publish.error_message || 'The provider submission failed without a recorded reason.'
    return projection(input, {
      state: 'failed',
      stateLabel: 'Failed',
      headline: `${platformLabel} submission failed`,
      explanation: `Portfolio did not confirm publication. ${reason}`,
      owner: 'Publishing recovery lane',
      nextAction: 'Resolve the provider error, then retry through the existing governed submission path.',
      waitingOnYou: 'Yes - review the failure and recovery action',
      tone: 'red',
      scheduledTime,
      publishedTime,
      permalink: input.publish.platform_post_url,
      reason,
    })
  }

  if (rawStatus === 'publishing' || rawStatus === 'submitting') {
    return projection(input, {
      state: 'submitting',
      stateLabel: 'Submitting',
      headline: `Submitting to ${platformLabel}`,
      explanation: 'Portfolio has started provider submission, but the provider has not confirmed publication yet.',
      owner: 'Provider submission worker',
      nextAction: 'Wait for provider confirmation or a recorded failure.',
      waitingOnYou: 'No',
      tone: 'blue',
      scheduledTime,
      publishedTime,
      permalink: input.publish.platform_post_url,
      reason: null,
    })
  }

  if (queueStatus === 'scheduled' && rawStatus === 'pending') {
    if (!input.item.scheduled_for || !scheduledTime) {
      return projection(input, {
        state: 'blocked',
        stateLabel: 'Blocked',
        headline: `${platformLabel} schedule is incomplete`,
        explanation: 'The queue says this post is scheduled, but Portfolio has no valid scheduled time.',
        owner: 'Publishing recovery lane',
        nextAction: 'Repair the canonical schedule before hosted automation can submit to the provider.',
        waitingOnYou: 'Yes - schedule recovery decision',
        tone: 'red',
        scheduledTime: null,
        publishedTime,
        permalink: input.publish.platform_post_url,
        reason: 'Missing or invalid scheduled time.',
      })
    }

    const scheduledAt = new Date(input.item.scheduled_for).getTime()
    const now = (input.now ?? new Date()).getTime()
    if (scheduledAt < now) {
      return projection(input, {
        state: 'blocked',
        stateLabel: 'Action required',
        headline: `${platformLabel} scheduled time has passed`,
        explanation: `The post was scheduled for ${scheduledTime}, but provider submission was not confirmed.`,
        owner: 'Publishing recovery lane',
        nextAction: 'Reschedule and reconfirm publication intent, or cancel the scheduled publication.',
        waitingOnYou: 'Yes - reschedule or cancel',
        tone: 'red',
        scheduledTime,
        publishedTime,
        permalink: input.publish.platform_post_url,
        reason: 'Scheduled time passed without provider confirmation.',
      })
    }

    return projection(input, {
      state: 'scheduled',
      stateLabel: 'Scheduled',
      headline: `Scheduled for ${scheduledTime}`,
      explanation: `${platformLabel} provider submission has not happened yet. ${SCHEDULED_PUBLISH_CADENCE ? `The hosted scheduler runs ${SCHEDULED_PUBLISH_CADENCE} and` : 'The hosted scheduler'} may submit this post at or after ${scheduledTime}; it will not submit before the scheduled time.`,
      owner: 'Portfolio hosted scheduler',
      nextAction: `The next hosted scheduler run at or after ${scheduledTime} will attempt submission to ${platformLabel}.`,
      waitingOnYou: 'No',
      tone: 'blue',
      scheduledTime,
      publishedTime,
      permalink: input.publish.platform_post_url,
      reason: null,
    })
  }

  if (queueStatus === 'approved' && rawStatus === 'pending' && !input.item.scheduled_for) {
    return projection(input, {
      state: 'ready_unscheduled',
      stateLabel: 'Ready, unscheduled',
      headline: `${platformLabel} handoff is ready`,
      explanation: 'Provider submission has not happened, and no hosted automation time is scheduled.',
      owner: 'Publishing lane',
      nextAction: 'Choose a schedule or use the existing explicit submission gate.',
      waitingOnYou: 'Yes - choose publication timing',
      tone: 'yellow',
      scheduledTime,
      publishedTime,
      permalink: input.publish.platform_post_url,
      reason: null,
    })
  }

  const reason = rawStatus === 'published' && !providerEvidence
    ? 'The provider row says published, but no provider ID, permalink, or publication time is recorded.'
    : queueStatus === 'published' && !providerEvidence
      ? 'The queue says published, but provider publication evidence is missing.'
      : `Portfolio cannot safely interpret queue state "${queueStatus || 'unknown'}" with provider state "${rawStatus || 'unknown'}".`

  return projection(input, {
    state: 'ambiguous',
    stateLabel: 'Needs reconciliation',
    headline: `${platformLabel} status needs reconciliation`,
    explanation: reason,
    owner: 'Publishing reconciliation lane',
    nextAction: 'Reconcile the queue and provider evidence before treating this post as submitted or published.',
    waitingOnYou: 'No - internal reconciliation required',
    tone: 'yellow',
    scheduledTime,
    publishedTime,
    permalink: input.publish.platform_post_url,
    reason,
  })
}

export function reconcilePublicationProjectionWithLifecycle(input: {
  projection: PublicationProjection
  lifecycle: SocialContentLifecycleProjection
}): PublicationProjection {
  if (!['scheduled', 'ready_unscheduled', 'submitting'].includes(input.projection.state)) {
    return input.projection
  }

  const unresolvedStep = PUBLICATION_PREREQUISITE_STEPS.find(
    (step) => input.lifecycle.steps[step].state !== 'approved',
  )
  if (!unresolvedStep) return input.projection

  const step = input.lifecycle.steps[unresolvedStep]
  const details = LIFECYCLE_STEP_DETAILS[unresolvedStep]
  const lifecycleState = step.state.replace('_', ' ')
  const scheduleContext = input.projection.scheduledTime
    ? `A provider schedule is recorded for ${input.projection.scheduledTime}, but ${details.label} is ${lifecycleState}.`
    : `${details.label} is ${lifecycleState}.`
  const reason = `${scheduleContext} Provider submission must remain blocked until the canonical lifecycle prerequisite is complete.`

  return {
    ...input.projection,
    state: 'blocked',
    stateLabel: 'Blocked',
    headline: `${PLATFORM_LABELS[input.projection.platform]} publication blocked by ${details.label}`,
    explanation: reason,
    owner: details.owner,
    nextAction: step.mismatch?.recoveryAction ?? details.nextAction(step.state),
    waitingOnYou: details.waitingOnYou(step.state),
    tone: 'red',
    reason,
  }
}

export function summarizePublicationProjections(projections: PublicationProjection[]): PublicationProjection {
  if (projections.length === 1) return projections[0]

  const firstAttention = projections.find((item) => ['failed', 'blocked', 'ambiguous'].includes(item.state))
  if (firstAttention) {
    return {
      ...firstAttention,
      headline: 'Publication needs attention',
      explanation: `${firstAttention.headline}. ${firstAttention.explanation}`,
    }
  }

  const firstIncomplete = projections.find((item) => item.state !== 'published')
  if (!firstIncomplete) {
    return {
      ...projections[0],
      headline: 'Published on all providers',
      explanation: `All ${projections.length} provider publications are confirmed.`,
    }
  }

  return {
    ...firstIncomplete,
    headline: `${firstIncomplete.headline} (${projections.filter((item) => item.state === 'published').length} of ${projections.length} published)`,
  }
}
