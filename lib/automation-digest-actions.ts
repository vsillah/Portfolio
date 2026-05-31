import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CreateAgentWorkItemInput, AgentWorkItem } from '@/lib/agent-work-items'

export const DIGEST_ACTION_SOURCE_TYPE = 'codex_automation_digest'
export const AGENT_OPS_CHANNEL_ID = 'C0B1MM4LQKB'
export const AGENT_OPS_CHANNEL_NAME = '#agent-ops'

export const DIGEST_ACTION_CATEGORIES = [
  'needs_vambah_approval',
  'agent_can_prepare',
  'blocked_until_access',
  'watch_only',
] as const

export type DigestActionCategory = (typeof DIGEST_ACTION_CATEGORIES)[number]

export type AutomationDigestSummary = {
  automation_id: string
  automation_name: string
  ran_at_utc: string
  status: 'green' | 'yellow' | 'red' | 'failed' | 'interrupted' | 'no_change'
  headline: string
  summary: string
  material_findings: string[]
  changed_files_or_links: string[]
  blockers_or_approvals: string[]
  next_run_focus: string[]
  codex_thread_hint?: string
}

export type DigestAction = {
  key: string
  category: DigestActionCategory
  title: string
  objective: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  ownerAgentKey: string | null
  ownerRuntime: 'codex' | 'n8n' | 'hermes' | 'opencode' | 'manual'
  automationId: string
  automationName: string
  digestDate: string
  sourcePath: string
  safePrompt: string
  createWorkItem: boolean
}

export type DigestActionResult = {
  action: DigestAction
  status: 'watch_only' | 'would_create_or_reuse' | 'created_or_reused'
  workItemId: string | null
}

export type DigestActionRunResult = {
  digestDate: string
  applied: boolean
  summaryCount: number
  actionCount: number
  workItemCount: number
  watchOnlyCount: number
  results: DigestActionResult[]
  slackMessage: string
}

type CreateWorkItem = (input: CreateAgentWorkItemInput) => Promise<Pick<AgentWorkItem, 'id'>>

const REQUIRED_KEYS = [
  'automation_id',
  'automation_name',
  'ran_at_utc',
  'status',
  'headline',
  'summary',
  'material_findings',
  'changed_files_or_links',
  'blockers_or_approvals',
  'next_run_focus',
] as const

const SECRET_VALUE_PATTERNS = [
  /\b(?:api[_-]?key|token|secret|password|credential|authorization)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/i,
  /\bBearer\s+[A-Za-z0-9_./+=-]{12,}/i,
  /\bsk-[A-Za-z0-9]{16,}/i,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}/i,
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i,
]

function assertArray(value: unknown, key: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid automation digest summary: ${key} must be an array of strings.`)
  }
}

export function assertSafeDigestText(value: string, context: string) {
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(`Unsafe automation digest content in ${context}. Refusing to route to Agent Ops.`)
    }
  }
}

function sanitizeText(value: string, context: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  assertSafeDigestText(normalized, context)
  return normalized
}

function validateSummary(value: unknown, sourcePath: string): AutomationDigestSummary {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid automation digest summary in ${sourcePath}: expected object.`)
  }
  const record = value as Record<string, unknown>
  for (const key of REQUIRED_KEYS) {
    if (!(key in record)) {
      throw new Error(`Invalid automation digest summary in ${sourcePath}: missing ${key}.`)
    }
  }
  for (const key of ['automation_id', 'automation_name', 'ran_at_utc', 'status', 'headline', 'summary'] as const) {
    if (typeof record[key] !== 'string') {
      throw new Error(`Invalid automation digest summary in ${sourcePath}: ${key} must be a string.`)
    }
  }
  assertArray(record.material_findings, 'material_findings')
  assertArray(record.changed_files_or_links, 'changed_files_or_links')
  assertArray(record.blockers_or_approvals, 'blockers_or_approvals')
  assertArray(record.next_run_focus, 'next_run_focus')
  if (record.codex_thread_hint != null && typeof record.codex_thread_hint !== 'string') {
    throw new Error(`Invalid automation digest summary in ${sourcePath}: codex_thread_hint must be a string.`)
  }

  const summary = record as AutomationDigestSummary
  const allText = [
    summary.automation_id,
    summary.automation_name,
    summary.ran_at_utc,
    summary.status,
    summary.headline,
    summary.summary,
    ...summary.material_findings,
    ...summary.changed_files_or_links,
    ...summary.blockers_or_approvals,
    ...summary.next_run_focus,
    summary.codex_thread_hint ?? '',
  ].join('\n')
  assertSafeDigestText(allText, sourcePath)
  return summary
}

