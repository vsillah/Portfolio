import type { ClientAiOpsReadinessContract } from './client-ai-ops-readiness-contract'
import { buildSyntheticClientAiOpsPilot, type SyntheticClientAiOpsPilot } from './client-ai-ops-synthetic-pilot'

export type ClientAiOpsPilotQaStatus = 'passed' | 'needs_manual_smoke' | 'waiting_approval' | 'blocked'

export type ClientAiOpsPilotQaCheck = {
  key: string
  label: string
  status: ClientAiOpsPilotQaStatus
  evidence: string
  nextAction: string
  clientSafe: boolean
  sideEffectFree: boolean
}

export type ClientAiOpsPilotQaPlan = {
  generatedAt: string
  fixture: 'synthetic_client_ai_ops_pilot'
  projectId: string
  summary: {
    total: number
    passed: number
    manualSmoke: number
    waitingApproval: number
    blocked: number
  }
  checks: ClientAiOpsPilotQaCheck[]
  manualSmokeTargets: Array<{
    surface: string
    path: string
    expectedEvidence: string[]
  }>
  forbiddenActions: string[]
}

export type ClientAiOpsPilotQaPlanFormatOptions = {
  includeDetails?: boolean
}

export type ClientAiOpsSmokeEvidenceStatus = 'pending_capture' | 'ready_for_review' | 'needs_redaction' | 'blocked'

export type ClientAiOpsSmokeEvidenceCaptureInput = {
  targetSurface: string
  capturedBy?: string
  capturedAt?: string
  screenshotPath?: string
  observedEvidence?: string[]
  notes?: string
  usedSyntheticData?: boolean
  containsSecrets?: boolean
  attemptedForbiddenActions?: string[]
}

export type ClientAiOpsSmokeEvidenceItem = {
  surface: string
  path: string
  status: ClientAiOpsSmokeEvidenceStatus
  expectedEvidence: string[]
  observedEvidence: string[]
  missingEvidence: string[]
  screenshotPath: string | null
  capturedBy: string | null
  capturedAt: string | null
  notes: string | null
  clientSafe: boolean
  sideEffectFree: boolean
  nextAction: string
}

export type ClientAiOpsSmokeEvidencePacket = {
  generatedAt: string
  fixture: 'synthetic_client_ai_ops_pilot'
  projectId: string
  sourcePlanGeneratedAt: string
  summary: {
    totalTargets: number
    pendingCapture: number
    readyForReview: number
    needsRedaction: number
    blocked: number
  }
  items: ClientAiOpsSmokeEvidenceItem[]
  reviewerChecklist: string[]
  forbiddenActions: string[]
}

const GENERATED_AT = '2026-06-02T12:00:00.000Z'
const SYNTHETIC_PROJECT_ID = 'synthetic-client-ai-ops-project'

export function buildClientAiOpsRealPilotQaPlan(pilot: SyntheticClientAiOpsPilot = buildSyntheticClientAiOpsPilot()): ClientAiOpsPilotQaPlan {
  const readiness = pilot.readinessContract
  const checks: ClientAiOpsPilotQaCheck[] = [
    auditToReadinessCheck(pilot),
    adminReadinessContractCheck(readiness),
    clientDashboardReadinessCheck(pilot),
    monitorReadinessCheck(readiness),
    meetingTaskProjectionCheck(pilot),
    approvalBoundaryCheck(readiness),
    authenticatedUiSmokeCheck(),
  ]
  const summary = {
    total: checks.length,
    passed: checks.filter((check) => check.status === 'passed').length,
    manualSmoke: checks.filter((check) => check.status === 'needs_manual_smoke').length,
    waitingApproval: checks.filter((check) => check.status === 'waiting_approval').length,
    blocked: checks.filter((check) => check.status === 'blocked').length,
  }

  return {
    generatedAt: GENERATED_AT,
    fixture: 'synthetic_client_ai_ops_pilot',
    projectId: SYNTHETIC_PROJECT_ID,
    summary,
    checks,
    manualSmokeTargets: [
      {
        surface: 'Admin project detail',
        path: '/admin/client-projects/[synthetic-or-test-project-id]',
        expectedEvidence: [
          'AI Ops Roadmap section is visible.',
          'Readiness Contract panel shows side effects disabled.',
          'Connector readiness and projection status agree with the roadmap source.',
        ],
      },
      {
        surface: 'Client dashboard',
        path: '/client/dashboard/[synthetic-or-test-token]',
        expectedEvidence: [
          'Setup Readiness panel is visible.',
          'Live setup locked until approved is visible.',
          'No internal swarm columns, agent traces, credentials, or provider internals are visible.',
        ],
      },
      {
        surface: 'Monitor report and meeting task projection',
        path: '/api/cron/client-ai-ops-monitor plus admin Meeting Tasks',
        expectedEvidence: [
          'Monitor summary records readiness_status and side-effect lock state.',
          'Readiness blockers create an internal follow-up only.',
          'Follow-up appears as an AmaduTown-owned Meeting Task.',
        ],
      },
    ],
    forbiddenActions: [
      'OAuth connection',
      'credential sync',
      'provider write',
      'workflow activation',
      'outbound send',
      'publishing',
      'production deploy mutation',
      'client-data mutation',
    ],
  }
}

