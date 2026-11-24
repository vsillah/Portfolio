import { describe, expect, it, vi } from 'vitest'

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/agentified-calendar-drafts', () => ({
  agentifiedCalendarDrafts: () => [{
    asset_id: 'AW-IG-CAR-01',
    id: 'agentified-draft:agentified-workshop-2026-post-thanksgiving:AW-IG-CAR-01:v1',
  }],
}))

import AgentifiedCalendarRedirect from './page'

describe('legacy Agentified calendar route', () => {
  it('redirects a selected asset into the canonical Release Calendar row', async () => {
    await AgentifiedCalendarRedirect({ searchParams: Promise.resolve({ asset: 'AW-IG-CAR-01' }) })
    expect(redirect).toHaveBeenCalledWith(
      '/admin/agents/content-intelligence?section=calendar&calendar_item=agentified-draft%3Aagentified-workshop-2026-post-thanksgiving%3AAW-IG-CAR-01%3Av1',
    )
  })

  it('redirects unknown assets to the canonical calendar without guessing ownership', async () => {
    await AgentifiedCalendarRedirect({ searchParams: Promise.resolve({ asset: 'unknown' }) })
    expect(redirect).toHaveBeenCalledWith('/admin/agents/content-intelligence?section=calendar')
  })
})
