import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const WORKFLOW_PATH = path.join(process.cwd(), 'n8n-exports/Client-Progress-Update-Router.json')

function loadWorkflow() {
  return JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8')) as {
    nodes: Array<{
      name: string
      parameters?: {
        sendHeaders?: boolean
        headerParameters?: { parameters?: Array<{ name: string; value: string }> }
        bodyParameters?: { parameters?: Array<{ name: string; value: string }> }
      }
    }>
  }
}

describe('Client Progress Update Router export', () => {
  it.each(['Slack Delivery Callback', 'Email Delivery Callback'])(
    '%s echoes Agent Ops trace metadata and authenticates callbacks',
    (nodeName) => {
      const workflow = loadWorkflow()
      const node = workflow.nodes.find((item) => item.name === nodeName)

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
})
