import type { AgentRuntime } from '@/lib/agent-run'

export type AgentAction =
  | 'read_files'
  | 'write_files'
  | 'external_api_call'
  | 'client_data_access'
  | 'known_workflow_db_write'
  | 'unknown_db_write'
  | 'publish_public_content'
  | 'send_email'
  | 'production_config_change'
  | 'public_content_from_private_material'

export type RuntimePolicy = {
  runtime: AgentRuntime
  label: string
  canReadFiles: boolean
  canWriteFiles: boolean
  canCallExternalApis: boolean
  canTouchClientData: boolean
  canWriteProductionData: 'none' | 'known_workflows' | 'approval_only'
  requiresApprovalFor: AgentAction[]
  notes: string
}

export type ApprovalGate = {
  action: AgentAction
  label: string
  approvalType: string
  description: string
}

export const APPROVAL_GATES: ApprovalGate[] = [
  {
    action: 'publish_public_content',
    label: 'Publishing',
    approvalType: 'publishing',
    description: 'Publishing public content or posting to an external audience.',
  },
  {
    action: 'send_email',
    label: 'Sending email',
    approvalType: 'send_email',
    description: 'Sending email or starting outbound email automation.',
  },
  {
    action: 'unknown_db_write',
    label: 'Unknown database write',
    approvalType: 'unknown_db_write',
    description: 'Database writes outside known, instrumented workflows.',
  },
  {
    action: 'production_config_change',
    label: 'Production config change',
    approvalType: 'production_config_change',
    description: 'Changing production environment, runtime, webhook, or policy configuration.',
  },
  {
    action: 'public_content_from_private_material',
    label: 'Private source to public content',
    approvalType: 'private_material_public_content',
    description: 'Public content derived from private notes, chats, transcripts, or client material.',
  },
]

export const RUNTIME_POLICIES: RuntimePolicy[] = [
  {
    runtime: 'codex',
    label: 'Codex Engineering Operator',
    canReadFiles: true,
    canWriteFiles: true,
    canCallExternalApis: true,
    canTouchClientData: false,
    canWriteProductionData: 'approval_only',
    requiresApprovalFor: [
      'unknown_db_write',
      'production_config_change',
      'publish_public_content',
      'send_email',
      'public_content_from_private_material',
    ],
    notes: 'Primary engineering runtime. Repo writes are allowed; production side effects need approval.',
  },
  {
    runtime: 'n8n',
    label: 'n8n Automation Runtime',
    canReadFiles: false,
    canWriteFiles: false,
    canCallExternalApis: true,
    canTouchClientData: true,
    canWriteProductionData: 'known_workflows',
    requiresApprovalFor: [
      'unknown_db_write',
      'production_config_change',
      'publish_public_content',
      'send_email',
      'public_content_from_private_material',
    ],
    notes: 'Production automation runtime. Known workflow writes are allowed; outbound actions stay gated.',
  },
  {
    runtime: 'hermes',
    label: 'Hermes Secondary Runtime',
    canReadFiles: true,
    canWriteFiles: false,
    canCallExternalApis: false,
    canTouchClientData: false,
    canWriteProductionData: 'none',
    requiresApprovalFor: [
      'write_files',
      'external_api_call',
      'client_data_access',
      'known_workflow_db_write',
      'unknown_db_write',
      'production_config_change',
      'publish_public_content',
      'send_email',
      'public_content_from_private_material',
    ],
    notes: 'Read-only in v1. Any mutation or client-data access must create an approval checkpoint first.',
  },
  {
    runtime: 'opencode',
    label: 'OpenCode Evaluation Runtime',
    canReadFiles: true,
    canWriteFiles: false,
    canCallExternalApis: false,
    canTouchClientData: false,
    canWriteProductionData: 'none',
    requiresApprovalFor: [
      'write_files',
      'external_api_call',
      'client_data_access',
      'known_workflow_db_write',
      'unknown_db_write',
      'production_config_change',
      'publish_public_content',
      'send_email',
      'public_content_from_private_material',
    ],
    notes: 'Deferred evaluation runtime. Isolated review only until trace and rollback behavior are proven.',
  },
  {
    runtime: 'manual',
    label: 'Manual Admin Action',
    canReadFiles: false,
    canWriteFiles: false,
    canCallExternalApis: true,
    canTouchClientData: true,
    canWriteProductionData: 'known_workflows',
    requiresApprovalFor: ['production_config_change', 'public_content_from_private_material'],
    notes: 'Human-triggered admin actions. Existing admin auth remains the approval boundary for known workflows.',
  },
]

export function getRuntimePolicy(runtime: AgentRuntime): RuntimePolicy {
  return RUNTIME_POLICIES.find((policy) => policy.runtime === runtime) ?? RUNTIME_POLICIES[0]
}

export function getApprovalGate(action: AgentAction): ApprovalGate | undefined {
  return APPROVAL_GATES.find((gate) => gate.action === action)
}

export function actionRequiresApproval(runtime: AgentRuntime, action: AgentAction): boolean {
  return getRuntimePolicy(runtime).requiresApprovalFor.includes(action)
}
