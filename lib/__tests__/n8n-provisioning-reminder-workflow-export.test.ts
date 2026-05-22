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
    jsonBody?: string
    url?: string
    sendHeaders?: boolean
    conditions?: {
      conditions?: Array<{
        leftValue?: string
        operator?: { operation?: string }
      }>
    }
    assignments?: {
      assignments?: Array<{ name?: string; value?: string }>
    }
    headerParameters?: {
      parameters?: Array<{ name?: string; value?: string }>
    }
  }
}

type N8nWorkflow = {
  nodes?: N8nNode[]
  connections?: Record<string, { main?: N8nConnection[][] }>
}

const WORKFLOW_PATH = path.join(process.cwd(), 'n8n-exports', 'WF-PROV-Provisioning-Reminder.json')

function loadWorkflow(): N8nWorkflow {
  return JSON.parse(readFileSync(WORKFLOW_PATH, 'utf8')) as N8nWorkflow
}

function getNode(workflow: N8nWorkflow, name: string): N8nNode {
  const node = workflow.nodes?.find((entry) => entry.name === name)
  expect(node, `Expected workflow node "${name}" to exist`).toBeDefined()
  return node as N8nNode
}

function expectConnection(workflow: N8nWorkflow, from: string, to: string, outputIndex = 0): void {
  const outputs = workflow.connections?.[from]?.main ?? []
  const target = outputs[outputIndex]?.find((connection) => connection.node === to)
  expect(target, `Expected "${from}" output ${outputIndex} to connect to "${to}"`).toBeDefined()
}

function getHeader(node: N8nNode, name: string): string | undefined {
  return node.parameters?.headerParameters?.parameters?.find((header) => header.name === name)?.value
}

describe('WF-PROV provisioning reminder export trace callbacks', () => {
  it('preserves Agent Ops trace fields from the webhook payload', () => {
    const workflow = loadWorkflow()
    const node = getNode(workflow, 'Extract Payload')

    expect(node.parameters?.assignments?.assignments).toEqual(
      expect.arrayContaining([
        {
          id: 'a7',
          name: 'agent_run_id',
          type: 'string',
          value: '={{ $json.body.agent_run_id || \'\' }}',
        },
        {
          id: 'a8',
          name: 'agent_event_callback_url',
          type: 'string',
          value: '={{ $json.body.agent_event_callback_url || \'\' }}',
        },
      ]),
    )
  })

  it('guards generic Agent Ops callbacks so reminders still respond when no trace URL is supplied', () => {
    const workflow = loadWorkflow()
    const guard = getNode(workflow, 'Has Agent Event Callback URL')

    expect(guard.type).toBe('n8n-nodes-base.if')
    expect(guard.parameters?.conditions?.conditions?.[0]).toMatchObject({
      leftValue: '={{ $node["Extract Payload"].json.agent_event_callback_url }}',
      operator: { operation: 'notEmpty' },
    })

    expectConnection(workflow, 'Send Slack Reminder', 'Has Agent Event Callback URL')
    expectConnection(workflow, 'Send Email Reminder', 'Has Agent Event Callback URL')
    expectConnection(workflow, 'Has Agent Event Callback URL', 'Report Agent Trace Event', 0)
    expectConnection(workflow, 'Has Agent Event Callback URL', 'Respond OK', 1)
  })

  it('records a final completion event after reminder delivery when Agent Ops context is present', () => {
    const workflow = loadWorkflow()
    const eventNode = getNode(workflow, 'Report Agent Trace Event')

    expect(eventNode.parameters?.url).toBe('={{ $node["Extract Payload"].json.agent_event_callback_url }}')
    expect(eventNode.parameters?.sendHeaders).toBe(true)
    expect(getHeader(eventNode, 'Content-Type')).toBe('application/json')
    expect(getHeader(eventNode, 'Authorization')).toBe('=Bearer {{ $vars.N8N_INGEST_SECRET || $env.N8N_INGEST_SECRET }}')
    expect(eventNode.parameters?.jsonBody).toContain("workflow_id: 'WF-PROV'")
    expect(eventNode.parameters?.jsonBody).toContain("stage: 'provisioning_reminder_sent'")
    expect(eventNode.parameters?.jsonBody).toContain("status: 'completed'")
    expect(eventNode.parameters?.jsonBody).toContain('final: true')
    expect(eventNode.parameters?.jsonBody).toContain('delivery_channel')
    expect(eventNode.parameters?.jsonBody).toContain('agent_run_id')
    expect(eventNode.parameters?.jsonBody).toContain('WF-PROV:provisioning_reminder_sent')

    expectConnection(workflow, 'Report Agent Trace Event', 'Respond OK')
  })
})
