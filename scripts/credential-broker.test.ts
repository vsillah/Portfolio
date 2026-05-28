import { spawn } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as http from 'node:http'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const BROKER_PATH = path.join(ROOT, 'scripts', 'credential-broker.ts')
const TSX_CLI_PATH = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')

type BrokerRun = {
  status: number | null
  stdout: string
  stderr: string
}

type SinkPresence = {
  sink: string
  status: string
  evidence: string
}

type CredentialReportJson = {
  rows: Array<{
    envVar: string
    sinkPresence: SinkPresence[]
  }>
  sinkGapActions: Array<{
    envVar: string
    sink: string
    status: string
  }>
}

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('credential broker CLI runtime sink checks', () => {
  it('reports Vercel and n8n credential metadata using key-only observations', async () => {
    const binDir = makeTempDir()
    writeFakeVercel(binDir, {
      envs: [{ key: 'OPENAI_API_KEY' }, { key: 'STRIPE_SECRET_KEY' }],
    })
    const n8n = await startN8nMetadataServer({
      credentials: {
        data: [
          {
            name: 'OpenAI Staging Account',
            type: 'openAiApi',
            data: { apiKey: 'must-not-leak-provider-secret' },
          },
          {
            name: 'Anthropic Staging Account',
            type: 'anthropicApi',
            data: { apiKey: 'also-must-not-leak' },
          },
        ],
      },
      variables: {
        data: [
          { key: 'OPENROUTER_API_KEY', value: 'must-not-leak-variable-secret' },
          { key: 'LINKEDIN_COOKIE', value: 'also-must-not-leak-variable-secret' },
        ],
      },
    })

    try {
      const result = await runBroker([
        'report',
        '--env',
        'staging',
        '--as-of',
        '2026-05-14',
        '--check-sinks',
        '--json',
      ], {
        PATH: binDir,
        N8N_API_KEY: 'test-n8n-api-key',
        N8N_BASE_URL: n8n.baseUrl,
      })

      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')

      const report = JSON.parse(result.stdout) as CredentialReportJson
      const openAi = rowFor(report, 'OPENAI_API_KEY')

      expect(presenceFor(openAi, 'Vercel')).toMatchObject({
        status: 'present',
        evidence: 'Found key name in Vercel preview environment metadata.',
      })
      expect(presenceFor(openAi, 'n8n Credentials')).toMatchObject({
        status: 'present',
      })
      expect(presenceFor(openAi, 'n8n Credentials').evidence).toContain('OpenAI Staging Account:openAiApi')

      expect(presenceFor(rowFor(report, 'OPENROUTER_API_KEY'), 'n8n Variables')).toMatchObject({
        status: 'present',
        evidence: 'Found n8n variable key metadata for OPENROUTER_API_KEY; values were not printed or stored.',
      })

      const serialized = JSON.stringify(report)
      expect(serialized).not.toContain('test-n8n-api-key')
      expect(serialized).not.toContain('must-not-leak-provider-secret')
      expect(serialized).not.toContain('also-must-not-leak')
      expect(serialized).not.toContain('must-not-leak-variable-secret')
      expect(serialized).not.toContain('also-must-not-leak-variable-secret')
    } finally {
      await n8n.close()
    }
  })

  it('keeps report generation non-fatal when provider metadata is unavailable', async () => {
    const emptyPathDir = makeTempDir()
    const result = await runBroker([
      'report',
      '--env',
      'staging',
      '--as-of',
      '2026-05-14',
      '--check-sinks',
      '--json',
    ], {
      PATH: emptyPathDir,
    })

    expect(result.status, result.stderr).toBe(0)
    const report = JSON.parse(result.stdout) as CredentialReportJson
    const openAi = rowFor(report, 'OPENAI_API_KEY')

    expect(presenceFor(openAi, 'Vercel')).toMatchObject({
      status: 'unavailable',
    })
    expect(presenceFor(openAi, 'Vercel').evidence).toContain('Vercel env metadata unavailable for preview')
    expect(presenceFor(openAi, 'n8n Credentials')).toMatchObject({
      status: 'unavailable',
      evidence: 'n8n credential metadata unavailable because N8N_API_KEY is not set.',
    })
    expect(presenceFor(rowFor(report, 'OPENROUTER_API_KEY'), 'n8n Variables')).toMatchObject({
      status: 'unavailable',
      evidence: 'n8n variable metadata unavailable because N8N_API_KEY is not set.',
    })
    expect(report.sinkGapActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        envVar: 'OPENAI_API_KEY',
        sink: 'n8n Credentials',
        status: 'unavailable',
      }),
    ]))
  })

  it('reports n8n Variables as unavailable when the API key lacks variable list scope', async () => {
    const n8n = await startN8nMetadataServer({
      credentials: { data: [] },
      variables: {
        status: 403,
        body: { message: 'forbidden' },
      },
    })

    try {
      const result = await runBroker([
        'report',
        '--env',
        'staging',
        '--as-of',
        '2026-05-14',
        '--check-sinks',
        '--json',
      ], {
        PATH: makeTempDir(),
        N8N_API_KEY: 'test-n8n-api-key',
        N8N_BASE_URL: n8n.baseUrl,
      })

      expect(result.status, result.stderr).toBe(0)
      const report = JSON.parse(result.stdout) as CredentialReportJson
      const openRouterVariables = presenceFor(rowFor(report, 'OPENROUTER_API_KEY'), 'n8n Variables')

      expect(openRouterVariables).toMatchObject({
        status: 'unavailable',
      })
      expect(openRouterVariables.evidence).toContain('variable:list scope')
      expect(report.sinkGapActions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          envVar: 'OPENROUTER_API_KEY',
          sink: 'n8n Variables',
          status: 'unavailable',
        }),
      ]))
    } finally {
      await n8n.close()
    }
  })

  it('reports absent n8n Variables metadata as missing instead of unknown', async () => {
    const n8n = await startN8nMetadataServer({
      credentials: { data: [] },
      variables: { data: [{ key: 'SOME_OTHER_KEY' }] },
    })

    try {
      const result = await runBroker([
        'report',
        '--env',
        'staging',
        '--as-of',
        '2026-05-14',
        '--check-sinks',
        '--json',
      ], {
        PATH: makeTempDir(),
        N8N_API_KEY: 'test-n8n-api-key',
        N8N_BASE_URL: n8n.baseUrl,
      })

      expect(result.status, result.stderr).toBe(0)
      const report = JSON.parse(result.stdout) as CredentialReportJson
      const openRouterVariables = presenceFor(rowFor(report, 'OPENROUTER_API_KEY'), 'n8n Variables')

      expect(openRouterVariables).toMatchObject({
        status: 'missing',
        evidence: 'No n8n variable key metadata matched OPENROUTER_API_KEY.',
      })
      expect(report.sinkGapActions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          envVar: 'OPENROUTER_API_KEY',
          sink: 'n8n Variables',
          status: 'missing',
        }),
      ]))
    } finally {
      await n8n.close()
    }
  })

  it('matches n8n Variables metadata case-insensitively without exposing values', async () => {
    const n8n = await startN8nMetadataServer({
      credentials: { data: [] },
      variables: {
        data: [
          { key: 'openrouter_api_key', value: 'must-not-leak-variable-secret' },
        ],
      },
    })

    try {
      const result = await runBroker([
        'report',
        '--env',
        'staging',
        '--as-of',
        '2026-05-14',
        '--check-sinks',
        '--json',
      ], {
        PATH: makeTempDir(),
        N8N_API_KEY: 'test-n8n-api-key',
        N8N_BASE_URL: n8n.baseUrl,
      })

      expect(result.status, result.stderr).toBe(0)
      const report = JSON.parse(result.stdout) as CredentialReportJson

      expect(presenceFor(rowFor(report, 'OPENROUTER_API_KEY'), 'n8n Variables')).toMatchObject({
        status: 'present',
        evidence: 'Found n8n variable key metadata for OPENROUTER_API_KEY; values were not printed or stored.',
      })
      expect(JSON.stringify(report)).not.toContain('must-not-leak-variable-secret')
    } finally {
      await n8n.close()
    }
  })

  it('fails strict sink reports when selected runtime sink gaps remain', async () => {
    const emptyPathDir = makeTempDir()
    const result = await runBroker([
      'report',
      '--env',
      'staging',
      '--as-of',
      '2026-05-14',
      '--strict-sinks',
      'unavailable',
      '--json',
    ], {
      PATH: emptyPathDir,
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Strict runtime sink gate failed:')
    expect(result.stdout).toContain('"sinkGapActions"')
    expect(result.stdout).toContain('"envVar": "OPENAI_API_KEY"')
    expect(result.stdout).toContain('"sink": "n8n Credentials"')
    expect(result.stdout).toContain('"status": "unavailable"')
  })
})

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'credential-broker-test-'))
  tempDirs.push(dir)
  return dir
}

