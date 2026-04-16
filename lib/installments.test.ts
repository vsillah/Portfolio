import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const single = vi.fn()
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const adminRef: { current: { from: typeof from } | null } = {
    current: { from },
  }

  return { single, eq, select, from, adminRef }
})

vi.mock('./supabase', () => ({
  get supabaseAdmin() {
    return mocks.adminRef.current
  },
}))

import { calculateInstallmentPlan, getInstallmentFeePercent } from './installments'

describe('calculateInstallmentPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('splits totals with fee and keeps sum exact via final installment', () => {
    const plan = calculateInstallmentPlan(1000, 3, 10)

    expect(plan.baseAmount).toBe(1000)
    expect(plan.feePercent).toBe(10)
    expect(plan.feeAmount).toBe(100)
    expect(plan.totalWithFee).toBe(1100)
    expect(plan.installmentAmount).toBe(366.66)
    expect(plan.schedule.map((item) => item.amount)).toEqual([366.66, 366.66, 366.68])
    expect(plan.schedule.reduce((sum, item) => sum + item.amount, 0)).toBe(1100)
  })

  it('generates monthly due dates from the current date', () => {
    const plan = calculateInstallmentPlan(500, 4, 0)
    const dueDates = plan.schedule.map((item) => item.dueDate.toISOString().slice(0, 10))

    expect(dueDates).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ])
  })
})

describe('getInstallmentFeePercent', () => {
  beforeEach(() => {
    mocks.from.mockClear()
    mocks.select.mockClear()
    mocks.eq.mockClear()
    mocks.single.mockReset()
    mocks.adminRef.current = { from: mocks.from }
  })

  it('returns configured numeric fee percent from site_settings', async () => {
    mocks.single.mockResolvedValueOnce({ data: { value: '12.5' } })

    await expect(getInstallmentFeePercent()).resolves.toBe(12.5)
    expect(mocks.from).toHaveBeenCalledWith('site_settings')
    expect(mocks.select).toHaveBeenCalledWith('value')
    expect(mocks.eq).toHaveBeenCalledWith('key', 'installment_fee_percent')
  })

  it('falls back to 10 when supabase admin client is unavailable', async () => {
    mocks.adminRef.current = null

    await expect(getInstallmentFeePercent()).resolves.toBe(10)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('falls back to 10 when stored value is invalid or negative', async () => {
    mocks.single.mockResolvedValueOnce({ data: { value: 'not-a-number' } })
    await expect(getInstallmentFeePercent()).resolves.toBe(10)

    mocks.single.mockResolvedValueOnce({ data: { value: '-5' } })
    await expect(getInstallmentFeePercent()).resolves.toBe(10)
  })
})
