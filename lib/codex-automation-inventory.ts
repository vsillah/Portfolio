import { existsSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

export type AutomationCategory =
  | 'Operations'
  | 'Credentials'
  | 'Model Ops'
  | 'Organization'
  | 'Content/Voice'
  | 'Subscriptions'
  | 'Other'

export type AutomationRiskLevel = 'low' | 'medium' | 'high'
export type AutomationBoundary = 'read-only' | 'branch-only' | 'approval-required' | 'never automatic'
export type AutomationContextHealth = 'green' | 'yellow' | 'red'

export interface CodexAutomationContextQuestion {
  id: string
  question: string
  answered: boolean
  answer: string | null
  recommendation: string
}

export interface CodexAutomationProfile {
  id: string
  name: string
  kind: string
  status: string
  schedule: string | null
  model: string | null
  reasoningEffort: string | null
  executionEnvironment: string | null
  cwds: string[]
  createdAt: number | null
  updatedAt: number | null
  category: AutomationCategory
  riskLevel: AutomationRiskLevel
  portfolioRelated: boolean
  sourceFile: string
  controlDocs: string[]
  promptExcerpt: string
  duplicateCandidate: boolean
  managementBoundary: AutomationBoundary
  contextHealth: AutomationContextHealth
  contextGaps: string[]
  contextQuestions: CodexAutomationContextQuestion[]
  contextProfile: {
    purpose: string | null
    operatingRhythm: string | null
    recurringDecisions: string | null
    inputs: string[]
    dependencies: string[]
    frictionPoints: string[]
    authorityBoundary: AutomationBoundary
    expectedOutputs: string[]
    escalationTrigger: string | null
    governingDocs: string[]
  }
}

export interface CodexAutomationInventory {
  available: boolean
  reason?: string
  sourceDirectory: string
  generatedAt: string
  automations: CodexAutomationProfile[]
  hiddenCount: number
  overview: {
    total: number
    active: number
    paused: number
    duplicateCandidates: number
    highRisk: number
    missingContext: number
  }
}

type ParsedAutomationToml = {
  id?: string
  name?: string
  kind?: string
  prompt?: string
  status?: string
  rrule?: string
  model?: string
  reasoning_effort?: string
  execution_environment?: string
  cwds?: string[]
  created_at?: number
  updated_at?: number
}

const PORTFOLIO_ROOT = '/Users/vambahsillah/Projects/Portfolio'
const DEFAULT_AUTOMATIONS_DIR = path.join(homedir(), '.codex', 'automations')
const SECRETISH_PATTERN =
  /(sk-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{12,}|[A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s,}]+)/gi

export function getDefaultCodexAutomationsDir() {
  return process.env.CODEX_AUTOMATIONS_DIR || DEFAULT_AUTOMATIONS_DIR
}

export async function listCodexAutomationInventory(
  automationRoot = getDefaultCodexAutomationsDir(),
): Promise<CodexAutomationInventory> {
  const generatedAt = new Date().toISOString()

  if (!existsSync(automationRoot)) {
    return unavailableInventory(automationRoot, generatedAt, 'Local Codex automation directory is not available in this environment')
  }

  let entries: string[]
  try {
    entries = await readdir(automationRoot)
  } catch {
    return unavailableInventory(automationRoot, generatedAt, 'Local Codex automation directory is not readable in this environment')
  }

  const parsed: CodexAutomationProfile[] = []
  for (const entry of entries.sort()) {
    const sourceFile = path.join(automationRoot, entry, 'automation.toml')
    if (!existsSync(sourceFile)) continue

    try {
      const content = await readFile(sourceFile, 'utf8')
      const raw = parseAutomationToml(content)
      parsed.push(buildAutomationProfile(raw, sourceFile))
    } catch {
      // Keep the dashboard resilient. Broken files are skipped for v1 rather
      // than blocking the whole inventory.
    }
  }

  const withDuplicates = markDuplicateCandidates(parsed)
  const automations = withDuplicates.filter((automation) => automation.portfolioRelated)
  const hiddenCount = withDuplicates.length - automations.length

  return {
    available: true,
    sourceDirectory: automationRoot,
    generatedAt,
    automations,
    hiddenCount,
    overview: buildOverview(automations),
  }
}