export async function readDigestSummaryFile(sourcePath: string) {
  const raw = await readFile(sourcePath, 'utf8')
  return validateSummary(JSON.parse(raw), sourcePath)
}

function digestDateFromSummary(summary: AutomationDigestSummary) {
  return summary.ran_at_utc.slice(0, 10)
}

function hashAction(input: string) {
  return createHash('sha256').update(input).digest('hex').slice(0, 12)
}

function normalizeActionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function buildAction(input: Omit<DigestAction, 'key'>): DigestAction {
  const keyInput = [
    input.digestDate,
    input.automationId,
    input.category,
    normalizeActionKey(input.title),
    normalizeActionKey(input.objective),
  ].join(':')
  return {
    ...input,
    key: `${DIGEST_ACTION_SOURCE_TYPE}:${input.digestDate}:${input.automationId}:${input.category}:${hashAction(keyInput)}`,
  }
}

function actionFromSummary(summary: AutomationDigestSummary, sourcePath: string, digestDate: string): DigestAction[] {
  const automationId = sanitizeText(summary.automation_id, `${sourcePath}:automation_id`)
  const automationName = sanitizeText(summary.automation_name, `${sourcePath}:automation_name`)
  const text = [
    summary.headline,
    summary.summary,
    ...summary.material_findings,
    ...summary.blockers_or_approvals,
    ...summary.next_run_focus,
  ].map((item, index) => sanitizeText(item, `${sourcePath}:text:${index}`))
  const combined = text.join('\n').toLowerCase()
  const actions: DigestAction[] = []

  if (summary.status === 'no_change') {
    actions.push(buildAction({
      category: 'watch_only',
      title: sanitizeText(summary.headline, `${sourcePath}:headline`),
      objective: sanitizeText(summary.summary, `${sourcePath}:summary`),
      priority: 'low',
      ownerAgentKey: null,
      ownerRuntime: 'manual',
      automationId,
      automationName,
      digestDate,
      sourcePath,
      safePrompt: `Codex: review ${automationName} only if the next digest shows material movement.`,
      createWorkItem: false,
    }))
    return actions
  }

  if (combined.includes('n8n') && (combined.includes('403') || combined.includes('credential') || combined.includes('drift'))) {
    actions.push(buildAction({
      category: 'blocked_until_access',
      title: 'Prepare n8n drift access repair preflight',
      objective: [
        'Prepare a non-mutating preflight for restoring scoped n8n drift visibility.',
        'Do not rotate credentials, change provider settings, or mutate workflows without explicit approval.',
      ].join(' '),
      priority: 'high',
      ownerAgentKey: 'automation-systems',
      ownerRuntime: 'manual',
      automationId,
      automationName,
      digestDate,
      sourcePath,
      safePrompt: 'Codex: run the n8n drift access repair preflight for Portfolio.',
      createWorkItem: true,
    }))
  }

  if (combined.includes('authenticated admin') || combined.includes('/api/admin/rag-health') || combined.includes('playwright smoke') || combined.includes('unevaluated production chat')) {
    actions.push(buildAction({
      category: 'blocked_until_access',
      title: 'Prepare authenticated Portfolio admin QA checklist',
      objective: [
        'Prepare the admin QA checklist for RAG health, Playwright smoke, stale Agent Ops review, and unevaluated chat sessions.',
        'Wait for authenticated admin context before running protected checks.',
      ].join(' '),
      priority: 'high',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'manual',
      automationId,
      automationName,
      digestDate,
      sourcePath,
      safePrompt: 'Codex: prepare the authenticated admin QA checklist for Portfolio.',
      createWorkItem: true,
    }))
  }

  if (combined.includes('thread-root') || combined.includes('thread roots') || combined.includes('state repair')) {
    actions.push(buildAction({
      category: 'needs_vambah_approval',
      title: 'Draft Codex thread-root repair decision packet',
      objective: [
        'Draft a backup-first decision packet for Codex thread-root repair.',
        'Preserve intentionally separate rotla and Personal chats unless Vambah explicitly approves migration.',
      ].join(' '),
      priority: 'medium',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'manual',
      automationId,
      automationName,
      digestDate,
      sourcePath,
      safePrompt: 'Codex: audit the Codex thread-root repair decision and propose a backup-first plan.',
      createWorkItem: true,
    }))
  }

  if (combined.includes('dashboard billing') || combined.includes('quiet-provider') || combined.includes('quiet providers') || combined.includes('auth-blocked vendors')) {
    actions.push(buildAction({
      category: 'agent_can_prepare',
      title: 'Prepare quiet-provider billing verification packet',
      objective: [
        'Prepare a sanitized billing-dashboard verification packet for quiet or auth-blocked providers.',
        'Do not cancel subscriptions or change provider settings without the exact approved cancellation phrase.',
      ].join(' '),
      priority: 'medium',
      ownerAgentKey: 'automation-systems',
      ownerRuntime: 'manual',
      automationId,
      automationName,
      digestDate,
      sourcePath,
      safePrompt: 'Codex: prepare the quiet-provider billing verification packet.',
      createWorkItem: true,
    }))
  }

  return dedupeActions(actions)
}

