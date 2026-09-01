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
    expect(screen.getByText('Enabled No')).toBeInTheDocument()
    expect(screen.getAllByText('Potential Client').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Can this workflow help our nonprofit intake?')).toHaveLength(1)
    expect(screen.getByText('Provider guardrails')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn reply adapter is not verified.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Details/i })).toHaveAttribute('href', '/admin/social-content/social-1')
    expect(screen.getByRole('link', { name: /Provider/i })).toHaveAttribute('href', 'https://linkedin.example/comment/1')

    const article = screen.getAllByText('Potential Client')[0].closest('article')
    expect(article).toBeTruthy()
    expect(article).not.toHaveAttribute('id', 'social-comment-review-gate')
    const panel = within(article as HTMLElement)
    expect(panel.getByText('Original post')).toBeInTheDocument()
    expect(panel.getByText('Inbound comment')).toBeInTheDocument()
    expect(panel.getByText('Draft reply')).toBeInTheDocument()
    const cardText = (article as HTMLElement).textContent ?? ''
    const originalPostIndex = cardText.indexOf('Original post')
    const inboundCommentIndex = cardText.indexOf('Inbound comment')
    const draftReplyIndex = cardText.indexOf('Draft reply')
    expect(originalPostIndex).toBeGreaterThanOrEqual(0)
    expect(inboundCommentIndex).toBeGreaterThan(originalPostIndex)
    expect(draftReplyIndex).toBeGreaterThan(inboundCommentIndex)
    expect(panel.getByRole('button', { name: /Draft Response/i })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Approve$/i })).not.toBeDisabled()
    expect(panel.getByRole('button', { name: /^Reject$/i })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Ignore$/i })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Submit$/i })).toBeDisabled()
  })

  it('shows the generated draft after clicking Draft Response', async () => {
    const generatedReply = 'Appreciate you reading and engaging with this.'
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const noDraftComment = { ...comment, draftReply: '', approvalState: 'unreviewed' }
      const draftedComment = { ...comment, draftReply: generatedReply, approvalState: 'drafted' }
      if (init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, message: 'Comment action recorded.', comments: [draftedComment] }),
        } as Response
      }

      const url = String(input)
      const isAfterPostRefresh = fetchMock.mock.calls.some(([, requestInit]) => requestInit?.method === 'POST')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: url.includes('status=ignored') ? [] : [isAfterPostRefresh ? draftedComment : noDraftComment],
          summary: { total: 1, new: 1, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 },
          filteredSummary: { total: 1, new: 1, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 },
          alertReliability,
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialCommentInboxPage />)

    expect(await screen.findByLabelText(/Draft reply/i)).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: /Draft Response/i }))

    expect(await screen.findByDisplayValue(generatedReply)).toBeInTheDocument()
    expect(await screen.findByText(/Draft response generated in the Draft reply box/i)).toBeInTheDocument()
    expect(screen.getByText(/Generated response ready for review/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generated reply guardrail/i })).toHaveAttribute(
      'title',
      'This generated response stays local until approval and provider submission gates pass.',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/social-content/social-1/engagement/comments',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"draft_response"'),
      }),
    )
  })

  it.each([360, 390, 430])('keeps the reliability panel available at %ipx mobile width', async (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    window.dispatchEvent(new Event('resize'))

    render(<SocialCommentInboxPage />)

    expect(await screen.findByText('Alert reliability')).toBeInTheDocument()
    expect(screen.getByText('Alerts disabled')).toBeInTheDocument()
    expect(screen.getByText('Enabled No')).toBeInTheDocument()
  })

  it('shows a clear empty state when filters remove all rows', async () => {
    render(<SocialCommentInboxPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Potential Client').length).toBeGreaterThanOrEqual(1)
    })
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'ignored' } })

    expect(await screen.findByText('No comments match these filters')).toBeInTheDocument()
    expect(screen.getByText(/Unsupported providers will appear here once their comments are imported/i)).toBeInTheDocument()
  })

  it('marks status metric filters active and exposes the clear action', async () => {
    render(<SocialCommentInboxPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Potential Client').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Filter comments to Lead (1)' }))

    const activeMetric = await screen.findByRole('button', { name: 'Clear Lead comment filter (1)' })
    expect(activeMetric).toHaveAttribute('aria-pressed', 'true')
    expect(activeMetric).toHaveAttribute('title', 'Click to clear this status filter')
    expect(screen.getByLabelText(/Status/i)).toHaveValue('lead')

    fireEvent.click(activeMetric)

    await waitFor(() => expect(screen.getByLabelText(/Status/i)).toHaveValue('all'))
    expect(screen.getByRole('button', { name: 'Filter comments to Lead (1)' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('hydrates the initial post filter from the deep-link query', async () => {
    window.history.replaceState({}, '', '/admin/social-content/engagement-inbox?comment=comment-1&post=social-1&review=reply&source=slack#social-comment-review-gate')

    render(<SocialCommentInboxPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Potential Client').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByLabelText(/Post/i)).toHaveValue('social-1')
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('post=social-1'),
        expect.any(Object),
      )
    })
    expect(window.location.search).toContain('comment=comment-1')
    expect(window.location.search).toContain('post=social-1')
    expect(window.location.search).toContain('review=reply')
    expect(window.location.search).toContain('source=slack')
    expect(window.location.hash).toBe('#social-comment-review-gate')
    const article = screen.getAllByText('Potential Client')[0].closest('article')
    expect(article).toHaveAttribute('id', 'social-comment-review-gate')
    const gate = within(article as HTMLElement)
    expect(gate.getByRole('button', { name: /^Approve$/i })).toBeInTheDocument()
    expect(gate.getByRole('button', { name: /^Reject$/i })).toBeInTheDocument()
  })

  it('focuses and highlights the linked comment after comments load', async () => {
    window.history.replaceState({}, '', '/admin/social-content/engagement-inbox?comment=comment-1&post=social-1#social-comment-review-gate')

    render(<SocialCommentInboxPage />)

    const focusedCard = await screen.findByLabelText('Focused comment from Potential Client')
    expect(focusedCard).toHaveAttribute('id', 'social-comment-review-gate')
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

  it('records reject revision notes without submitting externally', async () => {
    render(<SocialCommentInboxPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Potential Client').length).toBeGreaterThanOrEqual(1)
    })
    fireEvent.change(screen.getByLabelText('Revision note'), {
      target: { value: 'Make the reply more specific before approval.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Reject$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/social-content/social-1/engagement/comments', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"reject"'),
      }))
    })
    const rejectCall = vi.mocked(fetch).mock.calls.find(([, init]) => String(init?.body).includes('"action":"reject"'))
    expect(JSON.parse(String(rejectCall?.[1]?.body))).toMatchObject({
      action: 'reject',
      comment_id: 'comment-1',
      draft_reply: 'Yes, it can help triage intake while keeping a human approval gate.',
      note: 'Make the reply more specific before approval.',
    })
    expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toMatch(/slack|gmail|sms/i)
  })

  it('locks repeat decisions after reply rejection and exposes revise recovery', async () => {
    const rejectedComment = {
      ...comment,
      status: 'needs_qa',
      approvalState: 'rejected',
      draftReply: 'This reply needs a sharper answer.',
      actionHistory: [{
        action: 'reject',
        at: '2026-08-06T12:05:00.000Z',
        by: 'admin-user',
        note: null,
      }],
    }
    const returnedToReviewComment = {
      ...rejectedComment,
      approvalState: 'drafted',
      draftReply: 'Revised reply with a clearer answer.',
      actionHistory: [{
        action: 'return_to_review',
        at: '2026-08-06T12:08:00.000Z',
        by: 'admin-user',
        note: null,
      }, ...rejectedComment.actionHistory],
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            message: 'Revised reply saved and returned to review. Approval is required before any provider submission.',
            comments: [{ ...rejectedComment, approvalState: 'drafted' }],
          }),
        } as Response
      }

      const isAfterPostRefresh = fetchMock.mock.calls.some(([, requestInit]) => requestInit?.method === 'POST')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [isAfterPostRefresh ? returnedToReviewComment : rejectedComment],
          summary: { total: 1, new: 0, needs_qa: 1, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 },
          filteredSummary: { total: 1, new: 0, needs_qa: 1, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 },
          alertReliability,
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialCommentInboxPage />)

    const rejectedHeading = await screen.findByText('Reply rejected')
    const card = rejectedHeading.closest('article')
    expect(card).toBeTruthy()
    const panel = within(card as HTMLElement)
    expect(await panel.findByText('Reply rejected')).toBeInTheDocument()
    expect(panel.getByText('Review locked')).toBeInTheDocument()
    expect(panel.getByText('Revise opens the local editor before any review state changes.')).toBeInTheDocument()
    expect(panel.getByRole('region', { name: /Reply lifecycle/i })).toBeInTheDocument()
    expect(panel.getByText('Revision requested')).toBeInTheDocument()
    expect(panel.getByText('This reply is rejected and waiting for an operator revision or replacement reply.')).toBeInTheDocument()
    expect(panel.getByText('No written feedback was saved with the rejection.')).toBeInTheDocument()
    expect(panel.getByText('Review is locked until a revision is submitted.')).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: /^Approve$/i })).not.toBeInTheDocument()
    expect(panel.queryByRole('button', { name: /^Reject$/i })).not.toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Submit$/i })).toBeDisabled()

    fireEvent.click(panel.getByRole('button', { name: /^Revise Reply$/i }))

    expect(await panel.findByText('Revision mode')).toBeInTheDocument()
    expect(panel.getByText('The revision box is open locally. Text entered here is not saved until Submit Revision is clicked.')).toBeInTheDocument()
    expect(await panel.findByLabelText('Revision feedback or replacement reply')).toHaveValue('This reply needs a sharper answer.')
    expect(panel.getByRole('button', { name: /^Submit Revision$/i })).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: /^Revise Reply$/i })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/social-content/social-1/engagement/comments',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"return_to_review"'),
      }),
    )

    fireEvent.change(panel.getByLabelText('Revision feedback or replacement reply'), {
      target: { value: 'Revised reply with a clearer answer.' },
    })
    fireEvent.click(panel.getByRole('button', { name: /^Submit Revision$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/social-content/social-1/engagement/comments',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"return_to_review"'),
        }),
      )
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/social-content/social-1/engagement/comments',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Revised reply with a clearer answer.'),
      }),
    )
    expect(await screen.findByText(/Revised reply saved and returned to review/i)).toBeInTheDocument()
    expect(await screen.findByText('Revision was received and saved as the current draft reply.')).toBeInTheDocument()
    expect(screen.getByText(/Returned to review:/i)).toBeInTheDocument()
    expect(screen.getByText('No Amina or owner update is currently tracked. The reply is ready for operator review.')).toBeInTheDocument()
    expect(screen.getByText('Review the draft, then approve it, reject it with feedback, or edit it again.')).toBeInTheDocument()
  })

  it('opens revision mode for rejected replies without an existing draft and waits for new text', async () => {
    const rejectedComment = {
      ...comment,
      status: 'needs_qa',
      approvalState: 'rejected',
      draftReply: '',
      actionHistory: [{
        action: 'reject',
        at: '2026-08-06T12:05:00.000Z',
        by: 'admin-user',
        note: 'Needs a replacement reply.',
      }],
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            message: 'Revised reply saved and returned to review. Approval is required before any provider submission.',
          }),
        } as Response
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [rejectedComment],
          summary: { total: 1, new: 0, needs_qa: 1, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 },
          filteredSummary: { total: 1, new: 0, needs_qa: 1, auto_send_pending: 0, lead: 0, escalated: 0, responded: 0, ignored: 0 },
          alertReliability,
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialCommentInboxPage />)

    const rejectedHeading = await screen.findByText('Reply rejected')
    const card = rejectedHeading.closest('article')
    expect(card).toBeTruthy()
    const panel = within(card as HTMLElement)
    const revise = panel.getByRole('button', { name: /^Revise Reply$/i })
    expect(revise).not.toBeDisabled()

    fireEvent.click(revise)

    const revisionEditor = await panel.findByLabelText('Revision feedback or replacement reply')
    expect(revisionEditor).toHaveValue('')
    expect(panel.queryByRole('button', { name: /^Revise Reply$/i })).not.toBeInTheDocument()
    expect(panel.getByText('Saved in history: Needs a replacement reply.')).toBeInTheDocument()
    expect(panel.getByText('Enter feedback or replacement reply text before submitting the revision.')).toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Submit Revision$/i })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/social-content/social-1/engagement/comments',
      expect.objectContaining({ method: 'POST' }),
    )

    fireEvent.change(revisionEditor, { target: { value: 'Fresh replacement reply.' } })
    expect(panel.getByText('Submit the revision to return the edited reply to review.')).toBeInTheDocument()
    fireEvent.click(panel.getByRole('button', { name: /^Submit Revision$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/social-content/social-1/engagement/comments',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Fresh replacement reply.'),
        }),
      )
    })
  })

  it('locks rejected responded replies with submitted provider evidence inline and avoids no-op posts', async () => {
    const lockedComment = {
      ...comment,
      platform: 'youtube',
      providerPermalink: 'https://youtube.example/comment/1',
      status: 'responded',
      approvalState: 'rejected',
      draftReply: 'This rejected reply was already submitted.',
      submittedReplyLocked: true,
      submittedReplyLockReason: 'Reply already has submitted provider evidence. Local revision is locked so Portfolio does not rewrite or obscure the canonical provider record.',
      providerCapability: {
        provider: 'youtube_data_api',
        automaticReply: true,
        verified: true,
        humanGateSatisfied: false,
        blocker: 'Submitted provider evidence is authoritative.',
        recoveryPath: 'Review provider evidence before making any local correction.',
      },
      actionHistory: [{
        action: 'reject',
        at: '2026-08-06T12:05:00.000Z',
        by: 'admin-user',
        note: 'Rejected after provider evidence existed.',
      }],
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        throw new Error('Submitted-evidence locked replies must not post local no-op actions.')
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [lockedComment],
          summary: { total: 1, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 1, ignored: 0 },
          filteredSummary: { total: 1, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 1, ignored: 0 },
          alertReliability,
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialCommentInboxPage />)

    const rejectedHeading = await screen.findByText('Reply rejected')
    const card = rejectedHeading.closest('article')
    expect(card).toBeTruthy()
    const panel = within(card as HTMLElement)
    expect(panel.getAllByText('Provider evidence locked').length).toBeGreaterThanOrEqual(1)
    expect(panel.getAllByText(/Local revision is locked/i).length).toBeGreaterThanOrEqual(1)
    expect(panel.getByText('Submitted provider evidence is authoritative. Portfolio is not changing local review state for this reply.')).toBeInTheDocument()
    expect(panel.getByText('Saved in history: Rejected after provider evidence existed.')).toBeInTheDocument()
    expect(panel.getByText('Review controls are locked.')).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: /^Revise Reply$/i })).not.toBeInTheDocument()
    const lockedButton = panel.getByRole('button', { name: /^Revision Locked$/i })
    expect(lockedButton).toBeDisabled()
    const lockReasonId = lockedButton.getAttribute('aria-describedby')
    expect(lockReasonId).toBeTruthy()
    expect(document.getElementById(lockReasonId as string)).toHaveTextContent(/submitted provider evidence/i)

    fireEvent.click(lockedButton)
    fireEvent.click(lockedButton)

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/social-content/social-1/engagement/comments',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.queryByText(/local action was recorded without changing submitted state/i)).not.toBeInTheDocument()
  })

  it('locks review controls for already responded comments with submitted provider evidence', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        throw new Error('Submitted-evidence rows must not post repeated local review actions.')
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{
            ...comment,
            status: 'responded',
            approvalState: 'approved',
            providerCapability: {
              provider: 'youtube_data_api',
              automaticReply: true,
              verified: true,
              humanGateSatisfied: true,
              blocker: null,
              recoveryPath: 'YouTube reply capability verified.',
            },
            submittedReplyLocked: true,
            submittedReplyLockReason: 'Reply already has submitted provider evidence. Local revision is locked so Portfolio does not rewrite or obscure the canonical provider record.',
          }],
          summary: { total: 1, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 1, ignored: 0 },
          filteredSummary: { total: 1, new: 0, needs_qa: 0, auto_send_pending: 0, lead: 0, escalated: 0, responded: 1, ignored: 0 },
          alertReliability,
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialCommentInboxPage />)

    const lockedButton = await screen.findByRole('button', { name: /^Review Locked$/i })
    expect(lockedButton).toBeDisabled()
    expect(screen.getByText(/Local approve, reject, revise, and submit controls are locked/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Draft reply/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Approve$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Reject$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Ignore$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeDisabled()
    fireEvent.click(lockedButton)
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/social-content/social-1/engagement/comments',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.queryByText(/local action was recorded without changing submitted state/i)).not.toBeInTheDocument()
  })
})
