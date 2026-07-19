import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: null,
}))

import { buildAccountSummary, type TimeTrackingData } from './client-dashboard'

const noTime: TimeTrackingData = {
  total_seconds: 0,
  by_target: [],
}

describe('buildAccountSummary', () => {
  it('returns null when proposal history has no account value or service lines', () => {
    expect(buildAccountSummary([], noTime)).toBeNull()
    expect(
      buildAccountSummary(
        [
          {
            id: 'proposal-empty',
            bundle_name: 'Unpriced proposal',
            line_items: null,
            total_amount: 'not-a-number',
            status: 'draft',
            paid_at: null,
            accepted_at: null,
            created_at: null,
          },
        ],
        noTime
      )
    ).toBeNull()
  })

  it('derives paid contract capacity and rendered value from logged time', () => {
    const summary = buildAccountSummary(
      [
        {
          id: 'proposal-paid',
          bundle_name: 'Website UX Refresh',
          line_items: [
            {
              name: 'Website UX Refresh',
              description: 'Refresh the existing website',
              price: '1200',
            },
          ],
          total_amount: '1200',
          status: 'paid',
          paid_at: '2026-03-19T14:54:20.088Z',
          accepted_at: '2026-03-18T10:00:00.000Z',
          created_at: '2026-03-17T10:00:00.000Z',
        },
        {
          id: 'proposal-packet',
          bundle_name: 'KMB FireSpring Migration Working Packet',
          line_items: [
            {
              title: 'FireSpring migration advisory',
              description: 'Launch-readiness handoff',
              price: 0,
            },
          ],
          total_amount: 0,
          status: 'sent',
          paid_at: null,
          accepted_at: null,
          created_at: '2026-07-18T19:47:32.599Z',
        },
      ],
      {
        total_seconds: 23_400,
        by_target: [],
      }
    )

    expect(summary).toMatchObject({
      contract_value: 1200,
      paid_to_date: 1200,
      balance_due: 0,
      current_packet_value: 0,
      total_logged_seconds: 23_400,
      services_rendered_value: 1200,
      remaining_contract_value: 0,
    })
    expect(summary?.effective_hourly_rate).toBeCloseTo(184.615, 3)
    expect(summary?.service_lines).toEqual([
      {
        id: 'proposal-paid:Website UX Refresh',
        label: 'Website UX Refresh',
        description: 'Refresh the existing website',
        amount: 1200,
        status: 'paid',
        source: 'contract',
        date: '2026-03-19T14:54:20.088Z',
      },
      {
        id: 'proposal-packet:FireSpring migration advisory',
        label: 'FireSpring migration advisory',
        description: 'Launch-readiness handoff',
        amount: 0,
        status: 'sent',
        source: 'current_packet',
        date: '2026-07-18T19:47:32.599Z',
      },
    ])
  })

  it('tracks unpaid current-packet value as balance due before time is logged', () => {
    const summary = buildAccountSummary(
      [
        {
          id: 'proposal-contract',
          bundle_name: 'Paid contract',
          line_items: [],
          total_amount: 1000,
          status: 'paid',
          paid_at: '2026-06-01T00:00:00.000Z',
          accepted_at: null,
          created_at: '2026-05-31T00:00:00.000Z',
        },
        {
          id: 'proposal-packet',
          bundle_name: 'KMB FireSpring Migration Working Packet',
          line_items: [{ name: 'Migration packet', price: 250 }],
          total_amount: 250,
          status: 'sent',
          paid_at: null,
          accepted_at: '2026-07-18T00:00:00.000Z',
          created_at: '2026-07-17T00:00:00.000Z',
        },
      ],
      noTime
    )

    expect(summary).toMatchObject({
      contract_value: 1250,
      paid_to_date: 1000,
      balance_due: 250,
      current_packet_value: 250,
      services_rendered_value: 0,
      remaining_contract_value: 1250,
      effective_hourly_rate: null,
    })
    expect(summary?.service_lines[0]).toMatchObject({
      label: 'Migration packet',
      source: 'current_packet',
      date: '2026-07-18T00:00:00.000Z',
    })
  })

  it('normalizes line items and removes duplicate service lines within a source', () => {
    const summary = buildAccountSummary(
      [
        {
          id: 'proposal-first',
          bundle_name: 'Contract',
          line_items: [
            { title: '  Advisory session  ', price: '75' },
            { name: '', price: 10 },
            null,
          ],
          total_amount: 0,
          status: 'accepted',
          paid_at: null,
          accepted_at: '2026-07-01T00:00:00.000Z',
          created_at: '2026-06-30T00:00:00.000Z',
        },
        {
          id: 'proposal-duplicate',
          bundle_name: 'Contract',
          line_items: [{ name: 'Advisory session', price: 75 }],
          total_amount: 0,
          status: null,
          paid_at: null,
          accepted_at: null,
          created_at: '2026-07-02T00:00:00.000Z',
        },
      ],
      noTime
    )

    expect(summary?.service_lines).toEqual([
      {
        id: 'proposal-first:Advisory session',
        label: 'Advisory session',
        description: null,
        amount: 75,
        status: 'accepted',
        source: 'contract',
        date: '2026-07-01T00:00:00.000Z',
      },
    ])
  })
})
