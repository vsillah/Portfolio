import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CaseDiscoveryPanel, DiscoveryProposalReview } from './CaseDiscoveryPanel';
import { emptyDiscovery, readDiscovery, writeDiscovery } from '@/lib/case-discovery';

function Harness({ save, review, blocked = false }: { save: (notes: string) => Promise<boolean>; review: () => void; blocked?: boolean }) {
  const [notes, setNotes] = useState('Original call notes');
  return <CaseDiscoveryPanel notes={notes} onChange={setNotes} savedNotes="Original call notes" saving={false} onSave={() => save(notes)} onReviewProposal={review} proposalBlocked={blocked} />;
}
describe('case discovery', () => {
  it('keeps populated field labels stable when restoring saved notes', () => {
    const notes = writeDiscovery('Existing notes', { ...emptyDiscovery(), question: 'Saved question' });
    render(<CaseDiscoveryPanel notes={notes} savedNotes={notes} onChange={vi.fn()} onSave={vi.fn()} onReviewProposal={vi.fn()} saving={false} />);
    fireEvent.click(screen.getByText('1. Frame the question'));
    expect(screen.getByLabelText('Question to solve', { exact: true })).toHaveValue('Saved question');
  });
  it('saves structured findings and existing notes before opening the existing proposal', async () => {
    const save = vi.fn().mockResolvedValue(true), review = vi.fn();
    render(<Harness save={save} review={review} />);
    fireEvent.click(screen.getByText('1. Frame the question'));
    fireEvent.change(screen.getByLabelText('Question to solve'), { target: { value: 'Reduce the intake backlog' } });
    fireEvent.click(screen.getByText('2. Investigate'));
    fireEvent.change(screen.getByLabelText('Framework'), { target: { value: 'change' } });
    fireEvent.click(screen.getByLabelText('Client confirmed the approach'));
    fireEvent.click(screen.getByText('Save and review proposal'));
    await waitFor(() => expect(review).toHaveBeenCalledOnce());
    expect(readDiscovery(save.mock.calls[0][0])).toMatchObject({ plainNotes: 'Original call notes', packet: { question: 'Reduce the intake backlog', framework: 'change', aligned: true } });
  });
  it('keeps edits and blocks proposal handoff when saving fails; allows retry', async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true), review = vi.fn();
    render(<Harness save={save} review={review} />);
    fireEvent.click(screen.getByText('1. Frame the question'));
    fireEvent.change(screen.getByLabelText('Question to solve'), { target: { value: 'Retain this question' } });
    fireEvent.click(screen.getByText('Save and review proposal'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
    expect(review).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Question to solve')).toHaveValue('Retain this question');
    fireEvent.click(screen.getByText('Save and review proposal'));
    await waitFor(() => expect(review).toHaveBeenCalledOnce());
  });
  it('explains the proposal blocker while allowing discovery to be saved', async () => {
    const save = vi.fn().mockResolvedValue(true);
    render(<Harness save={save} review={vi.fn()} blocked />);
    expect(screen.getByText('Save and review proposal')).toBeDisabled();
    fireEvent.click(screen.getByText('Save discovery'));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(screen.getByText(/Select an offer/)).toBeVisible();
  });
  it('renders an internal review packet without exposing raw notes or framework prompts', () => {
    render(<DiscoveryProposalReview notes={writeDiscovery('PRIVATE unrelated note', { ...emptyDiscovery(), question: 'Reduce wait time' })} />);
    fireEvent.click(screen.getByText('Discovery review · Internal only'));
    expect(screen.getByText('Reduce wait time')).toBeVisible();
    expect(screen.queryByText('PRIVATE unrelated note')).not.toBeInTheDocument();
    expect(screen.queryByText(/Thank them for their time/)).not.toBeInTheDocument();
  });
});
