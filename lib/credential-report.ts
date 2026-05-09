export type CredentialEnvironment = 'dev' | 'staging' | 'prod'
export type CredentialSourceOfTruth = 'infisical' | '1password'

export type CredentialBaselineStatus = 'pending-provider-confirmation' | 'confirmed' | 'unknown'

export type CredentialBaseline = {
  status: CredentialBaselineStatus
  lastRotatedAt: string | null
  evidence: string
  updatedAt: string
}

export type CredentialSecret = {
  id: string
  envVar: string
  displayName: string
  category: string
  risk: string
  sourceOfTruth: CredentialSourceOfTruth
  rotationMode: string
  rotationCadenceDays: number
  environments: CredentialEnvironment[]
  runtimeSinks: string[]
  verification: string[]
  rollback: string
  approvalRequired?: CredentialEnvironment[]
  baseline?: Partial<Record<CredentialEnvironment, CredentialBaseline>>
  lastRotatedAt?: Partial<Record<CredentialEnvironment, string>>
}

export type CredentialInventory = {
  schemaVersion: number
  policy: {
    sourceOfTruth: string
    runtimeSinks: string[]
    agentAuthority: string
    defaultCadenceDays: Record<string, number>
  }
  providers: {
    infisical: {
      projectSlug: string
      projectId?: string
      secretPath: string
      envMap: Record<CredentialEnvironment, string>
    }
    onepassword: {
      vaults: Record<CredentialEnvironment, string>
    }
  }
  secrets: CredentialSecret[]
}

export type CredentialReportRow = {
  id: string
  envVar: string
  displayName: string
  category: string
  risk: string
  sourceOfTruth: CredentialSourceOfTruth
  rotationMode: string
  cadenceDays: number
  runtimeSinks: string[]
  approvalRequired: boolean
  baselineStatus: CredentialBaselineStatus
  baselineEvidence: string
  lastRotatedAt: string | null
  dueAt: string | null
  daysUntilDue: number | null
  status: 'needs-baseline' | 'due' | 'ok'
  nextAction: string
}

export type CredentialReport = {
  generatedAt: string
  env: CredentialEnvironment
  asOf: string
  sourceBoundary: string
  runtimeSinks: string[]
  providerContext: {
    infisicalProject: string
    infisicalPath: string
    onePasswordVault: string
  }
  summary: {
    total: number
    ok: number
    due: number
    needsBaseline: number
    approvalRequired: number
    providerConfirmed: number
    providerPending: number
  }
  bySource: Record<CredentialSourceOfTruth, number>
  byRisk: Record<string, number>
  byRuntimeSink: Record<string, number>
  blockers: string[]
  rows: CredentialReportRow[]
}

export const CREDENTIAL_ENVS: CredentialEnvironment[] = ['dev', 'staging', 'prod']

export function isCredentialEnvironment(value: string): value is CredentialEnvironment {
  return CREDENTIAL_ENVS.includes(value as CredentialEnvironment)
}

export function buildCredentialReport(
  inventory: CredentialInventory,
  env: CredentialEnvironment,
  asOfInput: string | Date = new Date()
): CredentialReport {
  const asOfDate = asDate(asOfInput)
  const rows = inventory.secrets
    .filter((secret) => secret.environments.includes(env))
    .map((secret) => buildReportRow(secret, env, asOfDate))
    .sort((a, b) => {
      const statusOrder = { due: 0, 'needs-baseline': 1, ok: 2 }
      const statusDelta = statusOrder[a.status] - statusOrder[b.status]
      if (statusDelta !== 0) return statusDelta
      return a.envVar.localeCompare(b.envVar)
    })

  const summary = {
    total: rows.length,
    ok: rows.filter((row) => row.status === 'ok').length,
    due: rows.filter((row) => row.status === 'due').length,
    needsBaseline: rows.filter((row) => row.status === 'needs-baseline').length,
    approvalRequired: rows.filter((row) => row.approvalRequired).length,
    providerConfirmed: rows.filter((row) => row.baselineStatus === 'confirmed').length,
    providerPending: rows.filter((row) => row.baselineStatus !== 'confirmed').length,
  }

  return {
    generatedAt: new Date().toISOString(),
    env,
    asOf: dateOnly(asOfDate),
    sourceBoundary: inventory.policy.sourceOfTruth,
    runtimeSinks: inventory.policy.runtimeSinks,
    providerContext: {
      infisicalProject: inventory.providers.infisical.projectSlug,
      infisicalPath: inventory.providers.infisical.secretPath,
      onePasswordVault: inventory.providers.onepassword.vaults[env],
    },
    summary,
    bySource: countBy(rows, (row) => row.sourceOfTruth),
    byRisk: countBy(rows, (row) => row.risk),
    byRuntimeSink: countRuntimeSinks(rows),
    blockers: buildBlockers(summary, env),
    rows,
  }
}

