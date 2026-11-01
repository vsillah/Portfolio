'use client'

import { useState } from 'react'
import LinkedInHandoffReview from '@/components/admin/LinkedInHandoffReview'
import type { AgentWorkItem } from '@/lib/agent-work-items'

const fixture = {
  id: '00000000-0000-4000-8000-000000000002',
  title: 'Review LinkedIn handoff from approved Social Content',
  status: 'ready_for_review', source_type: 'social_content_linkedin_draft_handoff',
  source_id: '00000000-0000-4000-8000-000000000001',
  metadata: { draft_packet: {
    version: 'linkedin_draft_handoff_v2', status: 'ready_for_internal_review',
    platform: 'linkedin', social_content_id: '00000000-0000-4000-8000-000000000001',
    source_content_updated_at: '2026-11-01T09:00:00Z', created_at: '2026-11-01T10:00:00Z',
    privacy_decision_receipt_id: '00000000-0000-4000-8000-000000000003',
    external_execution: false, external_account_draft_created: false,
    post_text: 'A good review system makes the next decision clear.\n\nThis sample packet shows the approved copy beside the visual and its evidence.',
    cta_text: 'Read the sample guide.', cta_url: 'https://example.com/sample-guide',
    hashtags: ['BuildWithReceipts'],
    visual_asset: { type: 'single_image', image_url: '/amadutown-logo-upscaled.png' },
    approved_visual_sha256: `sha256:${'a'.repeat(64)}`,
    candidate_projection: { lead_magnet_receipt_id: 'sample-lead-magnet-receipt' },
    canonical_decision_lineage: {
      copy_receipt_id: 'sample-copy-receipt', visual_review_receipt_id: 'sample-visual-receipt',
      asset_packet_receipt_id: 'sample-asset-packet-receipt', privacy_receipt_id: '00000000-0000-4000-8000-000000000003',
    },
    evidence_receipts: Object.fromEntries(['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']
      .map(key => [key, { receipt_id: `sample-${key}-receipt` }])),
  } },
} as unknown as AgentWorkItem

export default function LinkedInFixture() {
  const [reviewed, setReviewed] = useState(false)
  return <>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Development fixture · synthetic content</p>
      <h1 className="mt-2 text-2xl font-bold">Decision Queue · LinkedIn handoff review</h1>
      <p className="mt-2 text-sm text-muted-foreground">This route previews the production component with synthetic packet data. The decision endpoint has no matching fixture record.</p>
      <LinkedInHandoffReview item={fixture} onReviewed={async () => setReviewed(true)} />
      {reviewed && <p role="status">Fixture refreshed.</p>}
    </main>
  </>
}
