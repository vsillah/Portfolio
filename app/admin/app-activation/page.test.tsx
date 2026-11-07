import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
vi.mock('server-only', () => ({}))
import { getOperatorSnapshot, resetSyntheticOperatorReviewForTests } from '@/lib/app-activation-operator'

const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentSession: sessionMock }))
vi.mock('@/components/ProtectedRoute', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

import Page from './page'

beforeEach(() => {
  resetSyntheticOperatorReviewForTests()
  sessionMock.mockResolvedValue({ access_token: 'synthetic-session' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => getOperatorSnapshot(true) }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('app activation operator console', () => {
  it('searches, filters, clears filters, and shows source and audit details', async () => {
    const user = userEvent.setup()
    render(<Page />)
    expect(await screen.findByRole('button', { name: /adult.one@example.test/ })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Search adult email, ID, or receipt'), 'future-006')
    expect(screen.getByText('adult.six@example.test')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Interest records')).queryByText('adult.one@example.test')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'approved')
    expect(screen.getByText(/No records match/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(within(screen.getByLabelText('Interest records')).getByText('adult.one@example.test')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /adult.two@example.test/ }))
    expect(within(screen.getByLabelText('Record details')).getByText('fixture:tt-002')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Record details')).getByText('Audit history')).toBeInTheDocument()
  })

  it('requires a reason and destructive confirmation before the request', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await screen.findByRole('button', { name: /adult.one@example.test/ })
    await user.click(screen.getByRole('button', { name: /adult.two@example.test/ }))
    await user.click(screen.getByRole('button', { name: 'Reject interest' }))
    const confirm = screen.getByRole('button', { name: 'Confirm reject interest' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Audit reason'), 'Reviewed synthetic source receipt.')
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Type reject to confirm'), 'reject')
    expect(confirm).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Audit reason')).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('opens every available lifecycle action with an audit form', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await screen.findByRole('button', { name: /adult.one@example.test/ })
    const paths = [
      ['adult.one@example.test', 'Start or resume review'],
      ['adult.two@example.test', 'Approve interest'],
      ['adult.two@example.test', 'Waitlist interest'],
      ['adult.two@example.test', 'Reject interest'],
      ['adult.three@example.test', 'Prepare synthetic invitation'],
      ['adult.four@example.test', 'Revoke invitation'],
      ['adult.five@example.test', 'Revoke grant'],
    ] as const
    for (const [email, action] of paths) {
      await user.click(screen.getByRole('button', { name: new RegExp(email.replace('.', '\\.'), 'i') }))
      await user.click(screen.getByRole('button', { name: action, exact: true }))
      expect(screen.getByLabelText('Audit reason')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
    }
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('explains blocked approval and does not show an action for hosted mode', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await screen.findByRole('button', { name: /adult.one@example.test/ })
    expect(screen.getByRole('button', { name: 'Approve interest' })).toBeDisabled()
    expect(screen.getByText('Start or resume review before approval.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /adult.four@example.test/ }))
    expect(screen.getAllByText('Revoke the issued invitation first.')).toHaveLength(2)
    cleanup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => getOperatorSnapshot(false) }))
    render(<Page />)
    expect(await screen.findByText('Provider setup required')).toBeInTheDocument()
    expect(screen.queryByText('Operator actions')).not.toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })
})
