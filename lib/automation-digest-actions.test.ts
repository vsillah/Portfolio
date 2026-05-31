import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildDigestActionsFromFiles,
  runDigestActionRouting,
  assertSafeDigestText,
} from './automation-digest-actions'

async function writeSummary(name: string, summary: Record<string, unknown>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'digest-actions-'))
  const filePath = path.join(dir, name)
  await writeFile(filePath, JSON.stringify(summary, null, 2))
  return filePath
}

const baseSummary = {
  automation_id: 'portfolio-operations-manager',
  automation_name: 'Portfolio Operations Manager',
  ran_at_utc: '2026-05-28T13:05:00Z',
  status: 'yellow',
  headline: 'Portfolio health green except n8n visibility',
  summary: 'Checks passed; n8n drift API still returns 403.',
  material_findings: [
    'n8n drift check still returns 403 for all tracked workflow pairs.',
  ],
  changed_files_or_links: [],
  blockers_or_approvals: [
    'Approval needed to refresh/re-scope n8n API credentials for drift visibility.',
    'Authenticated admin context needed for /api/admin/rag-health and Playwright smoke.',
  ],
  next_run_focus: [
    'Evaluate the 1 unevaluated production chat session if admin access is available.',
  ],
}

describe('automation digest action extraction', () => {
  it('maps n8n and authenticated-admin blockers to proposed work item actions', async () => {
    const filePath = await writeSummary('portfolio-ops.json', baseSummary)

    const result = await buildDigestActionsFromFiles({ summaryPaths: [filePath] })

    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'blocked_until_access',
        title: 'Prepare n8n drift access repair preflight',
        priority: 'high',
        ownerAgentKey: 'automation-systems',
        createWorkItem: true,
      }),
      expect.objectContaining({
        category: 'blocked_until_access',
        title: 'Prepare authenticated Portfolio admin QA checklist',
        priority: 'high',
        ownerAgentKey: 'chief-of-staff',
        createWorkItem: true,
      }),
    ]))
  })

  it('maps billing dashboard checks and thread-root repair to durable action categories', async () => {
    const orgPath = await writeSummary('codex-org.json', {
      ...baseSummary,
      automation_id: 'codex-project-organization-monitor',
      automation_name: 'Codex Project Organization Monitor',
      headline: 'Workspace roots aligned; thread-root drift remains',
      summary: 'Read-only audit found 25 active non-Portfolio thread roots.',
      blockers_or_approvals: ['State repair remains approval-gated; monitor stayed read-only.'],
      next_run_focus: ['If approved, back up Codex state before migrating thread roots.'],
    })
    const subscriptionPath = await writeSummary('subscriptions.json', {
      ...baseSummary,
      automation_id: 'portfolio-subscription-cancellation-monitor',
      automation_name: 'Portfolio Subscription Cancellation Monitor',
      headline: 'Subscription watch refreshed; no cancellation approval needed',
      summary: 'Active core services moved; quiet providers remain investigation-only.',
      blockers_or_approvals: [
        'No cancellation approval phrase was present.',
        'Dashboard checks still needed for Vapi, Printful, Resend, Pinecone, ElevenLabs, Calendly, and Gemini.',
      ],
      next_run_focus: ['Verify dashboard billing for quiet or auth-blocked vendors.'],
    })

    const result = await buildDigestActionsFromFiles({ summaryPaths: [orgPath, subscriptionPath] })

    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'needs_vambah_approval',
        title: 'Draft Codex thread-root repair decision packet',
      }),
      expect.objectContaining({
        category: 'agent_can_prepare',
        title: 'Prepare quiet-provider billing verification packet',
      }),
    ]))
  })

  it('keeps no-change corpus summaries watch-only and out of work item creation', async () => {
    const filePath = await writeSummary('corpus.json', {
      ...baseSummary,
      automation_id: 'personality-corpus-report-monitor',
      automation_name: 'Personality Corpus Report Monitor',
      status: 'no_change',
      headline: 'Personality corpus reports unchanged',
      summary: 'May 3 corpus snapshot still has no diffs, errors, or active alerts.',
      material_findings: [],
      blockers_or_approvals: [],
      next_run_focus: ['Watch for a new refresh snapshot.'],
    })

    const result = await runDigestActionRouting({ summaryPaths: [filePath], apply: false })

    expect(result.workItemCount).toBe(0)
    expect(result.watchOnlyCount).toBe(1)
    expect(result.results[0]).toEqual(expect.objectContaining({
      status: 'watch_only',
      workItemId: null,
    }))
  })

  it('uses deterministic idempotency keys when applying work items', async () => {
    const filePath = await writeSummary('portfolio-ops.json', baseSummary)
    const createWorkItem = vi.fn(async (input) => ({ id: `wi-${String(input.idempotencyKey).slice(-4)}` }))

    const first = await runDigestActionRouting({ summaryPaths: [filePath], apply: true, createWorkItem })
    const second = await runDigestActionRouting({ summaryPaths: [filePath], apply: true, createWorkItem })

    expect(first.results.map((result) => result.action.key)).toEqual(second.results.map((result) => result.action.key))
    expect(createWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      status: 'proposed',
      source: expect.objectContaining({ type: 'codex_automation_digest' }),
      idempotencyKey: expect.stringMatching(/^codex_automation_digest:2026-05-28:/),
      metadata: expect.objectContaining({
        automation_digest_action: true,
        privacy_boundary: 'sanitized_action_only',
      }),
    }))
  })

  it('keeps the checked-in synthetic digest fixtures aligned with expected actions', async () => {
    const fixtureDir = path.resolve(process.cwd(), 'docs/automation-digest-agent-ops-backlog-fixtures')
    const result = await runDigestActionRouting({
      summaryPaths: [
        path.join(fixtureDir, '2026-05-28-synthetic-actions-summary.json'),
        path.join(fixtureDir, '2026-05-28-synthetic-watch-summary.json'),
      ],
      apply: false,
    })

    expect(result.digestDate).toBe('2026-05-28')
    expect(result.summaryCount).toBe(2)
    expect(result.workItemCount).toBe(4)
    expect(result.watchOnlyCount).toBe(1)
    expect(result.results.map((item) => item.action.title)).toEqual(expect.arrayContaining([
      'Prepare n8n drift access repair preflight',
      'Prepare authenticated Portfolio admin QA checklist',
      'Draft Codex thread-root repair decision packet',
      'Prepare quiet-provider billing verification packet',
      'Personality corpus reports unchanged',
    ]))
  })

  it('rejects secret-looking values before Slack or work-item routing', () => {
    expect(() => assertSafeDigestText('token = sk-1234567890abcdef1234567890abcdef', 'test')).toThrow(
      /Unsafe automation digest content/,
    )
  })
})
