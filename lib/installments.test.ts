import { afterEach, describe, expect, it, vi } from 'vitest'

type SupabaseSingleResult = { data?: { value?: unknown } | null }

function createSupabaseAdminMock(result: SupabaseSingleResult) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  }
}

async function importInstallmentsWithSupabase(supabaseAdmin: unknown) {
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabaseAdmin }))
  return import('./installments')
}

describe('calculateInstallmentPlan', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('splits installment totals and applies rounding remainder to last payment', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))

    const { calculateInstallmentPlan } = await importInstallmentsWithSupabase(null)
    const plan = calculateInstallmentPlan(1000, 3, 10)

    expect(plan.feeAmount).toBe(100)
    expect(plan.totalWithFee).toBe(1100)
    expect(plan.installmentAmount).toBe(366.66)
    expect(plan.schedule.map((item) => item.amount)).toEqual([366.66, 366.66, 366.68])
    expect(plan.schedule.reduce((sum, item) => sum + item.amount, 0)).toBe(1100)
    expect(plan.schedule.map((item) => item.number)).toEqual([1, 2, 3])
  })

  it('builds a month-by-month due date schedule', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))

    const { calculateInstallmentPlan } = await importInstallmentsWithSupabase(null)
    const plan = calculateInstallmentPlan(99.99, 4, 7.5)

    expect(plan.feeAmount).toBe(7.5)
    expect(plan.totalWithFee).toBe(107.49)
    expect(plan.schedule).toHaveLength(4)
    expect(plan.schedule[0].dueDate.getUTCMonth()).toBe(0)
    expect(plan.schedule[1].dueDate.getUTCMonth()).toBe(1)
    expect(plan.schedule[2].dueDate.getUTCMonth()).toBe(2)
    expect(plan.schedule[3].dueDate.getUTCMonth()).toBe(3)
  })
})

describe('getInstallmentFeePercent', () => {
  it('returns default fee when supabase admin client is unavailable', async () => {
    const { getInstallmentFeePercent } = await importInstallmentsWithSupabase(null)
    await expect(getInstallmentFeePercent()).resolves.toBe(10)
  })

  it('returns configured fee percent when setting value is numeric', async () => {
    const supabaseAdmin = createSupabaseAdminMock({ data: { value: '12.5' } })
    const { getInstallmentFeePercent } = await importInstallmentsWithSupabase(supabaseAdmin)

    await expect(getInstallmentFeePercent()).resolves.toBe(12.5)
  })

  it('falls back to default when configured setting is invalid', async () => {
    const invalidValues = ['abc', -5, null]

    for (const value of invalidValues) {
      const supabaseAdmin = createSupabaseAdminMock({ data: { value } })
      const { getInstallmentFeePercent } = await importInstallmentsWithSupabase(supabaseAdmin)
      await expect(getInstallmentFeePercent()).resolves.toBe(10)
    }
  })
})
