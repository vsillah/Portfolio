export type AgentPodKey =
  | 'chief_of_staff'
  | 'strategy_narrative'
  | 'research_knowledge'
  | 'content_production'
  | 'product_automation'
  | 'publishing_follow_up'

export type AgentOrganizationStatus = 'active' | 'partial' | 'planned'

export interface AgentPodDefinition {
  key: AgentPodKey
  name: string
  purpose: string
}

export interface N8nWorkflowRef {
  id?: string
  name: string
  environment: 'production' | 'staging' | 'shared'
  active: boolean
}

export interface AgentOrganizationNode {
  key: string
  name: string
  podKey: AgentPodKey
  status: AgentOrganizationStatus
  primaryRuntime: 'codex' | 'n8n' | 'hermes' | 'manual' | 'mixed'
  responsibility: string
  engagementPath: string
  approvalGate: string
  n8nWorkflows: N8nWorkflowRef[]
}

export const AGENT_PODS: AgentPodDefinition[] = [
  {
    key: 'chief_of_staff',
    name: 'Chief of Staff',
    purpose: 'Turns executive intent into cross-pod priorities, morning review, escalations, and status summaries.',
  },
  {
    key: 'strategy_narrative',
    name: 'Strategy & Narrative Pod',
    purpose: 'Shapes positioning, proposals, business models, legacy framing, and institutional strategy.',
  },
  {
    key: 'research_knowledge',
    name: 'Research & Knowledge Pod',
    purpose: 'Maintains evidence, source registers, private knowledge, RAG context, and decision support.',
  },
  {
    key: 'content_production',
    name: 'Content Production Pod',
    purpose: 'Creates, repurposes, brands, and quality-controls content assets.',
  },
  {
    key: 'product_automation',
    name: 'Product & Automation Pod',
    purpose: 'Builds and operates the product, client delivery, monitoring, workflow, and runtime tooling systems.',
  },
  {
    key: 'publishing_follow_up',
    name: 'Publishing & Follow-Up Pod',
    purpose: 'Handles outbound delivery, inbox/follow-up loops, social publishing, nurture, and meeting intake.',
  },
]

