import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildVercelResearchApprovalSlackText,
  buildVercelResearchApprovalUrl,
  notifyVercelResearchApprovalReady,
} from './vercel-autoresearch-notification'
import type { VercelResearchProposal } from './vercel-deployment-research'

const proposal: VercelResearchProposal = {
  id: 'next-build-profile',
  title: 'Profile the Next.js build path',
  hypothesis: 'Build profiling can identify the slowest local step.',
  expectedImpact: 'Lower build investigation time.',
  scorecardBaseline: {
    project: 'portfolio',
    target: 'preview',
    queueSeconds: 10,
    buildSeconds: 300,
    totalSeconds: 310,
  },
  touchedFiles: ['package.json'],
  touchedSettings: [],
  riskLevel: 'low',
  approvalState: 'not_required',
  approvalQuestion: 'Approve the build profile experiment?',
  rollbackPath: 'Discard the branch.',
  evidence: ['build=5m00s'],
}

describe('Vercel AutoResearch Slack notifications', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('builds a direct Agent Coordination approval URL and Slack message', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://portfolio.example.com/')

    expect(buildVercelResearchApprovalUrl({ runId: 'run-1' })).toBe(
      'https://portfolio.example.com/admin/agents/coordination?approvalRunId=run-1'
    )
    expect(buildVercelResearchApprovalSlackText({
      approvalId: 'approval-1',
      runId: 'run-1',
      workItemId: 'work-1',
      proposal,
    })).toContain('*Proposal:* Profile the Next.js build path')
  })

  it('skips safely when Slack Agent Ops webhook is not configured', async () => {
    await expect(notifyVercelResearchApprovalReady({
      approvalId: 'approval-1',
      runId: 'run-1',
      workItemId: 'work-1',
      proposal,
    })).resolves.toBe(false)
  })

  it('sends to the Slack Agent Ops webhook when configured', async () => {
    vi.stubEnv('SLACK_AGENT_OPS_WEBHOOK_URL', 'https://hooks.slack.test/agent-ops')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await expect(notifyVercelResearchApprovalReady({
      approvalId: 'approval-1',
      runId: 'run-1',
      workItemId: 'work-1',
      proposal,
    })).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.test/agent-ops',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Profile the Next.js build path'),
      })
    )
  })
})
