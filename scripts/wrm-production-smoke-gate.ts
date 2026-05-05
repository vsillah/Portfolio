#!/usr/bin/env tsx
/**
 * Production-safe smoke gate for WRM n8n workflows.
 *
 * This gate triggers only the webhook smoke branch added to the WRM workflows.
 * Smoke mode bypasses live Apify/Google source nodes and inserts synthetic
 * contacts with is_test_data=true, while preserving Agent Ops traces.
 */

import { config } from 'dotenv'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  WRM_SMOKE_WORKFLOWS,
  assertProductionCallbackBaseUrl,
  assertProductionWebhookUrl,
  buildWrmSmokePayload,
  type WrmSmokeWorkflow,
} from '../lib/wrm-smoke-gate'

config({ path: resolve(process.cwd(), '.env.local') })

type GateOptions = {
  dryRun: boolean
  callbackBaseUrl: string
  timeoutSeconds: number
  intervalSeconds: number
}

type CreatedRun = {
  workflow: WrmSmokeWorkflow
  runId: string
}

type AgentRunRow = {
  id: string
  title: string
  status: string
  current_step: string | null
  subject_id: string | null
  subject_label: string | null
  error_message: string | null
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'stale'])

function usage(): string {
  return `Usage:
  npx tsx scripts/wrm-production-smoke-gate.ts [options]

Options:
  --dry-run                  Print planned checks without writing or triggering.
  --callback-base-url <url>  Must be https://amadutown.com. Defaults to https://amadutown.com.
  --timeout <seconds>        Max wait time. Defaults to 180.
  --interval <seconds>       Poll interval. Defaults to 5.
  --help                     Show this help.

Required env for live mode:
  PROD_SUPABASE_URL
  PROD_SUPABASE_SERVICE_ROLE_KEY
  N8N_WRM001_WEBHOOK_URL
  N8N_WRM002_WEBHOOK_URL
  N8N_WRM003_WEBHOOK_URL
`
}

function readOptions(argv: string[]): GateOptions {
  const options: GateOptions = {
    dryRun: false,
    callbackBaseUrl: 'https://amadutown.com',
    timeoutSeconds: 180,
    intervalSeconds: 5,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help') {
      console.log(usage())
      process.exit(0)
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--callback-base-url') {
      options.callbackBaseUrl = readOptionValue(argv, index, arg)
      index += 1
      continue
    }
    if (arg === '--timeout') {
      options.timeoutSeconds = Number(readOptionValue(argv, index, arg))
      index += 1
      continue
    }
    if (arg === '--interval') {
      options.intervalSeconds = Number(readOptionValue(argv, index, arg))
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0) {
    throw new Error('--timeout must be a positive number')
  }
  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds <= 0) {
    throw new Error('--interval must be a positive number')
  }

  return options
}

function readOptionValue(argv: string[], index: number, arg: string): string {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${arg} requires a value`)
  }
  return value
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function prodDb(): SupabaseClient {
  return createClient(requiredEnv('PROD_SUPABASE_URL'), requiredEnv('PROD_SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createAgentRun(supabase: SupabaseClient, workflow: WrmSmokeWorkflow): Promise<CreatedRun> {
  const { data: registry } = await supabase
    .from('agent_registry')
    .select('id')
    .eq('key', 'automation-systems')
    .maybeSingle()

  const idempotencyKey = `wrm-smoke-gate:${workflow.workflowId}:${Date.now()}`
  const now = new Date().toISOString()
  const metadata = {
    workflow_id: workflow.workflowId,
    source: workflow.source,
    mode: 'smoke',
    is_test_data: true,
    gate: 'wrm-production-smoke-gate',
  }

  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      agent_registry_id: (registry as { id?: string } | null)?.id ?? null,
      agent_key: 'automation-systems',
      runtime: 'n8n',
      kind: 'warm_lead_smoke',
      title: workflow.title,
      status: 'running',
      subject_type: 'workflow',
      subject_id: workflow.workflowId,
      subject_label: workflow.source,
      trigger_source: 'wrm-production-smoke-gate',
      current_step: 'Production smoke dispatched',
      metadata,
      idempotency_key: idempotencyKey,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Failed to create Agent Ops run for ${workflow.workflowId}: ${error?.message ?? 'missing id'}`)
  }

  const runId = data.id as string
  await supabase.from('agent_run_events').insert({
    run_id: runId,
    event_type: 'run_started',
    severity: 'info',
    message: workflow.title,
    metadata,
    idempotency_key: `${idempotencyKey}:started`,
  })
  await supabase.from('agent_run_steps').insert({
    run_id: runId,
    step_key: 'production_smoke_dispatched',
    name: 'Production smoke dispatched',
    status: 'running',
    metadata,
    idempotency_key: `${idempotencyKey}:dispatch`,
  })

  return { workflow, runId }
}

