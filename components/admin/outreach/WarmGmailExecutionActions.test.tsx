import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { warmFinalCopyFingerprint } from '@/lib/warm-outreach-copy-fingerprint'
import { buildWarmGmailActionRequest } from '@/lib/warm-gmail-action-request'
import WarmGmailExecutionActions from './WarmGmailExecutionActions'
import type { WarmGmailDraftReviewData } from './WarmGmailDraftReviewPanel'
vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn(async () => ({ access_token: 'synthetic-session' })) }))
const base: WarmGmailDraftReviewData = {
  id: 'queue-1', contactSubmissionId: 42, channel: 'email', status: 'approved', subject: 'Workshop follow-up', body: 'Hi Amina, would Tuesday at 2 suit a follow-up?', updatedAt: '2026-09-08T12:00:00.000Z', createdAt: '2026-09-08T12:00:00.000Z', sequenceStep: 1, generationModel: null, generationPromptSummary: null, generationInputs: {},
}
function readiness(action: 'draft' | 'send', data = base) {
  const reviewedCopy = { queueId: data.id, recipientEmail: 'amina@example.com', sender: 'sender@example.com', subject: data.subject!, body: data.body!, updatedAt: data.updatedAt! }
  return { reviewedCopy, noSendSmoke: action === 'draft', readyForConfirmation: action === 'send', expectedAuthorization: {
    expectedUpdatedAt: data.updatedAt, finalCopyFingerprint: warmFinalCopyFingerprint({ id: data.id, contact_submission_id: 42, contact_submissions: { email: reviewedCopy.recipientEmail }, subject: data.subject, body: data.body }), recipientEmail: reviewedCopy.recipientEmail,
    ...(action === 'draft' ? { createGmailDraft: true, draftAuthorization: 'create_gmail_draft_for_recipient' } : { executeGmailSend: true, sendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient', gmailDraftId: 'draft-1' }),
  } }
}
afterEach(() => vi.unstubAllGlobals())
describe('explicit warm Gmail operator actions', () => {
  it('requires separate confirmations and refreshed authorization before receipt', async () => {
    let stored = structuredClone(base)
    const calls: Array<{ path: string; body: Record<string, unknown> }> = []
    const fetchMock = vi.fn(async (path: string, options: RequestInit) => {
      expect(options.headers).toMatchObject({ Authorization: 'Bearer synthetic-session' })
      const body = JSON.parse(String(options.body)); calls.push({ path, body })
      let result: Record<string, unknown>
      if (body.noSendSmoke) result = readiness('draft', stored)
      else if (body.createGmailDraft) {
        expect(body).toEqual(buildWarmGmailActionRequest('draft', readiness('draft', stored), stored))
        stored = { ...stored, updatedAt: '2026-09-08T12:00:01.000Z', generationInputs: { gmail_draft_creation: { draft_id: 'draft-1' } } }
        result = { gmailDraftCreated: true, draftId: 'draft-1', message: 'Draft saved in Gmail. No email sent.' }
      } else if (path.endsWith('slack-send-approval')) {
        expect(body.expectedUpdatedAt).toBe(stored.updatedAt)
        result = { approvalRequest: { status: 'pending' } }
      } else if (body.prepareOnly) result = readiness('send', stored)
      else {
        expect(body).toEqual(buildWarmGmailActionRequest('send', readiness('send', stored), stored))
        stored = { ...stored, status: 'sent' }
        result = { status: 'sent', gmailSendCalled: true, externalSendPerformed: true, messageId: 'message-1', threadId: 'thread-1', message: 'Gmail sent the authorized draft. Receipt recorded.' }
      }
      return { ok: true, json: async () => result }
    })
    vi.stubGlobal('fetch', fetchMock)
    function Harness() { const [data, setData] = useState(stored); return <WarmGmailExecutionActions data={data} onRefresh={async () => setData(stored)} /> }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Review Gmail draft creation' }))
    const create = await screen.findByRole('button', { name: 'Create Gmail draft' })
    expect(calls).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Exact Gmail confirmation' })).toHaveTextContent('sender@example.com')
    fireEvent.click(create)
    fireEvent.click(create)
    await screen.findByRole('button', { name: 'Prepare review request' })
    expect(calls.filter(call => call.body.createGmailDraft)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Prepare review request' }))
    await screen.findByText(/Slack delivery has not occurred/)
    expect(screen.queryByRole('button', { name: 'Review Gmail send' })).not.toBeInTheDocument()
    // Separate, already-recorded authorization becomes visible only on refresh.
    stored = { ...stored, generationInputs: { ...stored.generationInputs, warm_gmail_send_authorization: { status: 'approved' } } }
    fireEvent.click(screen.getByRole('button', { name: 'Refresh review' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review Gmail send' }))
    const send = await screen.findByRole('button', { name: 'Send this Gmail draft' })
    expect(calls.filter(call => call.body.executeGmailSend)).toHaveLength(0)
    fireEvent.click(send)
    await screen.findByText('Gmail sent the authorized draft. Receipt recorded.')
    expect(calls.filter(call => call.body.executeGmailSend)).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Review Gmail send' })).not.toBeInTheDocument()
  })
  it('requires an explicit Slack destination confirmation and locks a lost receipt', async () => {
    const data = { ...base, generationInputs: { gmail_draft_creation: { draft_id: 'draft-1' }, warm_gmail_send_slack_approval_request: { status: 'pending' } } }
    const prepared = { ...readiness('send', data), slackDestination: { workspaceId: 'TTEST', channelId: 'CTEST' }, expectedAuthorization: { ...readiness('send', data).expectedAuthorization, executeGmailSend: undefined, sendReviewToSlack: true, workspaceId: 'TTEST', channelId: 'CTEST' } }
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => prepared }).mockRejectedValueOnce(new Error('Slack result unknown; reconcile the channel.'))
    vi.stubGlobal('fetch', fetchMock)
    render(<WarmGmailExecutionActions data={data} onRefresh={async () => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review Slack delivery' }))
    const send = await screen.findByRole('button', { name: 'Send review to Slack' })
    expect(screen.getByRole('group', { name: 'Exact Gmail confirmation' })).toHaveTextContent('Slack workspace TTEST')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(send)
    await screen.findByText('Slack result unknown; reconcile the channel.')
    expect(screen.getByRole('link', { name: 'Open Slack to reconcile' })).toHaveAttribute('href', 'https://app.slack.com/client/TTEST/CTEST')
    expect(screen.queryByRole('button', { name: 'Review Slack delivery' })).not.toBeInTheDocument()
  })

  it('recovers approved post-mailbox revisions through an explicit update, then fresh review', async () => {
    let stored = { ...base, body: 'Approved revised follow-up', generationInputs: { gmail_draft_creation: { draft_id: 'draft-1' }, copy_revision_requires_provider_reconciliation: true } } as WarmGmailDraftReviewData
    const fetchMock = vi.fn(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body))
      if (body.noSendSmoke) {
        expect(body.prepareDraftUpdate).toBe(true)
        return { ok: true, json: async () => ({ ...readiness('draft', stored), expectedAuthorization: { ...readiness('draft', stored).expectedAuthorization, createGmailDraft: false, updateGmailDraft: true, gmailDraftId: 'draft-1', draftAuthorization: 'update_gmail_draft_for_recipient' } }) }
      }
      expect(body.updateGmailDraft).toBe(true)
      expect(body.createGmailDraft).toBe(false)
      stored = { ...stored, generationInputs: { gmail_draft_creation: { draft_id: 'draft-1' }, copy_revision_requires_provider_reconciliation: false, warm_gmail_send_authorization: null, warm_gmail_send_slack_approval_request: null } }
      return { ok: true, json: async () => ({ gmailDraftUpdated: true, draftId: 'draft-1', message: 'Draft updated. Fresh review required.' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    function Harness() { const [data, setData] = useState(stored); return <WarmGmailExecutionActions data={data} onRefresh={async () => setData(stored)} /> }
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Review Gmail send' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review Gmail draft update' }))
    const update = await screen.findByRole('button', { name: 'Update Gmail draft' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(update)
    await screen.findByRole('button', { name: 'Prepare review request' })
    expect(screen.queryByRole('button', { name: 'Review Gmail send' })).not.toBeInTheDocument()
  })

  it.each(['flag changed', 'stale version', 'CAS rejected'])('releases only a confirmed %s local lock after authoritative refresh', async reason => {
    let stored = structuredClone(base)
    const prepared = readiness('draft', stored)
    const fetchMock = vi.fn().mockImplementationOnce(async () => ({ ok: true, json: async () => prepared }))
      .mockImplementationOnce(async () => {
        stored = { ...stored, updatedAt: '2026-09-08T13:00:00.000Z', body: 'Current reviewed copy' }
        return { ok: false, json: async () => ({ error: reason, actionOutcome: 'rejected_before_external_action' }) }
      }).mockImplementation(async () => ({ ok: true, json: async () => readiness('draft', stored) }))
    vi.stubGlobal('fetch', fetchMock)
    function Harness() { const [data, setData] = useState(stored); return <WarmGmailExecutionActions data={data} onRefresh={async () => setData(stored)} /> }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Review Gmail draft creation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Create Gmail draft' }))
    await screen.findByText(reason)
    fireEvent.click(await screen.findByRole('button', { name: 'Review Gmail draft creation' }))
    await screen.findByRole('button', { name: 'Create Gmail draft' })
    expect(screen.getByRole('group', { name: 'Exact Gmail confirmation' })).toHaveTextContent('Current reviewed copy')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('keeps authoritative in-flight state locked after a confirmed CAS loser refresh', async () => {
    let stored = structuredClone(base)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => readiness('draft') }).mockImplementationOnce(async () => {
      stored = { ...stored, generationInputs: { warm_gmail_draft_creation_attempt: { status: 'creating' } } }
      return { ok: false, json: async () => ({ actionOutcome: 'rejected_before_external_action', error: 'Another request won.' }) }
    }))
    function Harness() { const [data, setData] = useState(stored); return <WarmGmailExecutionActions data={data} onRefresh={async () => setData(stored)} /> }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Review Gmail draft creation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Create Gmail draft' }))
    await screen.findByText('Another request won.')
    expect(screen.queryByRole('button', { name: 'Review Gmail draft creation' })).not.toBeInTheDocument()
  })

  it('does not release on HTTP status or unknown receipt alone, even after refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => readiness('draft') }).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ status: 'outcome_unknown', error: 'Reconcile receipt.' }) }))
    render(<WarmGmailExecutionActions data={base} onRefresh={async () => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review Gmail draft creation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Create Gmail draft' }))
    await screen.findByText('Reconcile receipt.')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh review' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Review Gmail draft creation' })).not.toBeInTheDocument())
  })

  it('keeps the local lock when authoritative refresh fails after a confirmed rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => readiness('draft') }).mockResolvedValueOnce({ ok: false, json: async () => ({ actionOutcome: 'rejected_before_external_action', error: 'Stale version.' }) }))
    render(<WarmGmailExecutionActions data={base} onRefresh={async () => { throw new Error('Refresh failed.') }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review Gmail draft creation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Create Gmail draft' }))
    await screen.findByText('Refresh failed.')
    expect(screen.queryByRole('button', { name: 'Review Gmail draft creation' })).not.toBeInTheDocument()
  })

  it('offers recovery when execution setup is disabled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ readyForConfirmation: false, message: 'Live Gmail sending is disabled. Complete setup, then refresh.' }) })))
    render(<WarmGmailExecutionActions data={{ ...base, generationInputs: { gmail_draft_creation: { draft_id: 'draft' }, warm_gmail_send_authorization: { status: 'approved' } } }} onRefresh={async () => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review Gmail send' }))
    await screen.findByText(/Live Gmail sending is disabled/)
    expect(screen.queryByRole('button', { name: 'Send this Gmail draft' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh review' })).toBeEnabled()
  })
  it('locks after a lost provider response without offering automatic retry', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => readiness('draft') }).mockRejectedValueOnce(new Error('Connection lost; reconcile the mailbox.'))
    vi.stubGlobal('fetch', fetchMock)
    render(<WarmGmailExecutionActions data={base} onRefresh={async () => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review Gmail draft creation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Create Gmail draft' }))
    await screen.findByText('Connection lost; reconcile the mailbox.')
    expect(screen.queryByRole('button', { name: 'Review Gmail draft creation' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Gmail to reconcile' })).toBeInTheDocument()
  })
  it('rejects a confirmation whose displayed copy changed', async () => {
    expect(() => buildWarmGmailActionRequest('draft', readiness('draft'), { ...base, body: 'Changed copy' })).toThrow('changed')
    expect(() => buildWarmGmailActionRequest('send', { ...readiness('send'), readyForConfirmation: false }, base)).toThrow('not ready')
  })
})
