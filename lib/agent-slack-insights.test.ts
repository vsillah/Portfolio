import { describe, expect, it } from 'vitest'
import {
  highSignalInsightsSlackBlocks,
  highSignalInsightsSlackText,
} from './agent-slack-insights'
import { decodeSlackActionValue, type SlackBlock } from './agent-slack-blocks'
import type { HighSignalInsight } from './social-engagement'

function insight(overrides: Partial<HighSignalInsight> = {}): HighSignalInsight {
  return {
    contentId: 'content-1',
    title: 'Agent Ops needs a control plane, not a demo',
    theme: 'Agentic Operating System',
    score: 87,
    recommendation: 'expand',
    recommendationLabel: 'Expand with adjacent AutoResearch',
    ownerAgentKey: 'research-source-register',
    bestContentHref: '/admin/social-content/content-1',
    bestContentUrl: 'https://linkedin.com/posts/example',
    sourcePrdHref: '/docs/agentic-content-research-prds/01-agentic-operating-system-overview.md',
    capturedAt: '2026-06-04T10:00:00.000Z',
    metrics: {
      impressions: 1200,
      views: null,
      reactions: 42,
      likes: 40,
      comments: 9,
      shares: 3,
      reposts: 2,
      engagementRate: 0.0467,
    },
    ...overrides,
  }
}

function actionBlocks(blocks: SlackBlock[]) {
  return blocks.filter((block): block is Extract<SlackBlock, { type: 'actions' }> => block.type === 'actions')
}

describe('high-signal insight Slack formatting', () => {
  it('returns refresh guidance and a Social Content link for the empty state', () => {
    expect(highSignalInsightsSlackText([])).toContain('Refresh LinkedIn engagement metrics')

    const blocks = highSignalInsightsSlackBlocks({
      insights: [],
      baseUrl: 'https://portfolio.test',
    })
    const serialized = JSON.stringify(blocks)

    expect(serialized).toContain('No high-signal insight packets are ready yet')
    expect(serialized).toContain('Open Social Content')
    expect(serialized).toContain('https://portfolio.test/admin/social-content?status=published&platform=linkedin')
  })

  it('caps insight cards at three to keep mobile Slack packets scannable', () => {
    const blocks = highSignalInsightsSlackBlocks({
      insights: [1, 2, 3, 4].map((index) => insight({
        contentId: `content-${index}`,
        title: `Insight title ${index}`,
        theme: `Theme ${index}`,
      })),
      baseUrl: 'https://portfolio.test',
    })

    const cardSections = blocks.filter((block) => (
      block.type === 'section' && block.text?.text.includes('Recommendation:')
    ))
    const cardActionBlocks = actionBlocks(blocks).filter((block) => (
      block.elements.some((element) => element.action_id === 'agent_insight_draft_autoresearch')
    ))

    expect(cardSections).toHaveLength(3)
    expect(cardActionBlocks).toHaveLength(3)
    expect(JSON.stringify(blocks)).not.toContain('content-4')
  })

  it('resolves detail links without double-prefixing absolute URLs', () => {
    const relativeBlocks = highSignalInsightsSlackBlocks({
      insights: [insight({ bestContentHref: '/admin/social-content/content-1' })],
      baseUrl: 'https://portfolio.test',
    })
    const absoluteBlocks = highSignalInsightsSlackBlocks({
      insights: [insight({
        bestContentHref: 'https://external.example/posts/agent-ops',
      })],
      baseUrl: 'https://portfolio.test',
    })

    const relativeDetail = actionBlocks(relativeBlocks)[0].elements.find((element) => element.action_id === 'open_social_content_detail')
    const absoluteDetail = actionBlocks(absoluteBlocks)[0].elements.find((element) => element.action_id === 'open_social_content_detail')

    expect(relativeDetail?.url).toBe('https://portfolio.test/admin/social-content/content-1')
    expect(absoluteDetail?.url).toBe('https://external.example/posts/agent-ops')
  })

  it('keeps mobile action payloads curated and explicit about approval boundaries', () => {
    const blocks = highSignalInsightsSlackBlocks({
      insights: [insight({
        title: 'Public title for Slack',
        theme: 'Permission Scopes and Risk Boundaries',
        score: 92,
        contentId: 'content-boundary',
        ownerAgentKey: 'chief-of-staff',
        sourcePrdHref: null,
        ...({ rawPostText: 'raw-not-for-slack' } as unknown as Partial<HighSignalInsight>),
      })],
      baseUrl: 'https://portfolio.test',
    })
    const serialized = JSON.stringify(blocks)
    const firstActions = actionBlocks(blocks)[0]
    const draftAction = decodeSlackActionValue(firstActions.elements[0].value)
    const askAction = decodeSlackActionValue(firstActions.elements[1].value)

    expect(serialized).toContain('No publishing, scheduling, outbound sends')
    expect(draftAction).toMatchObject({
      action: 'insight.draft_autoresearch',
      contentId: 'content-boundary',
      agentKey: 'chief-of-staff',
    })
    expect(draftAction?.note).toContain('Theme: Permission Scopes and Risk Boundaries')
    expect(draftAction?.note).toContain('Score: 92')
    expect(draftAction?.note).not.toContain('raw-not-for-slack')
    expect(askAction).toMatchObject({
      action: 'insight.ask_shaka',
      contentId: 'content-boundary',
    })
  })
})
