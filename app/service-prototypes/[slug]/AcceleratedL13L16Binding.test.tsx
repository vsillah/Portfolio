import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { visualParityBindings, AcceleratedLearningPlan, reviewL13L16Media, lessons } from './AcceleratedLearningPlan'

const require = createRequire(import.meta.url)
const originalApproval = require('../../../docs/accelerated-course-modules/l13-l16-learner-binding/human-qa-approval-receipt.json')
const reviewReceipt = require('../../../docs/accelerated-course-modules/l13-l16-learner-binding/correction-review-receipt.json')
const correctionApproval = require('../../../docs/accelerated-course-modules/l13-l16-learner-binding/correction-human-qa-approval-receipt.json')
const { verifyAcceleratedL13L16Binding } = require('../../../scripts/verify-accelerated-l13-l16-binding.mjs')
const nextConfig = require('../../../next.config.js')

describe('Accelerated L13–L16 correction review binding', () => {
  beforeEach(() => localStorage.clear())
  it('preserves historical approval and binds the exact approved correction artifacts', () => {
    expect(verifyAcceleratedL13L16Binding()).toBe(true)
    expect(originalApproval.approval_source).toMatchObject({ reviewed_pr: 1206, merged_source_commit: '6814e6a5b01ab75555f5de46742a0a715bf9dfb5', reviewer: 'Vambah Sillah' })
    expect(reviewReceipt).toMatchObject({ reviewed_pr: 1208, status: 'human_qa_pending', approval_message_id: null, external_actions_authorized: false })
    expect(correctionApproval).toMatchObject({ status: 'approved', external_actions_authorized: false })
    expect(correctionApproval.approval_source).toMatchObject({ reviewed_pr: 1208, reviewed_candidate_head: 'ff0f14b12273ef30f19b5cd32c227a973480e4ad', reviewer: 'Vambah Sillah' })
    expect(Object.keys(reviewL13L16Media)).toEqual(['L13', 'L14', 'L15', 'L16'])
    for (const id of ['L13', 'L14', 'L15', 'L16'] as const) {
      expect(reviewReceipt.candidate_composite_sha256[id]).toBe(reviewL13L16Media[id].compositeSha256)
      expect(correctionApproval.bindings[id]).toBe(reviewL13L16Media[id].compositeSha256)
    }
  })

  it('fails closed on stale, prematurely approved, or mismatched receipts', () => {
    expect(() => verifyAcceleratedL13L16Binding({ originalApproval: { ...originalApproval, status: 'pending' } })).toThrow(/historical approval missing or stale/)
    expect(() => verifyAcceleratedL13L16Binding({ originalApproval: { ...originalApproval, approval_source: { ...originalApproval.approval_source, approval_message_id: 'stale' } } })).toThrow(/historical approval source mismatch/)
    expect(() => verifyAcceleratedL13L16Binding({ reviewReceipt: { ...reviewReceipt, status: 'approved' } })).toThrow(/correction review state mismatch/)
    expect(() => verifyAcceleratedL13L16Binding({ reviewReceipt: { ...reviewReceipt, candidate_composite_sha256: { ...reviewReceipt.candidate_composite_sha256, L15: '0'.repeat(64) } } })).toThrow(/correction hash mismatch/)
    expect(() => verifyAcceleratedL13L16Binding({ correctionApproval: { ...correctionApproval, status: 'pending' } })).toThrow(/correction approval missing or stale/)
    expect(() => verifyAcceleratedL13L16Binding({ correctionApproval: { ...correctionApproval, approval_source: { ...correctionApproval.approval_source, approval_message_id: 'stale' } } })).toThrow(/correction approval source mismatch/)
    expect(() => verifyAcceleratedL13L16Binding({ correctionApproval: { ...correctionApproval, bindings: { ...correctionApproval.bindings, L16: '0'.repeat(64) } } })).toThrow(/correction approval hash mismatch/)
  })

  it('keeps exact corrected media out of the unrelated admin function trace', () => {
    const excludes = nextConfig.experimental.outputFileTracingExcludes['/api/admin/social-content/*/bind-approved-master']
    for (const [id, media] of Object.entries(reviewL13L16Media)) {
      const low = id.toLowerCase()
      expect(excludes).toContain(`./public/accelerated/lessons/${low}/review-${media.compositeSha256.slice(0, 8)}/*`)
    }
  })

  it.each(['L13', 'L14', 'L15', 'L16'] as const)('plays %s directly with captions and transcript, then records progress', (id) => {
    render(<AcceleratedLearningPlan />)
    const lesson = lessons.find((item) => item.id === id)!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${id}:.*ready`) }))
    expect(screen.getByRole('region', { name: `${id} guided video` })).toBeInTheDocument()
    const video = screen.getByLabelText(`${id} ${lesson.title} guided video`)
    expect(video).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', visualParityBindings.lessons.find((item) => item.lessonId === id)?.videoPath)
    expect(document.querySelector('video track')).toHaveAttribute('src', reviewL13L16Media[id].captions)
    const track = { mode: 'hidden' }
    Object.defineProperty(video, 'textTracks', { configurable: true, value: [track] })
    fireEvent.loadedMetadata(video)
    expect(track.mode).toBe('showing')
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    expect(track.mode).toBe('disabled')
    fireEvent.click(screen.getByText(`Read along with ${id} transcript`))
    expect(screen.getByText(reviewL13L16Media[id].transcript.cues[0].text)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
  })
})
