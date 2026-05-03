import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  listCodexAutomationInventory,
  parseAutomationToml,
} from './codex-automation-inventory'

let tempRoot: string | null = null

async function writeAutomation(id: string, body: string) {
  if (!tempRoot) tempRoot = await mkdtemp(path.join(tmpdir(), 'codex-automations-'))
  const dir = path.join(tempRoot, id)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'automation.toml'), body)
}

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true })
    tempRoot = null
  }
})

describe('parseAutomationToml', () => {
  it('parses the current Codex automation TOML shape', () => {
    const parsed = parseAutomationToml(`
version = 1
id = "portfolio-operations-manager"
kind = "cron"
name = "Portfolio Operations Manager"
prompt = "Run a daily Portfolio report.\\nDo not change production."
status = "ACTIVE"
rrule = "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0"
model = "gpt-5.5"
reasoning_effort = "high"
execution_environment = "local"
cwds = ["/Users/vambahsillah/Projects/Portfolio", "/Users/vambahsillah/Documents"]
created_at = 1777635786167
updated_at = 1777636249936
`)

    expect(parsed).toEqual(expect.objectContaining({
      id: 'portfolio-operations-manager',
      kind: 'cron',
      name: 'Portfolio Operations Manager',
      status: 'ACTIVE',
      rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0',
      reasoning_effort: 'high',
      execution_environment: 'local',
      cwds: ['/Users/vambahsillah/Projects/Portfolio', '/Users/vambahsillah/Documents'],
      created_at: 1777635786167,
    }))
    expect(parsed.prompt).toContain('\nDo not change production.')
  })
})
describe('listCodexAutomationInventory', () => {
  it('returns unavailable when the local Codex automation directory is missing', async () => {
    const inventory = await listCodexAutomationInventory('/definitely/not/a/codex/automation/root')

    expect(inventory.available).toBe(false)
    expect(inventory.automations).toEqual([])
    expect(inventory.reason).toContain('not available')
  })

  it('includes Portfolio automations and hides personal automations by default', async () => {
    await writeAutomation('portfolio-operations-manager', `
id = "portfolio-operations-manager"
kind = "cron"
name = "Portfolio Operations Manager"
prompt = "Use docs/portfolio-operations-manager.md. Run daily Portfolio health checks. Do not change production settings. Report failures and approval packets."
status = "ACTIVE"
rrule = "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0"
model = "gpt-5.5"
reasoning_effort = "high"
execution_environment = "local"
cwds = ["/Users/vambahsillah/Projects/Portfolio"]
created_at = 1
updated_at = 2
`)
    await writeAutomation('personal-reminder', `
id = "personal-reminder"
kind = "cron"
name = "Personal Reminder"
prompt = "Remind me to drink water."
status = "ACTIVE"
rrule = "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0"
cwds = ["/Users/vambahsillah"]
`)

    const inventory = await listCodexAutomationInventory(tempRoot!)

    expect(inventory.available).toBe(true)
    expect(inventory.hiddenCount).toBe(1)
    expect(inventory.automations).toHaveLength(1)
    expect(inventory.automations[0]).toEqual(expect.objectContaining({
      id: 'portfolio-operations-manager',
      category: 'Operations',
      portfolioRelated: true,
      riskLevel: 'high',
      managementBoundary: 'approval-required',
    }))
    expect(inventory.automations[0].controlDocs).toContain('docs/portfolio-operations-manager.md')
    expect(inventory.automations[0].contextQuestions.every((question) => question.answered)).toBe(true)
  })

  it('marks unanswered context-readiness questions without generating answers', async () => {
    await writeAutomation('portfolio-thin-monitor', `
id = "portfolio-thin-monitor"
kind = "cron"
name = "Portfolio Thin Monitor"
prompt = "Check Portfolio."
status = "ACTIVE"
rrule = "FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=8;BYMINUTE=0;BYSECOND=0"
cwds = ["/Users/vambahsillah/Projects/Portfolio"]
`)

    const inventory = await listCodexAutomationInventory(tempRoot!)
    const automation = inventory.automations[0]
    const unanswered = automation.contextQuestions.filter((question) => !question.answered)

    expect(automation.contextHealth).toBe('red')
    expect(unanswered.map((question) => question.id)).toEqual(expect.arrayContaining([
      'decision',
      'boundary',
      'outputs',
      'escalation',
      'governance',
    ]))
    expect(unanswered.find((question) => question.id === 'boundary')?.answer).toBeNull()
    expect(unanswered.find((question) => question.id === 'boundary')?.recommendation).toContain('authority boundary')
  })

  it('flags duplicate credential rotation jobs and sanitizes prompt excerpts', async () => {
    for (const id of ['portfolio-credential-rotation-due-report', 'portfolio-credential-rotation-due-report-2']) {
      await writeAutomation(id, `
id = "${id}"
kind = "cron"
name = "Portfolio Credential Rotation Due Report"
prompt = "Run Portfolio credential checks with API_KEY=super-secret-value. Do not rotate, revoke, or expose secret values. Produce an approval packet."
status = "ACTIVE"
rrule = "FREQ=WEEKLY;BYDAY=MO;BYHOUR=8;BYMINUTE=30;BYSECOND=0"
model = "gpt-5.5"
reasoning_effort = "high"
execution_environment = "local"
cwds = ["/Users/vambahsillah/Projects/Portfolio"]
`)
    }

    const inventory = await listCodexAutomationInventory(tempRoot!)

    expect(inventory.automations).toHaveLength(2)
    expect(inventory.overview.duplicateCandidates).toBe(2)
    expect(inventory.automations.every((automation) => automation.duplicateCandidate)).toBe(true)
    expect(inventory.automations[0].promptExcerpt).not.toContain('super-secret-value')
    expect(inventory.automations[0].category).toBe('Credentials')
  })
})
