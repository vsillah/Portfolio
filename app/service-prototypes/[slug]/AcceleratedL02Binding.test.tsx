import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AcceleratedLearningPlan, l01Media, l02Media, lessons } from './AcceleratedLearningPlan'

vi.mock('next/image', () => ({
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const require = createRequire(import.meta.url)

describe('Accelerated L02 learner binding', () => {
  it('keeps static L02 media out of the oversized admin function trace', () => {
    const config = require('../../../next.config.js')
    const exclusions = config.experimental.outputFileTracingExcludes['/api/admin/social-content/*/bind-approved-master']
    expect(exclusions).toContain('./public/accelerated/lessons/l01/approved-ee09bf72/*')
    expect(exclusions).toContain('./public/accelerated/lessons/l02/approved-ded23edb/*')
  })

  it('binds exact L02 media, approved captions, native source, and lesson identity', () => {
    const manifest = JSON.parse(readFileSync('docs/accelerated-course-modules/l02-native-composite/composite-manifest.json', 'utf8'))
    const receipt = JSON.parse(readFileSync('docs/accelerated-course-modules/l02-native-composite/composite-receipt.json', 'utf8'))
    const transcript = JSON.parse(readFileSync('docs/accelerated-course-modules/l02-native-composite/l02-learner-transcript.json', 'utf8'))
    expect(manifest.lesson).toBe('Accelerated L02')
    expect(receipt.lesson).toBe('Accelerated L02')
    expect(hash(`public${l02Media.video}`)).toBe(l02Media.compositeSha256)
    expect(hash('docs/accelerated-course-modules/l02-native-composite/accelerated-l02-native-composite.mp4')).toBe(l02Media.compositeSha256)
    expect(hash('docs/accelerated-course-modules/l02-native-composite/accelerated-l02-heygen-native.mp4')).toBe(l02Media.sourceSha256)
    expect(hash('docs/accelerated-course-modules/l02-l04-guided-video/l02-storyboard.srt')).toBe(l02Media.captionsSourceSha256)
    expect(manifest.output_sha256).toBe(l02Media.compositeSha256)
    expect(manifest.source_sha256).toBe(l02Media.sourceSha256)
    expect(manifest.captions_sha256).toBe(l02Media.captionsSourceSha256)
    expect(transcript.source_srt_sha256).toBe(l02Media.captionsSourceSha256)
    expect(transcript.cues).toHaveLength(94)
    expect(readFileSync(`public${l02Media.captions}`, 'utf8').match(/-->/g)).toHaveLength(94)
    expect(l01Media.video).toBe('/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4')
    expect(hash(`public${l01Media.video}`)).toBe('ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a')
  })

  it('plays L02 with captions and transcript, returns to plan, and keeps L03–L16 locked', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: /L02: Prioritize before generating/ }))
    expect(screen.getByText('L02 guided video is ready')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Watch L02 guided video/ }))
    expect(screen.getByLabelText('L02 Prioritize before generating guided video')).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', l02Media.video)
    expect(document.querySelector('video track')).toHaveAttribute('src', l02Media.captions)
    expect(screen.getByRole('button', { name: 'English captions on' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    expect(screen.getByRole('button', { name: 'English captions off' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByText('Read along with L02 transcript'))
    expect(screen.getByText('The meeting has barely started and the board is full.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Return to Learning plan/ }))
    expect(screen.queryByLabelText('L02 Prioritize before generating guided video')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
    for (const item of lessons.slice(2)) {
      const row = screen.getByRole('button', { name: new RegExp(`^${item.id}:.*locked`) })
      expect(row.querySelector('[data-state]')).toHaveAttribute('data-state', 'locked')
      fireEvent.click(row)
      expect(screen.getByRole('button', { name: new RegExp(`Watch ${item.id} guided video`) })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Completion unavailable' })).toBeDisabled()
    }
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
  })
})
