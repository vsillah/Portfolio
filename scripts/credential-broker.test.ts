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

      const serialized = JSON.stringify(report)
      expect(serialized).not.toContain('test-n8n-api-key')
      expect(serialized).not.toContain('must-not-leak-provider-secret')
      expect(serialized).not.toContain('also-must-not-leak')
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
    expect(report.sinkGapActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        envVar: 'OPENAI_API_KEY',
        sink: 'n8n Credentials',
        status: 'unavailable',
      }),
    ]))
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

async function startN8nMetadataServer(payload: unknown): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((request, response) => {
    expect(request.url).toBe('/api/v1/credentials')
    expect(request.headers['x-n8n-api-key']).toBe('test-n8n-api-key')
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(payload))
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
