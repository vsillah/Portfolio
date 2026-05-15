import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/sales/generate-step', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/sales/generate-step', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({
      user: { id: 'admin-user-1' },
      isAdmin: true,
    })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('carries lead and call notes into generated script steps', async () => {
    const response = await POST(makeRequest({
      stepType: 'opening',
      audit: {
        key_insights: ['manual follow-up is slowing revenue'],
        business_challenges: { primary_challenges: ['missed lead follow-up'] },
      },
      clientName: 'Amina',
      clientCompany: 'Northstar Studio',
      previousSteps: [],
      availableContent: [],
      conversationHistory: [],
      contactNotes: 'Mentioned they need a lighter first engagement.',
      callNotes: 'Prefers examples tied to missed consultations.',
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.step.talkingPoints).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Contact: Mentioned they need a lighter first engagement.'),
        expect.stringContaining('Call: Prefers examples tied to missed consultations.'),
      ])
    )
    expect(body.step.suggestedActions).toContain(
      'Use the contact and call notes when choosing language, examples, and next questions'
    )
  })
})
