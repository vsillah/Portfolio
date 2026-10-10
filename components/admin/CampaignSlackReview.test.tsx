import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: mocks.session }))
import CampaignSlackReview from './CampaignSlackReview'
import { fixture } from '@/lib/campaign-release-test-fixture'
import { releaseHash, type ReleaseRecord } from '@/lib/campaign-release-manifest'

const manifest = fixture()
const hash = releaseHash(manifest)
function release(change: Partial<ReleaseRecord> = {}): ReleaseRecord {
  return { manifest, hash, state: 'pending', version: 1, audit: [], ...change }
}
const intent = {
  id: '22222222-2222-4222-8222-222222222222', key: 'campaign-slack:abc', releaseId: manifest.releaseId,
  hash, version: 1, campaignId: manifest.campaignId, sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.com',
  team: 'T123', channel: 'C123', actor: 'admin-1', state: 'prepared' as const,
}
const gate = { enabled: true, reason: 'Routes this exact release for one Slack decision. Provider execution remains disabled.' }
function projection(change: Record<string, unknown> = {}) {
  return { release: release(), gate, intents: [] as Array<typeof intent>, receipts: [] as Array<Record<string, unknown>>, ...change }
}
function install(body: unknown, post: { status?: number; body?: unknown } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    if (init?.method === 'POST') return Response.json(post.body ?? { sent: false }, { status: post.status ?? 200 })
    return Response.json(body)
  }))
  return calls
}
async function clickWhenReady(name: string) {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
}
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ access_token: 'session-token' }) })
afterEach(() => { vi.unstubAllGlobals() })

it('asks for a session and does not query Slack receipts', async () => {
  mocks.session.mockResolvedValue(null)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<CampaignSlackReview record={release()} onRecord={vi.fn()} />)
  expect(await screen.findByRole('status')).toHaveTextContent('Sign in again to inspect Slack receipts.')
  expect(screen.getByRole('button', { name: 'Prepare Slack review' })).toBeDisabled()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('keeps prepare disabled when Slack status cannot be loaded', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'relation secret-token' }, { status: 503 })))
  render(<CampaignSlackReview record={release()} onRecord={vi.fn()} />)
  expect(await screen.findByRole('status')).toHaveTextContent('Slack outcome unavailable. Refresh before retrying.')
  expect(screen.queryByText(/secret-token/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Prepare Slack review' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Send review to Slack' })).not.toBeInTheDocument()
})

it('prepares once with the signed release identity and does not send', async () => {
  const calls = install(projection())
  const onRecord = vi.fn()
  render(<CampaignSlackReview record={release()} onRecord={onRecord} />)
  await clickWhenReady('Prepare Slack review')
  expect(await screen.findByRole('status')).toHaveTextContent('Intent saved. No new Slack message sent.')
  const post = calls.find(call => call.init?.method === 'POST')
  expect(post?.url).toBe(`/api/admin/campaigns/${manifest.campaignId}/releases/slack`)
  expect(post?.init?.headers).toMatchObject({ Authorization: 'Bearer session-token' })
  expect(JSON.parse(String(post?.init?.body))).toEqual({ releaseId: manifest.releaseId, hash, version: 1, dispatch: false })
  expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ hash, state: 'pending' }))
})

it('sends only the current prepared release when dispatch is enabled', async () => {
  const prepared = projection({ intents: [intent] })
  const calls = install(prepared, { body: { sent: true } })
  render(<CampaignSlackReview record={release()} onRecord={vi.fn()} />)
  await clickWhenReady('Send review to Slack')
  expect(await screen.findByRole('status')).toHaveTextContent('Review card sent. Waiting for a signed decision.')
  expect(JSON.parse(String(calls.find(call => call.init?.method === 'POST')?.init?.body))).toMatchObject({ dispatch: true, version: 1 })
})