export const AGENT_ORGANIZATION: AgentOrganizationNode[] = [
  {
    key: 'chief-of-staff',
    name: 'Chief of Staff Agent',
    podKey: 'chief_of_staff',
    status: 'partial',
    primaryRuntime: 'mixed',
    responsibility: 'Cross-pod review, daily priorities, stale-run cleanup, escalation routing, and executive status.',
    engagementPath: '/admin/agents plus the Agent Ops morning review schedule.',
    approvalGate: 'Read-only status by default; production config changes require approval.',
    n8nWorkflows: [
      {
        id: 'INXb3COtMsXx7lku',
        name: 'WF-AGENT-OPS: Morning Review',
        environment: 'production',
        active: true,
      },
    ],
  },
  {
    key: 'strategic-narrative',
    name: 'Strategic Narrative Agent',
    podKey: 'strategy_narrative',
    status: 'planned',
    primaryRuntime: 'codex',
    responsibility: 'Convert intent, market context, and operating proof into clear narrative strategy.',
    engagementPath: 'Codex/Hermes content workflow first; n8n is not the primary runtime for this agent.',
    approvalGate: 'Human review before public-facing claims or private-story usage.',
    n8nWorkflows: [],
  },
  {
    key: 'proposal-business-model',
    name: 'Proposal & Business Model Agent',
    podKey: 'strategy_narrative',
    status: 'planned',
    primaryRuntime: 'codex',
    responsibility: 'Assemble offers, pricing logic, proposal framing, and value models.',
    engagementPath: 'Portfolio proposal/admin surfaces; Codex implementation support.',
    approvalGate: 'Human approval before client-facing proposal delivery.',
    n8nWorkflows: [],
  },
  {
    key: 'legacy-institution-builder',
    name: 'Legacy & Institution Builder',
    podKey: 'strategy_narrative',
    status: 'planned',
    primaryRuntime: 'codex',
    responsibility: 'Translate long-horizon institution-building ideas into durable artifacts and operating models.',
    engagementPath: 'Codex planning/content workflow.',
    approvalGate: 'Human approval before public thought leadership.',
    n8nWorkflows: [],
  },
  {
    key: 'research-source-register',
    name: 'Research & Source Register Agent',
    podKey: 'research_knowledge',
    status: 'partial',
    primaryRuntime: 'mixed',
    responsibility: 'Collect, classify, and retrieve source-backed evidence for decisions, content, and client work.',
    engagementPath: '/admin/value-evidence, RAG workflows, and lead research workflows.',
    approvalGate: 'Private or client-derived material requires review before public use.',
    n8nWorkflows: [
      { id: 'uxsDWErRpICMxoRM', name: 'Lead Research and Qualifying Agent', environment: 'production', active: true },
      { id: 'iqGylSD1c2lDxlDT', name: 'WF-VEP-001: Internal Evidence Extraction', environment: 'production', active: true },
      { id: 'gUyOBZOknpAt41aF', name: 'WF-VEP-002: Social Listening Pipeline', environment: 'production', active: true },
      { id: '7YdqfO7rewTHICHy', name: 'WF-VEP-001-STAG: Internal Evidence Extraction', environment: 'staging', active: true },
      { id: 'VgDvKIZeuslJSmj8', name: 'WF-VEP-002-STAG: Social Listening Pipeline', environment: 'staging', active: true },
    ],
  },
  {
    key: 'private-knowledge-librarian',
    name: 'Private Knowledge Librarian',
    podKey: 'research_knowledge',
    status: 'partial',
    primaryRuntime: 'n8n',
    responsibility: 'Keep RAG and private knowledge retrieval paths current without exposing raw private material.',
    engagementPath: 'RAG ingest/query workflows and Portfolio knowledge surfaces.',
    approvalGate: 'No private material quoted publicly without explicit approval.',
    n8nWorkflows: [
      { id: 'yCNUqSHfyXpxNDLm', name: 'WF-RAG-INGEST: Google Drive -> Pinecone Ingestion (Daily)', environment: 'production', active: true },
      { id: '7Xn0fxEgXlbK6Gmm', name: 'WF-RAG-QUERY: Webhook RAG Search', environment: 'production', active: true },
      { id: '5YImo1TTgEInnfxw', name: 'WF-RAG-CHAT: Public Chatbot', environment: 'production', active: true },
      { id: 'Y56hALscpB5Asq7j', name: 'WF-RAG-DIAGNOSTIC: Multi-Category Assessment', environment: 'production', active: true },
      { id: 'FJHcf3SPDWBirqu1', name: 'WF-RAG-INGEST-STAG: Google Drive -> Pinecone Ingestion (Daily)', environment: 'staging', active: false },
      { id: 'gYtZQi25kxXpbHLH', name: 'WF-RAG-QUERY-STAG: Webhook RAG Search', environment: 'staging', active: true },
      { id: 'ZCbY39UhhreaX4Rp', name: 'WF-RAG-CHAT-STAG: Public Chatbot', environment: 'staging', active: true },
      { id: 'lSpWqqaOQllyYFF8', name: 'WF-RAG-DIAG-STAG: Multi-Category Assessment', environment: 'staging', active: true },
    ],
  },
  {
    key: 'decision-journal',
    name: 'Decision Journal Agent',
    podKey: 'research_knowledge',
    status: 'planned',
    primaryRuntime: 'mixed',
    responsibility: 'Capture durable decisions, rationale, source links, approvals, PRs, and rollback notes.',
    engagementPath: 'Planned Agent Ops and Slack command layer.',
    approvalGate: 'Read-only capture first; edits to durable rules require review.',
    n8nWorkflows: [],
  },
  {
    key: 'voice-content-architect',
    name: 'Voice & Content Architect',
    podKey: 'content_production',
    status: 'partial',
    primaryRuntime: 'mixed',
    responsibility: 'Turn source-backed ideas into Vambah-aligned content structures and reusable assets.',
    engagementPath: '/admin/social-content and Codex content workflow.',
    approvalGate: 'Human review before publishing.',
    n8nWorkflows: [
      { id: 'wGV65iaCpN8vFiU1', name: 'WF-SOC-001: Social Content Extraction', environment: 'production', active: true },
      { id: '7w0m68a8ad6BkdzV', name: 'WF-SOC-001-STAG: Social Content Extraction', environment: 'staging', active: true },
    ],
  },
  {
    key: 'content-repurposing',
    name: 'Content Repurposing Agent',
    podKey: 'content_production',
    status: 'partial',
    primaryRuntime: 'n8n',
    responsibility: 'Regenerate and adapt content assets across audio, image, and social variants.',
    engagementPath: '/admin/social-content and content generation workflows.',
    approvalGate: 'Human review before publish/send.',
    n8nWorkflows: [
      { id: '3uUlNmu58u0VzpDN', name: 'WF-SOC-003: Social Content Regenerate Audio', environment: 'production', active: true },
      { id: 'eo0OAfcGmsZUqvjp', name: 'WF-SOC-003 Image Regeneration', environment: 'production', active: true },
    ],
  },
  {
    key: 'amadutown-brand',
    name: 'AmaduTown Brand Agent',
    podKey: 'content_production',
    status: 'planned',
    primaryRuntime: 'codex',
    responsibility: 'Protect brand assets, visual consistency, and source-faithful public narrative.',
    engagementPath: 'Codex design/content workflow first.',
    approvalGate: 'Human review before public visual or brand changes.',
    n8nWorkflows: [],
  },
  {
    key: 'course-curriculum-builder',
    name: 'Course & Curriculum Builder',
    podKey: 'content_production',
    status: 'planned',
    primaryRuntime: 'codex',
    responsibility: 'Build course structures, lesson assets, facilitator guides, and deck-ready material.',
    engagementPath: 'Codex content/course workflow first.',
    approvalGate: 'Human review before client/public release.',
    n8nWorkflows: [],
  },
  {
    key: 'engineering-copilot',
    name: 'Engineering Copilot Agent',
    podKey: 'product_automation',
    status: 'partial',
    primaryRuntime: 'codex',
    responsibility: 'Implement, validate, ship, and monitor Portfolio changes through the integration-captain workflow.',
    engagementPath: 'Codex branches, PRs, Vercel checks, and Agent Ops traces.',
    approvalGate: 'Direct production-impacting changes use PR/deploy gates.',
    n8nWorkflows: [],
  },
  {
    key: 'automation-systems',
    name: 'Automation Systems Agent',
    podKey: 'product_automation',
    status: 'active',
    primaryRuntime: 'n8n',
    responsibility: 'Operate the client, project, monitor, provisioning, and workflow automation backbone.',
    engagementPath: 'n8n schedules/webhooks plus Portfolio admin workflow pages.',
    approvalGate: 'Known workflow writes allowed; config and unknown production writes require approval.',
    n8nWorkflows: [
      { id: 'r7lqF46pFnIazhY3', name: 'WF-000: Inbound Lead Intake', environment: 'production', active: true },
      { id: 'vQroX9UhX7Ud0ciV', name: 'WF-000A: Discovery Call Booked', environment: 'production', active: true },
      { id: 'Uk6jTuFgb3jOs5Yb', name: 'WF-000B: Discovery Session Complete', environment: 'production', active: true },
      { id: 'jX5Inu4YEJE8H0ox', name: 'WF-001: Client Payment Intake', environment: 'production', active: true },
      { id: 'rIDbBY9JsG3ddv25', name: 'WF-001B: Onboarding Call Handler', environment: 'production', active: true },
      { id: 'MJngftZveHYB6sG2', name: 'WF-002: Kickoff Call Scheduled', environment: 'production', active: true },
      { id: '8H9syBvNGfAAP57A', name: 'WF-004: Kickoff Call Complete', environment: 'production', active: true },
      { id: 'ww8lxWCTDxxf54hy', name: 'WF-005: Project Workspace Setup', environment: 'production', active: true },
      { id: 'WC4o59BeXcLEX3Ox', name: 'WF-006: Milestone Planning', environment: 'production', active: true },
      { id: 'ljflHS6xzonxHiIi', name: 'WF-007: Automated Progress Updates', environment: 'production', active: true },
      { id: 'GMXuSK6DvCOVD2lt', name: 'WF-008: Blocker Escalation', environment: 'production', active: true },
      { id: 'AEe18CbCODbiNbpX', name: 'WF-009: Milestone Completion', environment: 'production', active: true },
      { id: '7p8Cz4aC6GoIqZDL', name: 'WF-010: E2E Testing Checklist', environment: 'production', active: true },
      { id: 'qBYSSCmM9YF3S6BP', name: 'WF-011: Documentation Generation', environment: 'production', active: true },
      { id: 'FFm50BA6AhDUwz45', name: 'WF-012: Project Delivery & Upsell', environment: 'production', active: true },
      { id: 'HqpDGIHxvJqXKHuT', name: 'WF-MON-001: Apify Actor Health Monitor', environment: 'production', active: true },
      { id: 'R5xVO3JBGMBjQ9f5', name: 'WF-MON-001-STAG: Apify Actor Health Monitor', environment: 'staging', active: true },
      { id: 'SLhkx0Ff4uGjcxi2', name: 'WF-PROV: Provisioning Reminder', environment: 'production', active: true },
      { id: '3XGTDE9esc6yVH0Y', name: 'WF-PROV-STAG: Provisioning Reminder', environment: 'staging', active: true },
      { id: 'V5cNpHrAgSqd05NC', name: 'WF-GAMMA-CLEANUP: Stuck Gamma Reports', environment: 'production', active: true },
      { id: '5Je559BeMo2woKg4', name: 'WF-TSK: Task Slack Sync', environment: 'production', active: true },
      { id: 'yW5jjL7iLkWLO6Co', name: 'WF-TSK-STAG: Task Slack Sync', environment: 'staging', active: true },
    ],
  },
  {
    key: 'agent-tooling-parity',
    name: 'Agent Tooling Parity Agent',
    podKey: 'product_automation',
    status: 'planned',
    primaryRuntime: 'codex',
    responsibility: 'Keep Codex, Hermes, OpenCode, n8n, and future runtimes aligned on tools and safety gates.',
    engagementPath: 'Agent Ops runtime evaluation plus future scheduled parity checks.',
    approvalGate: 'Tool installs/config changes require review unless explicitly pre-approved.',
    n8nWorkflows: [],
  },
  {
    key: 'website-product-copy',
    name: 'Website & Product Copy Agent',
    podKey: 'publishing_follow_up',
    status: 'partial',
    primaryRuntime: 'mixed',
    responsibility: 'Move approved copy and social content toward publishing surfaces.',
    engagementPath: '/admin/social-content and publishing workflows.',
    approvalGate: 'Approval required before public publishing.',
    n8nWorkflows: [
      { id: 'qmsrLudtm56hzKpV', name: 'WF-SOC-002: Social Content Publish', environment: 'production', active: true },
      { id: 'r8tYuflvnDI1UVoC', name: 'WF-SOC-002-STAG: Social Content Publish', environment: 'staging', active: true },
    ],
  },
  {
    key: 'inbox-follow-up',
    name: 'Inbox & Follow-Up Agent',
    podKey: 'publishing_follow_up',
    status: 'active',
    primaryRuntime: 'n8n',
    responsibility: 'Handle outreach sends, replies, Gmail drafts, nurture, meeting intake, and Slack follow-up.',
    engagementPath: '/admin/outreach, email center, Slack intake, and follow-up workflows.',
    approvalGate: 'Human approval before sending external email where workflow policy requires it.',
    n8nWorkflows: [
      { id: 'RnHIZzuZS46ptKG2', name: 'WF-CLG-001: Cold Lead Sourcing', environment: 'production', active: true },
      { id: 'E9lFlMxdtnnebIFK', name: 'WF-CLG-001-STAG: Cold Lead Sourcing', environment: 'staging', active: true },
      { id: 'l4iaJwxbeMlR7pTr', name: 'WF-CLG-003: Send and Follow-Up', environment: 'production', active: true },
      { id: 'c6YWuqITIeep5QZp', name: 'WF-CLG-003-STAG: Send and Follow-Up', environment: 'staging', active: true },
      { id: 'i2IGVOYWcpxFidpf', name: 'WF-CLG-004: Reply Detection and Notification', environment: 'production', active: true },
      { id: 'AxE3tBBNDOvD6ogK', name: 'WF-CLG-004-STAG: Reply Detection and Notification', environment: 'staging', active: true },
      { id: 'SGGvj8MavKXYcJZL', name: 'WF-WRM-001: Facebook Warm Lead Scraper', environment: 'production', active: true },
      { id: 'KZpTpasHMDQ3kLtG', name: 'WF-WRM-001-STAG: Facebook Warm Lead Scraper', environment: 'staging', active: true },
      { id: 'vrf24TfBytI1yWxA', name: 'WF-WRM-002: Google Contacts Sync', environment: 'production', active: true },
      { id: 'Tu0NeKYTpjQhYLxw', name: 'WF-WRM-002-STAG: Google Contacts Sync', environment: 'staging', active: true },
      { id: 'oMUimdg7FTFDut9i', name: 'WF-WRM-003: LinkedIn Warm Lead Scraper', environment: 'production', active: true },
      { id: '6aFxQF3CKR5HZptu', name: 'WF-WRM-003-STAG: LinkedIn Warm Lead Scraper', environment: 'staging', active: true },
      { id: 'zXfZmgqM6g1teIMY', name: 'WF-GDR: Gmail Draft Reply', environment: 'production', active: true },
      { id: 'ZcmmuBcI1vCEvJU7', name: 'WF-GDR-STAG: Gmail Draft Reply', environment: 'staging', active: true },
      { id: 'DiN2zado2GVk2Lka', name: 'WF-LMN-001: Ebook Nurture Sequence', environment: 'production', active: true },
      { id: 'ffiAJkNUDdF8E4G8', name: 'WF-LMN-001-STAG: Ebook Nurture Sequence', environment: 'staging', active: true },
      { id: '77FrJvhWIaOMfrLX', name: 'WF-SLK: Slack Meeting Intake', environment: 'production', active: true },
      { id: 'PVpcf3FbOpP3KhkO', name: 'WF-SLK-STAG: Slack Meeting Intake', environment: 'staging', active: true },
      { id: 'Hm33AYCNzZP4JfNh', name: 'WF-CAL: Calendly Webhook Router', environment: 'production', active: true },
      { id: 'bAx1DPXUy5Hs0fJl', name: 'WF-CAL-STAG: Calendly Webhook Router', environment: 'staging', active: true },
      { id: 'hzCgH5uF0GoJspWm', name: 'WF-MCH: Meeting Complete Handler', environment: 'production', active: true },
      { id: 'Khph9o7IMhEXgwFW', name: 'WF-MCH-STAG: Meeting Complete Handler', environment: 'staging', active: true },
      { id: 'yNVJ3Ptmj3RF4eLl', name: 'WF-AGB: AI Agenda Builder', environment: 'production', active: true },
      { id: 'UFXxHyJ75hj9VsvO', name: 'WF-AGE: Agenda Email Sender', environment: 'production', active: true },
      { id: 'TQCVwtkO9Uo8xAnJ', name: 'WF-AGE-STAG: Agenda Email Sender', environment: 'staging', active: true },
      { id: 'gw0sl156wmKVgIyL', name: 'WF-FUP: Follow-Up Meeting Scheduler', environment: 'production', active: true },
      { id: 'S9CIj44mdW3tv8CH', name: 'WF-FUP-STAG: Follow-Up Meeting Scheduler', environment: 'staging', active: true },
    ],
  },
]

export function getAgentsForPod(podKey: AgentPodKey) {
  return AGENT_ORGANIZATION.filter((agent) => agent.podKey === podKey)
}

export function getAgentOrganizationSummary() {
  return AGENT_PODS.map((pod) => {
    const agents = getAgentsForPod(pod.key)
    const workflows = agents.flatMap((agent) => agent.n8nWorkflows)
    return {
      ...pod,
      agents,
      agentCount: agents.length,
      activeAgentCount: agents.filter((agent) => agent.status === 'active').length,
      partialAgentCount: agents.filter((agent) => agent.status === 'partial').length,
      plannedAgentCount: agents.filter((agent) => agent.status === 'planned').length,
      workflowCount: workflows.length,
      activeWorkflowCount: workflows.filter((workflow) => workflow.active).length,
    }
  })
}

export function getN8nWorkflowCoverage() {
  return AGENT_ORGANIZATION.flatMap((agent) =>
    agent.n8nWorkflows.map((workflow) => ({
      ...workflow,
      agentKey: agent.key,
      agentName: agent.name,
      podKey: agent.podKey,
      podName: AGENT_PODS.find((pod) => pod.key === agent.podKey)?.name ?? agent.podKey,
    })),
  )
}
