import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/sales/ai-insights', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/sales/ai-insights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admins before parsing the body', async () => {
    mocks.isAuthError.mockReturnValue(true)
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })

    const response = await POST(makeRequest('{'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })

  it('returns a generic 500 when the body is not JSON', async () => {
    const response = await POST(makeRequest('{'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })

  it('lets high urgency beat opportunity and caps pains, products, and the close', async () => {
    const response = await POST(makeRequest({
      audit: {
        business_challenges: {
          pain_points: ['Inbox overload', 'No owner', 'Slow quotes', 'Extra pain'],
          primary_challenges: ['Lead Follow-Up', 'Billing'],
          current_impact: 'Lost deals',
        },
        automation_needs: {
          priority_areas: ['CRM Hygiene'],
          desired_outcomes: ['Faster replies', 'Cleaner pipeline', 'Extra outcome'],
        },
        budget_timeline: {
          budget_range: 'tight',
          timeline: 'this quarter',
          decision_timeline: 'Next Week',
        },
        decision_making: { decision_maker: true, stakeholders: ['CFO'] },
        urgency_score: 8,
        opportunity_score: 9,
      },
      contact: { name: 'Ada Lovelace', company: 'Northstar' },
      products: [
        { id: 1, name: 'Magnet', offer_role: 'lead_magnet' },
        { id: 2, name: 'Core A', offer_role: 'core_offer' },
        { id: 3, name: 'Up B', offer_role: 'upsell' },
        { id: 4, name: 'Core C', offer_role: 'core_offer' },
        { id: 5, name: 'Core D', offer_role: 'core_offer' },
      ],
    }))

    expect(response.status).toBe(200)
    const { insights } = await response.json()
    expect(insights.openingLine).toContain('Hi Ada,')
    expect(insights.openingLine).toContain('pressing challenges')
    expect(insights.openingLine).toContain('around lead follow-up')
    expect(insights.openingLine).not.toContain('great opportunities')
    expect(insights.keyPainPoints).toEqual([
      'Inbox overload',
      'No owner',
      'Slow quotes',
      'Lead Follow-Up',
      'Billing',
    ])
    expect(insights.anticipatedObjections).toEqual([
      expect.objectContaining({
        objection: 'Let me think about it',
        response: expect.stringContaining('Lead Follow-Up'),
      }),
    ])
    expect(insights.productRecommendations.map((item: { productId: number }) => item.productId)).toEqual([2, 3, 4])
    expect(insights.productRecommendations[0].reason).toBe('Aligns with their need for CRM Hygiene')
    expect(insights.productRecommendations[0].talkingPoint).toContain('Lead Follow-Up')
    expect(insights.productRecommendations[0].talkingPoint).toContain('Core A')
    expect(insights.customizedTalkingPoints[0].personalizedNote).toContain('High urgency')
    expect(insights.customizedTalkingPoints[1].personalizedNote).toContain('premium solutions')
    expect(insights.customizedTalkingPoints[1].points).toEqual(expect.arrayContaining([
      expect.stringContaining('lost deals'),
      expect.stringContaining('Faster replies'),
      expect.stringContaining('Cleaner pipeline'),
      expect.stringContaining('tight'),
    ]))
    expect(insights.customizedTalkingPoints[1].points.some((point: string) => point.includes('Extra outcome'))).toBe(false)
    expect(insights.customizedTalkingPoints[2].points).toEqual([
      'Work with their timeline: "You mentioned you can decide next week"',
      "They're the decision maker - ask for the sale directly",
      'Create urgency: Offer a time-sensitive bonus or early-start discount',
    ])
  })

  it('builds the opportunity opening and keeps only the first four objections', async () => {
    const response = await POST(makeRequest({
      audit: {
        business_challenges: {
          pain_points: [],
          primary_challenges: ['Invoicing'],
          current_impact: 'Slow cash',
        },
        automation_needs: { priority_areas: [], desired_outcomes: [] },
        ai_readiness: {
          concerns: ['Cost', 'Data privacy', 'Account security'],
          team_readiness: 'Somewhat Hesitant',
        },
        budget_timeline: { budget_range: '$500', timeline: 'Later this year' },
        decision_making: { decision_maker: false, stakeholders: ['Ops Lead', 'Founder'] },
        urgency_score: 6,
        opportunity_score: 8,
      },
      contact: { name: ' Ada Lovelace', company: '  Acme' },
      products: [],
    }))

    const { insights } = await response.json()
    expect(insights.openingLine).toContain('Hi there,')
    expect(insights.openingLine).toContain('for   Acme to improve efficiency')
    expect(insights.openingLine).not.toContain('in invoicing')
    expect(insights.keyPainPoints).toEqual(['Invoicing', 'Slow cash'])
    expect(insights.anticipatedObjections.map((item: { objection: string }) => item.objection)).toEqual([
      "That's more than we budgeted for",
      "We're not ready to start right now",
      'I need to run this by my team',
      "We're worried about data privacy",
    ])
    expect(insights.anticipatedObjections[0].likelyTrigger).toContain('$500')
    expect(insights.anticipatedObjections[0].response).toContain('slow cash')
    expect(insights.anticipatedObjections[1].response).toContain('  Acme')
    expect(insights.anticipatedObjections[2].response).toContain('Ops Lead')
    expect(insights.anticipatedObjections[3].likelyTrigger).toContain('Data privacy')
    expect(JSON.stringify(insights.anticipatedObjections)).not.toContain('too complex')
    expect(insights.productRecommendations).toEqual([])
    expect(insights.customizedTalkingPoints[0].personalizedNote).toContain('Moderate urgency')
    expect(insights.customizedTalkingPoints[2].points[2]).toBe(
      'Propose a pilot or trial to reduce perceived risk'
    )
    expect(insights.customizedTalkingPoints[2].points[1]).toContain('Ops Lead')
  })

  it('treats a missing decision-maker flag as not the buyer when stakeholders exist', async () => {
    const response = await POST(makeRequest({
      audit: {
        business_challenges: { primary_challenges: ['Scheduling'] },
        budget_timeline: { budget_range: 'under 2000', timeline: 'LATER' },
        decision_making: { stakeholders: ['CFO'] },
        urgency_score: 3,
        opportunity_score: 3,
      },
      contact: { name: 'Ada', company: 'Northstar' },
      products: [],
    }))

    const { insights } = await response.json()
    expect(insights.openingLine).toContain('move forward')
    expect(insights.openingLine).not.toContain('pressing challenges')
    expect(insights.anticipatedObjections.map((item: { objection: string }) => item.objection)).toEqual([
      "We're not ready to start right now",
      'I need to run this by my team',
    ])
    expect(insights.anticipatedObjections[1].likelyTrigger).toContain('CFO')
    expect(JSON.stringify(insights.anticipatedObjections)).not.toContain('budgeted')
  })

  it('adds the default hesitation objection when only team readiness is hesitant', async () => {
    const response = await POST(makeRequest({
      audit: {
        ai_readiness: { team_readiness: 'Hesitant about change' },
        decision_making: { decision_maker: true },
      },
      contact: {},
      products: [],
    }))

    const { insights } = await response.json()
    expect(insights.openingLine).toContain('Hi there,')
    expect(insights.openingLine).toContain('your company')
    expect(insights.anticipatedObjections.map((item: { objection: string }) => item.objection)).toEqual([
      'This seems too complex for our team',
      'Let me think about it',
    ])
    expect(insights.anticipatedObjections[0].likelyTrigger).toContain('Hesitant about change')
    expect(insights.anticipatedObjections[0].response).toContain('within 2 weeks')
    expect(insights.anticipatedObjections[1].response).toContain('these challenges')
    expect(insights.customizedTalkingPoints[2].points[1]).toBe(
      "They're the decision maker - ask for the sale directly"
    )
  })

  it('returns a generic 500 when products are missing', async () => {
    const response = await POST(makeRequest({
      audit: {},
      contact: { name: 'Ada' },
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })
})