function dedupeActions(actions: DigestAction[]) {
  const byKey = new Map<string, DigestAction>()
  for (const action of actions) {
    const semanticKey = [
      action.category,
      normalizeActionKey(action.title),
      normalizeActionKey(action.objective),
    ].join(':')
    byKey.set(semanticKey, byKey.get(semanticKey) ?? action)
  }
  return [...byKey.values()]
}

export async function buildDigestActionsFromFiles(input: {
  summaryPaths: string[]
  digestDate?: string | null
}) {
  const summaries = await Promise.all(input.summaryPaths.map(async (sourcePath) => ({
    sourcePath,
    summary: await readDigestSummaryFile(sourcePath),
  })))
  const digestDate = input.digestDate
    ?? summaries.map(({ summary }) => digestDateFromSummary(summary)).sort().at(-1)
    ?? new Date().toISOString().slice(0, 10)
  const actions = summaries.flatMap(({ sourcePath, summary }) => actionFromSummary(summary, sourcePath, digestDate))
  return {
    digestDate,
    summaryCount: summaries.length,
    actions: dedupeActions(actions),
  }
}

function workItemInputForAction(action: DigestAction): CreateAgentWorkItemInput {
  return {
    title: action.title,
    objective: [
      action.objective,
      '',
      `Safe Codex prompt: ${action.safePrompt}`,
      'Approval boundary: this proposed work item does not approve credential rotation, billing cancellation, production config changes, external sends, repo merge, deployment, or provider mutation.',
    ].join('\n'),
    priority: action.priority,
    status: 'proposed',
    ownerAgentKey: action.ownerAgentKey,
    ownerRuntime: action.ownerRuntime,
    source: {
      type: DIGEST_ACTION_SOURCE_TYPE,
      id: `${action.digestDate}:${action.automationId}`,
      label: `${action.automationName} digest action`,
    },
    overlapGroup: `automation-digest:${action.automationId}`,
    metadata: {
      automation_digest_action: true,
      digest_date: action.digestDate,
      automation_id: action.automationId,
      automation_name: action.automationName,
      category: action.category,
      safe_prompt: action.safePrompt,
      source_summary_path: path.resolve(action.sourcePath),
      agent_ops_channel_id: AGENT_OPS_CHANNEL_ID,
      privacy_boundary: 'sanitized_action_only',
      requires_explicit_approval_for_mutation: true,
    },
    idempotencyKey: action.key,
  }
}

