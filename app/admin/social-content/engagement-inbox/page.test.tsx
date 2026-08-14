import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SocialCommentInboxPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const comment = {
  id: 'comment-1',
  socialContentId: 'social-1',
  platform: 'linkedin',
  providerCommentId: 'urn:comment:1',
  providerPermalink: 'https://linkedin.example/comment/1',
  authorDisplayName: 'Potential Client',
  body: 'Can this workflow help our nonprofit intake?',
  status: 'lead',
  classification: { label: 'Lead', priority: 'high', reason: 'Direct service question' },
  draftReply: 'Yes, it can help triage intake while keeping a human approval gate.',
  approvalState: 'drafted',
  providerCapability: {
    provider: 'linkedin',
    automaticReply: false,
    verified: false,
    humanGateSatisfied: false,
    blocker: 'LinkedIn reply adapter is not verified.',
    recoveryPath: 'Reply manually from the provider permalink.',
  },
  actionHistory: [],
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
  campaignId: 'campaign-1',
  campaignLabel: 'Agentified launch',
  postLabel: 'Agentified Episode 1',
  postExcerpt: 'Original post copy',
}

const alertReliability = {
  state: 'disabled',
  label: 'Alerts disabled',
  summary: 'Slack alert delivery is default-off. The inbox remains the recovery surface.',
  deliveryMode: 'disabled',
  activation: {
    enabled: false,
    reason: 'activation_disabled_default_off',
  },
  counts: {
    itemCount: 1,
    sent: 0,
    deduped: 0,
    skipped: 1,
    errors: 0,
  },
  reasons: ['Dry run only.'],
  lastActionableNextStep: 'Review eligible comments in the Engagement Inbox or run an authorized dry-run cron check.',
  nextStep: {
    label: 'Open inbox',
    href: '/admin/social-content/engagement-inbox',
  },
  lastRun: null,
}

