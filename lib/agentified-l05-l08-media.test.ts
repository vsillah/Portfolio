import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedL05L08Media } from './agentified-l05-l08-media'

const source = 'agentified/workshop/l05-l08-continuous-narration'
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('approved Agentified L05-L08 continuous narration', () => {
  it.each(Object.entries(agentifiedL05L08Media))('%s binds the immutable composite, complete transcript, and 45-second countdown', (id, media) => {
    const lesson = id.toLowerCase()
    const filename = `agentified-${lesson}-continuous-narration`
    const receipt = JSON.parse(readFileSync(`${source}/${lesson}-validation-receipt.json`, 'utf8'))
    const publicVideo = `public${media.video}`
    const publicCaptions = `public${media.captions}`
    expect(digest(publicVideo)).toBe(media.compositeSha256)
    expect(digest(publicCaptions)).toBe(media.vttSha256)
    expect(digest(`${source}/${filename}-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`${source}/${filename}-captions.vtt`)).toBe(media.vttSha256)
    expect(receipt.composite.sha256).toBe(media.compositeSha256)
    expect(receipt.captions.vtt_sha256).toBe(media.vttSha256)
    expect(receipt.composite.duration_seconds).toBe(media.durationSeconds)
    expect(receipt.guided_work_window).toMatchObject(media.guidedWork)
    expect(media.guidedWork.end - media.guidedWork.start).toBe(45)

    const cues = readFileSync(publicCaptions, 'utf8').split(/\r?\n\r?\n/).slice(1).filter(Boolean).map((block) => {
      const [timing, ...lines] = block.split(/\r?\n/)
      return { start: timing.slice(0, 8), text: lines.join(' ').trim() }
    })
    expect(media.spokenCues).toEqual(cues)
    expect(cues.length).toBeGreaterThan(40)
  })

  it('pins the source commit and provider batch receipt', () => {
    const receipt = JSON.parse(readFileSync(`${source}/batch-provider-receipt.json`, 'utf8'))
    expect(receipt.source_commit).toBe('a260c7593758fd6757ea21ef240a9abc83cc3725')
    expect(receipt.batch_sha256).toBe('398b0032f735cae199817634f997db89099dbf0c0a9b6c6c123d318c3067eeb1')
    expect(receipt.jobs_submitted).toBe(4)
    expect(receipt.retries).toBe(0)
  })
})
