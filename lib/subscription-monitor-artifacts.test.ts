import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function latestAuditSection(audit: string) {
  const match = audit.match(/## 2026-06-03 Daily Monitor Run[\s\S]*?(?=\n## \d{4}-\d{2}-\d{2} |\n*$)/)
  return match?.[0] ?? ''
}

describe('subscription monitor artifact contract', () => {
  it('keeps the latest main audit entry compact and linked to its dated artifact', () => {
    const audit = readRepoFile('docs/subscription-cancellation-audit.md')
    const section = latestAuditSection(audit)

    expect(section).toContain('Detailed run artifact:')
    expect(section).toContain('subscription-monitor-runs/2026-06-03.md')
    expect(section).toContain('Summary:')
    expect(section).not.toContain('Raw Findings')
    expect(section).not.toContain('Discovered Subscription Inventory')
    expect(section).not.toContain('Inactive-For-Two-Sessions Evidence')
  })

  it('preserves the detailed latest run in the dated artifact directory', () => {
    const artifactPath = 'docs/subscription-monitor-runs/2026-06-03.md'
    const artifact = readRepoFile(artifactPath)

    expect(existsSync(join(repoRoot, artifactPath))).toBe(true)
    expect(artifact).toContain('# 2026-06-03 Subscription Monitor Run')
    expect(artifact).toContain('Raw Findings')
    expect(artifact).toContain('Discovered Subscription Inventory')
    expect(artifact).toContain('Candidate Cancellations')
  })

  it('documents the future-run output contract in the automation runbook', () => {
    const runbook = readRepoFile('docs/automations/portfolio-subscription-cancellation-monitor.md')

    expect(runbook).toContain('docs/subscription-monitor-runs/YYYY-MM-DD.md')
    expect(runbook).toContain('Do not paste another full monitor report into `docs/subscription-cancellation-audit.md`')
    expect(runbook).toContain('latestMonitorArtifact')
  })
})
