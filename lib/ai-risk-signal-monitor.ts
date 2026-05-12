import { getAgentByKey } from '@/lib/agent-organization'
import type { CreateAgentWorkItemInput } from '@/lib/agent-work-items'

export const AI_RISK_SIGNAL_CATEGORIES = [
  'agent_autonomy',
  'prompt_injection',
  'privacy_data',
  'regulatory',
  'security',
  'bias_safety',
  'vendor_incident',
  'consumer_disclosure',
] as const

export const AI_RISK_SIGNAL_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export const AI_RISK_SIGNAL_CLASSIFICATIONS = ['watch_only', 'exposure_check', 'upgrade_request', 'approval_required'] as const
export const AI_RISK_SOURCE_PRIORITIES = ['primary', 'standards', 'vendor', 'news', 'commentary'] as const

export type AiRiskSignalCategory = (typeof AI_RISK_SIGNAL_CATEGORIES)[number]
export type AiRiskSignalSeverity = (typeof AI_RISK_SIGNAL_SEVERITIES)[number]
export type AiRiskSignalClassification = (typeof AI_RISK_SIGNAL_CLASSIFICATIONS)[number]
export type AiRiskSourcePriority = (typeof AI_RISK_SOURCE_PRIORITIES)[number]

export type AiRiskSignalInput = {
  id?: string
  title: string
  summary: string
  sourceUrl?: string | null
  sourceName?: string | null
  category?: AiRiskSignalCategory | string | null
  severity?: AiRiskSignalSeverity | string | null
  publishedAt?: string | null
  tags?: string[]
}

export type AiRiskExposureSurface = {
  key: string
  label: string
  reason: string
  ownerAgentKey: string
  ownerAgentName: string
  approvalGate: string
}

export type AiRiskSignalAssessment = {
  signalId: string
  title: string
  classification: AiRiskSignalClassification
  severity: AiRiskSignalSeverity
  category: AiRiskSignalCategory
  confidence: 'low' | 'medium' | 'high'
  rationale: string
  exposureSurfaces: AiRiskExposureSurface[]
  ownerAgentKey: 'risk-compliance-intelligence'
  ownerAgentName: string
  recommendedNextAction: string
  upgradeRequest: {
    title: string
    objective: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    owner_agent_key: string
    source_type: 'ai_risk_signal'
    source_id: string
    source_label: string
    metadata: Record<string, unknown>
  } | null
}

export type AiRiskWorkItemRequest = CreateAgentWorkItemInput & {
  sourceAssessment: AiRiskSignalAssessment
}

export type AiRiskSourceFeed = {
  key: string
  name: string
  url: string
  priority: AiRiskSourcePriority
  ownerAgentKey: 'research-source-register' | 'risk-compliance-intelligence' | 'agent-tooling-parity'
  categories: AiRiskSignalCategory[]
  cadence: 'daily' | 'weekly' | 'event_driven'
  enabled: boolean
  notes: string
}

export const MOREMI_OPERATIONAL_DRILL_SIGNAL: AiRiskSignalInput = {
  id: 'moremi-operational-drill-prompt-injection-browser-automation',
  title: 'Synthetic Moremi drill: prompt injection risk in browser automation',
  summary: [
    'Synthetic Agent Ops validation signal for indirect prompt injection in tool-using agents.',
    'Use this to prove Moremi can create a proposed work item without production remediation, external sends, or client-data access.',
  ].join(' '),
  sourceName: 'Synthetic Agent Ops drill',
  sourceUrl: null,
  category: 'prompt_injection',
  severity: 'high',
  tags: ['synthetic', 'agent-ops-drill', 'prompt injection', 'browser automation', 'unsafe tool call'],
}

