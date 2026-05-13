import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('node:fs/promises', () => ({
  readdir: mocks.readdir,
  readFile: mocks.readFile,
  default: { readdir: mocks.readdir, readFile: mocks.readFile },
}))

import { GET } from './route'

function request(url = 'http://localhost/api/admin/credentials/report?env=staging') {
  return new Request(url, {
    headers: { authorization: 'Bearer token' },
  })
}

const inventory = {
  schemaVersion: 1,
  policy: {
    sourceOfTruth: 'Infisical for runtime/API secrets; 1Password for human logins.',
    runtimeSinks: ['Vercel', 'n8n'],
    agentAuthority: 'Scoped read/run by default.',
    defaultCadenceDays: { 'standard-api': 90 },
  },
  providers: {
    infisical: {
      projectSlug: 'portfolio',
      secretPath: '/portfolio',
      envMap: { dev: 'dev', staging: 'staging', prod: 'prod' },
    },
    onepassword: {
      vaults: {
        dev: 'Portfolio / dev',
        staging: 'Portfolio / staging',
        prod: 'Portfolio / prod',
      },
    },
  },
  secrets: [
    {
      id: 'openai-api-key',
      envVar: 'OPENAI_API_KEY',
      displayName: 'OpenAI API key',
      category: 'llm',
      risk: 'standard-api',
      sourceOfTruth: 'infisical',
      rotationMode: 'provider-dashboard-or-api',
      rotationCadenceDays: 90,
      environments: ['staging'],
      runtimeSinks: ['Vercel'],
      verification: ['npm run credentials:smoke -- --env {env}'],
      rollback: 'Restore previous key.',
      baseline: {
        staging: {
          status: 'pending-provider-confirmation',
          lastRotatedAt: null,
          evidence: 'Pending provider confirmation.',
          updatedAt: '2026-05-01',
        },
      },
    },
  ],
}

describe('GET /api/admin/credentials/report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.readdir.mockResolvedValue(['2026-05-09-staging-openai-api-key-rotation.json'])
    mocks.readFile.mockImplementation(async (file: string) => {
      if (file.includes('.credential-rotation-audits')) {
        return JSON.stringify({
          createdAt: '2026-05-09T12:00:00.000Z',
          type: 'rotation',
          environment: 'staging',
          secretId: 'openai-api-key',
          envVar: 'OPENAI_API_KEY',
          sourceOfTruth: 'infisical',
          rotationMode: 'provider-dashboard-or-api',
          cadenceDays: 90,
          runtimeSinks: ['Vercel'],
          approvalRequired: false,
          generatedFingerprint: null,
          action: 'Provider-backed rotation required.',
          verification: ['npm run credentials:smoke -- --env staging'],
          rollback: 'Restore previous key.',
        })
      }
      return JSON.stringify(inventory)
    })
  })

  it('requires admin auth before reading the inventory', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.readFile).not.toHaveBeenCalled()
  })

  it('returns a credential report for the requested environment', async () => {
    const response = await GET(request('http://localhost/api/admin/credentials/report?env=staging&asOf=2026-05-09') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      env: 'staging',
      asOf: '2026-05-09',
      summary: {
        total: 1,
        needsBaseline: 1,
      },
      providerContext: {
        infisicalProject: 'portfolio',
        onePasswordVault: 'Portfolio / staging',
      },
      packetSummary: {
        total: 1,
        drafted: 1,
      },
    })
    expect(body.rows[0]).toMatchObject({
      envVar: 'OPENAI_API_KEY',
      status: 'needs-baseline',
    })
  })

  it('rejects invalid environments', async () => {
    const response = await GET(request('http://localhost/api/admin/credentials/report?env=qa') as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid env. Expected dev, staging, or prod.' })
  })
})
