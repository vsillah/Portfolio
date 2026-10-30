import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import DarkCastleYouTubeMasterReviewPage from './page'

describe('Dark Castle YouTube master thumbnail review', () => {
  it('lets the reviewer select exactly one thumbnail direction', () => {
    render(<DarkCastleYouTubeMasterReviewPage />)

    const optionA = screen.getByRole('radio', { name: 'Select thumbnail A: Human-led product proof' })
    const optionB = screen.getByRole('radio', { name: 'Select thumbnail B: Product-led continuity' })

    expect(optionA).toBeChecked()
    expect(optionB).not.toBeChecked()
    expect(screen.getByText('Direction A selected')).toBeVisible()

    fireEvent.click(optionB)

    expect(optionA).not.toBeChecked()
    expect(optionB).toBeChecked()
    expect(screen.getByText('Direction B selected')).toBeVisible()
    expect(screen.getByText(/Upload, scheduling, publishing, and external execution remain closed/i)).toBeVisible()
  })
})
