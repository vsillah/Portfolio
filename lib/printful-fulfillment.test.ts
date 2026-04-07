import { describe, expect, it } from 'vitest'
import { buildPrintfulSubmissionItems, shouldSkipPrintfulSubmission } from './printful-fulfillment'

describe('shouldSkipPrintfulSubmission', () => {
  it('skips submission when APP_ENV is non-production, even for live Stripe events', () => {
    expect(shouldSkipPrintfulSubmission('staging', true)).toBe(true)
    expect(shouldSkipPrintfulSubmission('development', true)).toBe(true)
  })

  it('does not skip submission in production even when Stripe event is not livemode', () => {
    expect(shouldSkipPrintfulSubmission('production', false)).toBe(false)
  })

  it('falls back to Stripe livemode when APP_ENV is unset', () => {
    expect(shouldSkipPrintfulSubmission(undefined, true)).toBe(false)
    expect(shouldSkipPrintfulSubmission(undefined, false)).toBe(true)
  })
})

describe('buildPrintfulSubmissionItems', () => {
  it('prefers sync_variant_id when product variant has printful_sync_variant_id', () => {
    const result = buildPrintfulSubmissionItems(
      [
        { product_variant_id: 10, printful_variant_id: '1001', quantity: 2 },
      ],
      [
        { id: 10, printful_sync_variant_id: 9001 },
      ]
    )

    expect(result).toEqual([{ sync_variant_id: 9001, quantity: 2 }])
  })

  it('falls back to printful variant_id when sync variant is missing', () => {
    const result = buildPrintfulSubmissionItems(
      [
        { product_variant_id: 10, printful_variant_id: '1001', quantity: 1 },
      ],
      [
        { id: 10, printful_sync_variant_id: null },
      ]
    )

    expect(result).toEqual([{ variant_id: 1001, quantity: 1 }])
  })

  it('omits rows without printful_variant_id and keeps eligible rows', () => {
    const result = buildPrintfulSubmissionItems(
      [
        { product_variant_id: 1, printful_variant_id: null, quantity: 1 },
        { product_variant_id: 2, printful_variant_id: '2002', quantity: 3 },
      ],
      [
        { id: 2, printful_sync_variant_id: null },
      ]
    )

    expect(result).toEqual([{ variant_id: 2002, quantity: 3 }])
  })

  it('uses variant_id fallback when product variant row is not found', () => {
    const result = buildPrintfulSubmissionItems(
      [
        { product_variant_id: 999, printful_variant_id: '3456', quantity: 4 },
      ],
      []
    )

    expect(result).toEqual([{ variant_id: 3456, quantity: 4 }])
  })
})
