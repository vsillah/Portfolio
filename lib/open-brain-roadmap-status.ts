export type OpenBrainRoadmapPhaseStatus = 'complete' | 'in_progress' | 'approval_gated' | 'deferred'

export interface OpenBrainRoadmapPhase {
  id: string
  title: string
  status: OpenBrainRoadmapPhaseStatus
  completed: string[]
  remaining: string[]
  gates: string[]
  evidence: string[]
  nextAction: string
}

export interface OpenBrainRoadmapStatus {
  generatedAt: string
  summary: string
  currentFocus: string
  phases: OpenBrainRoadmapPhase[]
}

export function buildOpenBrainRoadmapStatus(generatedAt = new Date().toISOString()): OpenBrainRoadmapStatus {
  const phases: OpenBrainRoadmapPhase[] = [
    {
      id: 'phase-1',
      title: 'Lock Open Brain As Canonical Memory',
      status: 'complete',
      completed: [
        'Open Brain is documented as the local-first source of truth for durable memory.',
        'Portfolio is documented as a dashboard, approval, and projection surface only.',
        'Privacy tiers and forbidden projection paths are documented.',
      ],
      remaining: [],
      gates: [
        'Durable memories still require proposal approval before promotion.',
      ],
      evidence: [
        'docs/open-brain-local-service.md',
        'docs/memory-context-organization-workflow.md',
      ],
      nextAction: 'Keep new producers aligned with the source -> event -> proposal -> memory contract.',
    },
    {
      id: 'phase-2',
      title: 'Register Local Open Brain Runtime',
      status: 'approval_gated',
      completed: [
        'Runtime registration dry-run packet exists.',
        'Codex, Hermes, OpenCode/OpenClaw-style agents, Claude Desktop, and Cursor config snippets are generated without mutating configs.',
      ],
      remaining: [
        'Register each runtime one at a time after local-state approval.',
        'Run each runtime doctor/list/manual MCP verification after registration.',
      ],
      gates: [
        'Do not edit agent runtime configs without explicit local-state approval.',
        'Do not copy secrets across agent configs.',
      ],
      evidence: [
        'lib/open-brain-runtime-registration.ts',
        'scripts/open-brain-runtime-registration.ts',
        'docs/open-brain-local-service.md',
      ],
      nextAction: 'Prepare a runtime-specific approval packet for the next chosen runtime.',
    },
    {
      id: 'phase-3',
      title: 'Route Producers Into Open Brain',
      status: 'complete',
      completed: [
        'Personality corpus, Codex automation inventory, Agent Ops work items/handoffs, RAG shadow plans, AutoResearch proposals, and Model Ops projections have producer routes.',
        'Producer routes record sanitized source/event traces before durable memory proposals.',
      ],
      remaining: [
        'Keep adding producers only through sanitized source/event/proposal flows.',
      ],
      gates: [
        'No raw private exports, work item bodies, handoff bodies, secrets, or hosted mutations in producer traces.',
      ],
      evidence: [
        'scripts/open-brain-personality-corpus-producer.ts',
        'scripts/open-brain-automation-producer.ts',
        'scripts/open-brain-agent-ops-producer.ts',
        'scripts/open-brain-autoresearch-producer.ts',
        'app/api/admin/rag-ingest/route.ts',
        'lib/model-ops-open-brain.ts',
      ],
      nextAction: 'Use producer traces as audit records and keep durable memories approval-gated.',
    },
    {
      id: 'phase-4',
      title: 'Karpathy Wiki Overlay',
      status: 'complete',
      completed: [
        'Wiki overlay compilation is preview-only.',
        'Wiki pages expose source memory IDs, source IDs, source event IDs, privacy tier, and approval state.',
        'Private records are excluded from wiki overlays.',
      ],
      remaining: [
        'Commit generated wiki pages only through a separate approved repo change.',
      ],
      gates: [
        'Do not treat wiki output as canonical memory.',
      ],
      evidence: [
        'lib/open-brain.ts',
        'app/admin/agents/open-brain/page.tsx',
        'app/api/admin/agents/open-brain/wiki/compile/route.ts',
      ],
      nextAction: 'Use wiki preview for review and traceability, not as a write path.',
    },
    {
      id: 'phase-5',
      title: 'RAG And Pinecone Projection',
      status: 'in_progress',
      completed: [
        'Public-safe Open Brain RAG projection documents carry memory/source IDs, privacy tier, source hash, projection version, deletion key, and rollback key.',
        'Chatbot knowledge has opt-in JSON mode for public-safe Open Brain projection metadata.',
        'RAG ingest endpoint records shadow-plan traces and blocks Pinecone writes pending approval.',
      ],
      remaining: [
        'Run retrieval-quality tests before production promotion.',
        'Stage Pinecone ingestion only after explicit cutover approval.',
        'Verify deletion and rollback keys in any external vector store staging packet.',
      ],
      gates: [
        'No raw private exports or unapproved inference can enter chatbot knowledge or Pinecone.',
        'Pinecone remains downstream and rebuildable from approved Open Brain records.',
      ],
      evidence: [
        'lib/chatbot-knowledge.ts',
        'app/api/knowledge/route.ts',
        'app/api/admin/rag-ingest/route.ts',
        'docs/open-brain-local-service.md',
      ],
      nextAction: 'Build a retrieval QA packet for the Open Brain public-safe projection before any Pinecone cutover.',
    },
    {
      id: 'phase-6',
      title: 'AutoResearch Loop Integration',
      status: 'complete',
      completed: [
        'AutoResearch proposals include experiment config, metric gate, not-run result summary, rollback path, promotion recommendation, and forbidden actions.',
        'Open Brain event metadata and pending proposals carry the experiment trace.',
        'Experiments, merges, deploys, hosted config mutation, and durable memory writes remain blocked without separate approval.',
      ],
      remaining: [
        'After approved experiments run, record metrics and rollback notes as source/event records before proposing durable memories.',
      ],
      gates: [
        'AutoResearch cannot execute experiments automatically.',
      ],
      evidence: [
        'lib/vercel-deployment-research.ts',
        'lib/open-brain.ts',
        'docs/model-ops-autoresearch.md',
      ],
      nextAction: 'Use approval cards to decide the next scoped experiment, then record outcomes as source/event records.',
    },
  ]

  return {
    generatedAt,
    summary: 'Open Brain is established as the default local-first memory structure. Runtime registration and Pinecone cutover remain the main approval-gated gaps.',
    currentFocus: 'Retrieval QA for Phase 5 and runtime-specific approval packets for Phase 2.',
    phases,
  }
}

export function formatOpenBrainRoadmapStatusMarkdown(status: OpenBrainRoadmapStatus) {
  return [
    '# Open Brain Roadmap Status',
    '',
    `Generated: ${status.generatedAt}`,
    '',
    status.summary,
    '',
    `Current focus: ${status.currentFocus}`,
    '',
    ...status.phases.flatMap((phase) => [
      `## ${phase.id}: ${phase.title}`,
      '',
      `Status: \`${phase.status}\``,
      '',
      'Completed:',
      ...formatList(phase.completed),
      '',
      'Remaining:',
      ...formatList(phase.remaining),
      '',
      'Gates:',
      ...formatList(phase.gates),
      '',
      'Evidence:',
      ...formatList(phase.evidence),
      '',
      `Next action: ${phase.nextAction}`,
      '',
    ]),
  ].join('\n')
}

function formatList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`) : ['- None.']
}
