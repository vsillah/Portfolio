import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type SetAssignment = {
  name?: string
  value?: string
}

type N8nNode = {
  name?: string
  parameters?: {
    assignments?: {
      assignments?: SetAssignment[]
    }
    url?: string
    headerParameters?: {
      parameters?: Array<{ name?: string; value?: string }>
    }
  }
}

type N8nWorkflow = {
  nodes?: N8nNode[]
  activeVersion?: {
    nodes?: N8nNode[]
  }
}

const VEP002_EXPORT_PATH = path.join(
  process.cwd(),
  'n8n-exports',
  'WF-VEP-002-Social-Listening-Pipeline.json',
)

function loadWorkflow(): N8nWorkflow {
  return JSON.parse(readFileSync(VEP002_EXPORT_PATH, 'utf8')) as N8nWorkflow
}

function getNodeByName(nodes: N8nNode[], name: string): N8nNode {
  const node = nodes.find(entry => entry.name === name)
  expect(node, `Expected workflow node "${name}" to exist`).toBeDefined()
  return node as N8nNode
}

function getAssignment(node: N8nNode, name: string): SetAssignment {
  const assignment = node.parameters?.assignments?.assignments?.find(entry => entry.name === name)
  expect(assignment, `Expected assignment "${name}" on node "${node.name}"`).toBeDefined()
  return assignment as SetAssignment
}

describe('WF-VEP-002 export regression guards', () => {
  it('defines baseUrl and ingestSecret assignments in Set Search Parameters (draft + activeVersion)', () => {
    const workflow = loadWorkflow()
    const nodeSets = [workflow.nodes ?? [], workflow.activeVersion?.nodes ?? []]

    for (const nodes of nodeSets) {
      const setParamsNode = getNodeByName(nodes, 'Set Search Parameters')
      expect(getAssignment(setParamsNode, 'baseUrl').value).toBe(
        "={{ $json.body?.callbackBaseUrl || 'https://amadutown.com' }}",
      )
      expect(getAssignment(setParamsNode, 'ingestSecret').value).toBe("={{ $vars.N8N_INGEST_SECRET }}")
    }
  })

  it('uses AMADUTOWN_PUBLIC_BASE_URL + Bearer N8N_INGEST_SECRET for ingest endpoints', () => {
    const workflow = loadWorkflow()
    const nodeSets = [workflow.nodes ?? [], workflow.activeVersion?.nodes ?? []]

    for (const nodes of nodeSets) {
      for (const nodeName of ['POST Raw to Market Intel', 'POST Pain Points']) {
        const ingestNode = getNodeByName(nodes, nodeName)
        expect(ingestNode.parameters?.url).toContain('$vars.AMADUTOWN_PUBLIC_BASE_URL')
        expect(ingestNode.parameters?.url).not.toContain('PORTFOLIO_BASE_URL')

        const authHeader = ingestNode.parameters?.headerParameters?.parameters?.find(
          header => header.name === 'Authorization',
        )

        expect(authHeader?.value).toBe('=Bearer {{ $vars.N8N_INGEST_SECRET }}')
      }
    }
  })
})