describe('SocialCommentInboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/admin/social-content/engagement-inbox')
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(window.HTMLElement.prototype, 'focus', {
      configurable: true,
      value: vi.fn(),
    })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, message: 'Comment action recorded.', comments: [{ ...comment, approvalState: 'approved' }] }),
        } as Response
      }

      const noMatches = url.includes('status=ignored')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: noMatches ? [] : [comment],
          summary: { total: 1, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 1, escalated: 0, responded: 0, ignored: 0 },
          filteredSummary: noMatches
            ? { total: 0, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 }
            : { total: 1, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 1, escalated: 0, responded: 0, ignored: 0 },
          alertReliability,
        }),
      } as Response
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders filters, blocked/manual provider state, and distinct actions', async () => {
    render(<SocialCommentInboxPage />)

    expect(await screen.findByText('Engagement Inbox')).toBeInTheDocument()
    expect(screen.getByText('Alert reliability')).toBeInTheDocument()
    expect(screen.getByText('Alerts disabled')).toBeInTheDocument()
    expect(screen.getByText('Slack alert delivery is default-off. The inbox remains the recovery surface.')).toBeInTheDocument()
    expect(screen.getByText('Review eligible comments in the Engagement Inbox or run an authorized dry-run cron check.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open inbox/i })).toHaveAttribute('href', '/admin/social-content/engagement-inbox')
    expect(screen.getByText('Deduped')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Potential Client')).toBeInTheDocument()
    expect(screen.getByText('Can this workflow help our nonprofit intake?')).toBeInTheDocument()
    expect(screen.getByText('Blocked/manual state')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn reply adapter is not verified.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Post/i })).toHaveAttribute('href', '/admin/social-content/social-1')
    expect(screen.getByRole('link', { name: /Provider/i })).toHaveAttribute('href', 'https://linkedin.example/comment/1')

    const article = screen.getByText('Potential Client').closest('article')
    expect(article).toBeTruthy()
    const panel = within(article as HTMLElement)
    expect(panel.getByRole('button', { name: /Draft Response/i })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Approve$/i })).not.toBeDisabled()
    expect(panel.getByRole('button', { name: /^Reject$/i })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Ignore$/i })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Submit$/i })).toBeDisabled()
  })

  it.each([360, 390, 430])('keeps the reliability panel available at %ipx mobile width', async (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    window.dispatchEvent(new Event('resize'))

    render(<SocialCommentInboxPage />)

    expect(await screen.findByText('Alert reliability')).toBeInTheDocument()
    expect(screen.getByText('Alerts disabled')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open inbox/i })).toBeInTheDocument()
  })

  it('shows a clear empty state when filters remove all rows', async () => {
    render(<SocialCommentInboxPage />)

    expect(await screen.findByText('Potential Client')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'ignored' } })

    expect(await screen.findByText('No comments match these filters')).toBeInTheDocument()
    expect(screen.getByText(/Unsupported providers will appear here once their comments are imported/i)).toBeInTheDocument()
  })

  it('hydrates the initial post filter from the deep-link query', async () => {
    window.history.replaceState({}, '', '/admin/social-content/engagement-inbox?comment=comment-1&post=social-1')

    render(<SocialCommentInboxPage />)

    expect(await screen.findByText('Potential Client')).toBeInTheDocument()
    expect(screen.getByLabelText(/Post/i)).toHaveValue('social-1')
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('post=social-1'),
        expect.any(Object),
      )
    })
    expect(window.location.search).toContain('comment=comment-1')
    expect(window.location.search).toContain('post=social-1')
  })

  it('focuses and highlights the linked comment after comments load', async () => {
    window.history.replaceState({}, '', '/admin/social-content/engagement-inbox?comment=comment-1&post=social-1')

    render(<SocialCommentInboxPage />)

    const focusedCard = await screen.findByLabelText('Focused comment from Potential Client')
    expect(focusedCard).toHaveClass('ring-2')
    await waitFor(() => {
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
      expect(window.HTMLElement.prototype.focus).toHaveBeenCalledWith({ preventScroll: true })
    })
  })

  it('shows recovery when the linked comment is absent or filtered out', async () => {
    window.history.replaceState({}, '', '/admin/social-content/engagement-inbox?comment=missing-comment&post=social-1')

    render(<SocialCommentInboxPage />)

    expect(await screen.findByText('Linked comment not visible')).toBeInTheDocument()
    expect(screen.getByText(/missing-comment/i)).toBeInTheDocument()
    expect(screen.getByText(/absent from this environment or filtered out/i)).toBeInTheDocument()
  })

  it('clears hydrated filters and comment focus from the query state', async () => {
    window.history.replaceState({}, '', '/admin/social-content/engagement-inbox?comment=missing-comment&post=social-1&status=lead')

    render(<SocialCommentInboxPage />)

    expect(await screen.findByText('Linked comment not visible')).toBeInTheDocument()
    expect(screen.getByLabelText(/Post/i)).toHaveValue('social-1')

    fireEvent.click(screen.getByRole('button', { name: /^Clear Filters$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Post/i)).toHaveValue('')
      expect(window.location.search).not.toContain('comment=')
      expect(window.location.search).not.toContain('post=')
      expect(window.location.search).not.toContain('status=')
    })
  })

  it('renders an explicit unavailable state when the canonical table is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        unavailable: true,
        blocked: true,
        items: [],
        summary: { total: 0, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 },
        filteredSummary: { total: 0, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 },
        alertReliability: {
          ...alertReliability,
          state: 'no_eligible_items',
          label: 'No eligible items',
          counts: { ...alertReliability.counts, itemCount: 0, skipped: 0 },
        },
        message: 'Comment inbox storage is not available in this environment.',
        recovery: 'Apply migration 20260806163011 to the bound Supabase project before validating populated comment inbox rows.',
      }),
    } as Response)))

    render(<SocialCommentInboxPage />)

    expect(await screen.findByRole('heading', { name: 'Comment inbox unavailable' })).toBeInTheDocument()
    expect(screen.getByText('Comment inbox storage is not available in this environment.')).toBeInTheDocument()
    expect(screen.getByText(/migration 20260806163011/i)).toBeInTheDocument()
    expect(screen.queryByText('Failed to load comment inbox')).not.toBeInTheDocument()
  })

  it('records approve actions without submitting externally', async () => {
    render(<SocialCommentInboxPage />)

    const approve = await screen.findByRole('button', { name: /^Approve$/i })
    fireEvent.click(approve)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/social-content/social-1/engagement/comments', expect.objectContaining({
        method: 'POST',
      }))
    })
    expect(await screen.findByText('Comment action recorded.')).toBeInTheDocument()
  })
})
