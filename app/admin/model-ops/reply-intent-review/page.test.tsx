import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_NAV } from '@/lib/admin-nav'
import ReplyIntentReviewPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: ({ items }: { items: Array<{ label: string }> }) => (
    <nav aria-label="Breadcrumb">
      {items.map((item) => (
        <span key={item.label}>{item.label}</span>
      ))}
    </nav>
  ),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'test-admin-token' })),
}))

const queueResponse = {
  available: true,
  items: [
    {
      source_id: '11111111-1111-4111-8111-111111111111',
      source_hash: 'abc123',
      reply_hash: 'def456',
      channel: 'email',
      replied_at: '2026-05-24T10:00:00.000Z',
      outreach_status: 'replied',
      sequence_step: 1,
      redacted_reply: 'Can we schedule a quick call next week?',
      suggested_labels: {
        scheduling_intent: true,
        ooo: false,
        not_interested: false,
        interested: true,
        needs_followup: false,
      },
      review_status: 'pending',
      human_scheduling_intent: null,
      notes: '',
      reviewed_at: null,
      existing_review_id: null,
    },
  ],
  summary: {
    target: 200,
    total_real_replies: 1,
    reviewed_real: 0,
    pending: 1,
    unsure: 0,
    skipped: 0,
    remaining_to_gate: 200,
  },
  pagination: {
    page: 1,
    limit: 30,
    total: 1,
    totalPages: 1,
  },
  schema: {
    reviews_table_available: true,
  },
}

describe('ReplyIntentReviewPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/bulk')) {
          return {
            ok: true,
            json: async () => ({ updated: 1, reviews: [] }),
          }
        }
        if (init?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({ review: { ...queueResponse.items[0], review_status: 'reviewed', human_scheduling_intent: true } }),
          }
        }
        return {
          ok: true,
          json: async () => queueResponse,
        }
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the operator review queue and saves a scheduling label', async () => {
    render(<ReplyIntentReviewPage />)

    expect(await screen.findByRole('heading', { name: 'Reply Intent Review' })).toBeInTheDocument()
    expect(screen.getAllByText('Can we schedule a quick call next week?').length).toBeGreaterThan(0)
    expect(screen.getByText('0/200')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Yes' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/model-ops/reply-intent-reviews',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"human_scheduling_intent":true'),
        })
      )
    })
  })

  it('is linked from Quality & insights admin navigation', () => {
    const qualityCategory = ADMIN_NAV.categories.find((category) => category.label === 'Quality & insights')

    expect(qualityCategory?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Model Ops',
          href: '/admin/model-ops/reply-intent-review',
        }),
      ])
    )
  })
})
