import { mrkdwn, slackButton, truncateSlack, type SlackBlock } from '@/lib/agent-slack-blocks'
import type { HighSignalInsight } from '@/lib/social-engagement'

function insightDetailUrl(baseUrl: string, insight: HighSignalInsight) {
  const path = insight.bestContentHref || `/admin/social-content/${insight.contentId}`
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${baseUrl}${path}`
}

function insightActionNote(insight: HighSignalInsight) {
  return [
    `Theme: ${insight.theme}`,
    `Title: ${insight.title}`,
    `Score: ${insight.score}`,
    `Recommendation: ${insight.recommendationLabel}`,
    `Metrics: ${insight.metrics.comments} comments, ${insight.metrics.shares + insight.metrics.reposts} shares, ${insight.metrics.reactions || insight.metrics.likes} reactions.`,
    `Owner agent: ${insight.ownerAgentKey}`,
    insight.sourcePrdHref ? `Source PRD: ${insight.sourcePrdHref}` : null,
  ].filter(Boolean).join('\n')
}

export function highSignalInsightsSlackText(insights: HighSignalInsight[]) {
  if (!insights.length) {
    return 'No high-signal AI insight engagement packets are ready yet. Refresh LinkedIn engagement metrics from Social Content first.'
  }

  return [
    '*High-signal AI insights*',
    ...insights.slice(0, 3).map((insight, index) => {
      const metrics = `${insight.metrics.comments} comments, ${insight.metrics.shares + insight.metrics.reposts} shares, ${insight.metrics.reactions || insight.metrics.likes} reactions`
      return `${index + 1}. *${insight.theme}* - ${insight.score}\n   ${truncateSlack(insight.title, 120)}\n   ${insight.recommendationLabel}; ${metrics}`
    }),
  ].join('\n')
}

export function highSignalInsightsSlackBlocks(input: {
  insights: HighSignalInsight[]
  baseUrl: string
}): SlackBlock[] {
  const { insights, baseUrl } = input
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn('*High-signal AI insights*\nEngagement-ranked AI insight themes from published Social Content. Slack can draft proposed research work; publishing and outbound actions stay gated in Portfolio.'),
    },
  ]

  if (!insights.length) {
    blocks.push({
      type: 'section',
      text: mrkdwn('No high-signal insight packets are ready yet. Refresh engagement metrics from a published LinkedIn Social Content item first.'),
    })
    blocks.push({
      type: 'actions',
      elements: [
        slackButton({ label: 'Open Social Content', actionId: 'open_social_content', url: `${baseUrl}/admin/social-content?status=published&platform=linkedin` }),
      ],
    })
    return blocks
  }

  insights.slice(0, 3).forEach((insight) => {
    const note = insightActionNote(insight)
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(insight.theme, 90)}* - Score ${insight.score}`,
        truncateSlack(insight.title, 150),
        `Recommendation: *${insight.recommendationLabel}*`,
        `Signal: ${insight.metrics.comments} comments - ${insight.metrics.shares + insight.metrics.reposts} shares - ${insight.metrics.reactions || insight.metrics.likes} reactions`,
        '_Boundary: No publishing, scheduling, outbound sends, workflow activation, credential changes, or customer-data mutation from Slack._',
      ].join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        slackButton({
          label: 'Draft AutoResearch',
          actionId: 'agent_insight_draft_autoresearch',
          style: 'primary',
          value: {
            action: 'insight.draft_autoresearch',
            contentId: insight.contentId,
            agentKey: insight.ownerAgentKey,
            note,
          },
          confirmText: `Create a proposed Agent Ops research task for ${insight.theme}?`,
        }),
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_insight_ask_shaka',
          value: {
            action: 'insight.ask_shaka',
            contentId: insight.contentId,
            note,
          },
        }),
        slackButton({
          label: 'Open detail',
          actionId: 'open_social_content_detail',
          url: insightDetailUrl(baseUrl, insight),
        }),
      ],
    })
  })

  blocks.push({
    type: 'actions',
    elements: [
      slackButton({ label: 'Open Mission Control', actionId: 'open_mission_control', url: `${baseUrl}/admin/agents` }),
      slackButton({ label: 'Open Social Content', actionId: 'open_social_content', url: `${baseUrl}/admin/social-content?status=published&platform=linkedin` }),
    ],
  })

  return blocks
}
