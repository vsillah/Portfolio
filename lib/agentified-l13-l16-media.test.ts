import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedL13L16Media } from './agentified-l13-l16-media'

const source = 'agentified/workshop/l13-l16-native-composite'
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const batch = JSON.parse(readFileSync(`${source}/batch-provider-receipt.json`, 'utf8'))
const expected = {
  L13: 'c84cc00839f3cc1b3abef53385cc9879d3ce56dcb651a02922cd127b311db69f',
  L14: 'de258e9b72709f757939d82b5d291400800e12f2d74534a675ee0a17292c41a0',
  L15: '80fb28550e6ad7a0a28cb54f349e28af473ca762a72fae6a74fb9905f3ca11e5',
  L16: 'e890f6a940ea6fcb1861bc79f1bffafec7306637f14b4bee1753527572e7138a',
}

describe('approved Agentified L13-L16 binding', () => {
  it('uses the immutable batch and L13 correction receipts', () => {
    expect(batch.lessons.map((item: { lesson_id: string }) => item.lesson_id)).toEqual(Object.keys(expected))
    expect(batch.caption_correction_receipt.sha256).toBe(digest(`${source}/l13-caption-correction-receipt.json`))
    const correction = JSON.parse(readFileSync(`${source}/l13-caption-correction-receipt.json`, 'utf8'))
    expect(correction.after.composite_sha256).toBe(expected.L13)
    expect(correction.after.vtt_sha256).toBe(agentifiedL13L16Media.L13.vttSha256)
  })

  it.each(Object.entries(agentifiedL13L16Media))('%s binds exact media, captions, transcript, and timing', (id, media) => {
    const low = id.toLowerCase()
    const receipt = JSON.parse(readFileSync(`${source}/${low}-provider-receipt.json`, 'utf8'))
    const lesson = batch.lessons.find((item: { lesson_id: string }) => item.lesson_id === id)
    expect(media.compositeSha256).toBe(expected[id as keyof typeof expected])
    expect(lesson.composite_sha256).toBe(media.compositeSha256)
    expect(receipt.composite.sha256).toBe(media.compositeSha256)
    expect(receipt.captions.vtt_sha256).toBe(media.vttSha256)
    expect(digest(`public${media.video}`)).toBe(media.compositeSha256)
    expect(digest(`public${media.captions}`)).toBe(media.vttSha256)
    expect(digest(`${source}/agentified-${low}-native-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`${source}/agentified-${low}-native-captions.vtt`)).toBe(media.vttSha256)
    expect(media.durationSeconds).toBe(lesson.output_duration_seconds)
    expect(media.guidedWork).toEqual({ start: receipt.timing_receipt.guided_work_countdown.sequence_start, end: receipt.timing_receipt.guided_work_countdown.sequence_end, duration: 45 })
    const cues = readFileSync(`public${media.captions}`, 'utf8').trim().split(/\r?\n\r?\n/).slice(1).map((block) => {
      const [timing, ...lines] = block.split(/\r?\n/)
      return { start: timing.slice(0, 8), text: lines.join(' ').trim() }
    })
    expect(media.spokenCues).toEqual(cues)
    expect(cues.length).toBeGreaterThan(35)
  })
})
