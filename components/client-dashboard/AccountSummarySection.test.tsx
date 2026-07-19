import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AccountSummarySection from './AccountSummarySection'
import type { AccountSummaryData, DashboardDocument, TimeTrackingData } from '@/lib/client-dashboard'

const accountSummary: AccountSummaryData = {
  contract_value: 1200,
  paid_to_date: 1200,
  balance_due: 0,
  current_packet_value: 0,
  total_logged_seconds: 23400,
  services_rendered_value: 1200,
  remaining_contract_value: 0,
  effective_hourly_rate: 184.6153846153846,
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

const documents: DashboardDocument[] = [
  {
    id: 'doc-1',
    type: 'strategy_report',
    title: 'Firespring Template Comparison for KMB',
    pdf_url: 'https://example.com/template.pdf',
    signed_url: null,
    created_at: '2026-07-17T14:58:41.501064Z',
    status: null,
  },
]

describe('AccountSummarySection', () => {
  it('summarizes paid value, time investment, remaining balance, and source detail', () => {
    render(
      <AccountSummarySection
        accountSummary={accountSummary}
        timeTracking={timeTracking}
        milestones={[
          {
            title: 'Consolidate Balance proof feedback',
            evidence: [
              {
                id: 'source-1',
                source_label: 'KMB Drive package',
                source_type: 'google_drive',
                is_client_visible: true,
              },
            ],
          },
        ]}
        documents={documents}
      />
    )

    expect(screen.getByRole('heading', { name: /account summary/i })).toBeInTheDocument()
    expect(screen.getByText('Time investment value')).toBeInTheDocument()
    expect(screen.getByText('Paid balance remaining')).toBeInTheDocument()
    expect(screen.getAllByText('No balance due')).toHaveLength(2)
    expect(screen.getByText('Contract exhausted')).toBeInTheDocument()
    expect(screen.getByText('$185/hr')).toBeInTheDocument()
    expect(screen.getByText(/6h 30m dedicated/i)).toBeInTheDocument()
    expect(screen.getByText(/2h · \$369/i)).toBeInTheDocument()
    expect(screen.getByText('Total time investment')).toBeInTheDocument()
    expect(screen.getByText(/\$1,200 paid - \$1,200 applied = No balance due/i)).toBeInTheDocument()
    expect(screen.getByText('Work performed')).toBeInTheDocument()
    expect(screen.getByText('KMB Drive package')).toBeInTheDocument()
    expect(screen.getByText('Firespring Template Comparison for KMB')).toBeInTheDocument()
    expect(screen.getByText('Included')).toBeInTheDocument()
    expect(screen.getByText('Website UX Refresh')).toBeInTheDocument()
    expect(screen.getByText(/FireSpring proof review/i)).toBeInTheDocument()
    expect(screen.getByText(/contract extension or package option/i)).toBeInTheDocument()
  })
})