async function markDispatchAccepted(supabase: SupabaseClient, runId: string): Promise<void> {
  await supabase
    .from('agent_run_steps')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      output_summary: 'Production smoke webhook accepted',
    })
    .eq('run_id', runId)
    .eq('step_key', 'production_smoke_dispatched')
}

async function markRunFailed(supabase: SupabaseClient, runId: string, message: string): Promise<void> {
  await supabase
    .from('agent_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      current_step: 'Production smoke gate failed',
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
}

async function triggerWorkflow(
  supabase: SupabaseClient,
  createdRun: CreatedRun,
  callbackBaseUrl: string
): Promise<void> {
  const webhookUrl = requiredEnv(createdRun.workflow.envVar)
  assertProductionWebhookUrl(createdRun.workflow.envVar, webhookUrl)

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      buildWrmSmokePayload({
        workflow: createdRun.workflow,
        runId: createdRun.runId,
        callbackBaseUrl,
      })
    ),
  })

  const text = await response.text()
  if (!response.ok) {
    await markRunFailed(supabase, createdRun.runId, `Webhook returned ${response.status}`)
    throw new Error(`${createdRun.workflow.workflowId} webhook returned ${response.status}: ${text.slice(0, 300)}`)
  }

  await markDispatchAccepted(supabase, createdRun.runId)
}

