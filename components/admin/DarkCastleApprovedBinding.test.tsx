import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/authenticated-fetch', () => ({ fetchWithSessionRecovery: mocks.fetch }))
import DarkCastleApprovedBinding from './DarkCastleApprovedBinding'

describe('Dark Castle approved binding operator surface', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('names the missing copy receipts and keeps the mutation disabled', async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ready: false, packetPrepared: false,
      blockers: ['Six persisted copy-review evidence receipts are missing.'], externalExecution: false,
      assetStatus: 'Approved artifact files verified by SHA-256.' }) })
    render(<DarkCastleApprovedBinding />)
    expect(await screen.findByText('Preparation blocked')).toBeVisible()
    expect(screen.getByText('Six persisted copy-review evidence receipts are missing.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Bind and prepare copy packet' })).toBeDisabled()
    expect(screen.getByText('5 Platform submission')).toBeVisible()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})
