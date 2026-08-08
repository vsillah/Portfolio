import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import {
  expandBundleItems,
  getAllExpandedBundleContentKeys,
  type BundleRowForKeys,
} from './bundle-expand'

describe('getAllExpandedBundleContentKeys', () => {
  it('merges base bundle keys with delta items', () => {
    const rows: BundleRowForKeys[] = [
      {
        id: 'base',
        base_bundle_id: null,
        bundle_items: [
          { content_type: 'service', content_id: 'svc-1', display_order: 0 },
          { content_type: 'product', content_id: '10', display_order: 1 },
        ],
      },
      {
        id: 'child',
        base_bundle_id: 'base',
        bundle_items: [
          { content_type: 'lead_magnet', content_id: 'lm-1', display_order: 0 },
        ],
      },
    ]

    expect(getAllExpandedBundleContentKeys(rows)).toEqual(
      new Set(['service:svc-1', 'product:10', 'lead_magnet:lm-1']),
    )
  })

  it('breaks cycles without throwing or looping forever', () => {
    const rows: BundleRowForKeys[] = [
      {
        id: 'a',
        base_bundle_id: 'b',
        bundle_items: [{ content_type: 'service', content_id: 'svc-a', display_order: 0 }],
      },
      {
        id: 'b',
        base_bundle_id: 'a',
        bundle_items: [{ content_type: 'service', content_id: 'svc-b', display_order: 0 }],
      },
    ]

    expect(getAllExpandedBundleContentKeys(rows)).toEqual(
      new Set(['service:svc-a', 'service:svc-b']),
    )
  })

  it('ignores missing base bundle references', () => {
    const rows: BundleRowForKeys[] = [
      {
        id: 'orphan-child',
        base_bundle_id: 'missing-base',
        bundle_items: [{ content_type: 'service', content_id: 'svc-1', display_order: 0 }],
      },
    ]

    expect(getAllExpandedBundleContentKeys(rows)).toEqual(new Set(['service:svc-1']))
  })
})

describe('expandBundleItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  function mockBundleRow(row: {
    id: string
    base_bundle_id: string | null
    bundle_items: Array<Record<string, unknown>>
  } | null) {
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: row,
              error: row ? null : { message: 'not found' },
            }),
          }),
        }),
      }
    })
  }

  it('returns an empty list when the bundle is missing', async () => {
    mockBundleRow(null)
    await expect(expandBundleItems('missing')).resolves.toEqual([])
  })

  it('returns delta items when there is no base bundle', async () => {
    mockBundleRow({
      id: 'bundle-1',
      base_bundle_id: null,
      bundle_items: [
        { content_type: 'service', content_id: 'svc-1', display_order: 0 },
        { content_type: 'product', content_id: '11', display_order: 1 },
      ],
    })

    await expect(expandBundleItems('bundle-1')).resolves.toEqual([
      { content_type: 'service', content_id: 'svc-1', display_order: 0 },
      { content_type: 'product', content_id: '11', display_order: 1 },
    ])
  })

  it('prepends base items, renumbers display_order, and deduplicates overlaps', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn((column: string, id: string) => {
            expect(column).toBe('id')
            const row =
              id === 'child'
                ? {
                    id: 'child',
                    base_bundle_id: 'base',
                    bundle_items: [
                      { content_type: 'service', content_id: 'svc-1', display_order: 0 },
                      { content_type: 'lead_magnet', content_id: 'lm-1', display_order: 1 },
                    ],
                  }
                : {
                    id: 'base',
                    base_bundle_id: null,
                    bundle_items: [
                      { content_type: 'service', content_id: 'svc-1', display_order: 0 },
                      { content_type: 'product', content_id: '10', display_order: 1 },
                    ],
                  }
            return {
              single: vi.fn().mockResolvedValue({ data: row, error: null }),
            }
          }),
        }),
      }
    })

    await expect(expandBundleItems('child')).resolves.toEqual([
      { content_type: 'service', content_id: 'svc-1', display_order: 0 },
      { content_type: 'product', content_id: '10', display_order: 1 },
      { content_type: 'lead_magnet', content_id: 'lm-1', display_order: 2 },
    ])
  })

  it('returns an empty list when revisiting a bundle id (cycle guard)', async () => {
    await expect(expandBundleItems('loop', new Set(['loop']))).resolves.toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
