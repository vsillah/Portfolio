import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import * as http from 'node:http'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const SEED_PATH = path.join(ROOT, 'scripts', 'seed-neil-kmb-client-dashboard.ts')
const TSX_CLI_PATH = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')

type SeedRun = {
  status: number | null
  stdout: string
  stderr: string
}

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('Neil KMB dashboard seed target safety', () => {
  it('defaults to a read-only dev dry run without exposing the dashboard token', async () => {
    const supabase = await startReadOnlySupabase()
    const envFile = writeEnvFile([
      `NEXT_PUBLIC_SUPABASE_URL=${supabase.baseUrl}`,
      'SUPABASE_SERVICE_ROLE_KEY=test-dev-service-role',
    ])

    try {
      const result = await runSeed(['--env-file', envFile])

      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('Target: DEV (127.0.0.1)')
      expect(result.stdout).toContain('Mode: DRY RUN')
      expect(result.stdout).toContain('"applied": false')
      expect(result.stdout).toContain('"target": "dev"')
      expect(result.stdout).toContain('"dashboardAccess": "created-or-reused"')
      expect(result.stdout).not.toContain('dry-run-dashboard-token')
      expect(result.stdout).not.toContain('/client/dashboard/')
      expect(supabase.methods).toEqual(['GET', 'GET', 'GET'])
      expect(supabase.apiKeys).toEqual([
        'test-dev-service-role',
        'test-dev-service-role',
        'test-dev-service-role',
      ])
    } finally {
      await supabase.close()
    }
  })

  it('uses production credentials for the --prod alias even when dev credentials are present', async () => {
    const supabase = await startReadOnlySupabase()
    const envFile = writeEnvFile([
      'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1',
      'SUPABASE_SERVICE_ROLE_KEY=test-dev-service-role',
      `PROD_SUPABASE_URL=${supabase.baseUrl}`,
      'PROD_SUPABASE_SERVICE_ROLE_KEY=test-prod-service-role',
    ])

    try {
      const result = await runSeed(['--prod', '--env-file', envFile])

      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain('Target: PROD (127.0.0.1)')
      expect(result.stdout).toContain('Mode: DRY RUN')
      expect(result.stdout).toContain('"target": "prod"')
      expect(supabase.methods).toEqual(['GET', 'GET', 'GET'])
      expect(supabase.apiKeys).toEqual([
        'test-prod-service-role',
        'test-prod-service-role',
        'test-prod-service-role',
      ])
    } finally {
      await supabase.close()
    }
  })

  it('does not fall back to dev credentials when production is selected', async () => {
    const envFile = writeEnvFile([
      'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1',
      'SUPABASE_SERVICE_ROLE_KEY=test-dev-service-role',
    ])

    const result = await runSeed(['--target=prod', '--env-file', envFile])

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Missing PROD_SUPABASE_URL')
    expect(result.stderr).not.toContain('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('requires the production service-role key instead of reusing the dev key', async () => {
    const envFile = writeEnvFile([
      'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1',
      'SUPABASE_SERVICE_ROLE_KEY=test-dev-service-role',
      'PROD_SUPABASE_URL=http://127.0.0.1:2',
    ])

    const result = await runSeed(['--target', 'prod', '--env-file', envFile])

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Target: PROD (127.0.0.1)')
    expect(result.stderr).toContain('Missing PROD_SUPABASE_SERVICE_ROLE_KEY')
    expect(result.stderr).not.toContain('Missing SUPABASE_SERVICE_ROLE_KEY')
  })

  it('rejects unsupported targets before attempting database access', async () => {
    const result = await runSeed(['--target', 'staging', '--env-file', writeEnvFile([])])

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Unsupported target "staging". Use --target dev or --target prod.')
    expect(result.stderr).not.toContain('Missing')
  })
})

function writeEnvFile(lines: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'neil-kmb-seed-test-'))
  tempDirs.push(dir)
  const envFile = path.join(dir, '.env.test')
  writeFileSync(envFile, `${lines.join('\n')}\n`)
  return envFile
}

function runSeed(args: string[]): Promise<SeedRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TSX_CLI_PATH, SEED_PATH, ...args], {
      cwd: ROOT,
      env: {
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (status) => {
      resolve({ status, stdout, stderr })
    })
  })
}

async function startReadOnlySupabase(): Promise<{
  baseUrl: string
  methods: string[]
  apiKeys: string[]
  close: () => Promise<void>
}> {
  const methods: string[] = []
  const apiKeys: string[] = []
  const server = http.createServer((request, response) => {
    methods.push(request.method ?? 'UNKNOWN')
    apiKeys.push(String(request.headers.apikey ?? ''))
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Range': '0-0/0',
    })
    response.end('[]')
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Supabase test server did not bind a TCP port')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    methods,
    apiKeys,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    }),
  }
}
