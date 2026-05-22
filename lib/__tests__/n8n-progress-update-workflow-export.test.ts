import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const WORKFLOW_PATH = path.join(process.cwd(), 'n8n-exports/Client-Progress-Update-Router.json')

function loadWorkflow() {
  return JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8')) as {
    nodes: Array<{
      name: string
      type?: string
      parameters?: {
        sendHeaders?: boolean
        url?: string
        specifyBody?: string
        jsonBody?: string
        conditions?: {
          conditions?: Array<{
            leftValue?: string
            operator?: { operation?: string }
          }>
        }
        headerParameters?: { parameters?: Array<{ name: string; value: string }> }
        bodyParameters?: { parameters?: Array<{ name: string; value: string }> }
      }
    }>
    connections?: Record<string, { main?: Array<Array<{ node?: string }>> }>
    activeVersion?: {
      nodes?: Array<{
        name: string
        parameters?: {
          url?: string
        }
      }>
      connections?: Record<string, { main?: Array<Array<{ node?: string }>> }>
    }
  }
}

function getNode(workflow: ReturnType<typeof loadWorkflow>, name: string) {
  const node = workflow.nodes.find((item) => item.name === name)
  expect(node, `Expected workflow node "${name}" to exist`).toBeDefined()
  return node
}

function expectConnection(
  workflow: ReturnType<typeof loadWorkflow>,
  from: string,
  to: string,
): void {
  const target = workflow.connections?.[from]?.main?.[0]?.find((connection) => connection.node === to)
  expect(target, `Expected "${from}" to connect to "${to}"`).toBeDefined()
}

describe('Client Progress Update Router export', () => {
  it.each(['Slack Delivery Callback', 'Email Delivery Callback'])(
    '%s echoes Agent Ops trace metadata and authenticates callbacks',
    (nodeName) => {
      const workflow = loadWorkflow()
      const node = getNode(workflow, nodeName)

      expect(node?.parameters?.sendHeaders).toBe(true)
      expect(node?.parameters?.headerParameters?.parameters).toEqual(
        expect.arrayContaining([
          {
            name: 'x-ingest-secret',
            value: '={{ $vars.N8N_INGEST_SECRET || $env.N8N_INGEST_SECRET }}',
          },
        ]),
      )
      expect(node?.parameters?.bodyParameters?.parameters).toEqual(
        expect.arrayContaining([
          {
            name: 'agent_run_id',
            value: "={{ $('Progress Update Webhook').item.json.body.agent_run_id || '' }}",
          },
          {
            name: 'delivery_status',
            value: 'sent',
          },
        ]),
      )
    },
  )

  it.each([
    {
      channel: 'slack',
      guard: 'Has Slack Agent Event Callback URL',
      callback: 'Slack Agent Trace Event',
      source: 'Slack Delivery Callback',
      stage: 'slack_delivery_complete',
    },
    {
      channel: 'email',
      guard: 'Has Email Agent Event Callback URL',
      callback: 'Email Agent Trace Event',
      source: 'Email Delivery Callback',
      stage: 'email_delivery_complete',
    },
  ])(
    '$callback records a generic Agent Ops trace event after delivery callbacks',
    ({ channel, guard, callback, source, stage }) => {
      const workflow = loadWorkflow()
      const guardNode = getNode(workflow, guard)
      const callbackNode = getNode(workflow, callback)

      expect(guardNode?.type).toBe('n8n-nodes-base.if')
      expect(guardNode?.parameters?.conditions?.conditions?.[0]).toMatchObject({
        leftValue: "={{ $('Progress Update Webhook').item.json.body.agent_event_callback_url || '' }}",
        operator: { operation: 'notEmpty' },
      })

      expect(callbackNode?.parameters?.url).toBe("={{ $('Progress Update Webhook').item.json.body.agent_event_callback_url }}")
      expect(callbackNode?.parameters?.sendHeaders).toBe(true)
      expect(callbackNode?.parameters?.headerParameters?.parameters).toEqual(
        expect.arrayContaining([
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: '=Bearer {{ $vars.N8N_INGEST_SECRET || $env.N8N_INGEST_SECRET }}' },
        ]),
      )
      expect(callbackNode?.parameters?.specifyBody).toBe('json')
      expect(callbackNode?.parameters?.jsonBody).toContain("workflow_id: 'client-progress-update-router'")
      expect(callbackNode?.parameters?.jsonBody).toContain(`stage: '${stage}'`)
      expect(callbackNode?.parameters?.jsonBody).toContain("status: 'completed'")
      expect(callbackNode?.parameters?.jsonBody).toContain(`channel: '${channel}'`)
      expect(callbackNode?.parameters?.jsonBody).toContain(`':client-progress-update-router:${stage}'`)

      expectConnection(workflow, source, guard)
      expectConnection(workflow, guard, callback)

      const activeCallback = workflow.activeVersion?.nodes?.find((node) => node.name === callback)
      expect(activeCallback?.parameters?.url).toBe("={{ $('Progress Update Webhook').item.json.body.agent_event_callback_url }}")
      expect(workflow.activeVersion?.connections?.[source]?.main?.[0]?.[0]?.node).toBe(guard)
    },
  )
})
