import type { CreateAgentWorkItemInput, AgentWorkItemPriority } from '@/lib/agent-work-items'
import type { MobileFoundryBacklogRecord } from '@/lib/mobile-app-foundry'

export const MOBILE_FOUNDRY_WORK_ITEMS_CONFIRMATION = 'create_mobile_foundry_work_items'

export const MOBILE_FOUNDRY_WORK_ITEM_SIDE_EFFECTS = {
  work_items_created: false,
  work_item_count: 0,
  repositories_created: false,
  github_accounts_created: false,
  outbound_messages_sent: false,
  app_store_submissions: false,
  pricing_changed: false,
  paid_apis_used: false,
} as const

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []
}

function scoreValue(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function priorityForScore(score: number): AgentWorkItemPriority {
  if (score >= 90) return 'urgent'
  if (score >= 75) return 'high'
  if (score >= 55) return 'medium'
  return 'low'
}

function summarizeList(label: string, values: string[]) {
  return values.length ? `${label}: ${values.join('; ')}` : `${label}: pending`
}

export function parseMobileFoundryBacklogRecord(value: unknown): MobileFoundryBacklogRecord | null {
  if (!isRecord(value)) return null

  const id = requiredString(value.id)
  const title = requiredString(value.title)
  const audience = requiredString(value.audience)
  const jobToBeDone = requiredString(value.job_to_be_done)
  const vambahFitSummary = requiredString(value.vambah_fit_summary)
  if (!id || !title || !audience || !jobToBeDone || !vambahFitSummary) return null

  const breakdown = isRecord(value.score_breakdown) ? value.score_breakdown : {}

  return {
    id,
    title,
    audience,
    job_to_be_done: jobToBeDone,
    trend_sources: stringArray(value.trend_sources),
    competitors: stringArray(value.competitors),
    popularity_score: scoreValue(value.popularity_score),
    score_breakdown: {
      demand_signal: scoreValue(breakdown.demand_signal),
      monetization_path: scoreValue(breakdown.monetization_path),
      builder_fit: scoreValue(breakdown.builder_fit),
      build_velocity: scoreValue(breakdown.build_velocity),
      differentiation: scoreValue(breakdown.differentiation),
      release_readiness: scoreValue(breakdown.release_readiness),
    },
    vambah_fit_summary: vambahFitSummary,
    prototype_scope: stringArray(value.prototype_scope),
    commercialization_path: stringArray(value.commercialization_path),
    risks: stringArray(value.risks),
    human_gate: 'review_required',
  }
}

export function buildMobileFoundryWorkItemRequest(
  record: MobileFoundryBacklogRecord,
  sourceRunId?: string | null,
): CreateAgentWorkItemInput {
  const priority = priorityForScore(record.popularity_score)
  const riskLine = summarizeList('Risks', record.risks)
  const prototypeLine = summarizeList('Prototype scope', record.prototype_scope)
  const commercializationLine = summarizeList('Commercialization path', record.commercialization_path)

  return {
    title: `Prototype mobile app opportunity: ${record.title}`,
    objective: [
      `Prepare a prototype brief and repo/build plan for ${record.title}.`,
      `Audience: ${record.audience}.`,
      `Job to be done: ${record.job_to_be_done}`,
      `Popularity score: ${record.popularity_score}/100.`,
      prototypeLine,
      commercializationLine,
      riskLine,
      'Keep this item proposed until Vambah or Shaka approves build delegation. Do not create repos, GitHub accounts, tester outreach, store submissions, prices, or public claims from this work item alone.',
    ].join('\n'),
    priority,
    status: 'proposed',
    ownerAgentKey: 'engineering-copilot',
    ownerRuntime: 'manual',
    source: {
      type: 'mobile_app_foundry_backlog',
      id: record.id,
      label: 'Mobile App Foundry backlog',
    },
    sourceRunId: sourceRunId ?? null,
    expectedFiles: [
      'docs/mobile-app-foundry-agent-system.md',
      'local-private/mobile-foundry/prototype-brief.md',
    ],
    overlapGroup: 'mobile-app-foundry',
    metadata: {
      mobile_app_foundry: true,
      foundry_phase: 'phase_3_approval_backed_backlog',
      foundry_agent_role: 'Imhotep (Kemet) - Prototype Architect',
      coordinating_agent: 'Shaka (Zulu) - Chief of Staff',
      backlog_record_id: record.id,
      popularity_score: record.popularity_score,
      score_breakdown: record.score_breakdown,
      audience: record.audience,
      job_to_be_done: record.job_to_be_done,
      trend_sources: record.trend_sources,
      competitors: record.competitors,
      public_safe_vambah_fit_summary: record.vambah_fit_summary,
      prototype_scope: record.prototype_scope,
      commercialization_path: record.commercialization_path,
      risks: record.risks,
      human_gate: record.human_gate,
      approval_required_before: [
        'repository creation',
        'new GitHub owner or account setup',
        'paid API use',
        'tester invitation',
        'store submission',
        'user data collection',
        'pricing changes',
        'public or client-facing claims',
      ],
      side_effect_boundary: {
        creates_proposed_agent_work_item: true,
        creates_repositories: false,
        creates_github_accounts: false,
        sends_outbound_messages: false,
        submits_to_app_stores: false,
        changes_prices: false,
        uses_paid_apis: false,
      },
    },
    idempotencyKey: `mobile-foundry:${record.id}:prototype-work-item:v1`,
  }
}
