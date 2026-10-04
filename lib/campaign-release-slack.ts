import { mrkdwn, slackButton, type SlackBlock } from './agent-slack-blocks'
import { getSlackAgentSource } from './slack-agent-environment'
import type { ReleaseRecord } from './campaign-release-manifest'

/** Build a review card only. Posting it to Slack is a separate authorized operation. */
export function campaignReleaseSlackBlocks(record: ReleaseRecord, dispatchIntentId?: string): SlackBlock[] {
  const { manifest, hash } = record
  const url = `${getSlackAgentSource().sourceOrigin}/admin/campaigns/${manifest.campaignId}?release=${manifest.releaseId}`
  return [
    { type: 'section', text: mrkdwn(`*Campaign release review*\n${manifest.actions.length} bounded actions · cap $${(manifest.spendCapCents / 100).toFixed(2)} USD\nExpires ${manifest.expiresAt}\nReview exact content and recipients in Portfolio. Provider execution remains gated.`) },
    { type: 'context', elements: [mrkdwn(`Manifest: \`${hash}\``)] },
    { type: 'actions', elements: [
      ...(['approve', 'revise', 'hold'] as const).map(decision => slackButton({
        label: { approve: 'Approve release', revise: 'Request revision', hold: 'Hold' }[decision],
        actionId: `campaign_release_${decision}`,
        value: { action: `campaign_release.${decision}`, schemaVersion: 'campaign-release/v1', runId: manifest.releaseId, manifestHash: hash, releaseVersion: String(record.version), dispatchIntentId },
        style: decision === 'approve' ? 'primary' : undefined,
      })),
      slackButton({ label: 'Open in Portfolio', actionId: 'campaign_release_open', url }),
      slackButton({ label: 'Emergency stop', actionId: 'campaign_release_stop', style: 'danger',
        value: { action: 'campaign_release.stop', schemaVersion: 'campaign-release/v1', runId: manifest.releaseId, manifestHash: hash, releaseVersion: String(record.version), dispatchIntentId },
        confirmText: 'Stop this release permanently. Already completed external actions cannot be recalled.' }),
    ] },
  ]
}
