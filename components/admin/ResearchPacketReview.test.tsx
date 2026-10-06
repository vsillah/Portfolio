// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResearchPacketReview } from './ResearchPacketReview'
afterEach(cleanup)
const packet = { id: 'packet', status: 'review_ready', updated_at: '2026-10-06T12:00:00Z', pattern_status: 'usable_framework', actor_metadata: {}, pattern_packet: { framework: 'Scene to lesson' }, privacy_notes: 'Public source only' }
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
  it('keeps the note and shows actionable failure', async () => {
    render(<ResearchPacketReview packet={packet} onReview={vi.fn().mockRejectedValue(new Error('Packet changed. Refresh before reviewing.'))} />)
    fireEvent.click(screen.getByText('Review packet'))
    fireEvent.change(screen.getByLabelText('Review reason'), { target: { value: 'Keep this note' } })
    fireEvent.click(screen.getByText('Approve framework'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((screen.getByLabelText('Review reason') as HTMLTextAreaElement).value).toBe('Keep this note')
  })
  it('shows completed review without decision controls', () => {
    render(<ResearchPacketReview packet={{ ...packet, status: 'approved', actor_metadata: { operator_review: { note: 'Reviewed safely' } } }} onReview={vi.fn()} />)
    fireEvent.click(screen.getByText('Review details'))
    expect(screen.getByText('Reviewed safely')).toBeTruthy()
    expect(screen.queryByText('Approve framework')).toBeNull()
  })
})