export const AI_RISK_SOURCE_FEEDS: AiRiskSourceFeed[] = [
  {
    key: 'owasp-agent-security-initiative',
    name: 'OWASP Agent Security Initiative',
    url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/initiatives/agent_security_initiative/',
    priority: 'standards',
    ownerAgentKey: 'research-source-register',
    categories: ['agent_autonomy', 'prompt_injection', 'security'],
    cadence: 'weekly',
    enabled: true,
    notes: 'Agentic AI security standards and risk vocabulary.',
  },
  {
    key: 'owasp-aivss',
    name: 'OWASP AI Vulnerability Scoring System',
    url: 'https://aivss.owasp.org/',
    priority: 'standards',
    ownerAgentKey: 'research-source-register',
    categories: ['security', 'agent_autonomy', 'prompt_injection'],
    cadence: 'weekly',
    enabled: true,
    notes: 'Severity scoring reference for AI-specific vulnerability triage.',
  },
  {
    key: 'nist-ai-rmf',
    name: 'NIST AI Risk Management Framework',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
    priority: 'standards',
    ownerAgentKey: 'research-source-register',
    categories: ['regulatory', 'bias_safety', 'privacy_data'],
    cadence: 'weekly',
    enabled: true,
    notes: 'Risk management vocabulary and governance reference.',
  },
  {
    key: 'eu-ai-act',
    name: 'EU Artificial Intelligence Act',
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
    priority: 'primary',
    ownerAgentKey: 'risk-compliance-intelligence',
    categories: ['regulatory', 'consumer_disclosure', 'privacy_data'],
    cadence: 'weekly',
    enabled: true,
    notes: 'Primary regulation text for EU AI Act obligations.',
  },
  {
    key: 'ftc-ai-guidance',
    name: 'FTC Artificial Intelligence Business Guidance',
    url: 'https://www.ftc.gov/business-guidance/technology/artificial-intelligence',
    priority: 'primary',
    ownerAgentKey: 'risk-compliance-intelligence',
    categories: ['consumer_disclosure', 'bias_safety', 'privacy_data'],
    cadence: 'weekly',
    enabled: true,
    notes: 'US consumer protection, AI claims, disclosure, and unfair/deceptive practice guidance.',
  },
  {
    key: 'model-provider-security-notices',
    name: 'Model Provider Security and Incident Notices',
    url: 'https://status.openai.com/',
    priority: 'vendor',
    ownerAgentKey: 'agent-tooling-parity',
    categories: ['vendor_incident', 'security'],
    cadence: 'event_driven',
    enabled: false,
    notes: 'Placeholder vendor signal family; enable only after provider-specific feed policy is approved.',
  },
]

const KEYWORD_SURFACES: Array<{
  keywords: string[]
  surface: Omit<AiRiskExposureSurface, 'ownerAgentName'>
}> = [
  {
    keywords: ['prompt injection', 'tool injection', 'jailbreak', 'indirect prompt'],
    surface: {
      key: 'agent-tool-use',
      label: 'Agent tool invocation and prompt handling',
      reason: 'Portfolio runs tool-using agents, Slack commands, RAG prompts, and workflow dispatch paths.',
      ownerAgentKey: 'agent-tooling-parity',
      approvalGate: 'Prompt, runtime, and production behavior changes require review.',
    },
  },
  {
    keywords: ['privacy', 'personal data', 'client data', 'customer data', 'retention', 'consent', 'pii'],
    surface: {
      key: 'client-data-boundary',
      label: 'Client, lead, meeting, and private knowledge data boundaries',
      reason: 'Portfolio handles lead, client, meeting, email, knowledge, and private operational records.',
      ownerAgentKey: 'private-knowledge-librarian',
      approvalGate: 'Client data access, private-source promotion, and public use of private material require approval.',
    },
  },
  {
    keywords: ['eu ai act', 'regulation', 'regulatory', 'compliance', 'enforcement', 'gpai', 'general-purpose ai', 'automated decision'],
    surface: {
      key: 'ai-policy-governance',
      label: 'AI policy, disclosure, and approval governance',
      reason: 'Portfolio exposes AI workflows, public chatbot behavior, admin automation, and client-facing AI Ops advice.',
      ownerAgentKey: 'risk-compliance-intelligence',
      approvalGate: 'Policy changes, public claims, and client-facing commitments require approval.',
    },
  },
  {
    keywords: ['security', 'credential', 'secret', 'api key', 'supply chain', 'remote code', 'browser automation'],
    surface: {
      key: 'runtime-security',
      label: 'Runtime, credential, and browser automation security',
      reason: 'Portfolio uses API keys, webhooks, browser-capable agents, n8n workflows, and production integrations.',
      ownerAgentKey: 'automation-systems',
      approvalGate: 'Credential changes, production config changes, and external API changes require approval.',
    },
  },
  {
    keywords: ['bias', 'discrimination', 'fairness', 'safety', 'harmful', 'deceptive'],
    surface: {
      key: 'public-ai-output-quality',
      label: 'Public AI output, recommendation, and disclosure quality',
      reason: 'Portfolio includes public chatbot, source-respecting LLM, social content, and advisory recommendation surfaces.',
      ownerAgentKey: 'voice-content-architect',
      approvalGate: 'Public content, public claims, and client-facing recommendations require human review.',
    },
  },
  {
    keywords: ['vendor', 'model provider', 'openai', 'anthropic', 'vercel', 'supabase', 'n8n', 'pinecone', 'slack'],
    surface: {
      key: 'vendor-dependency',
      label: 'AI/runtime vendor dependency and incident exposure',
      reason: 'Portfolio depends on model providers, Vercel, Supabase, n8n, Pinecone, Slack, and related workflow providers.',
      ownerAgentKey: 'agent-tooling-parity',
      approvalGate: 'Vendor replacement, model routing, and production config changes require approval.',
    },
  },
]

