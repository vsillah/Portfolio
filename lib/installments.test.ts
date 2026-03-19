import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockSupabaseAdmin = {
  from: ReturnType<typeof vi.fn>
} | null

async function loadInstallmentsModule(mockAdmin: MockSupabaseAdmin) {
  vi.resetModules()
  vi.doMock('./supabase', () => ({ supabaseAdmin: mockAdmin }))
  return import('./installments')
}

describe('calculateInstallmentPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00.000Z'))
  })

  it('splits payments and applies rounding difference to the last installment', async () => {
    const { calculateInstallmentPlan } = await loadInstallmentsModule(null)
    const plan = calculateInstallmentPlan(1000, 3, 10)

    expect(plan.feeAmount).toBe(100)
    expect(plan.totalWithFee).toBe(1100)
    expect(plan.installmentAmount).toBe(366.66)
    expect(plan.schedule.map(item => item.amount)).toEqual([366.66, 366.66, 366.68])
    expect(plan.schedule.reduce((sum, item) => sum + item.amount, 0)).toBe(1100)
  })

  it('creates a monthly schedule with stable numbering and due dates', async () => {
    const { calculateInstallmentPlan } = await loadInstallmentsModule(null)
    const plan = calculateInstallmentPlan(250, 4, 0)

    expect(plan.schedule).toHaveLength(4)
    expect(plan.schedule.map(item => item.number)).toEqual([1, 2, 3, 4])
    expect(plan.schedule.map(item => item.dueDate.toISOString().slice(0, 10))).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ])
  })
})

describe('getInstallmentFeePercent', () => {
  it('returns default 10 when service-role client is unavailable', async () => {
    const { getInstallmentFeePercent } = await loadInstallmentsModule(null)
    await expect(getInstallmentFeePercent()).resolves.toBe(10)
  })

  it('returns configured fee percent when site setting is a valid non-negative number', async () => {
    const single = vi.fn().mockResolvedValue({ data: { value: '12.5' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    const { getInstallmentFeePercent } = await loadInstallmentsModule({ from })
    await expect(getInstallmentFeePercent()).resolves.toBe(12.5)

    expect(from).toHaveBeenCalledWith('site_settings')
    expect(select).toHaveBeenCalledWith('value')
    expect(eq).toHaveBeenCalledWith('key', 'installment_fee_percent')
    expect(single).toHaveBeenCalledTimes(1)
  })

  it('falls back to default 10 when setting is invalid or negative', async () => {
    const single = vi.fn().mockResolvedValue({ data: { value: '-2' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    const { getInstallmentFeePercent } = await loadInstallmentsModule({ from })
    await expect(getInstallmentFeePercent()).resolves.toBe(10)
  })
})
