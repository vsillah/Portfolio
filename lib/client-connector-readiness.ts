import type { AgentAction } from '@/lib/agent-policy'

type JsonRecord = Record<string, unknown>

export type ClientConnectorCategory =
  | 'website_cms'
  | 'crm'
  | 'email_calendar'
  | 'docs_storage'
  | 'analytics'
  | 'automation'
  | 'payments'
  | 'social_outreach'
  | 'support_chat'
  | 'auth_identity'
  | 'runtime_hosting'
  | 'ai_model'
  | 'rag_vector'
  | 'communications'

export type ClientConnectorSource =
  | 'verified'
  | 'audit'
  | 'meeting_audit'
  | 'builtwith'
  | 'roadmap'
  | 'project_metadata'
  | 'inferred'

export type ClientConnectorStatus = 'ready' | 'needs_auth' | 'missing' | 'review' | 'approval_blocked'

export type ClientConnectorDefinition = {
  key: string
  label: string
  category: ClientConnectorCategory
  aliases: string[]
  authMethod: 'oauth' | 'api_key' | 'service_account' | 'webhook' | 'manual' | 'none'
  setupOwner: 'client' | 'amadutown' | 'shared'
  requiredScopes: string[]
  approvalActions: AgentAction[]
  healthChecks: string[]
  fallbackPath: string
  critical: boolean
}

export type ClientConnectorReadinessItem = {
  key: string
  label: string
  category: ClientConnectorCategory
  status: ClientConnectorStatus
  source: ClientConnectorSource
  authMethod: ClientConnectorDefinition['authMethod']
  setupOwner: ClientConnectorDefinition['setupOwner']
  requiredScopes: string[]
  approvalActions: AgentAction[]
  healthChecks: string[]
  fallbackPath: string
  critical: boolean
  evidence: string
  nextAction: string
}

export type ClientConnectorReadiness = {
  summary: string
  requiredConnectorCount: number
  readyConnectorCount: number
  approvalBlockedConnectorCount: number
  missingCriticalConnectorCount: number
  connectorNextAction: string
  items: ClientConnectorReadinessItem[]
  conflicts: Array<{
    category: ClientConnectorCategory
    providers: string[]
    sources: ClientConnectorSource[]
  }>
}

export type ClientConnectorAuditSignal = {
  id?: string | number | null
  audit_type?: string | null
  tech_stack?: JsonRecord | null
  automation_needs?: JsonRecord | null
  ai_readiness?: JsonRecord | null
  budget_timeline?: JsonRecord | null
  decision_making?: JsonRecord | null
  enriched_tech_stack?: JsonRecord | null
}

export type BuildClientConnectorReadinessInput = {
  verifiedStack?: JsonRecord | null
  auditSignals?: ClientConnectorAuditSignal[]
  builtWithStack?: JsonRecord | null
  roadmapSnapshot?: JsonRecord | null
  roadmapTasks?: Array<{ title?: string | null; task_key?: string | null; metadata?: JsonRecord | null }>
  projectMetadata?: JsonRecord | null
}

type ConnectorSignal = {
  definition: ClientConnectorDefinition
  source: ClientConnectorSource
  evidence: string
  confidence: number
}

const CATEGORY_LABELS: Record<ClientConnectorCategory, string> = {
  website_cms: 'Website/CMS',
  crm: 'CRM',
  email_calendar: 'Email/calendar',
  docs_storage: 'Docs/storage',
  analytics: 'Analytics',
  automation: 'Automation',
  payments: 'Payments',
  social_outreach: 'Social/outreach',
  support_chat: 'Support/chat',
  auth_identity: 'Auth/identity',
  runtime_hosting: 'Runtime/hosting',
  ai_model: 'AI model',
  rag_vector: 'RAG/vector',
  communications: 'Communications',
}