function auditToReadinessCheck(pilot: SyntheticClientAiOpsPilot): ClientAiOpsPilotQaCheck {
  const connectorKeys = pilot.clientView.connectorReadiness.items.map((item) => item.key)
  const requiredKeys = ['webflow', 'hubspot', 'google_workspace', 'slack', 'pinecone']
  const missing = requiredKeys.filter((key) => !connectorKeys.includes(key))
  return {
    key: 'audit_to_connector_readiness',
    label: 'Audit and stack signals map into connector readiness',
    status: missing.length === 0 ? 'passed' : 'blocked',
    evidence: missing.length === 0
      ? `Detected connector keys include ${requiredKeys.join(', ')}.`
      : `Missing connector keys: ${missing.join(', ')}.`,
    nextAction: missing.length === 0 ? 'Use synthetic connector readiness as the test-owned baseline.' : 'Repair connector catalog/source mapping before pilot QA.',
    clientSafe: true,
    sideEffectFree: true,
  }
}

function adminReadinessContractCheck(readiness: ClientAiOpsReadinessContract): ClientAiOpsPilotQaCheck {
  return {
    key: 'admin_readiness_contract',
    label: 'Admin readiness contract is stable and non-mutating',
    status: readiness.sideEffectsEnabled === false ? 'passed' : 'blocked',
    evidence: `status=${readiness.status}; sideEffectsEnabled=${String(readiness.sideEffectsEnabled)}; nextAction=${readiness.nextAction}`,
    nextAction: 'Render the readiness contract in admin project detail with authenticated test-owned data.',
    clientSafe: false,
    sideEffectFree: readiness.sideEffectsEnabled === false,
  }
}

function clientDashboardReadinessCheck(pilot: SyntheticClientAiOpsPilot): ClientAiOpsPilotQaCheck {
  const projection = pilot.clientView.projectionStatus
  const connectors = pilot.clientView.connectorReadiness
  return {
    key: 'client_dashboard_setup_readiness',
    label: 'Client dashboard setup readiness can be derived from client-safe data',
    status: connectors.requiredConnectorCount > 0 && projection.isolationRequiredCount >= 0 ? 'passed' : 'blocked',
    evidence: `${connectors.readyConnectorCount}/${connectors.requiredConnectorCount} connectors ready; ${projection.approvalNeededCount} roadmap approvals; ${projection.isolationRequiredCount} isolation checks.`,
    nextAction: 'Run authenticated client dashboard smoke with a synthetic or explicitly test-owned dashboard token.',
    clientSafe: true,
    sideEffectFree: true,
  }
}

function monitorReadinessCheck(readiness: ClientAiOpsReadinessContract): ClientAiOpsPilotQaCheck {
  return {
    key: 'monitor_readiness_summary',
    label: 'Monitor can record readiness without live setup',
    status: readiness.sideEffectsEnabled === false ? 'passed' : 'blocked',
    evidence: `Monitor-ready values: readiness_status=${readiness.status}; connector_required=${readiness.connector.required}; connector_ready=${readiness.connector.ready}.`,
    nextAction: 'Run monitor against synthetic/test-owned data and confirm the internal follow-up path only.',
    clientSafe: false,
    sideEffectFree: true,
  }
}

function meetingTaskProjectionCheck(pilot: SyntheticClientAiOpsPilot): ClientAiOpsPilotQaCheck {
  const visibleMeetingTasks = pilot.draft.tasks.filter((task) => task.meetingTaskVisible)
  return {
    key: 'meeting_task_projection',
    label: 'Roadmap work can project into Meeting Tasks',
    status: visibleMeetingTasks.length > 0 ? 'passed' : 'blocked',
    evidence: `${visibleMeetingTasks.length} roadmap tasks are marked meetingTaskVisible.`,
    nextAction: 'Confirm monitor follow-up appears as AmaduTown-owned Meeting Task in authenticated admin smoke.',
    clientSafe: false,
    sideEffectFree: true,
  }
}

