import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PractitionerContentReview from './PractitionerContentReview'
import type { SocialContentItem } from '@/lib/social-content'
import { practitionerContentQaFixture } from '@/lib/social-practitioner-content-qa-fixture'

const item = {
  ...practitionerContentQaFixture(),
  image_url: 'https://example.invalid/legacy.png',
} as unknown as SocialContentItem

describe('PractitionerContentReview', () => {
  it('shows evidence, finished copy, deterministic candidate, and legacy-candidate boundary together', () => {
    render(<PractitionerContentReview item={item} finishedCopy={item.post_text} />)

    expect(screen.getByRole('region', { name: 'Practitioner evidence and visual review' })).toBeInTheDocument()
    expect(screen.getByText('Ready for Human QA')).toBeInTheDocument()
    expect(screen.getByText('Make the repeated burden visible. Keep judgment human.')).toBeInTheDocument()
    expect(screen.getByText('Specificity: specific')).toBeInTheDocument()
    expect(screen.getByText('Correlation only')).toBeInTheDocument()
    expect(screen.getByText('Framework: applied')).toBeInTheDocument()
    expect(screen.getByText('Voice: applied')).toBeInTheDocument()
    expect(screen.getByText('Performance: bounded fallback')).toBeInTheDocument()
    expect(screen.getByText('Every Friday, three spreadsheets fed one intake decision.')).toBeInTheDocument()
    expect(screen.getByText('Start with repeated burden, stable rules, and one decision owner.')).toBeInTheDocument()
    expect(screen.getByText('Legacy generated candidate remains unapproved')).toBeInTheDocument()
  })

  it('shows the fail-closed state when privacy, provenance, and candidate receipts are incomplete', () => {
    const blockedItem = structuredClone(item) as SocialContentItem
    const quality = blockedItem.rag_context?.practitioner_content_quality as Record<string, any>
    quality.evidence_packet.status = 'draft'
    quality.evidence_packet.source_provenance = []
    quality.evidence_packet.redaction_receipt.status = 'pending'
    quality.deterministic_visual.candidate.status = 'draft'

    render(<PractitionerContentReview item={blockedItem} finishedCopy={blockedItem.post_text} />)

    expect(screen.getByText('Blocked before Human QA')).toBeInTheDocument()
    expect(screen.getByText('Resolve before Human QA')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
  })

  it('withholds Human QA readiness when framework or calibration application is incomplete', () => {
    const blockedItem = structuredClone(item) as SocialContentItem
    const quality = blockedItem.rag_context?.practitioner_content_quality as Record<string, any>
    quality.framework_application.status = 'draft'
    quality.framework_application.voice_calibration.reference_ids = []

    render(<PractitionerContentReview item={blockedItem} finishedCopy={blockedItem.post_text} />)

    expect(screen.getByText('Blocked before Human QA')).toBeInTheDocument()
    expect(screen.queryByText('Ready for Human QA')).not.toBeInTheDocument()
    expect(screen.getByText('Framework: draft')).toBeInTheDocument()
  })
})
