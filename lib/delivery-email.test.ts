import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))
vi.mock('@/lib/system-prompts', () => ({
  getSystemPrompt: vi.fn(),
}))
vi.mock('@/lib/cost-calculator', () => ({
  recordOpenAICost: vi.fn(),
}))
vi.mock('@/lib/notifications', () => ({
  sendEmail: vi.fn(),
}))

import { suggestEmailTemplate, type ContactPageData } from './delivery-email'

function makeContactData(overrides: Partial<ContactPageData> = {}): ContactPageData {
  return {
    gammaReports: [],
    videos: [],
    valueReports: [],
    deliveries: [],
    salesSessions: [],
    audits: [],
    ...overrides,
  }
}

describe('suggestEmailTemplate', () => {
  it('returns proposal delivery when sales session exists', () => {
    const result = suggestEmailTemplate(
      makeContactData({
        salesSessions: [{ id: 'session-1' }],
      })
    )

    expect(result).toBe('email_proposal_delivery')
  })

  it('returns follow up when deliveries exist but no sales sessions', () => {
    const result = suggestEmailTemplate(
      makeContactData({
        deliveries: [{ id: 'delivery-1' }],
      })
    )

    expect(result).toBe('email_follow_up')
  })

  it('returns asset delivery when generated assets exist without delivery history', () => {
    const result = suggestEmailTemplate(
      makeContactData({
        gammaReports: [{ id: 'gamma-1' }],
      })
    )

    expect(result).toBe('email_asset_delivery')
  })

  it('returns cold outreach when no prior engagement exists', () => {
    const result = suggestEmailTemplate(makeContactData())

    expect(result).toBe('email_cold_outreach')
  })
})
