import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  return {
    chain,
    from: vi.fn(() => chain),
  }
})

vi.mock('./supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { getBuildEvidenceForClientProject } from './client-build-evidence'

describe('getBuildEvidenceForClientProject', () => {
  it('only fetches client-visible build evidence for the project', async () => {
    mocks.chain.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'evidence-1',
        project_label: 'ReversR Rebuild Product Asset',
        captured_at: '2026-06-15T12:00:00.000Z',
        repo_metrics: {},
        token_usage: {},
        cost_summary: {},
        hourly_translation: {},
        source_confidence: {},
        client_safe_notes: [],
      },
      error: null,
    })

    await getBuildEvidenceForClientProject('project-1')

    expect(mocks.from).toHaveBeenCalledWith('client_project_build_evidence')
    expect(mocks.chain.eq).toHaveBeenCalledWith('client_project_id', 'project-1')
    expect(mocks.chain.eq).toHaveBeenCalledWith('is_client_visible', true)
    expect(mocks.chain.select.mock.calls[0]?.[0]).not.toContain('private_source_refs')
  })
})
