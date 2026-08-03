import visualStrategyQaReport from '@/docs/agentified-visual-qa/agentified-visual-strategy-qa-2026-07-31.json'

export type AgentifiedVisualQaFinding = {
  gate: string
  result: 'pass' | 'blocked'
  finding: string
}

export type AgentifiedVisualStrategy = {
  assetId: string
  socialContentId: string
  priority: 'P0' | 'P1'
  format: 'single_image' | 'carousel'
  recommendation: string
  selectedForm: string
  sourceAsset: string
  supportAssets: string[]
  researchPattern: string
  rationale: string
  altText: string
  candidateSlug: string
  candidatePaths: string[]
  qaFindings: AgentifiedVisualQaFinding[]
}

type AgentifiedVisualStrategyReport = {
  version: string
  date: string
  owner_agent_key: string
  owner_display_name: string
  side_effects: Record<string, boolean>
  source_inputs: Record<string, string>
  strategies: AgentifiedVisualStrategy[]
}

export type AgentifiedVisualStrategyQaPacket = AgentifiedVisualStrategy & {
  reportVersion: string
  reportDate: string
  ownerAgentKey: string
  ownerDisplayName: string
  sourceInputs: Record<string, string>
  candidateUrls: string[]
  primaryCandidateUrl: string | null
  allQaPassed: boolean
  privacyRightsFinding: AgentifiedVisualQaFinding | null
}

const report = visualStrategyQaReport as AgentifiedVisualStrategyReport

function publicUrlForCandidate(candidatePath: string) {
  return candidatePath.startsWith('public/')
    ? `/${candidatePath.slice('public/'.length)}`
    : candidatePath
}

export function getAgentifiedVisualStrategyQaBySocialContentId(
  socialContentId: string,
): AgentifiedVisualStrategyQaPacket | null {
  const strategy = report.strategies.find((item) => item.socialContentId === socialContentId)
  if (!strategy) return null

  const privacyRightsFinding = strategy.qaFindings.find((finding) => (
    finding.gate.toLowerCase().includes('privacy')
    || finding.gate.toLowerCase().includes('rights')
    || finding.gate.toLowerCase().includes('provenance')
  )) ?? null

  const candidateUrls = strategy.candidatePaths.map(publicUrlForCandidate)

  return {
    ...strategy,
    reportVersion: report.version,
    reportDate: report.date,
    ownerAgentKey: report.owner_agent_key,
    ownerDisplayName: report.owner_display_name,
    sourceInputs: report.source_inputs,
    candidateUrls,
    primaryCandidateUrl: candidateUrls[0] ?? null,
    allQaPassed: strategy.qaFindings.every((finding) => finding.result === 'pass'),
    privacyRightsFinding,
  }
}

export function getAgentifiedVisualStrategyQaPackets() {
  return report.strategies
    .map((strategy) => getAgentifiedVisualStrategyQaBySocialContentId(strategy.socialContentId))
    .filter((packet): packet is AgentifiedVisualStrategyQaPacket => Boolean(packet))
}