function approvalBoundaryCheck(readiness: ClientAiOpsReadinessContract): ClientAiOpsPilotQaCheck {
  const boundaries = Object.values(readiness.approvalBoundaries)
  const allWaiting = boundaries.every((value) => value === 'waiting_approval')
  return {
    key: 'approval_boundaries',
    label: 'Risky setup actions stay behind approvals',
    status: allWaiting ? 'waiting_approval' : 'blocked',
    evidence: `Approval boundaries: ${Object.entries(readiness.approvalBoundaries).map(([key, value]) => `${key}=${value}`).join(', ')}.`,
    nextAction: allWaiting ? 'Keep live setup disabled until the operator approves a specific setup packet.' : 'Repair readiness approval boundaries before pilot QA.',
    clientSafe: true,
    sideEffectFree: true,
  }
}

function authenticatedUiSmokeCheck(): ClientAiOpsPilotQaCheck {
  return {
    key: 'authenticated_ui_smoke',
    label: 'Authenticated admin and client surfaces are manually smoke-tested',
    status: 'needs_manual_smoke',
    evidence: 'Requires an authenticated admin session and a synthetic or explicitly test-owned dashboard token.',
    nextAction: 'Open the admin project page and client dashboard for a synthetic/test-owned project, then capture screenshots or notes for the captain handoff.',
    clientSafe: true,
    sideEffectFree: true,
  }
}

export function formatClientAiOpsRealPilotQaPlan(
  plan: ClientAiOpsPilotQaPlan = buildClientAiOpsRealPilotQaPlan(),
  options: ClientAiOpsPilotQaPlanFormatOptions = {},
): string {
  const includeDetails = options.includeDetails ?? true
  const lines = [
    'Client AI Ops Real-Pilot QA Plan',
    `Generated: ${plan.generatedAt}`,
    `Fixture: ${plan.fixture}`,
    `Project: ${plan.projectId}`,
    `Summary: ${plan.summary.passed} passed; ${plan.summary.waitingApproval} waiting approval; ${plan.summary.manualSmoke} manual smoke; ${plan.summary.blocked} blocked.`,
  ]

  if (includeDetails) {
    lines.push('', 'Checks:')
    for (const check of plan.checks) {
      lines.push(`- [${check.status}] ${check.label}`)
      lines.push(`  Evidence: ${check.evidence}`)
      lines.push(`  Next: ${check.nextAction}`)
      lines.push(`  Client safe: ${String(check.clientSafe)}; side-effect free: ${String(check.sideEffectFree)}`)
    }

    lines.push('', 'Manual Smoke Targets:')
    for (const target of plan.manualSmokeTargets) {
      lines.push(`- ${target.surface}: ${target.path}`)
      for (const evidence of target.expectedEvidence) {
        lines.push(`  - ${evidence}`)
      }
    }

    lines.push('', 'Forbidden Live Actions:')
    for (const action of plan.forbiddenActions) {
      lines.push(`- ${action}`)
    }
  }

  return lines.join('\n')
}

export function buildClientAiOpsSmokeEvidencePacket(
  plan: ClientAiOpsPilotQaPlan = buildClientAiOpsRealPilotQaPlan(),
  captures: ClientAiOpsSmokeEvidenceCaptureInput[] = [],
): ClientAiOpsSmokeEvidencePacket {
  const items = plan.manualSmokeTargets.map((target) => {
    const capture = captures.find((item) => item.targetSurface === target.surface)
    return buildSmokeEvidenceItem(target, plan.forbiddenActions, capture)
  })
  const summary = {
    totalTargets: items.length,
    pendingCapture: items.filter((item) => item.status === 'pending_capture').length,
    readyForReview: items.filter((item) => item.status === 'ready_for_review').length,
    needsRedaction: items.filter((item) => item.status === 'needs_redaction').length,
    blocked: items.filter((item) => item.status === 'blocked').length,
  }

  return {
    generatedAt: GENERATED_AT,
    fixture: plan.fixture,
    projectId: plan.projectId,
    sourcePlanGeneratedAt: plan.generatedAt,
    summary,
    items,
    reviewerChecklist: [
      'Confirm every capture uses synthetic or explicitly test-owned client data.',
      'Confirm screenshots and notes contain no secrets, tokens, credentials, personal account data, or raw client records.',
      'Confirm no OAuth, credential sync, provider write, workflow activation, outbound send, publishing, deploy mutation, or client-data mutation was attempted.',
      'Confirm observed evidence matches the expected evidence for each smoke target before marking the pilot ready for captain review.',
    ],
    forbiddenActions: plan.forbiddenActions,
  }
}

