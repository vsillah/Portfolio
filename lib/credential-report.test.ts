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

    const report = buildCredentialReport(inventory, 'staging', '2026-05-09', [
      {
        createdAt: '2026-05-08T12:00:00.000Z',
        type: 'rotation',
        environment: 'staging',
        secretId: 'missing-baseline',
        envVar: 'MISSING_BASELINE',
        sourceOfTruth: '1password',
        rotationMode: 'manual-reauth',
        cadenceDays: 90,
        runtimeSinks: ['local-env'],
        approvalRequired: false,
        generatedFingerprint: null,
        action: 'Generated replacement value and wrote it to the requested ignored local env sink.',
        verification: ['Manual login check'],
        rollback: 'Re-authenticate.',
        localEnvUpdated: '.env.staging',
      },
    ])

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
    expect(report.packetSummary).toMatchObject({
      total: 1,
      synced: 1,
      latestCreatedAt: '2026-05-08T12:00:00.000Z',
    })
    expect(report.sinkPresenceSummary).toEqual({
      present: 0,
      missing: 0,
      unknown: 3,
      unavailable: 0,
    })
    expect(report.packets[0]).toMatchObject({
      envVar: 'MISSING_BASELINE',
      status: 'synced',
      localEnvUpdated: true,
    })
    expect(report.blockers).toEqual([
      '1 staging secrets need provider-confirmed rotation baselines.',
      '1 staging secrets are due for rotation.',
    ])
    expect(report.rows.map((row) => row.envVar)).toEqual(['DUE_SECRET', 'MISSING_BASELINE'])

    const markdown = renderCredentialReportMarkdown(report)
    expect(markdown).toContain('Credential Rotation Visibility (staging)')
    expect(markdown).toContain('Rotation Packets')
    expect(markdown).toContain('Runtime Sink Presence')
    expect(markdown).toContain('DUE_SECRET')
    expect(markdown).not.toContain('super-secret')

    vi.useRealTimers()
  })

  it('merges value-free runtime sink presence observations into report rows', () => {
    const report = buildCredentialReport(inventory, 'staging', '2026-05-09', [], [
      {
        secretId: 'missing-baseline',
        envVar: 'MISSING_BASELINE',
        sink: 'local-env',
        status: 'present',
        evidence: 'Found key name in local env file: .env.staging.',
        checkedAt: '2026-05-09T12:00:00.000Z',
      },
      {
        secretId: 'due-secret',
        envVar: 'DUE_SECRET',
        sink: 'Vercel',
        status: 'missing',
        evidence: 'Key name was not listed by Vercel metadata.',
        checkedAt: '2026-05-09T12:00:00.000Z',
      },
    ])

    expect(report.sinkPresenceSummary).toEqual({
      present: 1,
      missing: 1,
      unknown: 1,
      unavailable: 0,
    })
    expect(report.rows.find((row) => row.envVar === 'MISSING_BASELINE')?.sinkPresence).toEqual([
      expect.objectContaining({
        sink: 'local-env',
        status: 'present',
      }),
    ])
    expect(JSON.stringify(report)).not.toContain('super-secret')
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
