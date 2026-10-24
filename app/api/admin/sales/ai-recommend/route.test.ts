import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getAllActiveUpsellPaths: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/upsell-paths', () => ({
  getAllActiveUpsellPaths: mocks.getAllActiveUpsellPaths,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/sales/ai-recommend', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function content(overrides: Record<string, unknown>) {
  return {
    content_id: '1',
    title: 'Offer',
    description: null,
    content_type: 'product',
    price: 100,
    image_url: null,
    is_active: true,
    display_order: 1,
    role_id: null,
    offer_role: 'bonus',
    dream_outcome_description: null,
    likelihood_multiplier: null,
    time_reduction: null,
    effort_reduction: null,
    role_retail_price: null,
    offer_price: null,
    perceived_value: null,
    bonus_name: null,
    bonus_description: null,
    qualifying_actions: null,
    payout_type: null,
    ...overrides,
  }
}

function upsellPath(overrides: Record<string, unknown>) {
  return {
    source_content_type: 'product',
    source_content_id: 'src-1',
    source_title: 'Starter Audit',
    next_problem: 'A'.repeat(120),
    upsell_title: 'Follow-up Ops',
    point_of_sale_steps: [{ talking_points: ['Mention the next bottleneck.'] }],
    value_frame_text: null,
    credit_previous_investment: true,
    ...overrides,
  }
}