export function parseAutomationToml(content: string): ParsedAutomationToml {
  const parsed: ParsedAutomationToml = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/)
    if (!match) continue
    const [, key, rawValue] = match
    const value = parseTomlValue(rawValue)
    ;(parsed as Record<string, unknown>)[key] = value
  }

  return parsed
}

function parseTomlValue(rawValue: string): string | number | string[] {
  const value = rawValue.trim()
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((item) => parseTomlString(item.trim()))
      .filter(Boolean)
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return parseTomlString(value)
  }
  if (/^-?\d+$/.test(value)) return Number(value)
  return value
}

function parseTomlString(value: string): string {
  const trimmed = value.trim()
  const unquoted = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed
  return unquoted
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
}

function buildAutomationProfile(raw: ParsedAutomationToml, sourceFile: string): CodexAutomationProfile {
  const prompt = raw.prompt || ''
  const name = raw.name || raw.id || path.basename(path.dirname(sourceFile))
  const cwds = Array.isArray(raw.cwds) ? raw.cwds : []
  const controlDocs = extractControlDocs(prompt)
  const category = classifyCategory(name, prompt, cwds)
  const managementBoundary = classifyBoundary(prompt)
  const contextProfile = buildContextProfile(name, prompt, cwds, controlDocs, managementBoundary)
  const contextGaps = findContextGaps(contextProfile, prompt)
  const contextQuestions = buildContextQuestions(contextProfile, prompt)
  const riskLevel = classifyRisk(prompt, category, managementBoundary)

  return {
    id: raw.id || path.basename(path.dirname(sourceFile)),
    name,
    kind: raw.kind || 'unknown',
    status: raw.status || 'UNKNOWN',
    schedule: raw.rrule || null,
    model: raw.model || null,
    reasoningEffort: raw.reasoning_effort || null,
    executionEnvironment: raw.execution_environment || null,
    cwds,
    createdAt: typeof raw.created_at === 'number' ? raw.created_at : null,
    updatedAt: typeof raw.updated_at === 'number' ? raw.updated_at : null,
    category,
    riskLevel,
    portfolioRelated: isPortfolioRelated(name, prompt, cwds, controlDocs),
    sourceFile,
    controlDocs,
    promptExcerpt: sanitizePromptExcerpt(prompt),
    duplicateCandidate: false,
    managementBoundary,
    contextHealth: classifyContextHealth(contextGaps, riskLevel),
    contextGaps,
    contextQuestions,
    contextProfile,
  }
}

function unavailableInventory(sourceDirectory: string, generatedAt: string, reason: string): CodexAutomationInventory {
  return {
    available: false,
    reason,
    sourceDirectory,
    generatedAt,
    automations: [],
    hiddenCount: 0,
    overview: buildOverview([]),
  }
}

function buildOverview(automations: CodexAutomationProfile[]) {
  return {
    total: automations.length,
    active: automations.filter((automation) => automation.status === 'ACTIVE').length,
    paused: automations.filter((automation) => automation.status === 'PAUSED').length,
    duplicateCandidates: automations.filter((automation) => automation.duplicateCandidate).length,
    highRisk: automations.filter((automation) => automation.riskLevel === 'high').length,
    missingContext: automations.filter((automation) => automation.contextHealth !== 'green').length,
  }
}

