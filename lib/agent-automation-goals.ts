import { getAgentByKey } from '@/lib/agent-organization'
import type { AgentWorkItemPriority } from '@/lib/agent-work-items'

export type AutomationLevel = 'full_internal' | 'draft_to_review' | 'approval_gated' | 'discovery_only'

export type AutomationGoalTaskSeed = {
  title: string
  objective: string
  ownerAgentKey: string
  priority: AgentWorkItemPriority
  expectedFiles?: string[]
  acceptanceCriteria: string[]
  riskNotes: string
  requiresApproval: boolean
  progressWeight: number
}

export type AutomationGoalSeed = {
  id: string
  tier: 1 | 2
  title: string
  objective: string
  workflowFamily: string
  automationLevel: AutomationLevel
  ownerAgentKey: string
  collaboratorAgentKeys: string[]
  sourceRoutes: string[]
  sourceDocs: string[]
  n8nWorkflows: string[]
  approvalGate: string
  nextAction: string
  requiresNewWorkflow: boolean
  tasks: AutomationGoalTaskSeed[]
}

export const AUTOMATION_GOAL_SEEDS: AutomationGoalSeed[] = [
  {
    id: 'inbound-lead-triage-to-booking',
    tier: 1,
    title: 'Automate inbound lead triage to booked-call follow-up',
    objective: 'Turn contact forms, chat/audit completions, and discovery bookings into qualified lead records, next-best action tasks, and review-ready reply drafts.',
    workflowFamily: 'inbound_sales',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'automation-systems',
    collaboratorAgentKeys: ['chief-of-staff', 'inbox-follow-up', 'warm-lead-capture'],
    sourceRoutes: ['/admin/lead-pipeline', '/admin/outreach', '/admin/email-center'],
    sourceDocs: ['docs/admin-sales-lead-pipeline-sop.md', 'docs/audit-inputs-and-client-data.md'],
    n8nWorkflows: ['WF-000', 'WF-000A', 'WF-000B', 'WF-GDR'],
    approvalGate: 'Lead intake and internal routing can run automatically; external replies, calendar changes, and source expansion require approval.',
    nextAction: 'Verify every inbound signal becomes either a qualified lead, a booked-call follow-up, or a Mission Control exception.',
    requiresNewWorkflow: false,
    tasks: [
      {
        title: 'Normalize inbound lead signals into one triage queue',
        objective: 'Map contact forms, audit completions, chat handoffs, and booked discovery calls into one deduped inbound lead queue with source context.',
        ownerAgentKey: 'automation-systems',
        priority: 'high',
        expectedFiles: ['app/admin/lead-pipeline', 'app/admin/outreach', 'app/api/contact', 'lib/client-dashboard.ts'],
        acceptanceCriteria: ['Inbound records preserve source and trace IDs.', 'Duplicate submissions are merged or suppressed.', 'Unmatched or low-confidence records become Mission Control exceptions.'],
        riskNotes: 'Do not copy production lead/contact records into non-production validation; use synthetic or explicitly test-owned rows.',
        requiresApproval: true,
        progressWeight: 2,
      },
      {
        title: 'Draft inbound reply and booking follow-up',
        objective: 'Generate a review-ready response or booking follow-up from the normalized inbound lead state.',
        ownerAgentKey: 'inbox-follow-up',
        priority: 'high',
        expectedFiles: ['app/admin/email-center', 'app/api/admin/outreach', 'lib/communications.ts'],
        acceptanceCriteria: ['Drafts explain the recommended next action.', 'The user can approve, edit, or reject before any external send.', 'Booked-call follow-ups link back to the originating lead or audit.'],
        riskNotes: 'No automatic external email or calendar mutation in this seed.',
        requiresApproval: true,
        progressWeight: 2,
      },
    ],
  },
  {
    id: 'meeting-intake-follow-up-drafts',
    tier: 1,
    title: 'Automate meeting intake to follow-up drafts',
    objective: 'Convert meeting signals into records, action tasks, reply drafts, follow-up scheduling recommendations, and Mission Control exceptions.',
    workflowFamily: 'meeting_follow_up',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'meeting-intake-follow-up',
    collaboratorAgentKeys: ['chief-of-staff', 'inbox-follow-up', 'automation-systems'],
    sourceRoutes: ['/admin/meetings', '/admin/meeting-tasks', '/admin/outreach'],
    sourceDocs: ['docs/meeting-follow-up-communications-guide.md', 'docs/admin-sales-lead-pipeline-sop.md'],
    n8nWorkflows: ['WF-SLK', 'WF-CAL', 'WF-MCH', 'WF-AGB', 'WF-FUP'],
    approvalGate: 'External emails and calendar invitations stay approval-gated.',
    nextAction: 'Confirm every meeting with action items can route into a draft follow-up or scheduling task.',
    requiresNewWorkflow: false,
    tasks: [
      {
        title: 'Map meeting signals into action-ready follow-up tasks',
        objective: 'Audit the meeting intake, meeting task, and outreach handoff path so every captured meeting creates traceable follow-up work.',
        ownerAgentKey: 'meeting-intake-follow-up',
        priority: 'high',
        expectedFiles: ['app/admin/meetings', 'app/admin/meeting-tasks', 'lib/meeting-action-tasks.ts'],
        acceptanceCriteria: ['Meeting records have clear attribution.', 'Action items route to meeting tasks without duplicate manual entry.', 'Missing lead or project attribution becomes a Mission Control exception.'],
        riskNotes: 'External sends must remain behind the existing outreach and calendar approval gates.',
        requiresApproval: true,
        progressWeight: 2,
      },
      {
        title: 'Draft follow-up replies from meeting tasks',
        objective: 'Route reply-ready meeting tasks into the outreach draft queue with owner, source meeting, and review status preserved.',
        ownerAgentKey: 'inbox-follow-up',
        priority: 'high',
        expectedFiles: ['app/api/admin/meeting-action-tasks', 'app/api/admin/outreach', 'lib/communications.ts'],
        acceptanceCriteria: ['Drafts preserve source meeting context.', 'The user can review, edit, approve, or reject before sending.', 'Sent drafts close the originating task when appropriate.'],
        riskNotes: 'No autonomous external email send in V1.',
        requiresApproval: true,
        progressWeight: 2,
      },
    ],
  },
  {
    id: 'warm-lead-review-ready-outreach',
    tier: 1,
    title: 'Automate warm lead capture to review-ready outreach',
    objective: 'Ingest warm relationship leads, dedupe, enrich, qualify, draft outreach, and route source/auth exceptions.',
    workflowFamily: 'warm_lead_capture',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'warm-lead-capture',
    collaboratorAgentKeys: ['research-source-register', 'inbox-follow-up', 'automation-systems'],
    sourceRoutes: ['/admin/outreach', '/admin/lead-dashboards'],
    sourceDocs: ['docs/warm-lead-workflow-integration.md', 'docs/admin-sales-lead-pipeline-sop.md'],
    n8nWorkflows: ['WF-WRM-001', 'WF-WRM-002', 'WF-WRM-003'],
    approvalGate: 'Known warm-source ingestion is allowed; outbound use and new source expansion require approval.',
    nextAction: 'Seed source-specific exception tasks for warm lead sources that cannot produce review-ready outreach.',
    requiresNewWorkflow: false,
    tasks: [
      {
        title: 'Normalize warm lead source ingestion',
        objective: 'Verify Facebook, Google Contacts, and LinkedIn warm lead workflows write consistent contact records with source traceability.',
        ownerAgentKey: 'warm-lead-capture',
        priority: 'high',
        expectedFiles: ['lib/n8n.ts', 'app/api/admin/outreach', 'n8n-exports'],
        acceptanceCriteria: ['Each source preserves source labels and trace IDs.', 'Duplicate leads are suppressed or merged.', 'Auth/source failures become Agent Ops exceptions.'],
        riskNotes: 'Live scrape drills and new source expansion need explicit approval.',
        requiresApproval: true,
        progressWeight: 2,
      },
      {
        title: 'Route warm leads into review-ready drafts',
        objective: 'Connect enriched warm leads to reviewable outreach drafts with owner, source, and next action visible.',
        ownerAgentKey: 'inbox-follow-up',
        priority: 'high',
        expectedFiles: ['app/admin/outreach', 'lib/outreach-queue-generator.ts'],
        acceptanceCriteria: ['High-fit warm leads get outreach drafts.', 'Drafts stay editable before send.', 'Low-confidence leads route to a triage queue.'],
        riskNotes: 'Outbound email remains user-approved.',
        requiresApproval: true,
        progressWeight: 2,
      },
    ],
  },
  {
    id: 'cold-lead-draft-sequence',
    tier: 1,
    title: 'Automate cold lead sourcing to draft sequence',
    objective: 'Find leads, qualify them, generate draft sequences, detect replies, and escalate reply-required items.',
    workflowFamily: 'cold_outreach',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'inbox-follow-up',
    collaboratorAgentKeys: ['research-source-register', 'chief-of-staff'],
    sourceRoutes: ['/admin/outreach', '/admin/email-center'],
    sourceDocs: ['docs/admin-sales-lead-pipeline-sop.md'],
    n8nWorkflows: ['WF-CLG-001', 'WF-CLG-003', 'WF-CLG-004', 'WF-GDR'],
    approvalGate: 'Send Now remains approval-gated unless a future sequence policy explicitly authorizes sends.',
    nextAction: 'Confirm the first cold sequence can be produced as a draft-only queue with reply escalation.',
    requiresNewWorkflow: false,
    tasks: [
      {
        title: 'Audit cold lead sourcing and qualification handoff',
        objective: 'Confirm sourced leads include enough qualification evidence to create safe draft outreach.',
        ownerAgentKey: 'research-source-register',
        priority: 'medium',
        expectedFiles: ['n8n-exports/WF-CLG-001-Cold-Lead-Sourcing.json', 'app/admin/outreach'],
        acceptanceCriteria: ['Lead source, fit reason, and evidence are visible.', 'Weak evidence routes to review instead of drafting.', 'No production customer data enters non-production validation.'],
        riskNotes: 'Lead enrichment providers and scrape sources may require separate bakeoff or approval.',
        requiresApproval: true,
        progressWeight: 1,
      },
      {
        title: 'Create cold outreach draft sequence queue',
        objective: 'Generate draft sequences and reply detection handoffs without automatic sending.',
        ownerAgentKey: 'inbox-follow-up',
        priority: 'high',
        expectedFiles: ['app/api/admin/outreach', 'lib/outreach-queue-generator.ts', 'lib/n8n.ts'],
        acceptanceCriteria: ['Draft sequence is reviewable before send.', 'Reply detection creates an Agent Ops item.', 'Rejected drafts do not trigger follow-up.'],
        riskNotes: 'Autonomous sending is out of scope for this seed.',
        requiresApproval: true,
        progressWeight: 2,
      },
    ],
  },
  {
    id: 'meeting-to-social-drafts',
    tier: 1,
    title: 'Automate meeting-to-social content drafts',
    objective: 'Extract source-backed ideas, generate LinkedIn drafts, create image/audio variants, and queue review-ready posts.',
    workflowFamily: 'social_content',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'voice-content-architect',
    collaboratorAgentKeys: ['content-repurposing', 'website-product-copy', 'private-knowledge-librarian'],
    sourceRoutes: ['/admin/social-content', '/admin/content/video-generation', '/admin/meetings'],
    sourceDocs: ['docs/admin-sales-lead-pipeline-sop.md'],
    n8nWorkflows: ['WF-SOC-001', 'WF-SOC-002', 'WF-SOC-003'],
    approvalGate: 'Public publishing requires review and approval.',
    nextAction: 'Make the meeting-to-LinkedIn draft lane explicit before adding YouTube publishing.',
    requiresNewWorkflow: false,
    tasks: [
      {
        title: 'Extract approved content ideas from meeting context',
        objective: 'Pull source-safe content prompts from meetings and source registers into the social content queue.',
        ownerAgentKey: 'voice-content-architect',
        priority: 'high',
        expectedFiles: ['app/admin/social-content', 'lib/meeting-action-tasks.ts'],
        acceptanceCriteria: ['Each draft has source context.', 'Private material is flagged before use.', 'Drafts keep Vambah voice guidance visible.'],
        riskNotes: 'Private meeting material must not become public copy without review.',
        requiresApproval: true,
        progressWeight: 2,
      },
      {
        title: 'Prepare repurposed media variants',
        objective: 'Generate image, audio, and short-form variants as reviewable assets attached to the social draft.',
        ownerAgentKey: 'content-repurposing',
        priority: 'medium',
        expectedFiles: ['app/api/admin/social-content', 'app/admin/content/video-generation'],
        acceptanceCriteria: ['Variants attach to the draft.', 'Failed media generation has a retry path.', 'Publishing remains separate from draft generation.'],
        riskNotes: 'Voice/avatar/video providers are fast-moving and may need a bakeoff before promotion.',
        requiresApproval: true,
        progressWeight: 1,
      },
    ],
  },
  {
    id: 'value-evidence-presentation-package',
    tier: 1,
    title: 'Automate value evidence to lead presentation package',
    objective: 'Gather evidence, classify pain points, create value calculations, draft Gamma reports, and attach packages to lead records.',
    workflowFamily: 'lead_value_package',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'research-source-register',
    collaboratorAgentKeys: ['proposal-business-model', 'voice-content-architect', 'automation-systems'],
    sourceRoutes: ['/admin/value-evidence', '/admin/reports/gamma', '/admin/lead-dashboards'],
    sourceDocs: ['docs/value-evidence-pipeline-setup.md', 'docs/admin-sales-lead-pipeline-sop.md'],
    n8nWorkflows: ['WF-VEP-001', 'WF-VEP-002'],
    approvalGate: 'Client-facing delivery and proposal terms require approval.',
    nextAction: 'Create a lead package path that moves evidence into a reviewable deck without manual copying.',
    requiresNewWorkflow: false,
    tasks: [
      {
        title: 'Run evidence extraction into lead package context',
        objective: 'Connect internal evidence and social listening outputs to lead-specific value package readiness.',
        ownerAgentKey: 'research-source-register',
        priority: 'high',
        expectedFiles: ['app/admin/value-evidence', 'app/api/admin/value-evidence', 'lib/n8n.ts'],
        acceptanceCriteria: ['Selected leads can trigger evidence extraction.', 'Evidence counts and failures are visible.', 'Source provenance is retained.'],
        riskNotes: 'Ingest secrets and source-provider credentials must not be exposed in traces.',
        requiresApproval: true,
        progressWeight: 2,
      },
      {
        title: 'Draft lead presentation package',
        objective: 'Use value evidence and meeting context to draft a Gamma report package linked to the lead.',
        ownerAgentKey: 'proposal-business-model',
        priority: 'high',
        expectedFiles: ['app/admin/reports/gamma', 'lib/gamma-report-builder.ts'],
        acceptanceCriteria: ['Deck has value calculation context.', 'Lead record links to generated package.', 'Client-facing send remains a separate approval.'],
        riskNotes: 'Pricing/proposal claims require human review before delivery.',
        requiresApproval: true,
        progressWeight: 2,
      },
    ],
  },
  {
    id: 'script-to-video-draft-queue',
    tier: 2,
    title: 'Automate script-to-video draft queue',
    objective: 'Turn approved scripts and meeting ideas into reviewable YouTube or short-form video drafts.',
    workflowFamily: 'video_content',
    automationLevel: 'draft_to_review',
    ownerAgentKey: 'content-repurposing',
    collaboratorAgentKeys: ['voice-content-architect', 'amadutown-brand', 'automation-systems'],
    sourceRoutes: ['/admin/content/video-generation', '/admin/content/videos'],
    sourceDocs: ['docs/about-page-video-storyboard.md'],
    n8nWorkflows: [],
    approvalGate: 'Public video publishing and brand approval remain gated.',
    nextAction: 'Draft the workflow proposal for script intake, media generation, and review queueing.',
    requiresNewWorkflow: true,
    tasks: [],
  },
  {
    id: 'client-reporting-roadmap-updates',
    tier: 2,
    title: 'Automate client reporting and roadmap updates',
    objective: 'Turn client project milestones, blockers, meeting tasks, and delivery evidence into reviewable progress reports and roadmap updates.',
    workflowFamily: 'client_reporting',
    automationLevel: 'approval_gated',
    ownerAgentKey: 'automation-systems',
    collaboratorAgentKeys: ['chief-of-staff', 'proposal-business-model', 'meeting-intake-follow-up'],
    sourceRoutes: ['/admin/client-projects', '/admin/meeting-tasks', '/admin/reports/gamma'],
    sourceDocs: ['docs/admin-sales-lead-pipeline-sop.md', 'docs/agent-operations-roadmap.md'],
    n8nWorkflows: ['WF-006', 'WF-007', 'WF-008', 'WF-009', 'WF-011', 'WF-012'],
    approvalGate: 'Client-visible reports, roadmap commitments, and upsell recommendations require approval before delivery.',
    nextAction: 'Draft the reporting packet format before allowing agents to create client-visible updates.',
    requiresNewWorkflow: false,
    tasks: [],
  },
  {
    id: 'subscription-revenue-monitoring',
    tier: 2,
    title: 'Automate subscription and revenue monitoring',
    objective: 'Monitor subscription cost, revenue signals, cancellation candidates, and payment anomalies, then route reviewable savings or revenue actions.',
    workflowFamily: 'revenue_operations',
    automationLevel: 'approval_gated',
    ownerAgentKey: 'risk-compliance-intelligence',
    collaboratorAgentKeys: ['chief-of-staff', 'automation-systems', 'proposal-business-model'],
    sourceRoutes: ['/admin/cost-revenue', '/admin/subscriptions', '/admin/agents/coordination'],
    sourceDocs: ['docs/subscription-cancellation-audit.md', 'docs/technology-bakeoff-surface-map.md'],
    n8nWorkflows: [],
    approvalGate: 'Cancellation, payment, pricing, vendor, and production configuration changes require explicit approval.',
    nextAction: 'Route recurring subscription and revenue anomalies into controller packets with cost, risk, and rollback context.',
    requiresNewWorkflow: true,
    tasks: [],
  },
  {
    id: 'client-onboarding-progress-updates',
    tier: 2,
    title: 'Automate client onboarding and progress updates',
    objective: 'Move client onboarding, milestone, blocker, and progress-update workflows into a single reviewable automation lane.',
    workflowFamily: 'client_delivery',
    automationLevel: 'approval_gated',
    ownerAgentKey: 'automation-systems',
    collaboratorAgentKeys: ['chief-of-staff', 'meeting-intake-follow-up'],
    sourceRoutes: ['/admin/client-projects', '/admin/meeting-tasks'],
    sourceDocs: ['docs/admin-sales-lead-pipeline-sop.md'],
    n8nWorkflows: ['WF-000', 'WF-001', 'WF-002', 'WF-004', 'WF-005', 'WF-006', 'WF-007', 'WF-008', 'WF-009', 'WF-010', 'WF-011', 'WF-012'],
    approvalGate: 'Client-visible sends and production project mutation remain gated.',
    nextAction: 'Audit the existing client lifecycle workflows before seeding execution tasks.',
    requiresNewWorkflow: false,
    tasks: [],
  },
  {
    id: 'rag-source-governance-exceptions',
    tier: 2,
    title: 'Automate RAG and source-governance exceptions',
    objective: 'Route RAG freshness, privacy, source approval, and retrieval health exceptions into Agent Ops.',
    workflowFamily: 'knowledge_governance',
    automationLevel: 'approval_gated',
    ownerAgentKey: 'private-knowledge-librarian',
    collaboratorAgentKeys: ['research-source-register', 'risk-compliance-intelligence'],
    sourceRoutes: ['/admin/agents/open-brain', '/api/admin/rag-health'],
    sourceDocs: ['docs/n8n-rag-chatbot-troubleshooting.md'],
    n8nWorkflows: ['WF-RAG-INGEST', 'WF-RAG-QUERY', 'WF-RAG-CHAT', 'WF-RAG-DIAGNOSTIC'],
    approvalGate: 'Private source promotion and public chatbot policy changes require approval.',
    nextAction: 'Create exception cards for RAG freshness and source policy gaps.',
    requiresNewWorkflow: false,
    tasks: [],
  },
  {
    id: 'risk-compliance-signal-triage',
    tier: 2,
    title: 'Automate risk and compliance signal triage',
    objective: 'Convert AI risk, privacy, security, and regulatory signals into proposed work items with reviewable remediation paths.',
    workflowFamily: 'risk_compliance',
    automationLevel: 'approval_gated',
    ownerAgentKey: 'risk-compliance-intelligence',
    collaboratorAgentKeys: ['chief-of-staff', 'engineering-copilot'],
    sourceRoutes: ['/admin/agents/coordination', '/admin/agents/open-brain'],
    sourceDocs: ['docs/ai-risk-compliance-agent.md'],
    n8nWorkflows: [],
    approvalGate: 'Policy, credential, production config, and remediation changes require approval.',
    nextAction: 'Wire Moremi warning review into an automation-goal backlog lane.',
    requiresNewWorkflow: true,
    tasks: [],
  },
]

