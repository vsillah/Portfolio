import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type N8nConnection = {
  node?: string
  type?: string
  index?: number
}

type N8nNode = {
  name?: string
  type?: string
  parameters?: {
    jsCode?: string
    url?: string
    jsonBody?: string
    headerParameters?: {
      parameters?: Array<{ name?: string; value?: string }>
    }
  }
}

type N8nWorkflow = {
  nodes?: N8nNode[]
  connections?: Record<string, { main?: N8nConnection[][] }>
}

const WORKFLOWS = [
  {
    file: 'WF-WRM-001-Facebook-Warm-Lead-Scraper.json',
    source: 'facebook',
    workflowId: 'WF-WRM-001',
    normalizeNode: 'Normalize & Deduplicate',
  },
  {
    file: 'WF-WRM-002-Google-Contacts-Sync.json',
    source: 'google_contacts',
    workflowId: 'WF-WRM-002',
    normalizeNode: 'Normalize Contacts',
  },
  {
    file: 'WF-WRM-003-LinkedIn-Warm-Lead-Scraper.json',
    source: 'linkedin',
    workflowId: 'WF-WRM-003',
    normalizeNode: 'Normalize & Deduplicate',
  },
]

function loadWorkflow(file: string): N8nWorkflow {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'n8n-exports', file), 'utf8')) as N8nWorkflow
}

function getNode(workflow: N8nWorkflow, name: string): N8nNode {
  const node = workflow.nodes?.find(entry => entry.name === name)
  expect(node, `Expected workflow node "${name}" to exist`).toBeDefined()
  return node as N8nNode
}

function getAuthHeader(node: N8nNode): string | undefined {
  return node.parameters?.headerParameters?.parameters?.find(header => header.name === 'Authorization')?.value
}

function expectConnection(workflow: N8nWorkflow, from: string, to: string, outputIndex = 0): void {
  const outputs = workflow.connections?.[from]?.main ?? []
  const target = outputs[outputIndex]?.find(connection => connection.node === to)
  expect(target, `Expected "${from}" output ${outputIndex} to connect to "${to}"`).toBeDefined()
}

describe('warm lead n8n workflow export trace callbacks', () => {
  it.each(WORKFLOWS)('$workflowId preserves agent trace fields through normalization', ({ file, normalizeNode }) => {
    const workflow = loadWorkflow(file)
    const node = getNode(workflow, normalizeNode)

    expect(node.parameters?.jsCode).toContain("const triggerJson = $node['Webhook Trigger']?.json")
    expect(node.parameters?.jsCode).toContain('agent_run_id: triggerBody.agent_run_id || null')
    expect(node.parameters?.jsCode).toContain('agent_event_callback_url: triggerBody.agent_event_callback_url || null')
    expect(node.parameters?.jsCode).toContain('return [{ json: { leads, count: leads.length, ...tracePayload } }];')
  })

  it.each(WORKFLOWS)('$workflowId posts ingest payload with trace id and n8n variable fallbacks', ({ file }) => {
    const workflow = loadWorkflow(file)
    const node = getNode(workflow, 'POST to Ingest API')

    expect(node.parameters?.url).toContain('$json.callbackBaseUrl')
    expect(node.parameters?.url).toContain('$vars.AMADUTOWN_PUBLIC_BASE_URL')
    expect(getAuthHeader(node)).toBe('=Bearer {{ $vars.N8N_INGEST_SECRET || $env.N8N_INGEST_SECRET }}')
    expect(node.parameters?.jsonBody).toContain('agent_run_id: $json.agent_run_id || undefined')
  })

  it.each(WORKFLOWS)('$workflowId calls run-complete and generic trace event after ingest', ({
    file,
    source,
    workflowId,
    normalizeNode,
  }) => {
    const workflow = loadWorkflow(file)
    const guardNode = getNode(workflow, 'Has Agent Run ID')
    const completionNode = getNode(workflow, 'Report Outreach Run Complete')
    const eventNode = getNode(workflow, 'Report Agent Trace Event')

    expect(guardNode.type).toBe('n8n-nodes-base.if')
    expect(completionNode.parameters?.url).toContain('/api/admin/outreach/run-complete')
    expect(completionNode.parameters?.jsonBody).toContain(`source: '${source}'`)
    expect(completionNode.parameters?.jsonBody).toContain(`$node["${normalizeNode}"].json.agent_run_id`)
    expect(getAuthHeader(completionNode)).toBe('=Bearer {{ $vars.N8N_INGEST_SECRET || $env.N8N_INGEST_SECRET }}')

    expect(eventNode.parameters?.url).toContain('agent_event_callback_url')
    expect(eventNode.parameters?.url).toContain('/api/admin/agents/runs/')
    expect(eventNode.parameters?.jsonBody).toContain(`workflow_id: '${workflowId}'`)
    expect(eventNode.parameters?.jsonBody).toContain("stage: 'outreach_ingest_complete'")
    expect(eventNode.parameters?.jsonBody).toContain("status: 'completed'")
    expect(getAuthHeader(eventNode)).toBe('=Bearer {{ $vars.N8N_INGEST_SECRET || $env.N8N_INGEST_SECRET }}')

    expectConnection(workflow, 'POST to Ingest API', 'Has Agent Run ID')
    expectConnection(workflow, 'Has Agent Run ID', 'Report Outreach Run Complete')
    expectConnection(workflow, 'Report Outreach Run Complete', 'Report Agent Trace Event')
  })
})