export const CLIENT_CONNECTOR_CATALOG: ClientConnectorDefinition[] = [
  connector('wordpress', 'WordPress', 'website_cms', ['wordpress', 'wp'], 'api_key', 'shared', ['REST API user/application password', 'Admin or editor access'], ['external_api_call', 'production_config_change'], ['REST API reachable', 'Admin role verified'], 'Use manual export/import or embedded forms until API access is approved.', true),
  connector('webflow', 'Webflow', 'website_cms', ['webflow'], 'oauth', 'shared', ['Sites read', 'CMS read/write when approved'], ['external_api_call', 'production_config_change'], ['Site token valid', 'CMS collections readable'], 'Use published site scraping and manual CMS updates until OAuth is approved.', true),
  connector('squarespace', 'Squarespace', 'website_cms', ['squarespace'], 'api_key', 'shared', ['Commerce/content API where available'], ['external_api_call', 'production_config_change'], ['API key valid', 'Site domain verified'], 'Use manual exports and form embeds when API access is limited.', true),
  connector('shopify', 'Shopify', 'website_cms', ['shopify'], 'oauth', 'shared', ['Storefront read', 'Admin API read/write when approved'], ['external_api_call', 'production_config_change'], ['Storefront API valid', 'Webhook target verified'], 'Use CSV exports and manual product updates until app install is approved.', true),
  connector('wix', 'Wix', 'website_cms', ['wix'], 'oauth', 'shared', ['Site read', 'CRM/forms read when approved'], ['external_api_call', 'production_config_change'], ['OAuth app authorized', 'Site read succeeds'], 'Use form notification parsing and manual CMS updates until OAuth is approved.', true),
  connector('nextjs', 'Custom Next.js', 'website_cms', ['next.js', 'nextjs', 'vercel', 'custom next'], 'service_account', 'amadutown', ['Repository access', 'Deployment/project read'], ['external_api_call', 'production_config_change'], ['Repo access verified', 'Preview deploy readable'], 'Use read-only repository review and manual deployment notes.', true),

  connector('hubspot', 'HubSpot', 'crm', ['hubspot', 'hubspot crm', 'hubspot marketing'], 'oauth', 'shared', ['CRM contacts read', 'CRM deals read', 'Marketing/email only when approved'], ['external_api_call', 'client_data_access'], ['OAuth token valid', 'Contact read smoke passes'], 'Use CSV exports and manual pipeline notes until OAuth is approved.', true),
  connector('salesforce', 'Salesforce', 'crm', ['salesforce', 'salesforce crm'], 'oauth', 'shared', ['Objects read', 'Lead/contact read', 'Write scopes only after approval'], ['external_api_call', 'client_data_access'], ['Connected app authorized', 'SOQL read smoke passes'], 'Use reports export and manual upload while connected app is pending.', true),
  connector('bonterra_network_for_good', 'Bonterra Network for Good', 'crm', ['bonterra', 'network for good', 'networkforgood', 'network for good crm', 'bonterra network for good'], 'api_key', 'shared', ['Supporter profile read', 'Donation history read', 'Campaign/event read', 'Notes/tasks write only after approval'], ['external_api_call', 'client_data_access'], ['Read-only supporter lookup succeeds', 'Writeback fields remain disabled'], 'Use Bonterra exports or consultant-provided CSV snapshots until API or integration access is approved.', true),
  connector('pipedrive', 'Pipedrive', 'crm', ['pipedrive'], 'api_key', 'shared', ['Deals read', 'Persons read', 'Activities read'], ['external_api_call', 'client_data_access'], ['API token valid', 'Pipeline read succeeds'], 'Use exported deals and activities until token approval.', true),
  connector('zoho', 'Zoho CRM', 'crm', ['zoho', 'zoho crm'], 'oauth', 'shared', ['Contacts read', 'Deals read'], ['external_api_call', 'client_data_access'], ['OAuth token valid', 'Module read succeeds'], 'Use Zoho exports until OAuth approval.', true),
  connector('airtable', 'Airtable', 'crm', ['airtable'], 'api_key', 'shared', ['Base read', 'Table read'], ['external_api_call', 'client_data_access'], ['Token valid', 'Base schema readable'], 'Use CSV export until personal access token approval.', false),
  connector('google_sheets_crm', 'Google Sheets CRM', 'crm', ['google sheets', 'sheets-as-crm', 'spreadsheet crm', 'spreadsheets'], 'oauth', 'shared', ['Sheets read', 'Drive file read'], ['external_api_call', 'client_data_access'], ['Sheet readable', 'Owner verified'], 'Use client-provided CSV snapshots until Google OAuth approval.', false),

  connector('google_workspace', 'Google Workspace', 'email_calendar', ['gmail', 'google workspace', 'google calendar', 'google drive'], 'oauth', 'shared', ['Gmail draft/send only when approved', 'Calendar read', 'Drive read'], ['external_api_call', 'client_data_access', 'send_email'], ['OAuth scopes confirmed', 'Draft-only smoke passes'], 'Use manual draft packets and uploaded files until OAuth approval.', true),
  connector('microsoft_365', 'Microsoft 365 / Outlook', 'email_calendar', ['outlook', 'microsoft 365', 'office 365', 'teams'], 'oauth', 'shared', ['Mail draft/send only when approved', 'Calendar read', 'Teams read when approved'], ['external_api_call', 'client_data_access', 'send_email'], ['OAuth scopes confirmed', 'Calendar read smoke passes'], 'Use manual draft packets and uploaded files until Microsoft OAuth approval.', true),
  connector('slack', 'Slack', 'communications', ['slack'], 'oauth', 'shared', ['Channels read', 'Messages write only when approved'], ['external_api_call', 'client_data_access'], ['App installed', 'Channel read succeeds'], 'Use manual status posts until Slack app approval.', false),
  connector('whatsapp_twilio', 'WhatsApp / Twilio', 'communications', ['whatsapp', 'twilio'], 'api_key', 'shared', ['Messaging service read', 'Send only when approved'], ['external_api_call', 'client_data_access', 'send_email'], ['Webhook verified', 'Template status checked'], 'Use manual WhatsApp Business exports until Twilio approval.', false),

  connector('google_drive', 'Google Drive', 'docs_storage', ['google drive', 'drive'], 'oauth', 'shared', ['Drive read', 'Scoped folder access'], ['external_api_call', 'client_data_access'], ['Folder access verified', 'File list smoke passes'], 'Use uploaded source folder snapshots until Drive OAuth approval.', true),
  connector('notion', 'Notion', 'docs_storage', ['notion'], 'oauth', 'shared', ['Page read', 'Database read'], ['external_api_call', 'client_data_access'], ['Integration invited', 'Database read succeeds'], 'Use exported Markdown/PDF snapshots until Notion approval.', false),

  connector('google_analytics', 'Google Analytics', 'analytics', ['google analytics', 'ga', 'ga4', 'google analytics 4'], 'oauth', 'shared', ['Analytics read'], ['external_api_call', 'client_data_access'], ['Property access verified', 'Report read succeeds'], 'Use exported traffic reports until OAuth approval.', false),
  connector('mixpanel', 'Mixpanel', 'analytics', ['mixpanel'], 'api_key', 'shared', ['Project read', 'Export read'], ['external_api_call', 'client_data_access'], ['Token valid', 'Event query succeeds'], 'Use exported cohorts/reports until token approval.', false),

  connector('n8n', 'n8n', 'automation', ['n8n'], 'api_key', 'amadutown', ['Workflow read', 'Execution read'], ['external_api_call', 'production_config_change'], ['Workflow list readable', 'Execution health readable'], 'Use workflow export/import files with manual activation.', true),
  connector('zapier', 'Zapier', 'automation', ['zapier'], 'oauth', 'shared', ['Zap visibility where available'], ['external_api_call', 'production_config_change'], ['Zap inventory reviewed', 'Owner confirmed'], 'Use screenshots/exported Zap descriptions until access approval.', false),
  connector('make', 'Make', 'automation', ['make', 'integromat'], 'api_key', 'shared', ['Scenario read', 'Execution read'], ['external_api_call', 'production_config_change'], ['Scenario inventory readable', 'Execution history accessible'], 'Use scenario export and manual setup packet.', false),
  connector('supabase', 'Supabase', 'automation', ['supabase', 'postgres', 'postgresql'], 'service_account', 'shared', ['Database read', 'Edge/project read'], ['external_api_call', 'client_data_access', 'production_config_change'], ['Project linked', 'Read-only query smoke passes'], 'Use schema snapshots and SQL files until service access approval.', true),

  connector('client_mac_mini_node', 'Client Mac mini node', 'runtime_hosting', ['mac mini', 'apple silicon', 'local node', 'local ai operations node'], 'manual', 'client', ['Device admin account', 'Network access', 'Backup path'], ['production_config_change'], ['Device online', 'Remote access gated', 'Backup status visible'], 'Use cloud runtime fallback until the client-owned node is online and approved.', true),
  connector('client_pc_node', 'Client PC node', 'runtime_hosting', ['mini pc', 'pc equivalent', 'windows mini pc', 'linux mini pc', 'client pc', 'on prem', 'on-prem'], 'manual', 'client', ['Device admin account', 'Network access', 'Backup path'], ['production_config_change'], ['Device online', 'Remote access gated', 'Backup status visible'], 'Use cloud runtime fallback until the client-owned node is online and approved.', true),
  connector('cloud_runtime', 'Cloud runtime host', 'runtime_hosting', ['cloud fallback', 'cloud runtime', 'cloud hosted', '24/7 access', 'always on', 'vercel', 'railway', 'render', 'aws', 'gcp', 'azure'], 'service_account', 'shared', ['Project read', 'Deployment read', 'Runtime env access only after approval'], ['external_api_call', 'production_config_change'], ['Runtime reachable', 'Health check passes', 'Cost owner recorded'], 'Use read-only setup packet and manual deployment approval before any cloud provisioning.', true),

  connector('stripe', 'Stripe', 'payments', ['stripe'], 'api_key', 'shared', ['Restricted read key', 'Webhook read'], ['external_api_call', 'client_data_access', 'production_config_change'], ['Restricted key valid', 'Webhook endpoint verified'], 'Use exported transactions and manual webhook packet.', false),
  connector('mailchimp', 'Mailchimp', 'social_outreach', ['mailchimp'], 'oauth', 'shared', ['Audience read', 'Campaign draft only when approved'], ['external_api_call', 'client_data_access', 'send_email'], ['Audience read succeeds', 'Draft-only path confirmed'], 'Use exported audience/campaign reports until OAuth approval.', false),
  connector('meta', 'Meta / Facebook', 'social_outreach', ['meta', 'facebook', 'instagram', 'meta ads'], 'oauth', 'shared', ['Page/ad account read', 'Publishing only when approved'], ['external_api_call', 'client_data_access', 'publish_public_content'], ['Business access verified', 'Account read succeeds'], 'Use exported ad/page reports until Meta access approval.', false),
  connector('linkedin', 'LinkedIn', 'social_outreach', ['linkedin'], 'oauth', 'shared', ['Profile/page read where available', 'Publishing only when approved'], ['external_api_call', 'client_data_access', 'publish_public_content'], ['Access owner confirmed', 'Publishing gate recorded'], 'Use manual review queue and browser-assisted research.', false),
  connector('resend', 'Resend', 'social_outreach', ['resend'], 'api_key', 'amadutown', ['Domain/sender read', 'Send only when approved'], ['external_api_call', 'send_email', 'production_config_change'], ['Domain verified', 'Webhook reachable'], 'Use Gmail draft path until Resend approval.', false),

  connector('openai', 'OpenAI', 'ai_model', ['openai', 'chatgpt', 'gpt'], 'api_key', 'shared', ['Model API key', 'Usage visibility'], ['external_api_call', 'client_data_access'], ['Key present in client-owned env', 'Model smoke passes'], 'Use manual/offline model evaluation until API key approval.', true),
  connector('anthropic', 'Anthropic', 'ai_model', ['anthropic', 'claude'], 'api_key', 'shared', ['Model API key', 'Usage visibility'], ['external_api_call', 'client_data_access'], ['Key present in client-owned env', 'Model smoke passes'], 'Use manual/offline model evaluation until API key approval.', true),
  connector('local_llm', 'Local/open-weight model', 'ai_model', ['local llm', 'ollama', 'lm studio', 'llama', 'mistral', 'qwen'], 'manual', 'amadutown', ['Local node access'], ['production_config_change'], ['Model available', 'Latency smoke passes'], 'Use hosted model fallback until local runtime is ready.', false),
  connector('pinecone', 'Pinecone', 'rag_vector', ['pinecone'], 'api_key', 'shared', ['Index read/write when approved'], ['external_api_call', 'client_data_access', 'production_config_change'], ['Index reachable', 'Namespace policy recorded'], 'Use Supabase/local RAG shadow mode until Pinecone approval.', false),
  connector('supabase_vector', 'Supabase Vector', 'rag_vector', ['supabase vector', 'pgvector', 'postgres vector'], 'service_account', 'shared', ['Vector table read/write when approved'], ['external_api_call', 'client_data_access', 'production_config_change'], ['Vector table reachable', 'RLS policy reviewed'], 'Use local JSON/search fallback until database approval.', false),
]

