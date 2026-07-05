import {
  inferTaskCategory,
  type ModelUsageImportPacket,
  type ModelUsageSourcePacket,
  type ModelUsageSourcePacketKind,
  type ModelUsageTaskCategory,
} from '@/lib/model-usage'

export type ModelUsageSourceFileKind =
  | 'codex_session_json'
  | 'claude_code_session_json'
  | 'gemini_usage_csv'
  | 'openai_usage_jsonl'
  | 'anthropic_usage_jsonl'
  | 'local_model_json'

export type ModelUsageSourceReaderInput = {
  kind: ModelUsageSourceFileKind
  text: string
  clientProjectId?: string | null
  clientLabel?: string | null
  agentKey?: string | null
  defaultTaskCategory?: ModelUsageTaskCategory
  exportBatchId?: string | null
}

export type ModelUsageImportRequest = ModelUsageImportPacket & {
  sourceFiles?: ModelUsageSourceReaderInput[]
}

const FORBIDDEN_SOURCE_FIELD_PATTERN = /(api[_-]?key|secret|access[_-]?token|refresh[_-]?token|(?:^|[_-])token(?:$|[_-])|password|credential|raw[_-]?prompt|^prompt$|messages|transcript|^content$)/i

export function buildModelUsageImportPacketFromRequest(request: ModelUsageImportRequest): ModelUsageImportPacket {
  const sourcePacketsFromFiles = (request.sourceFiles ?? []).flatMap((sourceFile) => (
    buildModelUsageImportPacketFromSourceText(sourceFile).sourcePackets ?? []
  ))
  return {
    dryRun: request.dryRun,
    events: request.events,
    sourcePackets: [...(request.sourcePackets ?? []), ...sourcePacketsFromFiles],
    subscriptionAllocations: request.subscriptionAllocations,
  }
}

export function buildModelUsageImportPacketFromSourceText(input: ModelUsageSourceReaderInput): ModelUsageImportPacket {
  const rows = parseSourceRows(input.kind, input.text)
  if (rows.length === 0) throw new Error('Model usage source file did not contain any importable rows.')
  if (rows.length > 100) throw new Error('Model usage source file cannot include more than 100 rows.')

  return {
    dryRun: true,
    sourcePackets: rows.map((row, index) => sourcePacketFromRow(input, row, index)),
  }
}

function parseSourceRows(kind: ModelUsageSourceFileKind, text: string): Record<string, unknown>[] {
  if (!text.trim()) return []
  if (kind === 'gemini_usage_csv') return parseCsv(text)
  if (kind === 'openai_usage_jsonl' || kind === 'anthropic_usage_jsonl') {
    return text.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ensureObject(parseJsonObject(line, `line ${index + 1}`), `line ${index + 1}`))
  }
  const parsed = parseJsonObject(text, 'source JSON')
  if (Array.isArray(parsed)) return parsed.map((row, index) => ensureObject(row, `source JSON[${index}]`))
  const object = ensureObject(parsed, 'source JSON')
  const arrayValue = object.sessions ?? object.records ?? object.rows ?? object.events
  if (Array.isArray(arrayValue)) return arrayValue.map((row, index) => ensureObject(row, `source JSON rows[${index}]`))
  return [object]
}

function sourcePacketFromRow(
  input: ModelUsageSourceReaderInput,
  row: Record<string, unknown>,
  index: number,
): ModelUsageSourcePacket {
  assertNoPrivateSourceFields(row, `rows[${index}]`)
  const usage = usageFromRow(row)
  const kind = sourcePacketKindFor(input.kind, row)
  const sourceId = stringValue(row.id)
    ?? stringValue(row.source_id)
    ?? stringValue(row.sourceId)
    ?? stringValue(row.session_id)
    ?? stringValue(row.sessionId)
    ?? `${input.kind}-${index + 1}`
  const metadata = {
    rowIndex: index,
    sourceFileKind: input.kind,
    operation: stringValue(row.operation),
    workflow_key: stringValue(row.workflow_key),
    artifact_type: stringValue(row.artifact_type),
  }

  return {
    kind,
    sourceId,
    occurredAt: stringValue(row.occurred_at) ?? stringValue(row.occurredAt) ?? stringValue(row.timestamp) ?? stringValue(row.date) ?? undefined,
    model: stringValue(row.model) ?? stringValue(row.model_name) ?? undefined,
    taskCategory: taskCategoryFromRow(row, input.defaultTaskCategory),
    agentKey: stringValue(row.agent_key) ?? stringValue(row.agentKey) ?? input.agentKey ?? null,
    clientProjectId: stringValue(row.client_project_id) ?? stringValue(row.clientProjectId) ?? input.clientProjectId ?? null,
    clientLabel: stringValue(row.client_label) ?? stringValue(row.clientLabel) ?? input.clientLabel ?? null,
    actionLabel: stringValue(row.action_label) ?? stringValue(row.actionLabel) ?? stringValue(row.operation) ?? undefined,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedTokens: usage.cachedTokens,
    reasoningTokens: usage.reasoningTokens,
    totalTokens: usage.totalTokens,
    acceptedOutputCount: numberValue(row.accepted_output_count) ?? numberValue(row.acceptedOutputCount) ?? undefined,
    resolvedWorkItemCount: numberValue(row.resolved_work_item_count) ?? numberValue(row.resolvedWorkItemCount) ?? undefined,
    retryCount: numberValue(row.retry_count) ?? numberValue(row.retryCount) ?? undefined,
    costUsd: numberValue(row.cost_usd) ?? numberValue(row.costUsd) ?? numberValue(row.amount_usd) ?? undefined,
    href: stringValue(row.href) ?? stringValue(row.url) ?? null,
    accountLabel: stringValue(row.account_label) ?? stringValue(row.accountLabel) ?? null,
    exportBatchId: stringValue(row.export_batch_id) ?? stringValue(row.exportBatchId) ?? input.exportBatchId ?? null,
    executionHost: stringValue(row.execution_host) ?? stringValue(row.executionHost) ?? stringValue(row.host) ?? null,
    deploymentTarget: deploymentTargetFromRow(row),
    sourceMetadata: stripEmpty(metadata),
  }
}

