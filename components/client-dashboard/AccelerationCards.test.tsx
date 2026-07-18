import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AccelerationCards from './AccelerationCards'
import type { AccelerationRecommendation } from '@/lib/acceleration-engine'

const recommendation: AccelerationRecommendation = {
  id: 'rec-1',
  client_project_id: 'project-1',
  pain_point_category_id: null,
  content_type: 'bundle',
  content_id: 0,
  service_title: 'Community Impact Accelerator',
  gap_category: 'tech_stack',
  gap_description: 'Close website handoff gaps.',
  projected_impact_pct: 28,
  projected_annual_value: 1997,
  impact_headline: 'Turn the FireSpring proof into cleaner launch-ready decisions.',
  impact_explanation: 'Connect vendor feedback, navigation decisions, and launch readiness.',
  data_source: 'client_specific',
  benchmark_ids: [],
  value_calculation_id: null,
  confidence_level: 'high',
  display_order: 0,
  is_active: true,
  cta_type: 'view_proposal',
  cta_url: '/pricing#community-impact-accelerator',
  dismissed_at: null,
  converted_at: null,
  created_at: '2026-07-18T00:00:00.000Z',
  updated_at: '2026-07-18T00:00:00.000Z',
}

describe('AccelerationCards', () => {
  it('does not render an empty package-options section', () => {
    const { container } = render(
      <AccelerationCards recommendations={[]} token="dashboard-token" onDismiss={vi.fn()} />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('labels active acceleration recommendations as package options', () => {
    render(
      <AccelerationCards
        recommendations={[recommendation]}
        token="dashboard-token"
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Package Options' })).toBeInTheDocument()
    expect(screen.getByText('Community Impact Accelerator')).toBeInTheDocument()
    expect(screen.getByText(/assessment gaps, task list/i)).toBeInTheDocument()
    expect(screen.getByText('$1,997')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view proposal/i })).toBeInTheDocument()
  })

  it('does not render a stray zero for free package options', () => {
    render(
      <AccelerationCards
        recommendations={[{
          ...recommendation,
          id: 'rec-free',
          service_title: 'Community Impact Starter',
          projected_annual_value: 0,
          projected_impact_pct: 18,
          cta_type: 'learn_more',
        }]}
        token="dashboard-token"
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByText('Community Impact Starter')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument()
  })

  it('opens the recommendation CTA returned by the dashboard API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ ctaUrl: '/pricing#community-impact-accelerator' }),
      })
    )
    const open = vi.fn()
    vi.stubGlobal('open', open)

    render(
      <AccelerationCards
        recommendations={[recommendation]}
        token="dashboard-token"
        onDismiss={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /view proposal/i }))

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/client/dashboard/dashboard-token/accelerators/rec-1',
        expect.objectContaining({ method: 'PATCH' })
      )
      expect(open).toHaveBeenCalledWith('/pricing#community-impact-accelerator', '_blank')
    })

    vi.unstubAllGlobals()
  })

  it('labels contract extension options as account actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ ctaUrl: '#account-summary' }),
      })
    )

    render(
      <AccelerationCards
        recommendations={[{
          ...recommendation,
          id: 'rec-contract',
          content_type: 'contract_option',
          service_title: 'Extend Existing Contract',
          projected_annual_value: 1200,
        }]}
        token="dashboard-token"
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByText('Extend Existing Contract')).toBeInTheDocument()
    expect(screen.getByText('contract')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /view account/i }))

    await vi.waitFor(() => {
      expect(window.location.hash).toBe('#account-summary')
    })

    vi.unstubAllGlobals()
  })
})