function connector(
  key: string,
  label: string,
  category: ClientConnectorCategory,
  aliases: string[],
  authMethod: ClientConnectorDefinition['authMethod'],
  setupOwner: ClientConnectorDefinition['setupOwner'],
  requiredScopes: string[],
  approvalActions: AgentAction[],
  healthChecks: string[],
  fallbackPath: string,
  critical: boolean,
): ClientConnectorDefinition {
  return { key, label, category, aliases, authMethod, setupOwner, requiredScopes, approvalActions, healthChecks, fallbackPath, critical }
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
}

function valuesFromUnknown(value: unknown): string[] {
  if (!value) return []
  if (typeof value === 'string' || typeof value === 'number') return [String(value)]
  if (Array.isArray(value)) return value.flatMap(valuesFromUnknown)
  if (typeof value === 'object') {
    const record = value as JsonRecord
    if (typeof record.name === 'string') return [record.name]
    return Object.values(record).flatMap(valuesFromUnknown)
  }
  return []
}

function definitionForValue(value: unknown, category?: ClientConnectorCategory): ClientConnectorDefinition | null {
  return definitionsForValue(value, category)[0] ?? null
}

function definitionsForValue(value: unknown, category?: ClientConnectorCategory): ClientConnectorDefinition[] {
  const normalized = normalize(value)
  if (!normalized || normalized === 'none' || normalized === 'other') return []
  return CLIENT_CONNECTOR_CATALOG.filter((definition) => {
    if (category && definition.category !== category) return false
    return definition.aliases.some((alias) => {
      const aliasNorm = normalize(alias)
      return normalized === aliasNorm || normalized.includes(aliasNorm) || aliasNorm.includes(normalized)
    })
  })
}