export function formatClientAiOpsSmokeEvidencePacket(packet: ClientAiOpsSmokeEvidencePacket): string {
  const lines = [
    'Client AI Ops Smoke Evidence Packet',
    `Generated: ${packet.generatedAt}`,
    `Fixture: ${packet.fixture}`,
    `Project: ${packet.projectId}`,
    `Summary: ${packet.summary.readyForReview} ready; ${packet.summary.pendingCapture} pending; ${packet.summary.needsRedaction} needs redaction; ${packet.summary.blocked} blocked.`,
    '',
    'Smoke Targets:',
  ]

  for (const item of packet.items) {
    lines.push(`- [${item.status}] ${item.surface}: ${item.path}`)
    lines.push(`  Screenshot: ${item.screenshotPath ?? '[capture screenshot path]'}`)
    lines.push(`  Captured by: ${item.capturedBy ?? '[operator name]'}`)
    lines.push(`  Captured at: ${item.capturedAt ?? '[ISO timestamp]'}`)
    lines.push(`  Next: ${item.nextAction}`)
    if (item.missingEvidence.length > 0) {
      lines.push(`  Missing evidence: ${item.missingEvidence.join('; ')}`)
    }
  }

  lines.push('', 'Reviewer Checklist:')
  for (const item of packet.reviewerChecklist) {
    lines.push(`- ${item}`)
  }

  lines.push('', 'Forbidden Live Actions:')
  for (const action of packet.forbiddenActions) {
    lines.push(`- ${action}`)
  }

  return lines.join('\n')
}

function buildSmokeEvidenceItem(
  target: ClientAiOpsPilotQaPlan['manualSmokeTargets'][number],
  forbiddenActions: string[],
  capture?: ClientAiOpsSmokeEvidenceCaptureInput,
): ClientAiOpsSmokeEvidenceItem {
  const observedEvidence = capture?.observedEvidence ?? []
  const missingEvidence = target.expectedEvidence.filter((expected) => !observedEvidence.includes(expected))
  const attemptedForbiddenActions = capture?.attemptedForbiddenActions ?? []
  const matchedForbiddenActions = attemptedForbiddenActions.filter((action) => forbiddenActions.includes(action))
  const usedSyntheticData = capture?.usedSyntheticData === true
  const containsSecrets = capture?.containsSecrets === true
  const status = smokeEvidenceStatus({
    hasCapture: Boolean(capture),
    usedSyntheticData,
    containsSecrets,
    matchedForbiddenActions,
    missingEvidence,
  })

  return {
    surface: target.surface,
    path: target.path,
    status,
    expectedEvidence: target.expectedEvidence,
    observedEvidence,
    missingEvidence,
    screenshotPath: capture?.screenshotPath ?? null,
    capturedBy: capture?.capturedBy ?? null,
    capturedAt: capture?.capturedAt ?? null,
    notes: capture?.notes ?? null,
    clientSafe: usedSyntheticData && !containsSecrets,
    sideEffectFree: matchedForbiddenActions.length === 0,
    nextAction: smokeEvidenceNextAction(status),
  }
}

function smokeEvidenceStatus(input: {
  hasCapture: boolean
  usedSyntheticData: boolean
  containsSecrets: boolean
  matchedForbiddenActions: string[]
  missingEvidence: string[]
}): ClientAiOpsSmokeEvidenceStatus {
  if (!input.hasCapture) return 'pending_capture'
  if (!input.usedSyntheticData || input.matchedForbiddenActions.length > 0) return 'blocked'
  if (input.containsSecrets) return 'needs_redaction'
  if (input.missingEvidence.length > 0) return 'pending_capture'
  return 'ready_for_review'
}

function smokeEvidenceNextAction(status: ClientAiOpsSmokeEvidenceStatus): string {
  if (status === 'ready_for_review') return 'Attach the capture to the captain handoff for review.'
  if (status === 'needs_redaction') return 'Redact secrets or private data before captain review.'
  if (status === 'blocked') return 'Stop the pilot path and open an approval or safety review.'
  return 'Capture this target with synthetic or explicitly test-owned data only.'
}
