import { describe, expect, it, vi } from 'vitest'
import {
  buildHighSignalInsight,
  mapBacklogTheme,
  mergeEngagementIntoRagContext,
  normalizeEngagementRow,
  scoreEngagement,
} from './social-engagement'

describe('social engagement metrics', () => {
  it('normalizes Apify LinkedIn rows into one internal metrics shape', () => {
    const metrics = normalizeEngagementRow({
      platform: 'linkedin',
      row: {
        postUrl: 'https://www.linkedin.com/posts/vambah_agent-ops?tracking=1',
        urn: 'urn:li:activity:123',
        reactionCount: '1,200',
        commentCount: 14,
        shareCount: 4,
        impressions: '8.5k',
        comments: [{ authorName: 'Operator One' }, { authorName: 'Operator One' }],
      },
      actorId: 'harvestapi~linkedin-profile-posts',
      runId: 'run-1',
      datasetId: 'dataset-1',
      confidence: 'exact',
    })

    expect(metrics).toMatchObject({
      platform: 'linkedin',
      contentUrl: 'https://www.linkedin.com/posts/vambah_agent-ops',
      platformPostId: 'urn:li:activity:123',
      reactions: 1200,
      comments: 14,
      shares: 4,
      impressions: 8500,
      notableCommenters: ['Operator One'],
      source: {
        provider: 'apify',
        actorId: 'harvestapi~linkedin-profile-posts',
        runId: 'run-1',
        datasetId: 'dataset-1',
        confidence: 'exact',
      },
    })
    expect(metrics.engagementRate).toBeGreaterThan(0)
  })

  it('weights comments and shares more heavily than passive views', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
    const highComment = normalizeEngagementRow({
      platform: 'linkedin',
      row: { views: 200, reactions: 4, comments: 8, shares: 3 },
      capturedAt: '2026-06-01T11:00:00.000Z',
    })
    const highViewLowAction = normalizeEngagementRow({
      platform: 'linkedin',
      row: { views: 10000, reactions: 10, comments: 0, shares: 0 },
      capturedAt: '2026-06-01T11:00:00.000Z',
    })

    expect(scoreEngagement(highComment).recommendation).toBe('promote')
    expect(scoreEngagement(highComment).score).toBeGreaterThan(scoreEngagement(highViewLowAction).score)
    expect(scoreEngagement(highViewLowAction).recommendation).toBe('format_bakeoff')
    vi.useRealTimers()
  })

  it('maps content back to the agentic content PRD backlog', () => {
    expect(mapBacklogTheme({
      postText: 'Mission Control and Slack traceability are how agents become operational.',
      topic: null,
      ragContext: null,
    })).toMatchObject({
      theme: 'Mission Control and Slack Traceability',
      href: expect.stringContaining('09-mission-control-and-slack-traceability'),
    })
  })

  it('merges latest metrics into rag_context without requiring manual entry', () => {
    const metrics = normalizeEngagementRow({
      platform: 'linkedin',
      row: { views: 100, reactions: 8, comments: 2, shares: 1 },
      capturedAt: '2026-06-01T11:00:00.000Z',
    })
    const score = scoreEngagement(metrics)

    const rag = mergeEngagementIntoRagContext({
      ragContext: { source: 'agent_ops_social_outreach_goal' },
      metrics,
      score,
      theme: 'Agentic Operating System',
      sourcePrdHref: '/docs/agentic-content-research-prds/01-agentic-operating-system-overview.md',
    })

    expect(rag.engagement).toMatchObject({
      latest_score: score.score,
      mapped_theme: 'Agentic Operating System',
      manual_entry_required: false,
    })
    expect((rag.engagement as { snapshots: unknown[] }).snapshots).toHaveLength(1)
  })

  it('builds Mission Control-ready high-signal insight cards', () => {
    const metrics = normalizeEngagementRow({
      platform: 'linkedin',
      row: { url: 'https://www.linkedin.com/posts/vambah_agent-ops', reactions: 60, comments: 6, shares: 2 },
      capturedAt: '2026-06-01T11:00:00.000Z',
    })

    const insight = buildHighSignalInsight({
      contentId: 'content-1',
      postText: 'Agent Ops needs a control plane, not a demo.',
      topic: 'Agent Ops control plane',
      ragContext: null,
      metrics,
    })

    expect(insight).toMatchObject({
      contentId: 'content-1',
      bestContentHref: '/admin/social-content/content-1',
      recommendationLabel: expect.any(String),
    })
    expect(insight.score).toBeGreaterThan(0)
  })
})
