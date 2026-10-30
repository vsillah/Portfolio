import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import thumbnailDirections from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/thumbnail-directions.json'
import DarkCastleYouTubeMasterReviewPage from './page'

describe('Dark Castle YouTube master thumbnail review', () => {
  it('lets the reviewer select exactly one thumbnail direction', () => {
    render(<DarkCastleYouTubeMasterReviewPage />)

    const optionA = screen.getByRole('radio', { name: 'Select thumbnail A: Human-led product proof' })
    const optionB = screen.getByRole('radio', { name: 'Select thumbnail B: Pattern-alert continuity' })

    expect(optionA).toBeChecked()
    expect(optionB).not.toBeChecked()
    expect(screen.getByText('Direction A selected')).toBeVisible()

    fireEvent.click(optionB)

    expect(optionA).not.toBeChecked()
    expect(optionB).toBeChecked()
    expect(screen.getByText('Direction B selected')).toBeVisible()
    expect(screen.getByText(/Upload, scheduling, publishing, and external execution remain closed/i)).toBeVisible()
  })

  it('describes every direction as hero-led and rejects blur-based composition language', () => {
    render(<DarkCastleYouTubeMasterReviewPage />)

    expect(screen.getByText(/All three require distinct hero shots/i)).toBeVisible()
    expect(screen.getByText(/fresh expressive hero shot/i)).toBeVisible()
    expect(screen.getByText(/distinct skeptical-reaction hero shot/i)).toBeVisible()
    expect(screen.queryByText(/product-led continuity/i)).not.toBeInTheDocument()
  })

  it('fails the review contract when any option lacks a hero or permits blur masks', () => {
    expect(thumbnailDirections.shared_gates).toMatchObject({
      generated_hero_required_per_candidate: true,
      circular_blur_masks_prohibited: true,
      product_only_candidates_prohibited: true,
    })
    expect(thumbnailDirections.options).toHaveLength(3)
    for (const option of thumbnailDirections.options) {
      expect(option.hero_asset).toMatch(/^source\/heygen\//)
      expect(`${option.style} ${option.focal_point} ${option.rejection}`).not.toMatch(/product-only|radial|circular blur or mask appears.*allowed/i)
    }
    expect(thumbnailDirections.superseded_candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'board-remembered-v1', status: 'rejected', reason_code: 'missing_required_hero' }),
      expect.objectContaining({ id: 'accidental-success-v1', status: 'rejected', reason_code: 'blur_mask_artifact' }),
    ]))
  })
})