function extractControlDocs(prompt: string): string[] {
  const matches = prompt.match(/(?:\/Users\/vambahsillah\/[^\s`'",)]+|(?:docs|lib|scripts|model-ops|personality-corpus)\/[^\s`'",)]+)/g) || []
  return [
    ...new Set(
      matches
        .map((item) => item.replace(/[.;:]+$/g, ''))
        .filter((item) => /\.(md|json|jsonl|toml|ts|tsx|sql)$/i.test(item)),
    ),
  ]
}

function classifyCategory(name: string, prompt: string, cwds: string[]): AutomationCategory {
  const nameText = name.toLowerCase()
  if (nameText.includes('subscription') || nameText.includes('cancellation') || nameText.includes('vendor')) return 'Subscriptions'
  if (nameText.includes('credential') || nameText.includes('rotation')) return 'Credentials'
  if (nameText.includes('model') || nameText.includes('llm') || nameText.includes('hermes') || nameText.includes('rag')) return 'Model Ops'
  if (nameText.includes('organization') || nameText.includes('workspace') || nameText.includes('codex project')) return 'Organization'
  if (nameText.includes('personality') || nameText.includes('corpus') || nameText.includes('content') || nameText.includes('voice')) return 'Content/Voice'
  if (nameText.includes('operation') || nameText.includes('health') || nameText.includes('monitor')) return 'Operations'

  const haystack = `${prompt} ${cwds.join(' ')}`.toLowerCase()
  if (haystack.includes('subscription') || haystack.includes('cancellation') || haystack.includes('vendor')) return 'Subscriptions'
  if (haystack.includes('credential') || haystack.includes('secret') || haystack.includes('rotation')) return 'Credentials'
  if (haystack.includes('model') || haystack.includes('llm') || haystack.includes('hermes') || haystack.includes('rag')) return 'Model Ops'
  if (haystack.includes('organization') || haystack.includes('workspace') || haystack.includes('codex project')) return 'Organization'
  if (haystack.includes('personality') || haystack.includes('corpus') || haystack.includes('content') || haystack.includes('voice')) return 'Content/Voice'
  if (haystack.includes('subscription') || haystack.includes('cancellation') || haystack.includes('vendor')) return 'Subscriptions'
  if (haystack.includes('operation') || haystack.includes('health') || haystack.includes('monitor')) return 'Operations'
  return 'Other'
}

function classifyBoundary(prompt: string): AutomationBoundary {
  const text = prompt.toLowerCase()
  if (text.includes('never automatic') || text.includes('never automatically')) return 'never automatic'
  if (text.includes('approval') || text.includes('do not rotate') || text.includes('do not revoke') || text.includes('production')) {
    return 'approval-required'
  }
  if (text.includes('branch') || text.includes('do not merge') || text.includes('do not push')) return 'branch-only'
  return 'read-only'
}

function classifyRisk(prompt: string, category: AutomationCategory, boundary: AutomationBoundary): AutomationRiskLevel {
  const text = prompt.toLowerCase()
  if (
    boundary === 'never automatic' ||
    text.includes('production') ||
    text.includes('secret') ||
    text.includes('credential') ||
    text.includes('cancel a subscription') ||
    text.includes('payment') ||
    text.includes('checkout')
  ) {
    return 'high'
  }
  if (boundary === 'approval-required' || category === 'Model Ops' || category === 'Subscriptions') return 'medium'
  return 'low'
}

function isPortfolioRelated(name: string, prompt: string, cwds: string[], controlDocs: string[]): boolean {
  const haystack = `${name} ${prompt} ${cwds.join(' ')} ${controlDocs.join(' ')}`.toLowerCase()
  return (
    cwds.some((cwd) => cwd.startsWith(PORTFOLIO_ROOT)) ||
    haystack.includes('/users/vambahsillah/projects/portfolio') ||
    haystack.includes('portfolio') ||
    haystack.includes('amadutown') ||
    haystack.includes('agent operations')
  )
}

function buildContextProfile(
  name: string,
  prompt: string,
  cwds: string[],
  controlDocs: string[],
  authorityBoundary: AutomationBoundary,
): CodexAutomationProfile['contextProfile'] {
  return {
    purpose: inferPurpose(name, prompt),
    operatingRhythm: inferOperatingRhythm(prompt),
    recurringDecisions: inferRecurringDecisions(prompt),
    inputs: [...new Set([...cwds, ...controlDocs])],
    dependencies: inferDependencies(prompt),
    frictionPoints: inferFrictionPoints(prompt),
    authorityBoundary,
    expectedOutputs: inferExpectedOutputs(prompt),
    escalationTrigger: inferEscalationTrigger(prompt),
    governingDocs: controlDocs,
  }
}

function inferPurpose(name: string, prompt: string) {
  if (!prompt.trim()) return null
  return `${name}: ${firstSentence(prompt)}`
}

function inferOperatingRhythm(prompt: string) {
  const text = prompt.toLowerCase()
  if (text.includes('monthly')) return 'monthly'
  if (text.includes('weekly')) return 'weekly'
  if (text.includes('daily')) return 'daily'
  if (text.includes('recurring')) return 'recurring'
  return null
}

function inferRecurringDecisions(prompt: string) {
  const text = prompt.toLowerCase()
  if (/(recommend|decision|approval|candidate|classify|risk|green\/yellow\/red|red status|yellow status)/.test(text)) {
    return 'Reviews evidence and recommends status, next action, or approval path.'
  }
  return null
}

function inferDependencies(prompt: string) {
  const deps = [
    ['Codex', /codex/i],
    ['Portfolio', /portfolio/i],
    ['n8n', /n8n/i],
    ['Hermes', /hermes/i],
    ['LM Studio', /lm studio/i],
    ['Supabase', /supabase/i],
    ['Vercel', /vercel/i],
    ['Slack', /slack/i],
    ['Google Drive', /google drive|drive/i],
    ['Stripe', /stripe/i],
    ['1Password', /1password/i],
    ['Infisical', /infisical/i],
  ] as const
  return deps.filter(([, pattern]) => pattern.test(prompt)).map(([name]) => name)
}

function inferFrictionPoints(prompt: string) {
  const points: string[] = []
  const text = prompt.toLowerCase()
  if (text.includes('duplicate') || text.includes('drift')) points.push('Drift or duplicate automation risk')
  if (text.includes('missing') || text.includes('unavailable')) points.push('Missing credentials, baselines, or local access')
  if (text.includes('stale') || text.includes('blocked')) points.push('Stale or blocked source state')
  if (text.includes('failed') || text.includes('failure')) points.push('Failure triage and retry boundary')
  return points
}

function inferExpectedOutputs(prompt: string) {
  const outputs: string[] = []
  const text = prompt.toLowerCase()
  if (text.includes('report')) outputs.push('report')
  if (text.includes('approval packet') || text.includes('proposal')) outputs.push('approval packet')
  if (text.includes('summary') || text.includes('summarize')) outputs.push('summary')
  if (text.includes('branch')) outputs.push('branch handoff')
  if (text.includes('alert') || text.includes('warning')) outputs.push('alert or warning')
  return outputs
}

function inferEscalationTrigger(prompt: string) {
  const text = prompt.toLowerCase()
  if (text.includes('approval')) return 'Escalate when an approval-required action or packet is needed.'
  if (text.includes('red status') || text.includes('red')) return 'Escalate on red status or critical failure.'
  if (text.includes('blocker') || text.includes('blocked')) return 'Escalate on blocked source, credential, or runtime access.'
  if (text.includes('failed') || text.includes('failure')) return 'Escalate on failed checks or repeated failure.'
  return null
}

function firstSentence(prompt: string) {
  return prompt.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)[0].slice(0, 180)
}

function findContextGaps(
  profile: CodexAutomationProfile['contextProfile'],
  prompt: string,
): string[] {
  const gaps: string[] = []
  if (!profile.purpose) gaps.push('missing purpose')
  if (!profile.operatingRhythm) gaps.push('missing operating rhythm')
  if (!profile.recurringDecisions) gaps.push('missing recurring decisions')
  if (profile.inputs.length === 0) gaps.push('missing inputs')
  if (profile.expectedOutputs.length === 0) gaps.push('missing outputs')
  if (profile.governingDocs.length === 0) gaps.push('missing control docs')
  if (!profile.escalationTrigger) gaps.push('missing escalation trigger')
  if (!hasExplicitAuthorityBoundary(prompt)) gaps.push('missing authority boundary')
  return gaps
}

function buildContextQuestions(
  profile: CodexAutomationProfile['contextProfile'],
  prompt: string,
): CodexAutomationContextQuestion[] {
  const hasBoundary = hasExplicitAuthorityBoundary(prompt)
  return [
    {
      id: 'purpose',
      question: 'What does this automation protect or improve?',
      answered: Boolean(profile.purpose),
      answer: profile.purpose,
      recommendation: 'Add a one-sentence purpose statement to the prompt or governing runbook.',
    },
    {
      id: 'decision',
      question: 'What decision does it support?',
      answered: Boolean(profile.recurringDecisions),
      answer: profile.recurringDecisions,
      recommendation: 'Name the recurring decision this job helps an agent or Vambah make.',
    },
    {
      id: 'inputs',
      question: 'What does it inspect?',
      answered: profile.inputs.length > 0,
      answer: profile.inputs.length > 0 ? profile.inputs.join(', ') : null,
      recommendation: 'List source paths, control docs, APIs, dashboards, or reports inspected by the automation.',
    },
    {
      id: 'boundary',
      question: 'What should it never do automatically?',
      answered: hasBoundary,
      answer: hasBoundary ? profile.authorityBoundary : null,
      recommendation: 'State the authority boundary explicitly, especially approvals, production, credentials, cancellations, and merge/deploy actions.',
    },
    {
      id: 'outputs',
      question: 'What should it produce?',
      answered: profile.expectedOutputs.length > 0,
      answer: profile.expectedOutputs.length > 0 ? profile.expectedOutputs.join(', ') : null,
      recommendation: 'Specify the expected output shape, such as report, summary, alert, approval packet, or branch handoff.',
    },
    {
      id: 'escalation',
      question: 'What failure should alert Vambah?',
      answered: Boolean(profile.escalationTrigger),
      answer: profile.escalationTrigger,
      recommendation: 'Define the failure, drift, stale source, blocked credential, or red-status condition that should trigger escalation.',
    },
    {
      id: 'governance',
      question: 'What doc, skill, or runbook governs it?',
      answered: profile.governingDocs.length > 0,
      answer: profile.governingDocs.length > 0 ? profile.governingDocs.join(', ') : null,
      recommendation: 'Reference the governing doc, skill, source register, or runbook path in the automation prompt.',
    },
  ]
}

function hasExplicitAuthorityBoundary(prompt: string) {
  return /(do not|approval|required|read-only|never|branch|authority)/i.test(prompt)
}

function classifyContextHealth(contextGaps: string[], riskLevel: AutomationRiskLevel): AutomationContextHealth {
  if (contextGaps.length === 0) return 'green'
  if (riskLevel === 'high' && contextGaps.length > 2) return 'red'
  if (contextGaps.length > 4) return 'red'
  return 'yellow'
}

function sanitizePromptExcerpt(prompt: string) {
  return prompt
    .replace(SECRETISH_PATTERN, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}

function markDuplicateCandidates(automations: CodexAutomationProfile[]) {
  const counts = new Map<string, number>()
  for (const automation of automations) {
    const key = duplicateKey(automation)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return automations.map((automation) => ({
    ...automation,
    duplicateCandidate: (counts.get(duplicateKey(automation)) ?? 0) > 1,
  }))
}

function duplicateKey(automation: CodexAutomationProfile) {
  return automation.name
    .toLowerCase()
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+copy$/g, '')
    .trim()
}
