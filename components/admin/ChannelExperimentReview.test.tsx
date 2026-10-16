import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChannelExperimentReview from './ChannelExperimentReview'

const packetId = '407df879-a539-40a1-a20e-75de31b9c494'

describe('ChannelExperimentReview', () => {
  it('renders inside the existing packet workflow with evidence, boundaries, score inputs, and no execution actions', () => {
    render(<ChannelExperimentReview packetId={packetId} defaultOpen />)

    const review = screen.getByRole('region', { name: 'Channel experiments for Stop Counting AI Licenses' })
    expect(within(review).getByText('Shared evidence core')).toBeVisible()
    expect(within(review).getByText('Claims, lineage, and boundaries')).toBeVisible()
    expect(within(review).getByText('Numerical scorecard and inputs')).toBeVisible()
    expect(within(review).getByText(/78\/100/)).toBeVisible()
    expect(within(review).getByText('Unscored')).toBeVisible()
    expect(within(review).getByText(/AmaduTown outcome benchmark/)).toBeVisible()
    expect(within(review).getByRole('link', { name: /AI Audit Calculator screenshot/ })).toHaveAttribute('href', '/audit_calculator_img.png')
    expect(within(review).queryByRole('button', { name: /^(publish|schedule|upload|render|send)$/i })).not.toBeInTheDocument()
  })

  it('switches between differentiated LinkedIn and YouTube variants', () => {
    render(<ChannelExperimentReview packetId={packetId} defaultOpen revision="test-commit" />)

    expect(screen.getByText('Your AI dashboard says 312 licenses are active. What decision got better?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Variant B · Monday morning test' }))
    expect(screen.getByText('Monday morning. The AI pilot is live. Nobody can explain what happens when the agent is wrong.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'youtube' }))
    expect(screen.getByText('Stop Counting AI Licenses: Build a Readiness Scorecard That Shows the Work')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open YouTube Social Content review' })).toHaveAttribute(
      'href',
      '/admin/social-content/1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=test-commit',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Variant B · Failed handoff story' }))
    expect(screen.getByText('Your AI Pilot Worked. Then the Handoff Broke.')).toBeVisible()
    expect(screen.getByText('Proposed visual evidence')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Open YouTube Social Content review' })).not.toBeInTheDocument()
  })

  it('keeps LinkedIn variants on the existing packet route without a YouTube detail link', () => {
    render(<ChannelExperimentReview packetId={packetId} defaultOpen />)
    expect(screen.getByText('Your AI dashboard says 312 licenses are active. What decision got better?')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Open YouTube Social Content review' })).not.toBeInTheDocument()
  })

  it('stays hidden for packets outside the approved three-packet scope', () => {
    const { container } = render(<ChannelExperimentReview packetId="other-packet" defaultOpen />)
    expect(container).toBeEmptyDOMElement()
  })
})
