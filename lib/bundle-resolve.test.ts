import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BundleItem } from '@/lib/sales-scripts'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import {
  resolveBundleItemForPricing,
  resolveBundleItemsToTierItems,
} from './bundle-resolve'

function baseItem(overrides: Partial<BundleItem> = {}): BundleItem {
  return {
    content_type: 'service',
    content_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    display_order: 0,
    ...overrides,
  }
}

function mockContentLookup(data: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })
  return { select, eq, maybeSingle }
}

describe('resolveBundleItemForPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for unknown content types', async () => {
    const item = baseItem({ content_type: 'not_a_type' as BundleItem['content_type'] })

    await expect(resolveBundleItemForPricing(item)).resolves.toBeNull()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips DB fetch for non-uuid service ids and humanizes the slug title', async () => {
    const item = baseItem({
      content_id: 'ci-workshop-recorded',
      override_perceived_value: 2500,
      override_role: 'core_offer',
    })

    const result = await resolveBundleItemForPricing(item)

    expect(mocks.from).not.toHaveBeenCalled()
    expect(result).toEqual({
      title: 'Ci Workshop Recorded',
      perceivedValue: 2500,
      offerRole: 'core_offer',
      description: '',
      isDeployed: false,
      outcomeGroup: undefined,
    })
  })

  it('fetches product rows by numeric id and prefers override title/description', async () => {
    mockContentLookup({
      id: 12,
      title: 'Canonical Product',
      price: 99,
      description: 'Canonical description',
      outcome_groups: { id: 'og-1', label: 'Revenue', display_order: 2 },
    })

    const result = await resolveBundleItemForPricing(
      baseItem({
        content_type: 'product',
        content_id: '12',
        override_title: 'Override Title',
        override_description: 'Override Description',
        override_price: 150,
      }),
    )

    expect(mocks.from).toHaveBeenCalledWith('products')
    expect(result).toEqual({
      title: 'Override Title',
      perceivedValue: 150,
      offerRole: 'bonus',
      description: 'Override Description',
      isDeployed: false,
      outcomeGroup: { id: 'og-1', label: 'Revenue', display_order: 2 },
    })
  })

  it('falls back to content price and maps invalid offer roles to bonus', async () => {
    mockContentLookup({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      title: 'Advisory Retainer',
      price: 1200,
      description: 'Monthly support',
    })

    const result = await resolveBundleItemForPricing(
      baseItem({
        override_role: 'not-a-role' as BundleItem['override_role'],
      }),
    )

    expect(mocks.from).toHaveBeenCalledWith('services')
    expect(result).toMatchObject({
      title: 'Advisory Retainer',
      perceivedValue: 1200,
      offerRole: 'bonus',
      description: 'Monthly support',
    })
  })

  it('ignores malformed outcome_groups without id/label', async () => {
    mockContentLookup({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      title: 'Lead Magnet',
      price: 0,
      description: '',
      outcome_groups: { label: 'Missing id' },
    })

    const result = await resolveBundleItemForPricing(
      baseItem({
        content_type: 'lead_magnet',
        content_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      }),
    )

    expect(result?.outcomeGroup).toBeUndefined()
  })
})

describe('resolveBundleItemsToTierItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips unresolvable items and sorts by display_order', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'services') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                  title: 'Second',
                  price: 200,
                  description: '',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const items = await resolveBundleItemsToTierItems([
      baseItem({
        content_type: 'unknown' as BundleItem['content_type'],
        content_id: 'skip-me',
        display_order: 0,
      }),
      baseItem({
        content_id: 'first-slug',
        display_order: 2,
        override_perceived_value: 50,
        override_title: 'First',
      }),
      baseItem({
        display_order: 1,
      }),
    ])

    expect(items.map((item) => item.title)).toEqual(['Second', 'First'])
  })
})
