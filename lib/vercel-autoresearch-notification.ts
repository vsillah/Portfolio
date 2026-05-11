import type { VercelResearchProposal } from './vercel-deployment-research'

export type VercelResearchApprovalNotificationInput = {
  approvalId: string
  runId: string
  workItemId: string
  proposal: VercelResearchProposal
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PORTFOLIO_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://amadutown.com'
  ).replace(/\/$/, '')
}

export function buildVercelResearchApprovalUrl(input: Pick<VercelResearchApprovalNotificationInput, 'runId'>) {
  return `${baseUrl()}/admin/agents/coordination?approvalRunId=${encodeURIComponent(input.runId)}`
}

export function buildVercelResearchApprovalSlackText(input: VercelResearchApprovalNotificationInput) {
  const proposal = input.proposal
  const url = buildVercelResearchApprovalUrl(input)
  return [
    '*Vercel AutoResearch proposal ready for approval*',
    `*Proposal:* ${proposal.title}`,
    `*Risk:* ${proposal.riskLevel}`,
    `*Approval:* ${proposal.approvalQuestion}`,
    `*Expected impact:* ${proposal.expectedImpact}`,
    `*Work item:* ${input.workItemId}`,
    `*Approve / reject:* ${url}`,
  ].join('\n')
}

export async function notifyVercelResearchApprovalReady(
  input: VercelResearchApprovalNotificationInput,
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_AGENT_OPS_WEBHOOK_URL
  if (!webhookUrl || !webhookUrl.startsWith('https://')) return false

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: buildVercelResearchApprovalSlackText(input) }),
    })
    if (!response.ok) {
      console.warn('[vercel-autoresearch-notification] Slack webhook failed:', response.status)
      return false
    }
    return true
  } catch (error) {
    console.warn(
      '[vercel-autoresearch-notification] Slack webhook error:',
      error instanceof Error ? error.message : error,
    )
    return false
  }
}
