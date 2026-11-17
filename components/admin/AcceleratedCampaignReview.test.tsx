import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AcceleratedCampaignReview from './AcceleratedCampaignReview'
import type { AcceleratedCampaignReview as Review } from '@/lib/social-accelerated-campaign-review'

vi.mock('@/lib/authenticated-fetch', () => ({
  fetchWithSessionRecovery: vi.fn(async () => ({ ok: true, blob: async () => new Blob(['png'], { type: 'image/png' }),
    json: async () => ({ ready: false, blockers: ['A verified $0, no-spend execution path is unavailable.'] }) })),
}))

beforeEach(() => {
  let index = 0
  URL.createObjectURL = vi.fn(() => `blob:review-${++index}`)
  URL.revokeObjectURL = vi.fn()
})

const base: Review = {
  kind: 'text_only',
  calendarItemId: 'af8ed285-69f4-4036-8201-1aa66827bb48',
  sourceManifestSha256: 'manifest-hash',
  jitPacketSha256: 'jit-hash',
  contentVersion: '2026-11-16T20:46:14Z',
  assetUrls: [],
  checks: [{ label: 'Approved visual', passed: true }],
  readyForHumanReview: true,
  externalActionsLocked: true,
}

describe('AcceleratedCampaignReview', () => {
  it('keeps the excluded X review read-only without a schedule control', () => {
    render(<AcceleratedCampaignReview review={base} contentId="d0046271-92ba-4c7f-a009-197b44562f48" postText="Approved X copy" ctaUrl="https://amadutown.com/accelerated" />)
    expect(screen.getByText(/Intentional text-only treatment/)).toBeVisible()
    expect(screen.queryByText(/Approved visual binding is unavailable/)).toBeNull()
    expect(screen.getByText(/The X record stays Draft/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Schedule approved record' })).toBeNull()
  })

  it('shows all eight approved raster frames in order', async () => {
    const review = { ...base, kind: 'carousel' as const, assetUrls: Array.from({ length: 8 }, (_, index) => `/api/admin/social-content/accelerated-review-assets/slide-${String(index + 1).padStart(2, '0')}.png`) }
    render(<AcceleratedCampaignReview review={review} contentId="9499ecbf-0349-472a-9b12-b6d987d1939d" postText="Approved carousel caption" ctaUrl="https://amadutown.com/accelerated" />)
    const images = await screen.findAllByRole('img')
    expect(images).toHaveLength(8)
    expect(images[0]).toHaveAttribute('alt', 'Approved Accelerated campaign slide 1 of 8')
    expect(images[7]).toHaveAttribute('alt', 'Approved Accelerated campaign slide 8 of 8')
  })
})
