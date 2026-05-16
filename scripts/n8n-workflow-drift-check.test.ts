import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  compareWorkflows,
  loadN8nDriftEnv,
  runDriftCheck,
  type N8nWorkflow,
} from './n8n-workflow-drift-check'

const ENV_KEYS = ['N8N_API_KEY', 'N8N_BASE_URL'] as const

let tempRoot: string | null = null
let originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}

async function makeTempRoot() {
  tempRoot = await mkdtemp(path.join(tmpdir(), 'n8n-drift-check-'))
  return tempRoot
}

function workflow(id: string, parameterValue = 'same'): N8nWorkflow {
  return {
    id,
    name: `Workflow ${id}`,
    active: true,
    nodes: [
      {
        id: `node-${id}`,
        name: 'Get Lead Data',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [100, 200],
        webhookId: `webhook-${id}`,
        credentials: { httpHeaderAuth: { id: `cred-${id}`, name: `cred-${id}` } },
        parameters: {
          url: 'https://example.test/lead',
          trackedValue: parameterValue,
        },
      },
    ],
    connections: {
      'Get Lead Data': {
        main: [[]],
      },
    },
  }
}

beforeEach(() => {
  originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
})

afterEach(async () => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true })
    tempRoot = null
  }
})

describe('n8n workflow drift check helpers', () => {
  it('loads .env.local before .env so local API credentials are available to the CLI', async () => {
    const root = await makeTempRoot()
    await writeFile(path.join(root, '.env.local'), [
      'N8N_API_KEY=local-test-key',
      'N8N_BASE_URL=https://local-n8n.example/',
      '',
    ].join('\n'))
    await writeFile(path.join(root, '.env'), [
      'N8N_API_KEY=env-test-key',
      'N8N_BASE_URL=https://env-n8n.example/',
      '',
    ].join('\n'))

    loadN8nDriftEnv(root)

    expect(process.env.N8N_API_KEY).toBe('local-test-key')
    expect(process.env.N8N_BASE_URL).toBe('https://local-n8n.example/')
  })

  it('returns a configuration error without calling n8n when the API key is missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const logger = { log: vi.fn(), error: vi.fn() }

    await expect(runDriftCheck({ env: {}, fetchImpl, logger })).resolves.toBe(2)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('N8N_API_KEY is required'))
  })

  it('uses the configured base URL and exits successfully in warn-only mode when drift exists', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(init?.headers).toEqual({ 'X-N8N-API-KEY': 'local-test-key', Accept: 'application/json' })
      const id = String(input).endsWith('/prod') ? 'prod' : 'stag'
      return new Response(JSON.stringify(workflow(id, id === 'prod' ? 'prod-only' : 'stag-only')), {
        status: 200,
      })
    })
    const logger = { log: vi.fn(), error: vi.fn() }

    await expect(runDriftCheck({
      env: {
        N8N_API_KEY: 'local-test-key',
        N8N_BASE_URL: 'https://n8n.example/',
      },
      fetchImpl,
      logger,
      warnOnly: true,
      workflowPairs: [{ label: 'Lead workflow', prodId: 'prod', stagId: 'stag' }],
    })).resolves.toBe(0)

    expect(fetchImpl).toHaveBeenCalledWith('https://n8n.example/api/v1/workflows/prod', expect.any(Object))
    expect(fetchImpl).toHaveBeenCalledWith('https://n8n.example/api/v1/workflows/stag', expect.any(Object))
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Drift detected but --warn mode is on'))
  })

  it('ignores environment-specific node fields while reporting tracked parameter drift', () => {
    const report = compareWorkflows(
      'Lead workflow',
      workflow('prod', 'prod-only'),
      workflow('stag', 'stag-only'),
      []
    )

    expect(report.hasDrift).toBe(true)
    expect(report.nodeDiffs).toEqual([
      expect.objectContaining({
        name: 'Get Lead Data',
        kind: 'different',
        detail: expect.stringContaining('trackedValue'),
      }),
    ])
    expect(report.nodeDiffs[0]?.detail).not.toContain('webhook-prod')
    expect(report.nodeDiffs[0]?.detail).not.toContain('cred-prod')
    expect(report.nodeDiffs[0]?.detail).not.toContain('node-prod')
  })
})