function writeFakeVercel(binDir: string, payload: unknown) {
  const vercelPath = path.join(binDir, 'vercel')
  writeFileSync(
    vercelPath,
    `#!/bin/sh\nprintf '%s\\n' 'Vercel CLI test banner' '${JSON.stringify(payload)}'\n`,
  )
  chmodSync(vercelPath, 0o755)
}

async function runBroker(args: string[], env: Record<string, string>): Promise<BrokerRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TSX_CLI_PATH, BROKER_PATH, ...args], {
      cwd: ROOT,
      env: {
        NODE_ENV: 'test',
        CREDENTIAL_BROKER_SKIP_DOTENV: '1',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (status) => {
      resolve({ status, stdout, stderr })
    })
  })
}

type N8nVariablesResponse = unknown | {
  status: number
  body: unknown
}

async function startN8nMetadataServer(payload: { credentials: unknown; variables?: N8nVariablesResponse }): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((request, response) => {
    expect(request.headers['x-n8n-api-key']).toBe('test-n8n-api-key')
    if (request.url === '/api/v1/credentials') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(payload.credentials))
      return
    }
    if (request.url === '/api/v1/variables') {
      if (isStatusResponse(payload.variables)) {
        response.writeHead(payload.variables.status, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(payload.variables.body))
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(payload.variables ?? { data: [] }))
      return
    }
    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ message: 'not found' }))
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('n8n metadata test server did not bind a TCP port')

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    }),
  }
}

function isStatusResponse(value: N8nVariablesResponse | undefined): value is { status: number; body: unknown } {
  return Boolean(value && typeof value === 'object' && 'status' in value && typeof value.status === 'number')
}

function rowFor(report: CredentialReportJson, envVar: string): { sinkPresence: SinkPresence[] } {
  const row = report.rows.find((candidate) => candidate.envVar === envVar)
  if (!row) throw new Error(`Missing credential report row for ${envVar}`)
  return row
}

function presenceFor(row: { sinkPresence: SinkPresence[] }, sink: string): SinkPresence {
  const presence = row.sinkPresence.find((candidate) => candidate.sink === sink)
  if (!presence) throw new Error(`Missing sink presence for ${sink}`)
  return presence
}