export async function runDigestActionRouting(input: {
  summaryPaths: string[]
  digestDate?: string | null
  apply?: boolean
  createWorkItem?: CreateWorkItem
}): Promise<DigestActionRunResult> {
  const built = await buildDigestActionsFromFiles({
    summaryPaths: input.summaryPaths,
    digestDate: input.digestDate,
  })
  const apply = Boolean(input.apply)
  const createWorkItem = input.createWorkItem
    ?? (apply ? (await import('@/lib/agent-work-items')).createAgentWorkItem : null)
  const results: DigestActionResult[] = []

  for (const action of built.actions) {
    if (!action.createWorkItem) {
      results.push({ action, status: 'watch_only', workItemId: null })
      continue
    }
    if (!apply) {
      results.push({ action, status: 'would_create_or_reuse', workItemId: null })
      continue
    }
    if (!createWorkItem) throw new Error('createAgentWorkItem unavailable for apply mode.')
    const workItem = await createWorkItem(workItemInputForAction(action))
    results.push({ action, status: 'created_or_reused', workItemId: workItem.id })
  }

  const workItemCount = results.filter((result) => result.action.createWorkItem).length
  const watchOnlyCount = results.filter((result) => !result.action.createWorkItem).length
  return {
    digestDate: built.digestDate,
    applied: apply,
    summaryCount: built.summaryCount,
    actionCount: results.length,
    workItemCount,
    watchOnlyCount,
    results,
    slackMessage: buildAgentOpsDigestSlackMessage({
      digestDate: built.digestDate,
      applied: apply,
      results,
    }),
  }
}

function categoryLabel(category: DigestActionCategory) {
  if (category === 'needs_vambah_approval') return 'needs Vambah approval'
  if (category === 'agent_can_prepare') return 'agent can prepare'
  if (category === 'blocked_until_access') return 'blocked until access'
  return 'watch only'
}

export function buildAgentOpsDigestSlackMessage(input: {
  digestDate: string
  applied: boolean
  results: DigestActionResult[]
}) {
  const workItems = input.results.filter((result) => result.action.createWorkItem)
  const watchOnly = input.results.filter((result) => !result.action.createWorkItem)
  const verb = input.applied ? 'created/reused' : 'would create/reuse'
  const lines = [
    `*Codex automation digest actions - ${input.digestDate}*`,
    `Private digest stays in email/DM. This channel gets the sanitized Agent Ops backlog only.`,
    `Work items ${verb}: ${workItems.length}. Watch-only signals: ${watchOnly.length}.`,
  ]
  if (workItems.length) {
    lines.push('', '*Action backlog*')
    for (const result of workItems.slice(0, 5)) {
      const id = result.workItemId ? ` - work item \`${result.workItemId}\`` : ''
      lines.push(`- *${result.action.title}* (${categoryLabel(result.action.category)}, ${result.action.priority})${id}`)
    }
  }
  if (watchOnly.length) {
    lines.push('', '*Watch-only*')
    for (const result of watchOnly.slice(0, 3)) {
      lines.push(`- ${result.action.automationName}: ${result.action.title}`)
    }
  }
  lines.push('', 'Use `/agent work` to review active Agent Ops work items. Sensitive details and approval packets stay in Portfolio/private digest surfaces.')
  return lines.join('\n')
}
