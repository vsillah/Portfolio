import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AcceleratedLearningPlan, approvedL05L08Media, l01Media, l02Media, l03Media, l04Media, lessons } from './AcceleratedLearningPlan'
import { validateApproval, validateReconciliation, verifyL04Binding } from '../../../scripts/verify-accelerated-l04-binding.mjs'

const dir = 'docs/accelerated-course-modules/l04-learner-binding'
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'))
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const approval = json(`${dir}/human-qa-approval-receipt.json`)
const reconciliation = json(`${dir}/caption-count-reconciliation-receipt.json`)
const packet = json(`${dir}/final-human-qa-packet.json`)

describe('Accelerated L04 approved learner binding', () => {
  it('keeps the approved hashes and original packet immutable, with exact 94-cue evidence', () => {
    expect(verifyL04Binding()).toBe(true)
    expect(hash(`public${l04Media.video}`)).toBe(l04Media.compositeSha256)
    expect(hash('docs/accelerated-course-modules/l02-l04-guided-video/l04-storyboard.srt')).toBe(l04Media.captionsSourceSha256)
    expect(hash('docs/accelerated-course-modules/curriculum/scripts/L04.md')).toBe(approval.bindings.script_sha256)
    expect(hash(`${dir}/final-human-qa-packet.json`)).toBe(reconciliation.bindings.original_packet_sha256)
    expect(packet.media.caption_cues).toBe(95)
    expect(approval.approval.message_id).toBe('msg_0b99e4d3546af239016aebc1eebe94819c8508b64284d53437')
    expect(approval.approval.implementation_head).toBe('81e1548b124bee3d304e6a722f2093d2713b6fee')
    expect(approval.reviewer.identity).toBe('Vambah Sillah')
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 's:0', '-count_packets', '-count_frames', '-show_entries', 'stream=nb_read_packets,nb_read_frames', '-of', 'json', `public${l04Media.video}`], { encoding: 'utf8' }))
    expect(probe.streams[0]).toEqual({ nb_read_frames: '94', nb_read_packets: '94' })
    expect(l04Media.transcript.cues).toHaveLength(94)
  })

  it('fails closed on absent, pending, duplicate, stale, and mismatched evidence', () => {
    expect(() => validateApproval([])).toThrow(/absent or duplicate/)
    expect(() => validateApproval([approval, approval])).toThrow(/absent or duplicate/)
    expect(() => validateApproval([{ ...approval, status: 'pending' }])).toThrow(/pending/)
    expect(() => validateApproval([{ ...approval, reviewer: { identity: 'Another reviewer' } }])).toThrow(/identity-mismatched/)
    expect(() => validateApproval([{ ...approval, approval: { ...approval.approval, implementation_head: 'stale' } }])).toThrow(/stale/)
    expect(() => validateApproval([{ ...approval, bindings: { ...approval.bindings, composite_sha256: 'wrong' } }])).toThrow(/identity-mismatched/)
    expect(() => validateReconciliation(undefined, packet)).toThrow(/absent/)
    expect(() => validateReconciliation({ ...reconciliation, status: 'pending' }, packet)).toThrow(/pending/)
    expect(() => validateReconciliation({ ...reconciliation, approval_message_id: 'stale' }, packet)).toThrow(/stale/)
    expect(() => validateReconciliation({ ...reconciliation, bindings: { ...reconciliation.bindings, approved_srt_sha256: 'wrong' } }, packet)).toThrow(/mismatched/)
  })

  it('plays L04 with captions and transcript, returns to progress, preserves L01–L03 and L05–L08, and locks L09–L16', () => {
    expect(l01Media.video).toContain('/l01/')
    expect(l02Media.video).toContain('/l02/')
    expect(l03Media.video).toContain('/l03/')
    expect(Object.keys(approvedL05L08Media)).toEqual(['L05', 'L06', 'L07', 'L08'])
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: /L04: Build small; keep personas alive/ }))
    expect(screen.getByText('L04 guided video is ready')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Watch L04 guided video/ }))
    const video = screen.getByLabelText('L04 Build small; keep personas alive guided video')
    expect(video).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', l04Media.video)
    expect(document.querySelector('video track')).toHaveAttribute('src', l04Media.captions)
    const track = { mode: 'hidden' }
    Object.defineProperty(video, 'textTracks', { configurable: true, value: [track] })
    fireEvent.loadedMetadata(video)
    expect(track.mode).toBe('showing')
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    expect(track.mode).toBe('disabled')
    fireEvent.click(screen.getByText('Read along with L04 transcript'))
    expect(screen.getByText(l04Media.transcript.cues[0].text)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Return to Learning plan/ }))
    expect(screen.queryByLabelText('L04 Build small; keep personas alive guided video')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
    for (const lesson of lessons.slice(8)) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${lesson.id}:.*locked`) }))
      expect(screen.getByRole('button', { name: `Watch ${lesson.id} guided video, unavailable until production review` })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Completion unavailable' })).toBeDisabled()
    }
  })
})