async function readRuns(supabase: SupabaseClient, runIds: string[]): Promise<AgentRunRow[]> {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('id,title,status,current_step,subject_id,subject_label,error_message')
    .in('id', runIds)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to read Agent Ops runs: ${error.message}`)
  return (data ?? []) as AgentRunRow[]
}

async function readProgressEvents(supabase: SupabaseClient, runIds: string[]): Promise<Array<{ run_id: string }>> {
  const { data, error } = await supabase
    .from('agent_run_events')
    .select('run_id')
    .in('run_id', runIds)
    .eq('event_type', 'n8n_progress')

  if (error) throw new Error(`Failed to read Agent Ops events: ${error.message}`)
  return (data ?? []) as Array<{ run_id: string }>
}

async function waitForTraceCompletion(
  supabase: SupabaseClient,
  createdRuns: CreatedRun[],
  options: GateOptions
): Promise<AgentRunRow[]> {
  const startedAt = Date.now()
  const runIds = createdRuns.map((run) => run.runId)

  while (Date.now() - startedAt < options.timeoutSeconds * 1000) {
    const [runs, events] = await Promise.all([
      readRuns(supabase, runIds),
      readProgressEvents(supabase, runIds),
    ])

    const progressRunIds = new Set(events.map((event) => event.run_id))
    const allCompleted = runs.length === runIds.length && runs.every((run) => run.status === 'completed')
    const allHaveProgress = runIds.every((runId) => progressRunIds.has(runId))
    const failed = runs.find((run) => run.status === 'failed' || run.status === 'cancelled' || run.status === 'stale')

    if (failed) {
      throw new Error(`${failed.subject_id} finished with status ${failed.status}: ${failed.error_message ?? 'no error message'}`)
    }
    if (allCompleted && allHaveProgress) return runs

    console.log(
      `Waiting for Agent Ops traces: ${runs.filter((run) => run.status === 'completed').length}/${runIds.length} completed, ${progressRunIds.size}/${runIds.length} progress events`
    )
    await sleep(options.intervalSeconds * 1000)
  }

  throw new Error(`Timed out after ${options.timeoutSeconds}s waiting for WRM smoke traces`)
}

async function markUnfinishedRunsFailed(
  supabase: SupabaseClient,
  createdRuns: CreatedRun[],
  message: string
): Promise<void> {
  if (createdRuns.length === 0) return

  const latestRuns = await readRuns(
    supabase,
    createdRuns.map((run) => run.runId)
  ).catch(() => [])
  const terminalRunIds = new Set(latestRuns.filter((run) => TERMINAL_STATUSES.has(run.status)).map((run) => run.id))

  await Promise.all(
    createdRuns
      .filter((run) => !terminalRunIds.has(run.runId))
      .map((run) => markRunFailed(supabase, run.runId, message).catch(() => {}))
  )
}

async function verifySyntheticRows(
  supabase: SupabaseClient,
  gateStartedAt: string,
  workflows: WrmSmokeWorkflow[]
): Promise<void> {
  const { data: syntheticRows, error: syntheticError } = await supabase
    .from('contact_submissions')
    .select('id,name,lead_source,is_test_data,created_at')
    .eq('is_test_data', true)
    .gte('created_at', gateStartedAt)
    .ilike('name', 'ATAS Production%Smoke Lead%')
    .order('created_at', { ascending: false })
    .limit(20)

  if (syntheticError) throw new Error(`Failed to verify synthetic smoke rows: ${syntheticError.message}`)

  for (const workflow of workflows) {
    const found = (syntheticRows ?? []).some((row) => {
      const typed = row as { name?: string; lead_source?: string }
      return (
        typeof typed.name === 'string' &&
        typed.name.startsWith(workflow.smokeNamePrefix) &&
        typed.lead_source === workflow.leadSource
      )
    })

    if (!found) {
      throw new Error(`No synthetic test row found for ${workflow.workflowId} after ${gateStartedAt}`)
    }
  }

  const { data: nonTestRows, error: nonTestError } = await supabase
    .from('contact_submissions')
    .select('id,name,lead_source,is_test_data,created_at')
    .neq('is_test_data', true)
    .gte('created_at', gateStartedAt)
    .ilike('name', 'ATAS Production%Smoke Lead%')
    .limit(10)

  if (nonTestError) throw new Error(`Failed to verify non-test smoke rows: ${nonTestError.message}`)
  if ((nonTestRows ?? []).length > 0) {
    throw new Error(`Found ${nonTestRows?.length ?? 0} smoke row(s) without is_test_data=true`)
  }

  console.log(`Verified ${syntheticRows?.length ?? 0} recent synthetic smoke row(s); non-test smoke rows: 0`)
}

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2))
  assertProductionCallbackBaseUrl(options.callbackBaseUrl)

  console.log('WRM production smoke gate')
  console.log(`Mode: ${options.dryRun ? 'dry-run' : 'live synthetic smoke'}`)
  console.log(`Callback base URL: ${options.callbackBaseUrl}`)
  console.log(`Workflows: ${WRM_SMOKE_WORKFLOWS.map((workflow) => workflow.workflowId).join(', ')}`)

  for (const workflow of WRM_SMOKE_WORKFLOWS) {
    const webhookUrl = process.env[workflow.envVar] ?? ''
    if (options.dryRun && !webhookUrl.trim()) continue
    assertProductionWebhookUrl(workflow.envVar, webhookUrl)
  }

  if (options.dryRun) {
    console.log('Dry run complete. No database writes or webhooks were triggered.')
    return
  }

  const gateStartedAt = new Date(Date.now() - 5000).toISOString()
  const supabase = prodDb()
  const createdRuns: CreatedRun[] = []

  try {
    for (const workflow of WRM_SMOKE_WORKFLOWS) {
      const created = await createAgentRun(supabase, workflow)
      createdRuns.push(created)
      console.log(`${workflow.workflowId}: Agent Ops run ${created.runId}`)
    }

    for (const createdRun of createdRuns) {
      await triggerWorkflow(supabase, createdRun, options.callbackBaseUrl)
      console.log(`${createdRun.workflow.workflowId}: webhook accepted`)
    }

    const completedRuns = await waitForTraceCompletion(supabase, createdRuns, options)
    await verifySyntheticRows(supabase, gateStartedAt, WRM_SMOKE_WORKFLOWS)

    console.log('WRM production smoke gate passed')
    for (const run of completedRuns) {
      console.log(`- ${run.subject_id}: ${run.status} (${run.id})`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await markUnfinishedRunsFailed(supabase, createdRuns, message)
    throw error
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
