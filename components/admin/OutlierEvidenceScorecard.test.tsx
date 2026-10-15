import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OutlierEvidenceScorecard from './OutlierEvidenceScorecard'
import { outlierEvidenceCalibrationQaFixture } from '@/lib/social-outlier-evidence-calibration'

describe('OutlierEvidenceScorecard', () => {
  it('renders a versioned scorecard with interactive drill-ins and attributable source links', () => {
    render(<OutlierEvidenceScorecard packet={outlierEvidenceCalibrationQaFixture('ready')} qaState="ready" />)

    expect(screen.getByRole('heading', { name: 'Outlier evidence scorecard' })).toBeVisible()
    expect(screen.getByText('outlier-evidence-calibration-v1')).toBeVisible()
    expect(screen.getByText('Scored')).toBeVisible()
    expect(screen.getByText(/Privacy-safe local QA fixture/)).toBeVisible()

    const ctaButton = screen.getByRole('button', { name: /CTA/ })
    fireEvent.click(ctaButton)
    expect(ctaButton).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('complementary')).getByRole('heading', { name: 'CTA' })).toBeVisible()

    fireEvent.click(screen.getByText('Sources, exclusions, and deterministic inputs'))
    expect(screen.getAllByRole('link', { name: /Operator proof breakdown|Evidence-first launch review|Human gate field note|Decision receipt walkthrough/ })).toHaveLength(4)
    expect(screen.getByText(/Input fingerprint: fnv1a:/)).toBeVisible()
  })

  it('keeps stale and unauthorized cohorts Unscored', () => {
    const { rerender } = render(<OutlierEvidenceScorecard packet={outlierEvidenceCalibrationQaFixture('stale')} qaState="stale" />)
    expect(screen.getAllByText('Unscored').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Evidence is stale/).length).toBeGreaterThan(0)

    rerender(<OutlierEvidenceScorecard packet={outlierEvidenceCalibrationQaFixture('unauthorized')} qaState="unauthorized" />)
    expect(screen.getAllByText('Unscored').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('Sources, exclusions, and deterministic inputs'))
    expect(screen.getAllByText('Source evidence is unauthorized.')).toHaveLength(4)
  })

  it('fails closed when a candidate dimension is missing', () => {
    render(<OutlierEvidenceScorecard packet={outlierEvidenceCalibrationQaFixture('missing')} qaState="missing" />)
    const productEvidenceButton = screen.getByRole('button', { name: /Product evidence/ })
    expect(productEvidenceButton).toHaveTextContent('Unscored')
    fireEvent.click(productEvidenceButton)
    expect(screen.getByRole('alert')).toHaveTextContent('Candidate evidence is missing')
  })
})
