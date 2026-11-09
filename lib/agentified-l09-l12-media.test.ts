import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedL09L12Media } from './agentified-l09-l12-media'

const source = 'agentified/workshop/l09-l12-native-composite'
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('approved Agentified L09-L12 native composites', () => {
  it.each(Object.entries(agentifiedL09L12Media))('%s binds exact source, composite, captions, transcript, and countdown', (id, media) => {
    const lesson = id.toLowerCase()
    const receipt = JSON.parse(readFileSync(`${source}/${lesson}-provider-receipt.json`, 'utf8'))
    const publicVideo = `public${media.video}`
    const publicCaptions = `public${media.captions}`
    expect(digest(publicVideo)).toBe(media.compositeSha256)
    expect(digest(publicCaptions)).toBe(media.vttSha256)
    expect(digest(`${source}/agentified-${lesson}-native-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`${source}/agentified-${lesson}-native-captions.vtt`)).toBe(media.vttSha256)
    expect(receipt.composite.sha256).toBe(media.compositeSha256)
    expect(receipt.captions.vtt_sha256).toBe(media.vttSha256)
    expect(receipt.native_source.sha256).toBe(media.nativeSourceSha256)
    expect(receipt.composite.duration_seconds).toBe(media.durationSeconds)
    expect(receipt.timing_receipt.guided_work_countdown).toMatchObject({ sequence_start: media.guidedWork.start, sequence_end: media.guidedWork.end, seconds: 45 })
    expect(media.guidedWork.end - media.guidedWork.start).toBe(45)
    expect(receipt.timing_receipt.presenter_windows).toHaveLength(2)
    expect(Math.abs(receipt.timing_receipt.provider_free_closing_card.end - receipt.composite.duration_seconds)).toBeLessThan(0.02)
    if (id === 'L10') expect(receipt.timing_receipt.l10_mobile_diagram_treatment.mode).toBe('enlarged_full_width_plate')

    const cues = readFileSync(publicCaptions, 'utf8').trim().split(/\r?\n\r?\n/).slice(1).map((block) => {
      const [timing, ...lines] = block.split(/\r?\n/)
      return { start: timing.slice(0, 8), text: lines.join(' ').trim() }
    })
    expect(media.spokenCues).toEqual(cues)
    expect(cues.length).toBeGreaterThan(35)
  })
})
