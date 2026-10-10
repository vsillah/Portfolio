// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchPacketReview } from './ResearchPacketReview'
afterEach(cleanup)
const evidence = {
  role_context: 'Community operations lead',
  situation: 'A recurring handoff was creating avoidable delays for the team.',
  action_taken: 'The practitioner introduced a short evidence review before assignment.',
  observed_outcome: 'The team caught missing context earlier and reduced repeated follow-up.',
  limitations: 'Observed in one bounded workflow; no causal claim is made.',
  public_use_boundary: 'framework_only',
  redaction_receipt: { direct_identifiers_removed: true, indirect_identifiers_reviewed: true, sensitive_details_removed: true, review_note: 'Names and unique organizational details were generalized.' },
  framework_receipt: { selected_framework_key: 'framework', application_note: 'Apply the scene-to-lesson structure without using source language.', source_use_confirmed: true },
  revision_note: 'Added privacy-safe practitioner evidence.',
}
const packet = { id: 'packet', status: 'review_ready', updated_at: '2026-10-06T12:00:00Z', pattern_status: 'usable_framework', source_url: 'https://example.com/source', actor_metadata: { practitioner_evidence: evidence }, pattern_packet: { framework: 'Scene to lesson' }, privacy_notes: 'Public source only' }
describe('ResearchPacketReview', () => {
  it('requires a note, shows evidence, and submits approval', async () => {
    const onReview = vi.fn().mockResolvedValue(undefined)
    render(<ResearchPacketReview packet={packet} onReview={onReview} />)
    fireEvent.click(screen.getByText('Review packet'))
    expect(screen.getByText(/Scene to lesson/)).toBeTruthy()
    expect((screen.getByText('Approve framework') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Original pattern' } })
    fireEvent.click(screen.getByText('Approve framework'))
    await waitFor(() => expect(onReview).toHaveBeenCalledWith('approved', 'Original pattern'))
    await waitFor(() => expect(screen.queryByText('Close review')).toBeNull())
  })
  it.each(['too_close_to_source', 'not_relevant', 'needs_brand_translation'])('blocks %s while allowing rejection', async pattern_status => {
    const onReview = vi.fn().mockResolvedValue(undefined)
    render(<ResearchPacketReview packet={{ ...packet, pattern_status }} onReview={onReview} />)
    fireEvent.click(screen.getByText('Review packet'))
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Unsafe' } })
    expect((screen.getByText('Approve framework') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByText('Reject packet'))
    await waitFor(() => expect(onReview).toHaveBeenCalledWith('rejected', 'Unsafe'))
  })
  it.each([
    { source_url: '' },
    { source_url: 'not-a-url' },
    { pattern_packet: {} },
  ])('blocks approval when evidence is incomplete: %j', fields => {
    render(<ResearchPacketReview packet={{ ...packet, ...fields }} onReview={vi.fn()} />)
    fireEvent.click(screen.getByText('Review packet'))
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Needs evidence' } })
    expect((screen.getByText('Approve framework') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Approval blocked until:')).toBeTruthy()
  })
  it('keeps the note and shows actionable failure', async () => {
    render(<ResearchPacketReview packet={packet} onReview={vi.fn().mockRejectedValue(new Error('Packet changed. Refresh before reviewing.'))} />)
    fireEvent.click(screen.getByText('Review packet'))
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Keep this note' } })
    fireEvent.click(screen.getByText('Approve framework'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((screen.getByLabelText('Review reason') as HTMLTextAreaElement).value).toBe('Keep this note')
  })
  it('creates a privacy-reviewed evidence draft on the existing packet', async () => {
    const onSaveEvidence = vi.fn().mockResolvedValue(undefined)
    render(<ResearchPacketReview packet={{ ...packet, actor_metadata: {} }} onReview={vi.fn()} onSaveEvidence={onSaveEvidence} />)
    fireEvent.click(screen.getByText('Review packet'))
    fireEvent.change(screen.getByLabelText('Practitioner role or context'), { target: { value: evidence.role_context } })
    fireEvent.change(screen.getByLabelText('Situation'), { target: { value: evidence.situation } })
    fireEvent.change(screen.getByLabelText('Action taken'), { target: { value: evidence.action_taken } })
    fireEvent.change(screen.getByLabelText('Observed outcome'), { target: { value: evidence.observed_outcome } })
    fireEvent.change(screen.getByLabelText('Limitations or evidence boundary'), { target: { value: evidence.limitations } })
    fireEvent.change(screen.getByLabelText('Public-use boundary'), { target: { value: evidence.public_use_boundary } })
    fireEvent.click(screen.getByText('I removed direct identifiers.'))
    fireEvent.click(screen.getByText('I reviewed indirect identifiers and identifying combinations.'))
    fireEvent.click(screen.getByText('I removed or generalized sensitive details.'))
    fireEvent.change(screen.getByLabelText('Redaction receipt note'), { target: { value: evidence.redaction_receipt.review_note } })
    fireEvent.change(screen.getByLabelText('Selected packet framework'), { target: { value: 'framework' } })
    fireEvent.change(screen.getByLabelText('Application note'), { target: { value: evidence.framework_receipt.application_note } })
    fireEvent.click(screen.getByText(/I confirm the source is a pattern input/))
    fireEvent.change(screen.getByLabelText('Revision note'), { target: { value: evidence.revision_note } })
    fireEvent.click(screen.getByText('Save evidence draft'))
    await waitFor(() => expect(onSaveEvidence).toHaveBeenCalledWith(expect.objectContaining({
      public_use_boundary: 'framework_only',
      redaction_receipt: expect.objectContaining({ direct_identifiers_removed: true }),
      framework_receipt: expect.objectContaining({ selected_framework_key: 'framework', source_use_confirmed: true }),
    })))
  })
  it('shows actionable blockers and prevents approval for internal-only evidence', () => {
    render(<ResearchPacketReview packet={{ ...packet, actor_metadata: { practitioner_evidence: { ...evidence, public_use_boundary: 'internal_only' } } }} onReview={vi.fn()} />)
    fireEvent.click(screen.getByText('Review packet'))
    expect(screen.getByText(/Internal-only evidence cannot be approved/)).toBeTruthy()
    expect((screen.getByText('Approve framework') as HTMLButtonElement).disabled).toBe(true)
  })
  it('offers revision recovery for rejected packets', () => {
    render(<ResearchPacketReview packet={{ ...packet, status: 'rejected' }} onReview={vi.fn()} onSaveEvidence={vi.fn()} />)
    fireEvent.click(screen.getByText('Review details'))
    expect(screen.getByText('Revise and return to review')).toBeTruthy()
    expect(screen.queryByText('Approve framework')).toBeNull()
  })
  it('shows completed review without decision controls', () => {
    render(<ResearchPacketReview packet={{ ...packet, status: 'approved', actor_metadata: { operator_review: { note: 'Reviewed safely' } } }} onReview={vi.fn()} />)
    fireEvent.click(screen.getByText('Review details'))
    expect(screen.getByText('Reviewed safely')).toBeTruthy()
    expect(screen.queryByText('Approve framework')).toBeNull()
  })
})
