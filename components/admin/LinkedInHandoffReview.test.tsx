import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AgentWorkItem } from '@/lib/agent-work-items'

const mocks = vi.hoisted(() => ({ getCurrentSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: mocks.getCurrentSession }))
import LinkedInHandoffReview from './LinkedInHandoffReview'

const contentId = '00000000-0000-4000-8000-000000000001'
const workItem = {
  id: '00000000-0000-4000-8000-000000000002',
  source_type: 'social_content_linkedin_draft_handoff', source_id: contentId,
  status: 'ready_for_review', metadata: { draft_packet: {
    version: 'linkedin_draft_handoff_v2', status: 'ready_for_internal_review',
    external_execution: false, external_account_draft_created: false,
    social_content_id: contentId, created_at: '2026-11-01T10:00:00Z',
    source_content_updated_at: '2026-11-01T09:00:00Z',
    privacy_decision_receipt_id: '00000000-0000-4000-8000-000000000003',
    post_text: 'Approved synthetic post.', cta_text: 'Read the guide.',
    cta_url: 'https://example.com/guide', hashtags: ['BuildBetter'],
    approved_visual_sha256: `sha256:${'a'.repeat(64)}`,
    visual_asset: { image_url: '/fixture.png' },
    candidate_projection: { lead_magnet_receipt_id: 'lead-fixture-1' },
    canonical_decision_lineage: { copy_receipt_id: 'copy-1', visual_review_receipt_id: 'visual-1',
      asset_packet_receipt_id: 'asset-1', privacy_receipt_id: 'privacy-1' },
    evidence_receipts: Object.fromEntries(['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']
      .map(key => [key, { receipt_id: `${key}-fixture` }])),
  } },
} as unknown as AgentWorkItem

describe('LinkedIn handoff review packet', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getCurrentSession.mockResolvedValue({ access_token: 'fixture-token' }) })

  it('shows exact approved content, binding, lineage, and external boundary', () => {
    render(<LinkedInHandoffReview item={workItem} onReviewed={vi.fn()} />)
    expect(screen.getByText(/Approved synthetic post/)).toBeInTheDocument()
    expect(screen.getByText(/Read the guide/)).toBeInTheDocument()
    expect(screen.getByText(/lead-fixture-1/)).toBeInTheDocument()
    expect(screen.getByText(/External actions closed/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request revision' })).toBeDisabled()
  })

  it('submits only the internal approval binding and refreshes the queue', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external_execution: false }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<LinkedInHandoffReview item={workItem} onReviewed={refresh} />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve internal handoff' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/linkedin-handoff-review')
    expect(JSON.parse(init.body)).toMatchObject({ decision: 'approve', work_item_id: workItem.id })
    expect(screen.getByRole('status')).toHaveTextContent('No external action was taken')
    vi.unstubAllGlobals()
  })

  it('closes controls when receipt evidence is missing', () => {
    const incomplete = { ...workItem, metadata: { draft_packet: { ...(workItem.metadata.draft_packet as Record<string, unknown>),
      evidence_receipts: {} } } } as AgentWorkItem
    render(<LinkedInHandoffReview item={incomplete} onReviewed={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Approve internal handoff' })).not.toBeInTheDocument()
    expect(screen.getByText(/Decision controls are closed/)).toBeInTheDocument()
  })
})