it('does not enable send when dispatch is disabled', async () => {
  install(projection({ gate: { enabled: false, reason: 'Slack dispatch is disabled.' }, intents: [intent] }))
  render(<CampaignSlackReview record={release()} onRecord={vi.fn()} />)
  expect(await screen.findByText('Slack dispatch is disabled.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send review to Slack' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Prepare Slack review' })).not.toBeInTheDocument()
})

it('does not enable send for a prepared intent from another version', async () => {
  install(projection({ intents: [intent] }))
  render(<CampaignSlackReview record={release({ version: 2 })} onRecord={vi.fn()} />)
  expect(await screen.findByRole('button', { name: 'Send review to Slack' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Prepare Slack review' })).not.toBeInTheDocument()
})

it.each(['sending', 'unconfirmed', 'rejected'] as const)('refuses another card from a %s intent', async state => {
  install(projection({ intents: [{ ...intent, state }] }))
  render(<CampaignSlackReview record={release()} onRecord={vi.fn()} />)
  expect(await screen.findByText(/this intent cannot resend/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Prepare Slack review' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Send review to Slack' })).not.toBeInTheDocument()
})

it('uses the current version when an older prepared intent is still stored', async () => {
  install(projection({ intents: [{ ...intent, version: 2, state: 'rejected' }, intent] }))
  render(<CampaignSlackReview record={release({ version: 2 })} onRecord={vi.fn()} />)
  expect(await screen.findByText(/this intent cannot resend/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Send review to Slack' })).not.toBeInTheDocument()
})

it('shows the callback outcome and the original card update without offering another send', async () => {
  install(projection({
    intents: [{ ...intent, state: 'sent' }],
    receipts: [{ id: '55555555-5555-4555-8555-555555555555', state: 'delivered', action: 'campaign_release.approve',
      status: 'completed', text: 'Campaign release approved.', delivery: 'delivered' }],
  }))
  render(<CampaignSlackReview record={release()} onRecord={vi.fn()} />)
  expect(await screen.findByText(/Decision recorded/)).toBeInTheDocument()
  expect(screen.getByText('Original Slack card updated.')).toBeInTheDocument()
  expect(screen.getByText('Campaign release approved.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Inspect callback receipt' })).toHaveAttribute('href', '/admin/agents/runs/55555555-5555-4555-8555-555555555555')
  expect(screen.queryByRole('button', { name: 'Send review to Slack' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Prepare Slack review' })).not.toBeInTheDocument()
})

it.each([
  [{ state: 'reconciliation_required', status: 'failed', delivery: 'failed', deliveryError: 'Card update blocked.' }, 'Callback outcome unconfirmed', 'Original card update failed or blocked.', 'Card update blocked.'],
  [{ state: 'delivered', status: 'blocked', delivery: 'delivered' }, 'Decision blocked', 'Original Slack card updated.', ''],
  [{ state: 'delivered', status: 'already_recorded' }, 'Duplicate decision recorded', 'Original card update unconfirmed.', ''],
  [{ state: 'queued' }, 'Callback accepted · decision pending', 'Original card update unconfirmed.', 'Refresh to check the durable worker outcome. Do not repeat the decision.'],
])('labels callback %j as %s', async (receipt, summary, delivery, detail) => {
  install(projection({ intents: [{ ...intent, state: 'sent' }], receipts: [{ id: 'receipt-1', action: 'campaign_release.stop', ...receipt }] }))
  render(<CampaignSlackReview record={release()} onRecord={vi.fn()} />)
  expect(await screen.findByText(new RegExp(summary))).toBeInTheDocument()
  expect(screen.getByText(delivery)).toBeInTheDocument()
  if (detail) expect(screen.getByText(detail)).toBeInTheDocument()
})

it('shows the curated request failure and clears the stale projection', async () => {
  install(projection(), { status: 409, body: { error: 'Slack request unconfirmed. Refresh the release and receipt before retrying.' } })
  render(<CampaignSlackReview record={release()} onRecord={vi.fn()} />)
  await clickWhenReady('Prepare Slack review')
  expect(await screen.findByRole('status')).toHaveTextContent('Slack request unconfirmed. Refresh the release and receipt before retrying.')
  expect(screen.getByText('Load Slack status before routing this release.')).toBeInTheDocument()
})
