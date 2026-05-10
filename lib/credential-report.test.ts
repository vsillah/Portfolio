import { describe, expect, it, vi } from 'vitest'
import {
  buildCredentialBaselineTemplate,
  buildCredentialReport,
  renderCredentialBaselineTemplateMarkdown,
  renderCredentialReportMarkdown,
  type CredentialInventory,
} from './credential-report'

const inventory: CredentialInventory = {
  schemaVersion: 1,
  policy: {
    sourceOfTruth: 'Infisical for runtime/API secrets; 1Password for human logins.',
    runtimeSinks: ['Vercel', 'n8n', 'local-env'],
    agentAuthority: 'Scoped read/run by default.',
    defaultCadenceDays: {
      'critical-production': 30,
      'standard-api': 90,
    },
  },
  providers: {
    infisical: {
      projectSlug: 'portfolio',
      projectId: 'project-id',
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
      id: 'due-secret',
      envVar: 'DUE_SECRET',
      displayName: 'Due secret',
      category: 'api',
      risk: 'standard-api',
      sourceOfTruth: 'infisical',
      rotationMode: 'provider-dashboard-or-api',
      rotationCadenceDays: 30,
      environments: ['staging', 'prod'],
      runtimeSinks: ['Vercel', 'n8n'],
      verification: ['npm run credentials:smoke -- --env {env}'],
      rollback: 'Restore previous value.',
      approvalRequired: ['prod'],
      baseline: {
        staging: {
          status: 'confirmed',
          lastRotatedAt: '2026-03-01',
          evidence: 'Infisical audit log',
          updatedAt: '2026-03-01',
        },
      },
    },
    {
      id: 'missing-baseline',
      envVar: 'MISSING_BASELINE',
      displayName: 'Missing baseline',
      category: 'login',
      risk: 'critical-production',
      sourceOfTruth: '1password',
      rotationMode: 'manual-reauth',
      rotationCadenceDays: 90,
      environments: ['staging'],
      runtimeSinks: ['local-env'],
      verification: ['Manual login check'],
      rollback: 'Re-authenticate.',
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

describe('credential report', () => {
  it('summarizes due and missing-baseline credential visibility without secret values', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-09T12:00:00.000Z'))

    const report = buildCredentialReport(inventory, 'staging', '2026-05-09')

    expect(report.summary).toMatchObject({
      total: 2,
      ok: 0,
      due: 1,
      needsBaseline: 1,
      approvalRequired: 0,
      providerConfirmed: 1,
      providerPending: 1,
    })
    expect(report.providerContext).toEqual({
      infisicalProject: 'portfolio',
      infisicalPath: '/portfolio',
      onePasswordVault: 'Portfolio / staging',
    })
    expect(report.bySource).toEqual({ infisical: 1, '1password': 1 })
    expect(report.blockers).toEqual([
      '1 staging secrets need provider-confirmed rotation baselines.',
      '1 staging secrets are due for rotation.',
    ])
    expect(report.rows.map((row) => row.envVar)).toEqual(['DUE_SECRET', 'MISSING_BASELINE'])

    const markdown = renderCredentialReportMarkdown(report)
    expect(markdown).toContain('Credential Rotation Visibility (staging)')
    expect(markdown).toContain('DUE_SECRET')
    expect(markdown).not.toContain('super-secret')

    vi.useRealTimers()
  })

  it('builds a provider-confirmation template for missing baselines', () => {
    const entries = buildCredentialBaselineTemplate(inventory, 'staging', '2026-05-09')

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      secretId: 'missing-baseline',
      envVar: 'MISSING_BASELINE',
      sourceOfTruth: '1password',
      baseline: {
        status: 'pending-provider-confirmation',
        lastRotatedAt: null,
        updatedAt: '2026-05-09',
      },
    })
    expect(entries[0].baseline.evidence).toContain('TODO: Confirm MISSING_BASELINE staging rotation date')

    const markdown = renderCredentialBaselineTemplateMarkdown('staging', entries)
    expect(markdown).toContain('Credential Baseline Template (staging)')
    expect(markdown).toContain('MISSING_BASELINE')
    expect(markdown).not.toContain('super-secret')
  })
})