function addSignal(signals: ConnectorSignal[], definition: ClientConnectorDefinition | null, source: ClientConnectorSource, evidence: string, confidence: number) {
  if (!definition) return
  signals.push({ definition, source, evidence, confidence })
}

function technologiesFromStack(stack: JsonRecord | null | undefined): unknown[] {
  if (!stack || typeof stack !== 'object') return []
  const direct = stack.technologies
  if (Array.isArray(direct)) return direct
  const byTag = stack.byTag
  if (byTag && typeof byTag === 'object') return Object.values(byTag as JsonRecord).flatMap(valuesFromUnknown)
  return []
}

function collectStackSignals(signals: ConnectorSignal[], stack: JsonRecord | null | undefined, source: ClientConnectorSource, confidence: number) {
  for (const technology of technologiesFromStack(stack)) {
    for (const value of valuesFromUnknown(technology)) {
      addSignal(signals, definitionForValue(value), source, `Detected ${value}`, confidence)
    }
  }
}

function collectAuditSignals(signals: ConnectorSignal[], audit: ClientConnectorAuditSignal) {
  const source: ClientConnectorSource = audit.audit_type === 'meeting_derived' || audit.audit_type === 'meeting' ? 'meeting_audit' : 'audit'
  const tech = audit.tech_stack ?? {}
  addSignal(signals, definitionForValue(tech.crm, 'crm'), source, `Audit CRM: ${String(tech.crm ?? '')}`, source === 'meeting_audit' ? 70 : 80)
  addSignal(signals, definitionForValue(tech.email, 'email_calendar') ?? definitionForValue(tech.email, 'communications'), source, `Audit email/comms: ${String(tech.email ?? '')}`, source === 'meeting_audit' ? 70 : 80)
  addSignal(signals, definitionForValue(tech.marketing, 'social_outreach') ?? definitionForValue(tech.marketing, 'crm'), source, `Audit marketing: ${String(tech.marketing ?? '')}`, source === 'meeting_audit' ? 70 : 80)
  addSignal(signals, definitionForValue(tech.analytics, 'analytics'), source, `Audit analytics: ${String(tech.analytics ?? '')}`, source === 'meeting_audit' ? 70 : 80)

  for (const tool of valuesFromUnknown(tech.other_tools)) {
    addSignal(signals, definitionForValue(tool), source, `Audit other tool: ${tool}`, source === 'meeting_audit' ? 65 : 75)
  }
  for (const tool of valuesFromUnknown(tech.website_technologies)) {
    addSignal(signals, definitionForValue(tool, 'website_cms') ?? definitionForValue(tool), source, `Audit website technology: ${tool}`, source === 'meeting_audit' ? 65 : 75)
  }

  collectStackSignals(signals, audit.enriched_tech_stack, source, source === 'meeting_audit' ? 68 : 78)

  const automationAreas = valuesFromUnknown(audit.automation_needs?.priority_areas)
  if (automationAreas.length > 0) addSignal(signals, definitionForValue('n8n'), 'inferred', `Audit automation priorities: ${automationAreas.join(', ')}`, 40)
  if (automationAreas.some((area) => normalize(area).includes('lead') || normalize(area).includes('follow'))) {
    addSignal(signals, definitionForValue('hubspot', 'crm'), 'inferred', 'Lead follow-up automation needs a CRM connector decision.', 35)
    addSignal(signals, definitionForValue('gmail', 'email_calendar'), 'inferred', 'Lead follow-up automation needs an email/calendar connector decision.', 35)
  }

  const dataQuality = normalize(audit.ai_readiness?.data_quality)
  const previousAi = normalize(audit.ai_readiness?.previous_ai_experience)
  if (dataQuality || previousAi || valuesFromUnknown(audit.ai_readiness?.concerns).length > 0) {
    addSignal(signals, definitionForValue('openai', 'ai_model'), 'inferred', 'AI readiness requires an AI model routing decision.', 35)
  }
  if (dataQuality.includes('integrated') || dataQuality.includes('ready') || dataQuality.includes('some systems')) {
    addSignal(signals, definitionForValue('supabase vector', 'rag_vector'), 'inferred', 'AI readiness suggests a RAG/vector store decision.', 30)
  }
}

