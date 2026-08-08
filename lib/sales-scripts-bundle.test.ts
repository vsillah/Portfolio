import { describe, expect, it } from 'vitest'
import {
  calculateBundleTotals,
  createBundleItemFromResolved,
  resolveBundleItem,
  type BundleItem,
  type ContentWithRole,
  type ResolvedBundleItem,
} from './sales-scripts'

const baseContent: ContentWithRole = {
  content_type: 'service',
  content_id: 'svc-1',
  title: 'Advisory Sprint',
  description: 'Canonical description',
  subtype: 'consulting',
  price: 5000,
  image_url: null,
  is_active: true,
  display_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  role_id: 'role-1',
  offer_role: 'core_offer',
  dream_outcome_description: 'Ship with confidence',
  likelihood_multiplier: 1,
  time_reduction: 2,
  effort_reduction: 1,
  role_retail_price: 5000,
  offer_price: 4500,
  perceived_value: 8000,
  unit_cost: 1200,
  bonus_name: null,
  bonus_description: null,
  qualifying_actions: null,
  payout_type: null,
}

describe('resolveBundleItem', () => {
  it('keeps canonical values when no overrides are present', () => {
    const item: BundleItem = {
      content_type: 'service',
      content_id: 'svc-1',
      display_order: 3,
      is_optional: true,
    }

    const resolved = resolveBundleItem(item, baseContent)

    expect(resolved).toMatchObject({
      title: 'Advisory Sprint',
      description: 'Canonical description',
      offer_role: 'core_offer',
      role_retail_price: 5000,
      perceived_value: 8000,
      display_order: 3,
      is_optional: true,
      has_overrides: false,
      original_role: 'core_offer',
      original_price: 5000,
      original_perceived_value: 8000,
    })
  })

  it('applies overrides and marks has_overrides when any override field is set', () => {
    const item: BundleItem = {
      content_type: 'service',
      content_id: 'svc-1',
      display_order: 0,
      override_title: 'Custom Sprint',
      override_price: 4200,
      override_role: 'bonus',
      override_perceived_value: 9000,
      override_dream_outcome: 'Faster launch',
      override_bonus_name: 'Launch bonus',
      override_likelihood: 1.2,
      override_time_reduction: 4,
      override_effort_reduction: 3,
    }

    const resolved = resolveBundleItem(item, baseContent)

    expect(resolved).toMatchObject({
      title: 'Custom Sprint',
      offer_role: 'bonus',
      role_retail_price: 4200,
      perceived_value: 9000,
      dream_outcome_description: 'Faster launch',
      bonus_name: 'Launch bonus',
      likelihood_multiplier: 1.2,
      time_reduction: 4,
      effort_reduction: 3,
      has_overrides: true,
      override_title: 'Custom Sprint',
      override_description: undefined,
      original_role: 'core_offer',
      original_price: 5000,
    })
  })
})

describe('calculateBundleTotals', () => {
  it('aggregates retail, perceived, cost, and role counts with fallbacks', () => {
    const items: ResolvedBundleItem[] = [
      {
        ...baseContent,
        display_order: 0,
        is_optional: false,
        has_overrides: false,
      },
      {
        ...baseContent,
        content_id: 'svc-2',
        offer_role: 'bonus',
        role_retail_price: null,
        price: 250,
        perceived_value: null,
        unit_cost: 40,
        display_order: 1,
        is_optional: false,
        has_overrides: false,
      },
    ]

    expect(calculateBundleTotals(items)).toEqual({
      totalRetailValue: 5250,
      totalPerceivedValue: 8250,
      totalCost: 1240,
      itemCount: 2,
      coreOfferCount: 1,
      bonusCount: 1,
    })
  })
})

describe('createBundleItemFromResolved', () => {
  it('persists only overrides that differ from originals', () => {
    const resolved: ResolvedBundleItem = {
      ...baseContent,
      display_order: 2,
      is_optional: false,
      has_overrides: true,
      offer_role: 'bonus',
      role_retail_price: 4200,
      perceived_value: 8000,
      original_role: 'core_offer',
      original_price: 5000,
      original_perceived_value: 8000,
    }

    expect(createBundleItemFromResolved(resolved)).toEqual({
      content_type: 'service',
      content_id: 'svc-1',
      display_order: 2,
      is_optional: false,
      override_role: 'bonus',
      override_price: 4200,
    })
  })

  it('omits override fields when includeOverrides is false', () => {
    const resolved: ResolvedBundleItem = {
      ...baseContent,
      display_order: 1,
      is_optional: true,
      has_overrides: true,
      offer_role: 'bonus',
      original_role: 'core_offer',
    }

    expect(createBundleItemFromResolved(resolved, false)).toEqual({
      content_type: 'service',
      content_id: 'svc-1',
      display_order: 1,
      is_optional: true,
    })
  })
})
