import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AcceleratedLearningPlan, approvedL05L08Media, l01Media, l02Media, l03Media, lessons } from './AcceleratedLearningPlan'

const source = 'artifacts/accelerated-l05-l08-native-composite-2026-11-04'
const receipt = JSON.parse(readFileSync('docs/accelerated-course-modules/l05-l08-learner-binding/human-qa-approval-receipt.json', 'utf8'))
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('Accelerated L05–L08 learner binding', () => {
  it('fails closed on approval and source identity drift', () => {
    expect(receipt.status).toBe('approved')
    expect(receipt.approval_source).toEqual({
      delegated_task_source_thread_id: '019ef636-39d4-7180-953c-660515b5604a',
      reviewed_pr: 1201,
      reviewed_pr_head: 'c050efc06d583528fffa220066315a07a4a79400',
      merged_base_commit: '9dda6126fb0bab0468080e394b5b3d91806a99f9',
      reviewer: 'Vambah Sillah',
    })
    expect(receipt.external_actions_authorized).toBe(false)
    const batch = JSON.parse(readFileSync(`${source}/batch-receipt.json`, 'utf8'))
    expect(batch.lessons).toHaveLength(4)
    expect(batch.status).toBe('human_qa_pending') // historical receipt stays unchanged
    for (const id of ['L05', 'L06', 'L07', 'L08'] as const) {
      const low = id.toLowerCase()
      const media = approvedL05L08Media[id]
      const manifest = JSON.parse(readFileSync(`${source}/${low}/composite-manifest.json`, 'utf8'))
      const composite = JSON.parse(readFileSync(`${source}/${low}/composite-receipt.json`, 'utf8'))
      const provider = JSON.parse(readFileSync(`${source}/${low}/provider-receipt.json`, 'utf8'))
      const timing = JSON.parse(readFileSync(`${source}/${low}/timing-receipt.json`, 'utf8'))
      const batchLesson = batch.lessons.find((item: { lesson: string }) => item.lesson === id)
      expect(receipt.bindings[id]).toBe(media.compositeSha256)
      expect(hash(`public${media.video}`)).toBe(media.compositeSha256)
      expect(hash(`${source}/${low}/accelerated-${low}-native-composite.mp4`)).toBe(media.compositeSha256)
      expect(manifest.output_sha256).toBe(media.compositeSha256)
      expect(composite.composite.sha256).toBe(media.compositeSha256)
      expect(batchLesson.composite_sha256).toBe(media.compositeSha256)
      expect(batchLesson.source_sha256).toBe(manifest.source_sha256)
      expect(composite.approved_source_sha256).toBe(manifest.source_sha256)
      expect(provider).toBeTruthy()
      expect(timing).toBeTruthy()
      expect(hash(`docs/accelerated-course-modules/l05-l08-guided-video/${low}-storyboard.srt`)).toBe(manifest.captions_sha256)
      expect(media.transcript.source_srt_sha256).toBe(manifest.captions_sha256)
      expect(hash(`docs/accelerated-course-modules/curriculum/scripts/${id}.md`)).toBe(manifest.script_sha256)
      expect(readFileSync(`public${media.captions}`, 'utf8').match(/-->/g)).toHaveLength(media.transcript.cues.length)
    }
  })

  it('preserves L01–L04 and keeps L09–L16 locked', () => {
    expect(l01Media.video).toBe('/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4')
    expect(l02Media.video).toBe('/accelerated/lessons/l02/approved-ded23edb/accelerated-l02-native-composite.mp4')
    expect(l03Media.video).toBe('/accelerated/lessons/l03/approved-02b9c3ea/accelerated-l03-native-composite.mp4')
    render(<AcceleratedLearningPlan />)
    for (const item of lessons.filter((lesson) => lesson.id === 'L04' || Number(lesson.id.slice(1)) >= 9)) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${item.id}:.*locked`) }))
      expect(screen.getByRole('button', { name: `Completion unavailable` })).toBeDisabled()
      expect(screen.getByRole('button', { name: new RegExp(`Watch ${item.id} guided video`) })).toBeDisabled()
    }
  })

  it.each(['L05', 'L06', 'L07', 'L08'] as const)('plays %s with captions and transcript, then returns to progress', (id) => {
    render(<AcceleratedLearningPlan />)
    const item = lessons.find((lesson) => lesson.id === id)!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${id}:`) }))
    expect(screen.getByText(`${id} guided video is ready`)).toBeInTheDocument()
    expect(screen.queryByText(/approved workshop visual|Storyboard preview · representative frame|Progress is for this preview only/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Watch ${id} guided video`) }))
    const video = screen.getByLabelText(`${id} ${item.title} guided video`)
    expect(video).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', approvedL05L08Media[id].video)
    expect(document.querySelector('video track')).toHaveAttribute('src', approvedL05L08Media[id].captions)
    const track = { mode: 'hidden' }
    Object.defineProperty(video, 'textTracks', { configurable: true, value: [track] })
    fireEvent.loadedMetadata(video)
    expect(track.mode).toBe('showing')
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    expect(track.mode).toBe('disabled')
    fireEvent.click(screen.getByText(`Read along with ${id} transcript`))
    expect(screen.getByText(approvedL05L08Media[id].transcript.cues[0].text)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Return to Learning plan/ }))
    expect(screen.queryByLabelText(`${id} ${item.title} guided video`)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
  })
})
