export interface N8nAgentCallbackContract {
  version: 1
  runtime: 'n8n'
  events_url: string
  auth_header: string
  required_fields: string[]
  progress_statuses: string[]
  completion_statuses: string[]
  failure_statuses: string[]
  final_completion_payload: {
    workflow_id: string
    stage: string
    status: 'completed'
    final: true
  }
  failure_payload: {
    workflow_id: string
    stage: string
    status: 'failed'
    error_message: string
  }
}

export interface N8nAgentCallbackEnvelope {
  agent_run_id: string
  agent_event_callback_url: string
  agent_callback_contract: N8nAgentCallbackContract
  agent_trace: Record<string, unknown>
}

export function buildN8nAgentCallbackContract(
  eventsUrl: string,
  workflowId?: string | null,
): N8nAgentCallbackContract {
  const workflow = workflowId ?? '<workflow-id>'

  return {
    version: 1,
    runtime: 'n8n',
    events_url: eventsUrl,
    auth_header: 'Authorization: Bearer N8N_INGEST_SECRET',
    required_fields: ['workflow_id', 'stage', 'status'],
    progress_statuses: ['running', 'in_progress', 'started'],
    completion_statuses: ['completed', 'complete', 'success'],
    failure_statuses: ['failed', 'error', 'failure'],
    final_completion_payload: {
      workflow_id: workflow,
      stage: '<final-stage-name>',
      status: 'completed',
      final: true,
    },
    failure_payload: {
      workflow_id: workflow,
      stage: '<failed-stage-name>',
      status: 'failed',
      error_message: '<required failure summary>',
    },
  }
}

export function buildN8nAgentCallbackEnvelope(input: {
  agentRunId: string
  eventsUrl: string
  workflowId?: string | null
  trace?: Record<string, unknown>
}): N8nAgentCallbackEnvelope {
  const callbackContract = buildN8nAgentCallbackContract(input.eventsUrl, input.workflowId)

  return {
    agent_run_id: input.agentRunId,
    agent_event_callback_url: input.eventsUrl,
    agent_callback_contract: callbackContract,
    agent_trace: {
      version: 1,
      runtime: 'n8n',
      agent_run_id: input.agentRunId,
      workflow_id: input.workflowId ?? null,
      events_url: input.eventsUrl,
      auth: 'Bearer N8N_INGEST_SECRET',
      callback_contract: callbackContract,
      ...(input.trace ?? {}),
    },
  }
}
