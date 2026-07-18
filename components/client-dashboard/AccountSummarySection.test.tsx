import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AccountSummarySection from './AccountSummarySection'
import type { AccountSummaryData, TimeTrackingData } from '@/lib/client-dashboard'

const accountSummary: AccountSummaryData = {
  contract_value: 1200,
  paid_to_date: 1200,
  balance_due: 0,
  current_packet_value: 0,
  service_lines: [
    {
      id: 'proposal-1:Website UX Refresh',
      label: 'Website UX Refresh',
      description: "Refresh and restructure a client's existing website",
      amount: 1200,
      status: 'paid',
      source: 'contract',
      date: '2026-03-19T14:54:20.088Z',
    },
    {
      id: 'proposal-2:FireSpring Balance proof feedback and migration advisory',
      label: 'FireSpring Balance proof feedback and migration advisory',
      description: 'Template-fit recommendations and launch-readiness handoff assets.',
      amount: 0,
      status: 'sent',
      source: 'current_packet',
      date: '2026-07-18T19:47:32.599Z',
    },
  ],
}

const timeTracking: TimeTrackingData = {
  total_seconds: 23400,
  by_target: [
    {
      target_type: 'milestone',
      target_id: '0',
      total_seconds: 7200,
      entry_count: 1,
      descriptions: [
        'KMB dashboard seed: FireSpring proof review, vendor recommendation research, and feedback synthesis',
      ],
    },
  ],
}

describe('AccountSummarySection', () => {
  it('summarizes contract value, paid balance, and services rendered', () => {
    render(
      <AccountSummarySection
        accountSummary={accountSummary}
        timeTracking={timeTracking}
      />
    )

    expect(screen.getByRole('heading', { name: /account summary/i })).toBeInTheDocument()
    expect(screen.getAllByText('$1,200')).toHaveLength(3)
    expect(screen.getByText('No balance due')).toBeInTheDocument()
    expect(screen.getByText('Included')).toBeInTheDocument()
    expect(screen.getByText('Website UX Refresh')).toBeInTheDocument()
    expect(screen.getByText(/FireSpring proof review/i)).toBeInTheDocument()
    expect(screen.getByText('6h 30m logged')).toBeInTheDocument()
  })
})