function collectRoadmapSignals(signals: ConnectorSignal[], input: BuildClientConnectorReadinessInput) {
  collectStackSignals(signals, input.roadmapSnapshot?.connector_readiness as JsonRecord | undefined, 'roadmap', 60)
  const text = [
    ...valuesFromUnknown(input.roadmapSnapshot?.stackSignals),
    ...(input.roadmapTasks ?? []).flatMap((task) => valuesFromUnknown([task.task_key, task.title, task.metadata])),
    ...valuesFromUnknown(input.projectMetadata),
  ]
  for (const value of text) {
    for (const definition of definitionsForValue(value)) {
      addSignal(signals, definition, 'roadmap', `Roadmap/project signal: ${value}`, 50)
    }
  }
}

function sourceRank(source: ClientConnectorSource): number {
  return {
    verified: 100,
    audit: 80,
    meeting_audit: 70,
    builtwith: 60,
    roadmap: 50,
    project_metadata: 45,
    inferred: 30,
  }[source]
}

function integrationReadiness(input: BuildClientConnectorReadinessInput): string {
  return normalize(input.auditSignals?.find((audit) => audit.tech_stack?.integration_readiness)?.tech_stack?.integration_readiness)
}

function hasApprovalBlocker(input: BuildClientConnectorReadinessInput): boolean {
  return Boolean(input.auditSignals?.some((audit) => {
    const dm = audit.decision_making ?? {}
    const approval = normalize(dm.approval_process)
    return dm.decision_maker === false || approval.includes('committee') || approval.includes('budget threshold')
  }))
}