export function listAutomationGoalSeeds(tier?: 1 | 2) {
  return tier ? AUTOMATION_GOAL_SEEDS.filter((goal) => goal.tier === tier) : AUTOMATION_GOAL_SEEDS
}

export function getAutomationGoalSeed(seedId: string) {
  return AUTOMATION_GOAL_SEEDS.find((goal) => goal.id === seedId) ?? null
}

export function validateAutomationGoalCatalog() {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const goal of AUTOMATION_GOAL_SEEDS) {
    if (ids.has(goal.id)) errors.push(`Duplicate goal seed id: ${goal.id}`)
    ids.add(goal.id)
    if (!getAgentByKey(goal.ownerAgentKey)) errors.push(`${goal.id} has invalid owner agent ${goal.ownerAgentKey}`)
    for (const collaborator of goal.collaboratorAgentKeys) {
      if (!getAgentByKey(collaborator)) errors.push(`${goal.id} has invalid collaborator agent ${collaborator}`)
    }
    if (goal.tier === 1 && goal.tasks.length === 0) errors.push(`${goal.id} is Tier 1 but has no task seeds`)
    for (const task of goal.tasks) {
      if (!getAgentByKey(task.ownerAgentKey)) errors.push(`${goal.id} task "${task.title}" has invalid owner agent ${task.ownerAgentKey}`)
      if (task.progressWeight <= 0) errors.push(`${goal.id} task "${task.title}" must have positive progress weight`)
    }
  }

  return errors
}
