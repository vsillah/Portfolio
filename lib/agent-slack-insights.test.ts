import { describe, expect, it } from 'vitest'

import { decodeSlackActionValue, type SlackBlock, type SlackButtonElement } from '@/lib/agent-slack-blocks'
import {
  highSignalInsightsSlackBlocks,
  highSignalInsightsSlackText,
} from '@/lib/agent-slack-insights'
import type { HighSignalInsight } from '@/lib/social-engagement'

function highSignalInsight(overrides: Partial<HighSignalInsight> = {}): HighSignalInsight {
  return {
    contentId: 'content-1',
    title: 'Anyone can launch an agent now',
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

function actionButtons(blocks: SlackBlock[]): SlackButtonElement[] {
  return blocks.flatMap((block) => (block.type === 'actions' ? block.elements : []))
}

function buttonByActionId(blocks: SlackBlock[], actionId: string): SlackButtonElement {
  const button = actionButtons(blocks).find((element) => element.action_id === actionId)
  if (!button) throw new Error(`Expected Slack button ${actionId}`)
  return button
}

describe('high-signal insight Slack payloads', () => {
  it('returns an actionable empty state without research action buttons', () => {
    const text = highSignalInsightsSlackText([])
    const blocks = highSignalInsightsSlackBlocks({
      insights: [],
      baseUrl: 'https://portfolio.test',
    })
    const serializedBlocks = JSON.stringify(blocks)

    expect(text).toContain('Refresh LinkedIn engagement metrics')
    expect(serializedBlocks).toContain('No high-signal insight packets are ready yet')
    expect(serializedBlocks).toContain('Refresh engagement metrics from a published LinkedIn Social Content item first')
    expect(serializedBlocks).toContain('Open Social Content')
    expect(serializedBlocks).toContain('https://portfolio.test/admin/social-content?status=published&platform=linkedin')
    expect(serializedBlocks).not.toContain('Draft AutoResearch')
    expect(serializedBlocks).not.toContain('insight.draft_autoresearch')
  })

  it('builds mobile-safe research actions and detail links for insight cards', () => {
    const blocks = highSignalInsightsSlackBlocks({
      insights: [highSignalInsight()],
      baseUrl: 'https://portfolio.test',
    })
    const serializedBlocks = JSON.stringify(blocks)

    expect(highSignalInsightsSlackText([highSignalInsight()])).toContain('Agentic Operating System')
    expect(serializedBlocks).toContain('Boundary: No publishing, scheduling, outbound sends')
    expect(serializedBlocks).toContain('Draft AutoResearch')
    expect(serializedBlocks).toContain('Ask Shaka')
    expect(buttonByActionId(blocks, 'open_social_content_detail').url).toBe(
      'https://portfolio.test/admin/social-content/content-1',
    )

    const draftPayload = decodeSlackActionValue(buttonByActionId(blocks, 'agent_insight_draft_autoresearch').value)
    expect(draftPayload).toMatchObject({
      action: 'insight.draft_autoresearch',
      contentId: 'content-1',
      agentKey: 'research-source-register',
    })
    expect(draftPayload?.note).toContain('Theme: Agentic Operating System')
    expect(draftPayload?.note).toContain('Score: 87')
    expect(draftPayload?.note).toContain('Recommendation: Expand with adjacent AutoResearch')
    expect(draftPayload?.note).toContain('Source PRD: /docs/agentic-content-research-prds/01-agentic-operating-system-overview.md')

    const askPayload = decodeSlackActionValue(buttonByActionId(blocks, 'agent_insight_ask_shaka').value)
    expect(askPayload).toMatchObject({
      action: 'insight.ask_shaka',
      contentId: 'content-1',
    })
    expect(askPayload?.agentKey).toBeUndefined()
  })

  it('keeps approval-boundary action payloads free of raw source URLs', () => {
    const blocks = highSignalInsightsSlackBlocks({
      insights: [
        highSignalInsight({
          title: 'Public title for Slack',
          theme: 'Permission Scopes and Risk Boundaries',
          score: 92,
          contentId: 'content-boundary',
          ownerAgentKey: 'chief-of-staff',
          bestContentUrl: 'raw-not-for-slack',
          sourcePrdHref: null,
        }),
      ],
      baseUrl: 'https://portfolio.test',
    })
    const serializedBlocks = JSON.stringify(blocks)
    const draftPayload = decodeSlackActionValue(buttonByActionId(blocks, 'agent_insight_draft_autoresearch').value)
    const askPayload = decodeSlackActionValue(buttonByActionId(blocks, 'agent_insight_ask_shaka').value)

    expect(serializedBlocks).toContain('No publishing, scheduling, outbound sends')
    expect(draftPayload).toMatchObject({
      action: 'insight.draft_autoresearch',
      contentId: 'content-boundary',
      agentKey: 'chief-of-staff',
    })
    expect(draftPayload?.note).toContain('Theme: Permission Scopes and Risk Boundaries')
    expect(draftPayload?.note).toContain('Score: 92')
    expect(draftPayload?.note).not.toContain('raw-not-for-slack')
    expect(askPayload).toMatchObject({
      action: 'insight.ask_shaka',
      contentId: 'content-boundary',
    })
  })

  it('uses absolute detail links as-is and falls back from zero reactions to likes', () => {
    const insight = highSignalInsight({
      bestContentHref: 'https://portfolio.test/custom-detail',
      metrics: {
        impressions: 900,
        views: null,
        reactions: 0,
        likes: 40,
        comments: 4,
        shares: 2,
        reposts: 1,
        engagementRate: 0.052,
      },
    })

    const text = highSignalInsightsSlackText([insight])
    const blocks = highSignalInsightsSlackBlocks({
      insights: [insight],
      baseUrl: 'https://portfolio.test',
    })

    expect(text).toContain('4 comments, 3 shares, 40 reactions')
    expect(JSON.stringify(blocks)).toContain('Signal: 4 comments - 3 shares - 40 reactions')
    expect(buttonByActionId(blocks, 'open_social_content_detail').url).toBe('https://portfolio.test/custom-detail')
  })

  it('caps Slack insight cards at three while keeping footer navigation', () => {
    const blocks = highSignalInsightsSlackBlocks({
      insights: [1, 2, 3, 4].map((index) =>
        highSignalInsight({
          contentId: `content-${index}`,
          title: `Insight ${index}`,
          theme: `Theme ${index}`,
          bestContentHref: `/admin/social-content/content-${index}`,
        }),
      ),
      baseUrl: 'https://portfolio.test',
    })
    const draftButtons = actionButtons(blocks).filter((button) => button.action_id === 'agent_insight_draft_autoresearch')

    expect(draftButtons).toHaveLength(3)
    expect(JSON.stringify(blocks)).toContain('Theme 3')
    expect(JSON.stringify(blocks)).not.toContain('Theme 4')
    expect(buttonByActionId(blocks, 'open_mission_control').url).toBe('https://portfolio.test/admin/agents')
    expect(buttonByActionId(blocks, 'open_social_content').url).toBe(
      'https://portfolio.test/admin/social-content?status=published&platform=linkedin',
    )
  })
})
