import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DarkCastleVisualRecovery from './DarkCastleVisualRecovery'
import { DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE, DARK_CASTLE_SOCIAL_CONTENT_ID, DARK_CASTLE_VISUAL_QA_ID } from '@/lib/social-approved-visual-contract'

describe('Dark Castle missing-contract recovery', () => {
  it('points the production record to its own copy gate without a QA-only route', () => {
    const { container } = render(<DarkCastleVisualRecovery recordId={DARK_CASTLE_SOCIAL_CONTENT_ID} />)

    expect(screen.getByRole('link', { name: 'Review this record’s saved copy' })).toHaveAttribute(
      'href',
      `/admin/social-content/${DARK_CASTLE_SOCIAL_CONTENT_ID}?step=copy#social-copy-gate`,
    )
    expect(container.textContent).toContain('corrected copy and image are still awaiting Human QA')
    expect(container.textContent).toContain('earlier approved copy')
    expect(container.innerHTML).not.toContain(DARK_CASTLE_VISUAL_QA_ID)
    expect(container.innerHTML).not.toContain('localhost')
  })

  it('encodes the record and fixture, and omits an empty fixture query', () => {
    const { rerender } = render(<DarkCastleVisualRecovery recordId="id with/slash" qaFixture="fixture with space" />)
    expect(screen.getByRole('link', { name: 'Review this record’s saved copy' })).toHaveAttribute(
      'href',
      '/admin/social-content/id%20with%2Fslash?step=copy&qa_fixture=fixture%20with%20space#social-copy-gate',
    )
    rerender(<DarkCastleVisualRecovery recordId={DARK_CASTLE_SOCIAL_CONTENT_ID} qaFixture="" />)
    expect(screen.getByRole('link', { name: 'Review this record’s saved copy' })).toHaveAttribute(
      'href',
      `/admin/social-content/${DARK_CASTLE_SOCIAL_CONTENT_ID}?step=copy#social-copy-gate`,
    )
  })

  it('keeps the local projection read-only when following the recovery link', () => {
    render(<DarkCastleVisualRecovery recordId={DARK_CASTLE_SOCIAL_CONTENT_ID} qaFixture={DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE} />)
    expect(screen.getByRole('link', { name: 'Review this record’s saved copy' })).toHaveAttribute(
      'href',
      `/admin/social-content/${DARK_CASTLE_SOCIAL_CONTENT_ID}?step=copy&qa_fixture=${DARK_CASTLE_PRODUCTION_RECOVERY_QA_FIXTURE}#social-copy-gate`,
    )
  })
})