function sourcePacketKindFor(kind: ModelUsageSourceFileKind, row: Record<string, unknown>): ModelUsageSourcePacketKind {
  if (kind === 'codex_session_json') return 'codex_session'
  if (kind === 'claude_code_session_json') return 'claude_code_session'
  if (kind === 'gemini_usage_csv') return 'gemini_usage_export'
  if (kind === 'openai_usage_jsonl') return 'openai_usage_export'
  if (kind === 'anthropic_usage_jsonl') return 'anthropic_usage_export'
  const localKind = stringValue(row.kind)?.toLowerCase() ?? ''
  const provider = stringValue(row.provider)?.toLowerCase() ?? ''
  const model = stringValue(row.model)?.toLowerCase() ?? ''
  if (localKind.includes('open_weight') || provider.includes('open') || model.includes('llama') || model.includes('mixtral')) return 'open_weight_model_run'
  return 'local_model_run'
}

function usageFromRow(row: Record<string, unknown>) {
  const nested = ensureObjectOrEmpty(row.usage) ?? ensureObjectOrEmpty(row.token_usage) ?? ensureObjectOrEmpty(row.metrics) ?? {}
  const inputTokens = numberValue(row.input_tokens) ?? numberValue(row.inputTokens) ?? numberValue(row.prompt_tokens) ?? numberValue(nested.input_tokens) ?? numberValue(nested.inputTokens) ?? numberValue(nested.prompt_tokens)
  const outputTokens = numberValue(row.output_tokens) ?? numberValue(row.outputTokens) ?? numberValue(row.completion_tokens) ?? numberValue(nested.output_tokens) ?? numberValue(nested.outputTokens) ?? numberValue(nested.completion_tokens)
  const cachedTokens = numberValue(row.cached_tokens) ?? numberValue(row.cachedTokens) ?? numberValue(nested.cached_tokens) ?? numberValue(nested.cachedTokens)
  const reasoningTokens = numberValue(row.reasoning_tokens) ?? numberValue(row.reasoningTokens) ?? numberValue(nested.reasoning_tokens) ?? numberValue(nested.reasoningTokens)
  const totalTokens = numberValue(row.total_tokens) ?? numberValue(row.totalTokens) ?? numberValue(nested.total_tokens) ?? numberValue(nested.totalTokens)
  return { inputTokens, outputTokens, cachedTokens, reasoningTokens, totalTokens }
}

function taskCategoryFromRow(row: Record<string, unknown>, fallback?: ModelUsageTaskCategory): ModelUsageTaskCategory | undefined {
  const explicit = stringValue(row.task_category) ?? stringValue(row.taskCategory)
  if (explicit) return explicit as ModelUsageTaskCategory
  return fallback ?? inferTaskCategory(row)
}

function deploymentTargetFromRow(row: Record<string, unknown>): ModelUsageSourcePacket['deploymentTarget'] {
  const value = (stringValue(row.deployment_target) ?? stringValue(row.deploymentTarget) ?? '').toLowerCase()
  if (value === 'local_device' || value === 'private_cloud' || value === 'managed_cloud' || value === 'unknown') return value
  if (stringValue(row.execution_host) || stringValue(row.executionHost) || stringValue(row.host)) return 'local_device'
  return undefined
}

function parseJsonObject(text: string, label: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Could not parse ${label} as JSON.`)
  }
}

function parseCsv(text: string): Record<string, unknown>[] {
  const rows = text.split(/\r?\n/).filter((line) => line.trim()).map(parseCsvLine)
  const headers = rows.shift()?.map((header) => header.trim()) ?? []
  if (headers.length === 0) return []
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function assertNoPrivateSourceFields(value: unknown, path: string) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SOURCE_FIELD_PATTERN.test(key)) throw new Error(`${path}.${key} is not allowed in model usage source imports.`)
    if (Array.isArray(child)) {
      child.forEach((item, index) => assertNoPrivateSourceFields(item, `${path}.${key}[${index}]`))
    } else {
      assertNoPrivateSourceFields(child, `${path}.${key}`)
    }
  }
}

function ensureObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function ensureObjectOrEmpty(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[$,]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function stripEmpty(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value != null && value !== ''))
}
