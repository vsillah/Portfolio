import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/admin/DarkCastleApprovedBinding', () => ({ default: () => <div data-testid="dark-castle-binding" /> }))

import thumbnailDirections from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/thumbnail-directions.json'
import thumbnailSelectionReceipt from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/thumbnail-selection-receipt-v1.json'
import DarkCastleYouTubeMasterReviewPage from './page'

describe('Dark Castle YouTube master thumbnail review', () => {
  it('lets the reviewer select exactly one thumbnail direction', () => {
    render(<DarkCastleYouTubeMasterReviewPage />)

    const optionA = screen.getByRole('radio', { name: 'Select thumbnail A: Human-led product proof' })
    const optionB = screen.getByRole('radio', { name: 'Select thumbnail B: Pattern-alert continuity' })

    const optionC = screen.getByRole('radio', { name: 'Select thumbnail C: Builder and reasoning tension' })

    expect(optionA).not.toBeChecked()
    expect(optionB).not.toBeChecked()
    expect(optionC).toBeChecked()
    expect(screen.getByText('Direction C approved')).toBeVisible()

    fireEvent.click(optionB)

    expect(optionA).not.toBeChecked()
    expect(optionB).toBeChecked()
    expect(optionC).not.toBeChecked()
    expect(screen.getByText('Previewing direction B')).toBeVisible()
    expect(screen.getByText(/Approved direction remains C/i)).toBeVisible()
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
      expressive_face_candidate_required: true,
      circular_blur_masks_prohibited: true,
      product_only_candidates_prohibited: true,
    })
    expect(thumbnailDirections.options).toHaveLength(3)
    expect(thumbnailDirections.options.some((option) => option.expression?.label && option.expression?.intended_audience_response)).toBe(true)
    for (const option of thumbnailDirections.options) {
      expect(option.hero_asset).toMatch(/^source\/heygen\//)
      expect(`${option.style} ${option.focal_point} ${option.rejection}`).not.toMatch(/product-only|radial|circular blur or mask appears.*allowed/i)
    }
    expect(thumbnailDirections.superseded_candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'board-remembered-v1', status: 'rejected', reason_code: 'missing_required_hero' }),
      expect.objectContaining({ id: 'accidental-success-v1', status: 'rejected', reason_code: 'blur_mask_artifact' }),
    ]))
    expect(thumbnailDirections.selection_decision).toMatchObject({
      status: 'human_qa_approved',
      selected_direction: 'C',
      selected_candidate_id: 'accidental-success',
      selected_asset_sha256: '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0',
      external_execution: 'closed',
    })
    expect(thumbnailSelectionReceipt).toMatchObject({
      receipt_id: thumbnailDirections.selection_decision.receipt_id,
      content_version: thumbnailDirections.selection_decision.content_version,
      selected_direction: thumbnailDirections.selection_decision.selected_direction,
      selected_candidate_id: thumbnailDirections.selection_decision.selected_candidate_id,
      selected_asset_sha256: thumbnailDirections.selection_decision.selected_asset_sha256,
      boundaries: expect.objectContaining({ publishing: 'closed', external_sends: 'closed' }),
    })
  })
})
