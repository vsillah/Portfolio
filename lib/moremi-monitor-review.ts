import { createHash } from 'crypto'
import { createAgentWorkItem, type AgentWorkItem } from '@/lib/agent-work-items'
import { supabaseAdmin } from '@/lib/supabase'

export const MOREMI_WARNING_WORK_ITEMS_CONFIRMATION = 'create_moremi_warning_work_items'

type AgentRunRow = {
  id: string
  title: string
  status: string
  current_step: string | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  outcome: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type AgentArtifactRow = {
  id: string
  title: string
  artifact_type: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export type MoremiMonitorReviewState = {
  has_monitor: boolean
  run: {
    id: string
    title: string
    status: string
    current_step: string | null
    error_message: string | null
    generated_at: string | null
    completed_at: string | null
    overall: string | null
    href: string
  } | null
  artifact: {
    id: string
    title: string
    created_at: string
    summary_markdown: string | null
  } | null
  warnings: string[]
  warning_count: number
  enabled_source_feed_count: number
  disabled_source_feed_count: number
  coverage_by_category: Record<string, number>
  coverage_by_priority: Record<string, number>
  source_feeds: Array<Record<string, unknown>>
  safety_boundary: string | null
  linked_work_items: AgentWorkItem[]
  side_effects: {
    work_items_created: boolean
    production_mutation_allowed: boolean
    live_external_fetch: boolean
    client_data_access: boolean
  }
}

export type MoremiWarningWorkItemCreationResult = {
  review: MoremiMonitorReviewState
  work_items: AgentWorkItem[]
}

function db() {
  if (!supabaseAdmin) throw new Error('Database not available')
  return supabaseAdmin
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function asNumberRecord(value: unknown): Record<string, number> {
  const record = asRecord(value)
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  )
}

function asSourceFeeds(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : []
}

function warningHash(warning: string) {
  return createHash('sha256').update(warning.trim()).digest('hex').slice(0, 16)
}

function shortWarning(warning: string, maxLength = 120) {
  const clean = warning.trim()
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1)}...`
}

export async function getLatestMoremiMonitorReview(): Promise<MoremiMonitorReviewState> {
  const { data: runRows, error: runError } = await db()
    .from('agent_runs')
    .select('id,title,status,current_step,error_message,started_at,completed_at,outcome,metadata')
    .eq('kind', 'ai_risk_signal_monitor')
    .order('started_at', { ascending: false })
    .limit(1)

  if (runError) throw new Error(`Failed to read latest Moremi monitor run: ${runError.message}`)
  const run = (runRows?.[0] ?? null) as AgentRunRow | null

  if (!run) {
    return {
      has_monitor: false,
      run: null,
      artifact: null,
      warnings: [],
      warning_count: 0,
      enabled_source_feed_count: 0,
      disabled_source_feed_count: 0,
      coverage_by_category: {},
      coverage_by_priority: {},
      source_feeds: [],
      safety_boundary: null,
      linked_work_items: [],
      side_effects: {
        work_items_created: false,
        production_mutation_allowed: false,
        live_external_fetch: false,
        client_data_access: false,
      },
    }
  }

  const [
    { data: artifactRows, error: artifactError },
    { data: workItemRows, error: workItemError },
  ] = await Promise.all([
    db()
      .from('agent_run_artifacts')
      .select('id,title,artifact_type,metadata,created_at')
      .eq('run_id', run.id)
      .eq('artifact_type', 'ai_risk_signal_monitor')
      .order('created_at', { ascending: false })
      .limit(1),
    db()
      .from('agent_work_items')
      .select('*')
      .eq('source_run_id', run.id)
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  if (artifactError) throw new Error(`Failed to read Moremi monitor artifact: ${artifactError.message}`)
  if (workItemError) throw new Error(`Failed to read Moremi linked work items: ${workItemError.message}`)

  const artifact = (artifactRows?.[0] ?? null) as AgentArtifactRow | null
  const artifactMetadata = asRecord(artifact?.metadata)
  const outcome = asRecord(run.outcome)
  const sourceFeeds = asSourceFeeds(artifactMetadata.source_feeds)
  const warnings = asStringArray(artifactMetadata.warnings)
  const enabledCount = typeof outcome.enabled_source_feed_count === 'number'
    ? outcome.enabled_source_feed_count
    : sourceFeeds.filter((feed) => feed.enabled === true).length
  const disabledCount = typeof outcome.disabled_source_feed_count === 'number'
    ? outcome.disabled_source_feed_count
    : sourceFeeds.filter((feed) => feed.enabled === false).length

  return {
    has_monitor: true,
    run: {
      id: run.id,
      title: run.title,
      status: run.status,
      current_step: run.current_step,
      error_message: run.error_message,
      generated_at: typeof outcome.generated_at === 'string' ? outcome.generated_at : run.started_at,
      completed_at: run.completed_at,
      overall: typeof outcome.overall === 'string' ? outcome.overall : null,
      href: `/admin/agents/runs/${run.id}`,
    },
    artifact: artifact
      ? {
          id: artifact.id,
          title: artifact.title,
          created_at: artifact.created_at,
          summary_markdown: typeof artifactMetadata.summary_markdown === 'string' ? artifactMetadata.summary_markdown : null,
        }
      : null,
    warnings,
    warning_count: typeof outcome.warning_count === 'number' ? outcome.warning_count : warnings.length,
    enabled_source_feed_count: enabledCount,
    disabled_source_feed_count: disabledCount,
    coverage_by_category: asNumberRecord(artifactMetadata.coverage_by_category),
    coverage_by_priority: asNumberRecord(artifactMetadata.coverage_by_priority),
    source_feeds: sourceFeeds,
    safety_boundary: typeof artifactMetadata.safety_boundary === 'string' ? artifactMetadata.safety_boundary : null,
    linked_work_items: (workItemRows ?? []) as AgentWorkItem[],
    side_effects: {
      work_items_created: false,
      production_mutation_allowed: false,
      live_external_fetch: false,
      client_data_access: false,
    },
  }
}

export async function createMoremiWarningWorkItems(): Promise<MoremiWarningWorkItemCreationResult> {
  const review = await getLatestMoremiMonitorReview()
  if (!review.run || review.warnings.length === 0) {
    return { review, work_items: [] }
  }
  const run = review.run

  const workItems = await Promise.all(review.warnings.map((warning) => {
    const hash = warningHash(warning)
    return createAgentWorkItem({
      title: `Review Moremi warning: ${shortWarning(warning)}`,
      objective: [
        `Review the Moremi AI risk monitor warning from run ${run.id}: ${warning}`,
        'Decide whether no action is needed, risk should be accepted, an approval packet is required, or a remediation task should be proposed.',
      ].join(' '),
      priority: 'medium',
      status: 'proposed',
      ownerAgentKey: 'risk-compliance-intelligence',
      ownerRuntime: 'manual',
      source: {
        type: 'ai_risk_signal_monitor_warning',
        id: `${run.id}:${hash}`,
        label: 'Moremi AI risk monitor warning',
      },
      sourceRunId: run.id,
      overlapGroup: 'ai-risk-compliance',
      metadata: {
        moremi_warning_work_item: true,
        monitor_run_id: run.id,
        warning,
        warning_hash: hash,
        source_feed_context: {
          enabled_source_feed_count: review.enabled_source_feed_count,
          disabled_source_feed_count: review.disabled_source_feed_count,
          coverage_by_category: review.coverage_by_category,
          coverage_by_priority: review.coverage_by_priority,
        },
        safety_boundary: review.safety_boundary,
        approval_boundary: 'Moremi warning work items are proposed review records only. Remediation, publishing, production config changes, workflow mutation, client-data access, and external sends require their existing approval gates.',
        production_mutation_allowed: false,
        live_external_fetch: false,
        client_data_access: false,
        public_content_allowed: false,
      },
      idempotencyKey: `moremi-warning:${run.id}:${hash}`,
    })
  }))

  return {
    review: await getLatestMoremiMonitorReview(),
    work_items: workItems,
  }
}
