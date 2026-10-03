import type { CampaignReleaseManifest } from './campaign-release-manifest'
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`
export function fixture(): CampaignReleaseManifest {
  return { schemaVersion: 'campaign-release/v1', releaseId: id(1), campaignId: id(2), revision: 1,
    class: 'broadcast_release', objective: 'Synthetic campaign', createdAt: '2026-10-03T00:00:00Z', expiresAt: '2026-10-04T00:00:00Z',
    currency: 'USD', spendCapCents: 0,
    stopConditions: ['operator_stop', 'source_changed', 'consent_revoked', 'suppression_changed', 'provider_uncertain', 'budget_exceeded'],
    actions: [{ id: id(3), provider: 'linkedin', operation: 'publish', accountId: 'synthetic-account', source: { table: 'social_content_queue', id: id(4), fingerprint: 'a'.repeat(64) },
      copy: { title: '', body: 'Reviewed exact copy.', metadata: { visibility: 'public' } }, assets: [], recipients: [], audience: 'Public',
      scheduledFor: '2026-10-03T12:00:00Z', maxSpendCents: 0, expectedReceipt: 'platform_post_id', dependsOn: [] }] }
}