const CATEGORY_KEYWORDS: Record<AiRiskSignalCategory, string[]> = {
  agent_autonomy: ['agent', 'autonomous', 'tool use', 'tool call', 'computer use', 'browser automation'],
  prompt_injection: ['prompt injection', 'jailbreak', 'indirect prompt', 'tool injection'],
  privacy_data: ['privacy', 'personal data', 'customer data', 'client data', 'pii', 'retention', 'consent'],
  regulatory: ['regulation', 'compliance', 'eu ai act', 'nist', 'ftc', 'law', 'policy'],
  security: ['security', 'credential', 'secret', 'exploit', 'vulnerability', 'supply chain'],
  bias_safety: ['bias', 'discrimination', 'safety', 'harmful', 'deceptive'],
  vendor_incident: ['vendor', 'outage', 'incident', 'breach', 'model provider', 'platform'],
  consumer_disclosure: ['disclosure', 'claim', 'advertising', 'consumer', 'deceptive', 'transparency'],
}

function normalizedText(signal: AiRiskSignalInput) {
  return `${signal.title} ${signal.summary} ${(signal.tags ?? []).join(' ')}`.toLowerCase()
}

function stableSignalId(signal: AiRiskSignalInput, index: number) {
  if (signal.id?.trim()) return signal.id.trim()
  const base = `${signal.sourceName ?? 'signal'}:${signal.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `${base.replace(/^-|-$/g, '').slice(0, 80) || 'ai-risk-signal'}-${index + 1}`
}

function normalizeSeverity(value: string | null | undefined, text: string): AiRiskSignalSeverity {
  if (AI_RISK_SIGNAL_SEVERITIES.includes(value as AiRiskSignalSeverity)) return value as AiRiskSignalSeverity
  if (/\b(critical|breach|enforcement|ban|illegal|exploit)\b/.test(text)) return 'critical'
  if (/\b(high risk|regulation|privacy|security|credential|client data|customer data|prompt injection)\b/.test(text)) return 'high'
  if (/\b(warning|guidance|policy|audit|disclosure|safety)\b/.test(text)) return 'medium'
  return 'low'
}

function normalizeCategory(value: string | null | undefined, text: string): AiRiskSignalCategory {
  if (AI_RISK_SIGNAL_CATEGORIES.includes(value as AiRiskSignalCategory)) return value as AiRiskSignalCategory
  const priorityOrder: AiRiskSignalCategory[] = [
    'prompt_injection',
    'privacy_data',
    'regulatory',
    'security',
    'bias_safety',
    'vendor_incident',
    'consumer_disclosure',
    'agent_autonomy',
  ]
  const match = priorityOrder.find((category) =>
    CATEGORY_KEYWORDS[category].some((keyword) => text.includes(keyword)),
  )
  return match ?? 'agent_autonomy'
}

function severityRank(severity: AiRiskSignalSeverity) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity]
}

function priorityForAssessment(
  classification: AiRiskSignalClassification,
  severity: AiRiskSignalSeverity,
): 'low' | 'medium' | 'high' | 'urgent' {
  if (classification === 'approval_required' || severity === 'critical') return 'urgent'
  if (classification === 'upgrade_request' || severity === 'high') return 'high'
  if (classification === 'exposure_check' || severity === 'medium') return 'medium'
  return 'low'
}

function surfacesForSignal(text: string) {
  const surfaces = KEYWORD_SURFACES
    .filter(({ keywords }) => keywords.some((keyword) => text.includes(keyword)))
    .map(({ surface }) => {
      const agent = getAgentByKey(surface.ownerAgentKey)
      return {
        ...surface,
        ownerAgentName: agent?.name ?? surface.ownerAgentKey,
      }
    })

  return surfaces.filter((surface, index, list) => list.findIndex((item) => item.key === surface.key) === index)
}

function classifySignal(severity: AiRiskSignalSeverity, surfaces: AiRiskExposureSurface[], text: string): AiRiskSignalClassification {
  const approvalSurfaceKeys = new Set([
    'agent-tool-use',
    'client-data-boundary',
    'ai-policy-governance',
    'runtime-security',
  ])
  const approvalKeywords = [
    'production config',
    'credential',
    'secret',
    'client data',
    'customer data',
    'personal data',
    'prompt injection',
    'tool injection',
    'jailbreak',
    'indirect prompt',
    'unsafe tool',
    'browser automation',
    'remote code',
    'api key',
    'public claim',
    'regulation',
    'enforcement',
  ]
  if (severity === 'critical' || approvalKeywords.some((keyword) => text.includes(keyword))) return 'approval_required'
  if (severityRank(severity) >= 2 && surfaces.some((surface) => approvalSurfaceKeys.has(surface.key))) return 'approval_required'
  if (severity === 'high' && surfaces.length > 0) return 'upgrade_request'
  if (surfaces.length > 0) return 'exposure_check'
  return 'watch_only'
}

export function assessAiRiskSignals(signals: AiRiskSignalInput[]): AiRiskSignalAssessment[] {
  const owner = getAgentByKey('risk-compliance-intelligence')

  return signals.map((signal, index) => {
    const text = normalizedText(signal)
    const signalId = stableSignalId(signal, index)
    const severity = normalizeSeverity(signal.severity, text)
    const category = normalizeCategory(signal.category, text)
    const exposureSurfaces = surfacesForSignal(text)
    const classification = classifySignal(severity, exposureSurfaces, text)
    const priority = priorityForAssessment(classification, severity)
    const confidence = exposureSurfaces.length >= 2 || severityRank(severity) >= 2 ? 'high' : exposureSurfaces.length === 1 ? 'medium' : 'low'
    const ownerAgentName = owner?.name ?? 'Moremi (Ife) - Risk & Compliance'
    const sourceLabel = signal.sourceName ?? signal.sourceUrl ?? signal.title
    const recommendedNextAction =
      classification === 'watch_only'
        ? 'Retain the signal for trend monitoring; no Portfolio exposure found from the provided text.'
        : classification === 'exposure_check'
          ? 'Open a read-only exposure check against the identified Portfolio surfaces.'
          : classification === 'upgrade_request'
            ? 'Create a scoped upgrade request for the highest-risk exposed surface.'
            : 'Create an approval-routed risk packet before any remediation work begins.'

    const upgradeRequest = classification === 'watch_only'
      ? null
      : {
          title: `Review AI risk signal: ${signal.title}`,
          objective: [
            `Assess ${signal.title} for Portfolio exposure.`,
            exposureSurfaces.length
              ? `Check surfaces: ${exposureSurfaces.map((surface) => surface.label).join('; ')}.`
              : 'Confirm whether any Portfolio surface is exposed.',
            'Produce a scoped remediation or acceptance note.',
          ].join(' '),
          priority,
          owner_agent_key: 'risk-compliance-intelligence',
          source_type: 'ai_risk_signal' as const,
          source_id: signalId,
          source_label: sourceLabel,
          metadata: {
            classification,
            severity,
            category,
            source_url: signal.sourceUrl ?? null,
            published_at: signal.publishedAt ?? null,
            exposure_surfaces: exposureSurfaces.map((surface) => surface.key),
            approval_required: classification === 'approval_required',
          },
        }

    return {
      signalId,
      title: signal.title,
      classification,
      severity,
      category,
      confidence,
      rationale: exposureSurfaces.length
        ? `Matched ${exposureSurfaces.length} Portfolio exposure surface(s) from the signal text.`
        : 'No Portfolio exposure surface matched from the provided signal text.',
      exposureSurfaces,
      ownerAgentKey: 'risk-compliance-intelligence',
      ownerAgentName,
      recommendedNextAction,
      upgradeRequest,
    }
  })
}

export function buildAiRiskWorkItemRequests(
  assessments: AiRiskSignalAssessment[],
): AiRiskWorkItemRequest[] {
  return assessments
    .filter((assessment) => assessment.upgradeRequest)
    .map((assessment) => {
      const request = assessment.upgradeRequest!
      return {
        title: request.title,
        objective: request.objective,
        priority: request.priority,
        status: 'proposed',
        ownerAgentKey: request.owner_agent_key,
        ownerRuntime: 'manual',
        source: {
          type: request.source_type,
          id: request.source_id,
          label: request.source_label,
        },
        expectedFiles: [],
        overlapGroup: 'ai-risk-compliance',
        metadata: {
          ...request.metadata,
          owner_agent_name: assessment.ownerAgentName,
          recommended_next_action: assessment.recommendedNextAction,
          confidence: assessment.confidence,
          rationale: assessment.rationale,
          exposure_surfaces_detail: assessment.exposureSurfaces,
          conversion_requires_review: true,
        },
        idempotencyKey: `ai-risk-signal:${request.source_id}:${assessment.classification}`,
        sourceAssessment: assessment,
      }
    })
}

export function buildMoremiOperationalDrillWorkItemRequest() {
  const [assessment] = assessAiRiskSignals([MOREMI_OPERATIONAL_DRILL_SIGNAL])
  const [request] = buildAiRiskWorkItemRequests([assessment])

  if (!request) {
    throw new Error('Moremi operational drill did not produce a work item request')
  }

  return {
    assessment,
    workItemRequest: {
      ...request,
      metadata: {
        ...request.metadata,
        synthetic_drill: true,
        non_production_data: true,
        production_mutation_allowed: false,
        approval_required_before_remediation: true,
        admin_verification_path: '/admin/agents/coordination',
        slack_verification_command: '/agent work',
      },
      idempotencyKey: 'ai-risk-drill:moremi-operational-drill:v1',
    },
  }
}

export function getAiRiskSignalMonitorSummary() {
  const enabledFeeds = AI_RISK_SOURCE_FEEDS.filter((feed) => feed.enabled)
  return {
    ownerAgentKey: 'risk-compliance-intelligence',
    ownerAgentName: getAgentByKey('risk-compliance-intelligence')?.name ?? 'Moremi (Ife) - Risk & Compliance',
    supportingAgents: [
      'research-source-register',
      'agent-tooling-parity',
      'engineering-copilot',
      'automation-systems',
      'decision-journal',
    ],
    categories: AI_RISK_SIGNAL_CATEGORIES,
    classifications: AI_RISK_SIGNAL_CLASSIFICATIONS,
    sourceFeeds: AI_RISK_SOURCE_FEEDS,
    enabledSourceFeedCount: enabledFeeds.length,
    sourceFeedPriorities: AI_RISK_SOURCE_PRIORITIES,
    safetyBoundary: 'Read-only signal assessment. Work-item creation, production config, workflow mutation, public claims, and client-data access require approval.',
  }
}

export function getAiRiskSourceFeeds(input: {
  enabledOnly?: boolean
  priority?: AiRiskSourcePriority
  category?: AiRiskSignalCategory
} = {}) {
  return AI_RISK_SOURCE_FEEDS.filter((feed) => {
    if (input.enabledOnly && !feed.enabled) return false
    if (input.priority && feed.priority !== input.priority) return false
    if (input.category && !feed.categories.includes(input.category)) return false
    return true
  })
}