export function renderCredentialReportMarkdown(report: CredentialReport): string {
  const lines = [
    `# Credential Rotation Visibility (${report.env})`,
    '',
    `Generated: ${report.generatedAt}`,
    `As of: ${report.asOf}`,
    '',
    '## Summary',
    '',
    `- Total tracked secrets: ${report.summary.total}`,
    `- OK: ${report.summary.ok}`,
    `- Due: ${report.summary.due}`,
    `- Missing provider-confirmed baseline: ${report.summary.needsBaseline}`,
    `- Approval-gated in this environment: ${report.summary.approvalRequired}`,
    '',
    '## Provider Context',
    '',
    `- Infisical project/path: ${report.providerContext.infisicalProject}:${report.providerContext.infisicalPath}`,
    `- 1Password vault: ${report.providerContext.onePasswordVault}`,
    `- Source boundary: ${report.sourceBoundary}`,
    '',
    '## Blockers',
    '',
    ...(report.blockers.length > 0 ? report.blockers.map((blocker) => `- ${blocker}`) : ['- None']),
    '',
    '## Secrets',
    '',
    '| Status | Env Var | Source | Risk | Due | Baseline | Next action |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.rows.map((row) => [
      row.status,
      row.envVar,
      row.sourceOfTruth,
      row.risk,
      row.dueAt ?? 'unknown',
      row.baselineStatus,
      row.nextAction,
    ].map(escapeTableCell).join(' | ')).map((line) => `| ${line} |`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

function buildReportRow(secret: CredentialSecret, env: CredentialEnvironment, asOfDate: Date): CredentialReportRow {
  const baseline = getBaseline(secret, env)
  const lastRotatedAt = baseline.lastRotatedAt
  const dueDate = lastRotatedAt ? addDays(new Date(lastRotatedAt), secret.rotationCadenceDays) : null
  const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - asOfDate.getTime()) / 86_400_000) : null
  const status = !lastRotatedAt ? 'needs-baseline' : dueDate && dueDate <= asOfDate ? 'due' : 'ok'

  return {
    id: secret.id,
    envVar: secret.envVar,
    displayName: secret.displayName,
    category: secret.category,
    risk: secret.risk,
    sourceOfTruth: secret.sourceOfTruth,
    rotationMode: secret.rotationMode,
    cadenceDays: secret.rotationCadenceDays,
    runtimeSinks: secret.runtimeSinks,
    approvalRequired: secret.approvalRequired?.includes(env) ?? false,
    baselineStatus: baseline.status,
    baselineEvidence: baseline.evidence,
    lastRotatedAt,
    dueAt: dueDate ? dateOnly(dueDate) : null,
    daysUntilDue,
    status,
    nextAction: nextAction(status, baseline.status, secret.approvalRequired?.includes(env) ?? false),
  }
}

function getBaseline(secret: CredentialSecret, env: CredentialEnvironment): CredentialBaseline {
  const explicit = secret.baseline?.[env]
  if (explicit) return explicit
  return {
    status: secret.lastRotatedAt?.[env] ? 'confirmed' : 'unknown',
    lastRotatedAt: secret.lastRotatedAt?.[env] ?? null,
    evidence: secret.lastRotatedAt?.[env] ? 'legacy lastRotatedAt field' : 'baseline not recorded',
    updatedAt: 'unknown',
  }
}

function nextAction(status: CredentialReportRow['status'], baselineStatus: CredentialBaselineStatus, approvalRequired: boolean): string {
  if (status === 'needs-baseline') return 'Confirm provider history and record lastRotatedAt evidence.'
  if (approvalRequired) return 'Prepare approval packet before rotation or revocation.'
  if (status === 'due') return 'Run staged rotation packet and smoke checks.'
  if (baselineStatus !== 'confirmed') return 'Upgrade baseline evidence to provider-confirmed.'
  return 'No action needed.'
}

function buildBlockers(summary: CredentialReport['summary'], env: CredentialEnvironment): string[] {
  const blockers: string[] = []
  if (summary.needsBaseline > 0) blockers.push(`${summary.needsBaseline} ${env} secrets need provider-confirmed rotation baselines.`)
  if (summary.due > 0) blockers.push(`${summary.due} ${env} secrets are due for rotation.`)
  if (env === 'prod' && summary.approvalRequired > 0) blockers.push('Production rotation or revocation requires an approval packet.')
  return blockers
}

function countBy<T extends string>(rows: CredentialReportRow[], key: (row: CredentialReportRow) => T): Record<T, number> {
  return rows.reduce((acc, row) => {
    const value = key(row)
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {} as Record<T, number>)
}

function countRuntimeSinks(rows: CredentialReportRow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    for (const sink of row.runtimeSinks) counts[sink] = (counts[sink] ?? 0) + 1
  }
  return counts
}

function asDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid report date: ${String(value)}`)
  return date
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|')
}
