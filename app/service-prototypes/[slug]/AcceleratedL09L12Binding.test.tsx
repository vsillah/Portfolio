import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AcceleratedLearningPlan, approvedL05L08Media, approvedL09L12Media, l01Media, l02Media, l03Media, l04Media, lessons } from './AcceleratedLearningPlan'

const source = 'artifacts/accelerated-l09-l12-native-composite-2026-11-04'
const receipt = JSON.parse(readFileSync('docs/accelerated-course-modules/l09-l12-learner-binding/human-qa-approval-receipt.json', 'utf8'))
const batch = JSON.parse(readFileSync(`${source}/batch-receipt.json`, 'utf8'))
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('Accelerated L09–L12 learner binding', () => {
  it('requires the exact immutable approval and source/media evidence', () => {
    expect(receipt).toMatchObject({
      receipt_type: 'accelerated_l09_l12_human_qa_approval', status: 'approved', external_actions_authorized: false,
      approval_source: { reviewed_pr: 1204, reviewed_pr_head: 'd176054f79c00d4b7b7b7e17e379918a0b15ce98', merged_base_commit: 'adaf7ec28c839867cda56c419be57381e1b154bd' },
      pre_approval_batch_receipt: `${source}/batch-receipt.json`,
    })
    expect(batch.lessons).toHaveLength(4)
    for (const id of ['L09', 'L10', 'L11', 'L12'] as const) {
      const low = id.toLowerCase()
      const media = approvedL09L12Media[id]
      const manifest = JSON.parse(readFileSync(`${source}/${low}/composite-manifest.json`, 'utf8'))
      const composite = JSON.parse(readFileSync(`${source}/${low}/composite-receipt.json`, 'utf8'))
      const item = batch.lessons.find((entry: { lesson: string }) => entry.lesson === id)
      expect(receipt.bindings[id]).toBe(media.compositeSha256)
      expect(existsSync(`public${media.video}`)).toBe(true)
      expect(existsSync(`public${media.captions}`)).toBe(true)
      expect(hash(`public${media.video}`)).toBe(media.compositeSha256)
      expect(hash(`${source}/${low}/accelerated-${low}-native-composite.mp4`)).toBe(media.compositeSha256)
      expect(manifest.output_sha256).toBe(media.compositeSha256)
      expect(composite.composite.sha256).toBe(media.compositeSha256)
      expect(item.composite_sha256).toBe(media.compositeSha256)
      expect(item.source_sha256).toBe(manifest.source_sha256)
      expect(composite.approved_source_sha256).toBe(manifest.source_sha256)
      expect(hash(`docs/accelerated-course-modules/l09-l12-guided-video/${low}-storyboard.srt`)).toBe(manifest.captions_sha256)
      expect(media.transcript.source_srt_sha256).toBe(manifest.captions_sha256)
      expect(hash(`docs/accelerated-course-modules/curriculum/scripts/${id}.md`)).toBe(manifest.script_sha256)
      expect(readFileSync(`public${media.captions}`, 'utf8').match(/-->/g)).toHaveLength(media.transcript.cues.length)
    }
  })

  it('preserves the L01–L08 exact bindings and preserves L13–L16 readiness', () => {
    expect(l01Media.video).toBe('/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4')
    expect(l02Media.video).toBe('/accelerated/lessons/l02/approved-ded23edb/accelerated-l02-native-composite.mp4')
    expect(l03Media.video).toBe('/accelerated/lessons/l03/approved-02b9c3ea/accelerated-l03-native-composite.mp4')
    expect(l04Media.video).toBe('/accelerated/lessons/l04/approved-b239a55b/accelerated-l04-native-composite.mp4')
    expect(Object.keys(approvedL05L08Media)).toEqual(['L05', 'L06', 'L07', 'L08'])
    render(<AcceleratedLearningPlan />)
    for (const item of lessons.filter((lesson) => Number(lesson.id.slice(1)) >= 13)) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${item.id}:`) }))
      expect(screen.getByRole('button', { name: new RegExp(`Watch ${item.id} guided video`) })).toBeEnabled()
    }
  })

  it.each(['L09', 'L10', 'L11', 'L12'] as const)('plays %s with captions and transcript, then returns to progress', (id) => {
    render(<AcceleratedLearningPlan />)
    const item = lessons.find((lesson) => lesson.id === id)!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${id}:`) }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Watch ${id} guided video`) }))
    const video = screen.getByLabelText(`${id} ${item.title} guided video`)
    expect(video).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', approvedL09L12Media[id].video)
    expect(document.querySelector('video track')).toHaveAttribute('src', approvedL09L12Media[id].captions)
    const track = { mode: 'hidden' }
    Object.defineProperty(video, 'textTracks', { configurable: true, value: [track] })
    fireEvent.loadedMetadata(video)
    expect(track.mode).toBe('showing')
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    expect(track.mode).toBe('disabled')
    fireEvent.click(screen.getByText(`Read along with ${id} transcript`))
    expect(screen.getByText(approvedL09L12Media[id].transcript.cues[0].text)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Return to Learning plan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
  })
})
