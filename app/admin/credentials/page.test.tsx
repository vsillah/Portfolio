import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_NAV } from '@/lib/admin-nav'
import CredentialAdminPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const baseReport = {
  generatedAt: '2026-05-09T12:00:00.000Z',
  env: 'staging',
  asOf: '2026-05-09',
  sourceBoundary: 'Infisical for runtime/API secrets; 1Password for human logins.',
  providerContext: {
    infisicalProject: 'portfolio',
    infisicalPath: '/portfolio',
    onePasswordVault: 'Portfolio / staging',
  },
  summary: {
    total: 2,
    ok: 0,
    due: 0,
    needsBaseline: 2,
    approvalRequired: 0,
    providerConfirmed: 0,
    providerPending: 2,
  },
  sinkPresenceSummary: {
    present: 1,
    missing: 0,
    unknown: 1,
    unavailable: 0,
  },
  bySource: { infisical: 1, '1password': 1 },
  byRisk: { 'standard-api': 1, 'oauth-session': 1 },
  byRuntimeSink: { Vercel: 1, 'local-env': 1 },
  packetSummary: {
    total: 1,
    drafted: 1,
    synced: 0,
    verified: 0,
    revocationPending: 0,
    blocked: 0,
    latestCreatedAt: '2026-05-09T12:00:00.000Z',
  },
  packets: [
    {
      createdAt: '2026-05-09T12:00:00.000Z',
      type: 'rotation',
      envVar: 'OPENAI_API_KEY',
      status: 'drafted',
      approvalRequired: false,
      localEnvUpdated: false,
    },
  ],
  sinkGapActions: [
    {
      secretId: 'openai-api-key',
      envVar: 'OPENAI_API_KEY',
      sink: 'Vercel',
      status: 'unknown',
      action: 'Add a key-only metadata adapter or approved sanitized evidence path for Vercel.',
      evidence: 'Runtime sink was not checked for this report.',
    },
  ],
  blockers: ['2 staging secrets need provider-confirmed rotation baselines.'],
  rows: [
    {
      id: 'openai-api-key',
      envVar: 'OPENAI_API_KEY',
      displayName: 'OpenAI API key',
      risk: 'standard-api',
      sourceOfTruth: 'infisical',
      cadenceDays: 90,
      approvalRequired: false,
      baselineStatus: 'pending-provider-confirmation',
      lastRotatedAt: null,
      dueAt: null,
      status: 'needs-baseline',
      sinkPresence: [
        {
          sink: 'Vercel',
          status: 'unknown',
          evidence: 'Runtime sink was not checked for this report.',
          checkedAt: 'not-checked',
        },
      ],
      sinkPresenceSummary: {
        present: 0,
        missing: 0,
        unknown: 1,
        unavailable: 0,
      },
      nextAction: 'Confirm provider history and record lastRotatedAt evidence.',
    },
    {
      id: 'linkedin-cookie',
      envVar: 'LINKEDIN_COOKIE',
      displayName: 'LinkedIn browser session',
      risk: 'oauth-session',
      sourceOfTruth: '1password',
      cadenceDays: 365,
      approvalRequired: false,
      baselineStatus: 'pending-provider-confirmation',
      lastRotatedAt: null,
      dueAt: null,
      status: 'needs-baseline',
      sinkPresence: [
        {
          sink: 'local-env',
          status: 'present',
          evidence: 'Found key name in local env file: .env.staging.',
          checkedAt: '2026-05-09T12:00:00.000Z',
        },
      ],
      sinkPresenceSummary: {
        present: 1,
        missing: 0,
        unknown: 0,
        unavailable: 0,
      },
      nextAction: 'Confirm provider history and record lastRotatedAt evidence.',
    },
  ],
}

describe('CredentialAdminPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const env = url.includes('env=prod') ? 'prod' : 'staging'
      return {
        ok: true,
        json: async () => ({
          ...baseReport,
          env,
          providerContext: {
            ...baseReport.providerContext,
            onePasswordVault: env === 'prod' ? 'Portfolio / prod' : 'Portfolio / staging',
          },
        }),
      }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders credential posture without exposing secret values', async () => {
    render(<CredentialAdminPage />)

    expect(await screen.findByRole('heading', { name: 'Credential Reporting' })).toBeInTheDocument()
    expect(screen.getByText('Baseline needed')).toBeInTheDocument()
    expect(screen.getByText('2 need baseline / 0 due / 0 ok')).toBeInTheDocument()
    expect(screen.getAllByText('OPENAI_API_KEY').length).toBeGreaterThan(0)
    expect(screen.getByText('LINKEDIN_COOKIE')).toBeInTheDocument()
    expect(screen.getByText('Rotation packets')).toBeInTheDocument()
    expect(screen.getByText('Runtime sink presence')).toBeInTheDocument()
    expect(screen.getByText('Runtime sink gap actions')).toBeInTheDocument()
    expect(screen.getByText('Add a key-only metadata adapter or approved sanitized evidence path for Vercel.')).toBeInTheDocument()
    expect(screen.getByText('local-env: present')).toBeInTheDocument()
    expect(screen.getByText('Vercel: unknown')).toBeInTheDocument()
    expect(screen.getByText('Drafted')).toBeInTheDocument()
    expect(screen.queryByText('super-secret-value')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/credentials/report?env=staging', {
        headers: { Authorization: 'Bearer admin-token' },
      })
    })
  })

  it('reloads the selected environment', async () => {
    render(<CredentialAdminPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'prod' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/credentials/report?env=prod', {
        headers: { Authorization: 'Bearer admin-token' },
      })
    })
    expect(await screen.findByText('Portfolio / prod')).toBeInTheDocument()
  })

  it('is linked from Configuration admin navigation', () => {
    const configurationCategory = ADMIN_NAV.categories.find((category) => category.label === 'Configuration')

    expect(configurationCategory?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Credential Reporting',
          href: '/admin/credentials',
        }),
      ])
    )
  })
})
