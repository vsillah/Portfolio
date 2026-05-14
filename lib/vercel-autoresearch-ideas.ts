import type { AgentWorkItemPriority } from '@/lib/agent-work-items'

export type VercelAutoResearchIdea = {
  id: string
  title: string
  objective: string
  priority: AgentWorkItemPriority
  expectedFiles: string[]
  overlapGroup: string
  recommendation: string
  risk: string
  definitionOfReady: string[]
}

export const VERCEL_AUTORESEARCH_IDEA_SOURCE_TYPE = 'vercel_autoresearch_idea'
export const VERCEL_AUTORESEARCH_IDEA_SOURCE_LABEL = 'Vercel AutoResearch idea inbox'

export const VERCEL_AUTORESEARCH_DEFINITION_OF_READY = [
  'Clear hypothesis tied to a deployment metric baseline.',
  'One bounded experiment scope with expected files or settings named.',
  'Rollback path is explicit and low-friction.',
  'No production Vercel config mutation is included unless a separate approval packet exists.',
  'Owner lane can pick it up without needing hidden context.',
]

export const VERCEL_AUTORESEARCH_IDEAS: VercelAutoResearchIdea[] = [
  {
    id: 'build-profile-attribution',
    title: 'Build-profile attribution',
    objective: 'Measure whether deploy time is dominated by Next build, generated knowledge, static pages, dependency install, or asset work before changing hosted deployment settings.',
    priority: 'high',
    expectedFiles: ['package.json', 'scripts/build-chatbot-knowledge.ts', 'next.config.js'],
    overlapGroup: 'vercel-autoresearch-build-profile',
    recommendation: 'Start here because it produces the baseline every later build-performance idea needs.',
    risk: 'low',
    definitionOfReady: [
      ...VERCEL_AUTORESEARCH_DEFINITION_OF_READY,
      'Baseline includes at least one recent portfolio and portfolio-staging deployment timing sample.',
    ],
  },
  {
    id: 'staging-queue-pressure-diagnosis',
    title: 'Staging queue-pressure diagnosis',
    objective: 'Compare portfolio-staging queue patterns against production and preview so agents can separate Vercel queue delay from application build cost.',
    priority: 'high',
    expectedFiles: ['docs/vercel-deployment-runbook.md', 'scripts/vercel-deployment-metrics.ts'],
    overlapGroup: 'vercel-autoresearch-queue-pressure',
    recommendation: 'Prioritize when staging queue findings repeat or block captain sweeps.',
    risk: 'medium',
    definitionOfReady: [
      ...VERCEL_AUTORESEARCH_DEFINITION_OF_READY,
      'Queue findings repeat across at least two recent deployment checks or cross the blocked threshold once.',
    ],
  },
  {
    id: 'knowledge-generation-cost-control',
    title: 'Knowledge generation cost control',
    objective: 'Measure whether build-time knowledge generation adds enough deployment latency to justify caching, artifact reuse, or narrower rebuild triggers.',
    priority: 'medium',
    expectedFiles: ['scripts/build-chatbot-knowledge.ts', 'lib/chatbot-knowledge-content.generated.ts', 'package.json'],
    overlapGroup: 'vercel-autoresearch-knowledge-build',
    recommendation: 'Useful after build-profile attribution confirms generated knowledge is material.',
    risk: 'low',
    definitionOfReady: [
      ...VERCEL_AUTORESEARCH_DEFINITION_OF_READY,
      'Build-profile evidence shows generated knowledge work is a meaningful share of total build time.',
    ],
  },
  {
    id: 'admin-route-static-generation-audit',
    title: 'Admin route static-generation audit',
    objective: 'Identify admin pages that are statically generated unnecessarily and decide whether they should become dynamic to reduce build work.',
    priority: 'medium',
    expectedFiles: ['app/admin/**/page.tsx', 'next.config.js'],
    overlapGroup: 'vercel-autoresearch-admin-build',
    recommendation: 'Run after the build profile points at page-data collection or static generation overhead.',
    risk: 'medium',
    definitionOfReady: [
      ...VERCEL_AUTORESEARCH_DEFINITION_OF_READY,
      'Candidate admin routes are listed with build evidence and user-facing behavior risk.',
    ],
  },
  {
    id: 'bundle-first-load-regression-tracking',
    title: 'Bundle and first-load regression tracking',
    objective: 'Track whether admin and agent surfaces are growing shared JavaScript and propose scoped bundle reductions when regressions appear.',
    priority: 'medium',
    expectedFiles: ['app/admin/agents/**', 'components/**', 'package.json'],
    overlapGroup: 'vercel-autoresearch-bundle-regression',
    recommendation: 'Use this to keep Agent Ops growth from becoming hidden deployment and runtime debt.',
    risk: 'low',
    definitionOfReady: [
      ...VERCEL_AUTORESEARCH_DEFINITION_OF_READY,
      'A before/after route-size or first-load JS comparison is available from a recent build.',
    ],
  },
  {
    id: 'deployment-context-parity-check',
    title: 'Deployment context parity check',
    objective: 'Compare portfolio and portfolio-staging environment/build behavior so staging remains a trustworthy proxy instead of a slower or misleading path.',
    priority: 'high',
    expectedFiles: ['docs/deploy-context.md', 'docs/vercel-deployment-runbook.md'],
    overlapGroup: 'vercel-autoresearch-context-parity',
    recommendation: 'Prioritize when staging behaves materially slower than production after code-equivalent deploys.',
    risk: 'medium',
    definitionOfReady: [
      ...VERCEL_AUTORESEARCH_DEFINITION_OF_READY,
      'The packet distinguishes environment/config parity questions from app-code performance questions.',
    ],
  },
  {
    id: 'safe-instrumentation-bakeoff',
    title: 'Safe instrumentation bakeoff',
    objective: 'Evaluate low-noise ways to capture build phase timings without changing production Vercel project settings.',
    priority: 'medium',
    expectedFiles: ['scripts/**', 'docs/technology-bakeoff-surface-map.md', 'docs/vercel-deployment-runbook.md'],
    overlapGroup: 'vercel-autoresearch-instrumentation-bakeoff',
    recommendation: 'Use a scored bakeoff before adopting any build instrumentation pattern as a default.',
    risk: 'low',
    definitionOfReady: [
      ...VERCEL_AUTORESEARCH_DEFINITION_OF_READY,
      'Candidate instrumentation options have comparison criteria, expected overhead, and rollback notes.',
    ],
  },
  {
    id: 'vercel-settings-proposal-packet',
    title: 'Vercel settings proposal packet',
    objective: 'Prepare a review packet for Vercel preview policy, build concurrency, or related hosted settings only after repeated queue findings justify a settings-level discussion.',
    priority: 'low',
    expectedFiles: ['docs/vercel-deployment-runbook.md'],
    overlapGroup: 'vercel-autoresearch-settings-packet',
    recommendation: 'Keep low until queue findings repeat; this remains a separate approval gate because it touches production-adjacent settings.',
    risk: 'high',
    definitionOfReady: [
      ...VERCEL_AUTORESEARCH_DEFINITION_OF_READY,
      'Repeated queue evidence exists and the packet explicitly says it does not authorize hosted setting changes.',
    ],
  },
]