describe('POST /api/admin/sales/ai-recommend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAllActiveUpsellPaths.mockResolvedValue([])
  })

  it('rejects non-admins before parsing the body or loading upsell paths', async () => {
    mocks.isAuthError.mockReturnValue(true)
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await POST(makeRequest('{'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getAllActiveUpsellPaths).not.toHaveBeenCalled()
  })

  it('returns a generic 500 when the body is not JSON', async () => {
    const response = await POST(makeRequest('{'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
    expect(mocks.getAllActiveUpsellPaths).not.toHaveBeenCalled()
  })

  it('ranks price strategies from content keys and ignores non-product prefixes', async () => {
    const response = await POST(makeRequest({
      audit: {
        urgency_score: 8,
        opportunity_score: 9,
        ai_readiness: { concerns: ['Cost'] },
        budget_timeline: { timeline: 'within 30 days', budget_range: '$2k' },
        automation_needs: { priority_areas: ['lead routing'] },
      },
      currentObjection: 'price_objection',
      conversationHistory: [],
      productsPresented: [999],
      contentPresented: ['product:12abc', 'ebook:9', 'product:', 'nocolon'],
      availableContent: [
        content({ content_id: '12', title: 'Shown Bonus', bonus_name: 'Shown' }),
        content({
          content_id: '44',
          title: 'Hidden Bonus',
          bonus_name: 'Workshop',
          perceived_value: 80,
          dream_outcome_description: 'Faster follow-up',
        }),
        content({ content_id: 'nope', title: 'Zero Id Bonus', price: 5 }),
        content({ content_id: '9', title: 'Decoy Plan', offer_role: 'decoy', price: 99 }),
        content({ content_id: '8', title: 'Plan B', offer_role: 'downsell', price: 40 }),
        content({ content_id: '3', title: 'Core Kit', offer_role: 'core_offer', price: 500 }),
      ],
      clientCompany: 'Northstar',
    }))

    expect(response.status).toBe(200)
    const { recommendations } = await response.json()
    expect(recommendations.map((item: { strategy: string; confidence: number }) => ({
      strategy: item.strategy,
      confidence: item.confidence,
    }))).toEqual([
      { strategy: 'stack_bonuses', confidence: 0.95 },
      { strategy: 'payment_plan', confidence: 0.85 },
      { strategy: 'show_decoy', confidence: 0.8 },
    ])
    expect(recommendations[0].products.map((product: { id: number }) => product.id)).toEqual([44, 0])
    expect(recommendations[0].products[1].reason).toBe('Addresses their lead routing')
    expect(recommendations[0].talkingPoint).toBe(
      '"Let me show you what\'s included with this. Workshop alone is worth $80..."'
    )
    expect(recommendations[0].why).toContain('high opportunity (9/10)')
    expect(recommendations[1].products).toEqual([
      expect.objectContaining({ id: 8, name: 'Plan B' }),
    ])
    expect(recommendations[1].why).toBe(
      'Budget of $2k with urgency 8/10 - payment plan removes the barrier'
    )
    expect(recommendations[2].products).toEqual([
      expect.objectContaining({ id: 9, name: 'Decoy Plan' }),
    ])
    expect(recommendations[2].talkingPoint).toContain('Decoy Plan')
    expect(recommendations[2].talkingPoint).toContain('$99')
  })

  it('uses legacy product ids when no content keys are presented', async () => {
    const response = await POST(makeRequest({
      audit: { opportunity_score: 5 },
      currentObjection: 'price_objection',
      conversationHistory: [],
      productsPresented: [2],
      availableProducts: [
        { id: 2, title: 'Already shown', offer_role: 'bonus', price: 10 },
        { id: 3, title: 'Still available', offer_role: 'bonus', price: 15, bonus_name: 'New Bonus', perceived_value: 40 },
      ],
    }))

    const { recommendations } = await response.json()
    const stacked = recommendations.find((item: { strategy: string }) => item.strategy === 'stack_bonuses')
    expect(stacked.products.map((product: { id: number }) => product.id)).toEqual([3])
    expect(stacked.talkingPoint).toContain('New Bonus')
    expect(stacked.talkingPoint).toContain('$40')
  })

  it('merges offer upsells into the top three and skips empty or unmatched paths', async () => {
    mocks.getAllActiveUpsellPaths.mockResolvedValue([
      upsellPath({}),
      upsellPath({ upsell_title: 'Skipped Path', point_of_sale_steps: [] }),
      upsellPath({
        source_content_type: 'ebook',
        source_content_id: 'src-2',
        source_title: 'Guide',
        upsell_title: 'Ebook Upgrade',
        point_of_sale_steps: [{ talking_points: [] }],
        value_frame_text: 'Frame the upgrade.',
        credit_previous_investment: false,
      }),
      upsellPath({ source_content_id: 'other', upsell_title: 'Unmatched Path' }),
    ])

    const response = await POST(makeRequest({
      audit: { urgency_score: 5, opportunity_score: 5 },
      currentObjection: 'positive',
      conversationHistory: [],
      contentPresented: ['product:src-1', 'ebook:src-2', 'nocolon', ':bad', 'product:'],
      clientName: 'Ada',
    }))

    const { recommendations } = await response.json()
    expect(recommendations).toHaveLength(3)
    expect(recommendations.map((item: { strategy: string; confidence: number }) => ({
      strategy: item.strategy,
      confidence: item.confidence,
    }))).toEqual([
      { strategy: 'continue_script', confidence: 0.9 },
      { strategy: 'different_product', confidence: 0.85 },
      { strategy: 'different_product', confidence: 0.85 },
    ])
    expect(recommendations[1]).toMatchObject({
      offerRole: 'upsell',
      talkingPoint: 'Mention the next bottleneck.',
      products: [{
        id: 0,
        name: 'Follow-up Ops',
        reason: `Solves the predicted next problem: "${'A'.repeat(100)}..."`,
      }],
    })
    expect(recommendations[1].why).toBe(
      'Offer-level upsell: Starter Audit → Follow-up Ops. Previous investment applies as credit.'
    )
    expect(recommendations[2].talkingPoint).toBe('Frame the upgrade.')
    expect(recommendations[2].why).toBe('Offer-level upsell: Guide → Ebook Upgrade. ')
    expect(JSON.stringify(recommendations)).not.toContain('Skipped Path')
    expect(JSON.stringify(recommendations)).not.toContain('Unmatched Path')
    expect(recommendations.some((item: { strategy: string }) => item.strategy === 'stack_bonuses')).toBe(false)
  })

  it('drops a price-objection upsell when stronger objection strategies fill the top three', async () => {
    mocks.getAllActiveUpsellPaths.mockResolvedValue([
      upsellPath({ upsell_title: 'Too Expensive Upgrade' }),
    ])

    const response = await POST(makeRequest({
      audit: {},
      currentObjection: 'price_objection',
      conversationHistory: [],
      contentPresented: ['product:src-1'],
    }))

    const { recommendations } = await response.json()
    expect(recommendations.map((item: { strategy: string; confidence: number }) => ({
      strategy: item.strategy,
      confidence: item.confidence,
    }))).toEqual([
      { strategy: 'show_decoy', confidence: 0.7 },
      { strategy: 'stack_bonuses', confidence: 0.65 },
      { strategy: 'payment_plan', confidence: 0.55 },
    ])
    expect(JSON.stringify(recommendations)).not.toContain('Too Expensive Upgrade')
    expect(recommendations[1].confidence).toBe(0.65)
    expect(recommendations[1].why).toBe(
      'Budget concern with high opportunity (5/10) - showing more value can tip the scale'
    )
    expect(recommendations[2].why).toBe('Splitting payments reduces the perceived commitment')
  })

  it('treats a missing decision maker as having authority and an explicit false as not', async () => {
    const shared = {
      audit: {
        business_challenges: { primary_challenges: ['missed follow-up'], current_impact: 'lost deals' },
        decision_making: { stakeholders: ['CFO', 'Ops'] },
      },
      currentObjection: 'authority_objection',
      conversationHistory: [],
    }

    const missingFlag = await POST(makeRequest(shared))
    const explicitFalse = await POST(makeRequest({
      ...shared,
      audit: {
        ...shared.audit,
        decision_making: { decision_maker: false, stakeholders: ['CFO', 'Ops'] },
      },
    }))

    const missingBody = await missingFlag.json()
    const falseBody = await explicitFalse.json()

    expect(missingBody.recommendations.map((item: { strategy: string }) => item.strategy)).toEqual([
      'roi_calculator',
      'case_study',
      'stakeholder_call',
    ])
    expect(missingBody.recommendations[2].confidence).toBe(0.4)
    expect(missingBody.recommendations[2].talkingPoint).toContain('loop in anyone else')
    expect(missingBody.recommendations[0].talkingPoint).toContain('lost deals')

    expect(falseBody.recommendations.map((item: { strategy: string; confidence: number }) => ({
      strategy: item.strategy,
      confidence: item.confidence,
    }))).toEqual([
      { strategy: 'stakeholder_call', confidence: 0.9 },
      { strategy: 'roi_calculator', confidence: 0.6 },
      { strategy: 'case_study', confidence: 0.6 },
    ])
    expect(falseBody.recommendations[0].why).toBe(
      "They're not the decision maker - need to include CFO, Ops"
    )
    expect(falseBody.recommendations[0].talkingPoint).toContain('CFO, Ops')
    expect(falseBody.recommendations[2].talkingPoint).toContain('missed follow-up')
  })

  it('caps an opportunity boost at 0.95', async () => {
    const response = await POST(makeRequest({
      audit: { opportunity_score: 10, urgency_score: 1 },
      currentObjection: 'positive',
      conversationHistory: [],
    }))

    const { recommendations } = await response.json()
    expect(recommendations.map((item: { strategy: string; confidence: number }) => ({
      strategy: item.strategy,
      confidence: item.confidence,
    }))).toEqual([
      { strategy: 'continue_script', confidence: 0.95 },
      { strategy: 'stack_bonuses', confidence: 0.75 },
      { strategy: 'limited_time', confidence: 0.6 },
    ])
  })

  it('falls back to continue_script for an unknown objection', async () => {
    const response = await POST(makeRequest({
      audit: { opportunity_score: 4 },
      currentObjection: 'not-a-real-objection',
      conversationHistory: [],
    }))

    const { recommendations } = await response.json()
    expect(recommendations).toEqual([
      expect.objectContaining({
        strategy: 'continue_script',
        confidence: 0.3,
        why: 'Moving forward might help uncover the real objection',
      }),
    ])
  })

  it('returns a generic 500 when upsell lookup throws', async () => {
    mocks.getAllActiveUpsellPaths.mockRejectedValue(new Error('db down'))

    const response = await POST(makeRequest({
      audit: {},
      currentObjection: 'positive',
      conversationHistory: [],
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })
})