function statusForSignal(signal: ConnectorSignal, input: BuildClientConnectorReadinessInput, hasConflict: boolean): ClientConnectorStatus {
  if (hasConflict) return 'review'
  if (hasApprovalBlocker(input) && signal.definition.approvalActions.length > 0) return 'approval_blocked'
  const readiness = integrationReadiness(input)
  if (signal.source === 'verified' && (readiness.includes('well') || readiness.includes('integrated') || readiness.includes('high'))) return 'ready'
  if (signal.source === 'inferred') return 'missing'
  if (signal.definition.authMethod === 'none') return 'ready'
  return 'needs_auth'
}

function nextActionForItem(item: Omit<ClientConnectorReadinessItem, 'nextAction'>): string {
  if (item.status === 'review') return `Resolve conflicting ${CATEGORY_LABELS[item.category]} signals before provisioning.`
  if (item.status === 'approval_blocked') return `Create approval checkpoint before connecting ${item.label}.`
  if (item.status === 'missing') return `Decide whether ${item.label} belongs in the client MVP connector set.`
  if (item.status === 'needs_auth') return `Prepare ${item.authMethod} setup packet for ${item.label}; do not connect until approved.`
  return `${item.label} connector is ready for read-only planning and health checks.`
}

export function buildClientConnectorReadiness(input: BuildClientConnectorReadinessInput): ClientConnectorReadiness {
  const signals: ConnectorSignal[] = []
  collectStackSignals(signals, input.verifiedStack, 'verified', 100)
  for (const audit of input.auditSignals ?? []) collectAuditSignals(signals, audit)
  collectStackSignals(signals, input.builtWithStack, 'builtwith', 60)
  collectRoadmapSignals(signals, input)

  const byCategory = new Map<ClientConnectorCategory, ConnectorSignal[]>()
  for (const signal of signals) {
    byCategory.set(signal.definition.category, [...(byCategory.get(signal.definition.category) ?? []), signal])
  }

  const conflicts: ClientConnectorReadiness['conflicts'] = []
  const pickedSignals: ConnectorSignal[] = []
  for (const [category, categorySignals] of byCategory) {
    const sorted = categorySignals.sort((a, b) => (sourceRank(b.source) + b.confidence) - (sourceRank(a.source) + a.confidence))
    const highestSourceRank = sourceRank(sorted[0]!.source)
    const sameTier = sorted.filter((signal) => sourceRank(signal.source) === highestSourceRank)
    const providerKeys = [...new Set(sameTier.map((signal) => signal.definition.key))]
    if (providerKeys.length > 1 && (highestSourceRank >= 70 || category === 'runtime_hosting')) {
      conflicts.push({
        category,
        providers: providerKeys.map((key) => CLIENT_CONNECTOR_CATALOG.find((definition) => definition.key === key)?.label ?? key),
        sources: [...new Set(sameTier.map((signal) => signal.source))],
      })
    }
    pickedSignals.push(sorted[0]!)
  }

  const items = pickedSignals
    .sort((a, b) => sourceRank(b.source) - sourceRank(a.source))
    .map((signal): ClientConnectorReadinessItem => {
      const hasConflict = conflicts.some((conflict) => conflict.category === signal.definition.category)
      const base = {
        key: signal.definition.key,
        label: signal.definition.label,
        category: signal.definition.category,
        status: statusForSignal(signal, input, hasConflict),
        source: signal.source,
        authMethod: signal.definition.authMethod,
        setupOwner: signal.definition.setupOwner,
        requiredScopes: signal.definition.requiredScopes,
        approvalActions: signal.definition.approvalActions,
        healthChecks: signal.definition.healthChecks,
        fallbackPath: signal.definition.fallbackPath,
        critical: signal.definition.critical,
        evidence: signal.evidence,
      }
      return { ...base, nextAction: nextActionForItem(base) }
    })

  const readyConnectorCount = items.filter((item) => item.status === 'ready').length
  const approvalBlockedConnectorCount = items.filter((item) => item.status === 'approval_blocked').length
  const missingCriticalConnectorCount = items.filter((item) => item.critical && (item.status === 'missing' || item.status === 'review')).length
  const needsAuthCount = items.filter((item) => item.status === 'needs_auth').length
  const nextItem = items.find((item) => item.status === 'approval_blocked')
    ?? items.find((item) => item.status === 'review')
    ?? items.find((item) => item.status === 'needs_auth')
    ?? items.find((item) => item.status === 'missing' && item.critical)
    ?? items[0]

  return {
    summary: items.length
      ? `${items.length} required, ${readyConnectorCount} ready, ${needsAuthCount} need auth, ${approvalBlockedConnectorCount} approval-blocked`
      : 'No connector requirements detected yet',
    requiredConnectorCount: items.length,
    readyConnectorCount,
    approvalBlockedConnectorCount,
    missingCriticalConnectorCount,
    connectorNextAction: nextItem?.nextAction ?? 'Capture audit or verified stack data to build the connector setup packet.',
    items,
    conflicts,
  }
}
