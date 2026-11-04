import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AcceleratedLearningPlan, l01Media, l02Media, l03Media, lessons } from './AcceleratedLearningPlan'

vi.mock('next/image', () => ({
  default: ({ unoptimized: _unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const require = createRequire(import.meta.url)

describe('Accelerated L03 learner binding', () => {
  it('keeps static L03 media out of the admin function trace', () => {
    const config = require('../../../next.config.js')
    const exclusions = config.experimental.outputFileTracingExcludes['/api/admin/social-content/*/bind-approved-master']
    expect(exclusions).toContain('./public/accelerated/lessons/l03/approved-02b9c3ea/*')
  })

  it('binds the exact approved composite, caption source, script, and receipts', () => {
    const dir = 'docs/accelerated-course-modules/l03-native-composite'
    const manifest = JSON.parse(readFileSync(`${dir}/composite-manifest.json`, 'utf8'))
    const receipt = JSON.parse(readFileSync(`${dir}/composite-receipt.json`, 'utf8'))
    const approval = JSON.parse(readFileSync(`${dir}/human-qa-approval-receipt.json`, 'utf8'))
    const deviation = JSON.parse(readFileSync(`${dir}/resolution-deviation-receipt.json`, 'utf8'))
    const transcript = JSON.parse(readFileSync(`${dir}/l03-learner-transcript.json`, 'utf8'))
    expect(hash(`public${l03Media.video}`)).toBe(l03Media.compositeSha256)
    expect(hash('docs/accelerated-course-modules/l02-l04-guided-video/l03-storyboard.srt')).toBe(l03Media.captionsSourceSha256)
    expect(hash('docs/accelerated-course-modules/curriculum/scripts/L03.md')).toBe(manifest.script_sha256)
    expect(hash(`${dir}/resolution-deviation-receipt.json`)).toBe(manifest.resolution_deviation_receipt_sha256)
    expect(manifest.source_commit).toBe('7663edf66b7eb6c88d7129ae331199616ae44345')
    expect(manifest.output_sha256).toBe(l03Media.compositeSha256)
    expect(manifest.source_sha256).toBe(l03Media.sourceSha256)
    expect(receipt.composite.sha256).toBe(l03Media.compositeSha256)
    expect(receipt.approved_source_sha256).toBe(l03Media.sourceSha256)
    expect(receipt.human_qa.composite_status).toBe('pending')
    expect(approval.status).toBe('approved')
    expect(approval.approval.message_id).toBe('01a1a7dd-1768-7aa2-ae4d-94873644fe8c')
    expect(approval.approval.reviewed_pr_head).toBe('3fb377f9c57feaaad77644b309991b0e22d95143')
    expect(approval.bindings.composite_sha256).toBe(l03Media.compositeSha256)
    expect(approval.bindings.provider_source_sha256).toBe(l03Media.sourceSha256)
    expect(approval.bindings.script_sha256).toBe(manifest.script_sha256)
    expect(approval.external_actions_authorized).toBe(false)
    expect(deviation.status).toBe('approved')
    expect(transcript.source_srt_sha256).toBe(l03Media.captionsSourceSha256)
    expect(transcript.cues).toHaveLength(85)
    expect(readFileSync(`public${l03Media.captions}`, 'utf8').match(/-->/g)).toHaveLength(85)
    expect(l01Media.video).toBe('/accelerated/lessons/l01/approved-ee09bf72/accelerated-l01-native-composite.mp4')
    expect(l02Media.video).toBe('/accelerated/lessons/l02/approved-ded23edb/accelerated-l02-native-composite.mp4')
    expect(hash(`public${l01Media.video}`)).toBe('ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a')
    expect(hash(`public${l02Media.video}`)).toBe(l02Media.compositeSha256)
  })

  it('fails closed for absent, pending, stale, or identity-mismatched Human QA approval', async () => {
    const { validateL03HumanQaApproval } = await import('../../../scripts/stage-accelerated-l03-media.mjs')
    const approval = JSON.parse(readFileSync('docs/accelerated-course-modules/l03-native-composite/human-qa-approval-receipt.json', 'utf8'))
    expect(() => validateL03HumanQaApproval(undefined)).toThrow(/absent or pending/)
    expect(() => validateL03HumanQaApproval({ ...approval, status: 'pending' })).toThrow(/absent or pending/)
    expect(() => validateL03HumanQaApproval({
      ...approval,
      approval: { ...approval.approval, reviewed_pr_head: 'stale-head' },
    })).toThrow(/stale or identity-mismatched/)
    expect(() => validateL03HumanQaApproval({
      ...approval,
      bindings: { ...approval.bindings, composite_sha256: 'mismatched-composite' },
    })).toThrow(/artifact binding mismatch/)
  })

  it('plays L03 with captions and transcript, returns to plan, and keeps L04 and L09–L16 locked', () => {
    render(<AcceleratedLearningPlan />)
    fireEvent.click(screen.getByRole('button', { name: /L03: Answer-driven discovery/ }))
    expect(screen.getByText('L03 guided video is ready')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Watch L03 guided video/ }))
    const video = screen.getByLabelText('L03 Answer-driven discovery guided video')
    expect(video).toHaveAttribute('controls')
    expect(document.querySelector('video source')).toHaveAttribute('src', l03Media.video)
    expect(document.querySelector('video track')).toHaveAttribute('src', l03Media.captions)
    const track = { mode: 'hidden' }
    Object.defineProperty(video, 'textTracks', { configurable: true, value: [track] })
    fireEvent.loadedMetadata(video)
    expect(track.mode).toBe('showing')
    fireEvent.click(screen.getByRole('button', { name: 'English captions on' }))
    expect(track.mode).toBe('disabled')
    fireEvent.click(screen.getByText('Read along with L03 transcript'))
    expect(screen.getByText('Imagine walking into a review with a dashboard redesign.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Return to Learning plan/ }))
    expect(screen.queryByLabelText('L03 Answer-driven discovery guided video')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson complete' }))
    expect(screen.getByRole('progressbar', { name: 'Lessons complete' })).toHaveAttribute('value', '1')
    for (const lesson of lessons.filter((item) => item.id === 'L04' || Number(item.id.slice(1)) >= 9)) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${lesson.id}:.*locked`) }))
      expect(screen.getByRole('button', { name: new RegExp(`Watch ${lesson.id} guided video`) })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Completion unavailable' })).toBeDisabled()
    }
  })

  it('fails closed when the committed media is missing or mismatched', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'accelerated-l03-'))
    const script = path.resolve('scripts/stage-accelerated-l03-media.mjs')
    const run = () => execFileSync(process.execPath, ['--input-type=module', '-e', `import { validateAndStageL03 } from ${JSON.stringify(`file://${script}`)}; validateAndStageL03(${JSON.stringify(temp)})`], { encoding: 'utf8', stdio: 'pipe' })
    try {
      expect(run).toThrow(/ENOENT/)
      const media = path.join(temp, `public${l03Media.video}`)
      mkdirSync(path.dirname(media), { recursive: true })
      writeFileSync(media, 'different bytes')
      expect(run).toThrow(/composite hash mismatch/)
    } finally {
      rmSync(temp, { recursive: true, force: true })
    }
  })
})
