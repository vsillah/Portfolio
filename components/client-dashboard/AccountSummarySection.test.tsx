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

  it('derives financial values when a legacy account payload omits calculated fields', () => {
    const legacyAccountSummary = {
      ...accountSummary,
      total_logged_seconds: undefined,
      effective_hourly_rate: undefined,
      services_rendered_value: undefined,
      remaining_contract_value: undefined,
      service_lines: [],
    } as unknown as AccountSummaryData

    render(
      <AccountSummarySection
        accountSummary={legacyAccountSummary}
        timeTracking={{ total_seconds: 7200, by_target: [] }}
      />
    )

    expect(screen.getByText('$600/hr')).toBeInTheDocument()
    expect(screen.getByText('Contract capacity').parentElement).toHaveTextContent('Contract exhausted')
    expect(screen.getByText('Paid balance remaining').parentElement).toHaveTextContent('No balance due')
    expect(screen.getByText('Client balance due').parentElement).toHaveTextContent('No balance due')
    expect(screen.getByText(/contract extension or package option/i)).toBeInTheDocument()
  })

  it('uses remaining paid value before recommending a separate package', () => {
    render(
      <AccountSummarySection
        accountSummary={{
          ...accountSummary,
          effective_hourly_rate: 200,
          services_rendered_value: 400,
          remaining_contract_value: 800,
          service_lines: [],
        }}
        timeTracking={{
          total_seconds: 7200,
          by_target: [
            {
              target_type: 'milestone',
              target_id: '0',
              total_seconds: 7200,
              entry_count: 1,
            },
          ],
        }}
      />
    )

    expect(screen.getByText('Contract capacity').parentElement).toHaveTextContent('$800')
    expect(screen.getByText('Paid balance remaining').parentElement).toHaveTextContent('$800')
    expect(screen.getByText(/\$1,200 paid - \$400 applied = \$800/i)).toBeInTheDocument()
    expect(screen.getByText(/use the remaining paid balance before opening a separate package/i)).toBeInTheDocument()
    expect(screen.queryByText(/paid value has been fully allocated/i)).not.toBeInTheDocument()
  })

  it('hides internal evidence and routes client-visible sources to their dashboard sections', () => {
    render(
      <AccountSummarySection
        accountSummary={accountSummary}
        timeTracking={timeTracking}
        milestones={[
          {
            title: 'Consolidate Balance proof feedback',
            evidence: [
              {
                id: 'internal-source',
                source_label: 'Private admin analysis',
                source_type: 'internal',
                is_client_visible: false,
              },
              {
                id: 'meeting-source',
                source_label: 'Kickoff meeting',
                source_type: 'read_ai',
                is_client_visible: true,
              },
              {
                id: 'drive-source',
                source_label: 'KMB Drive package',
                source_type: 'google_drive',
                is_client_visible: true,
              },
            ],
          },
        ]}
      />
    )

    expect(screen.queryByText('Private admin analysis')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kickoff meeting' })).toHaveAttribute('href', '#meeting-history')
    expect(screen.getByRole('link', { name: 'KMB Drive package' })).toHaveAttribute('href', '#documents')
  })
})
