import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { AcceleratedLearningPlan, approvedL13L16Media, lessons } from './AcceleratedLearningPlan'

const require = createRequire(import.meta.url)
const receipt = require('../../../docs/accelerated-course-modules/l13-l16-learner-binding/human-qa-approval-receipt.json')
const { verifyAcceleratedL13L16Binding } = require('../../../scripts/verify-accelerated-l13-l16-binding.mjs')

describe('Accelerated L13–L16 final learner binding', () => {
  it('accepts only the approved receipt, exact composites, captions, transcripts and scripts', () => {
    expect(verifyAcceleratedL13L16Binding()).toBe(true)
    expect(receipt.approval_source).toMatchObject({ reviewed_pr: 1206, merged_source_commit: '6814e6a5b01ab75555f5de46742a0a715bf9dfb5', reviewer: 'Vambah Sillah' })
    expect(Object.keys(approvedL13L16Media)).toEqual(['L13', 'L14', 'L15', 'L16'])
  })

  it('fails closed on stale, missing, or mismatched approval', () => {
    expect(() => verifyAcceleratedL13L16Binding({ receipt: { ...receipt, status: 'pending' } })).toThrow(/approval missing or stale/)
    expect(() => verifyAcceleratedL13L16Binding({ receipt: { ...receipt, approval_source: { ...receipt.approval_source, approval_message_id: 'stale' } } })).toThrow(/approval source mismatch/)
    expect(() => verifyAcceleratedL13L16Binding({ receipt: { ...receipt, bindings: { ...receipt.bindings, L15: '0'.repeat(64) } } })).toThrow(/L15 receipt or composite mismatch/)
  })

  it.each(['L13', 'L14', 'L15', 'L16'] as const)('opens %s with captions and transcript, returns and records progress', (id) => {
    render(<AcceleratedLearningPlan />)
    const lesson = lessons.find((item) => item.id === id)!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${id}:.*ready`) }))
    expect(screen.getByText(`${id} guided video is ready`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Watch ${id} guided video`) }))
    const video = screen.getByLabelText(`${id} ${lesson.title} guided video`)
    expect(video).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', approvedL13L16Media[id].video)
    expect(document.querySelector('video track')).toHaveAttribute('src', approvedL13L16Media[id].captions)
    const track = { mode: 'hidden' }
    Object.defineProperty(video, 'textTracks', { configurable: true, value: [track] })
    fireEvent.loadedMetadata(video)
    expect(track.mode).toBe('showing')
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    expect(track.mode).toBe('disabled')
    fireEvent.click(screen.getByText(`Read along with ${id} transcript`))
    expect(screen.getByText(approvedL13L16Media[id].transcript.cues[0].text)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Return to Learning plan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
  })
})
