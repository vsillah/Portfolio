import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedL01Media as media } from './agentified-l01-media'

const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const base = 'agentified/workshop/l01-native-composite/'

describe('approved Agentified L01 media binding', () => {
  it('fails closed on drift of every approved source and served asset', () => {
    expect(digest(`${base}agentified-l01-native-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`${base}agentified-l01-native-captions.srt`)).toBe(media.srtSha256)
    expect(digest(`${base}agentified-l01-native-captions.vtt`)).toBe(media.vttSha256)
    expect(digest('agentified/workshop/l01-native-source/agentified-l01-heygen-native-source.mp4')).toBe(media.sourceSha256)
    expect(digest(`public${media.video}`)).toBe(media.compositeSha256)
    expect(digest(`public${media.captions}`)).toBe(media.vttSha256)
    const timeline = JSON.parse(readFileSync(`${base}composite-timeline.json`, 'utf8'))
    expect(timeline.lesson_duration_seconds).toBe(media.durationSeconds)
    expect(timeline.native_speed).toBe(1)
    expect(timeline.approved_closing_card).toEqual({ start: 523, end: 540 })
  })

  it('keeps the read-along spoken cues aligned with the approved VTT', () => {
    const vtt = readFileSync(`${base}agentified-l01-native-captions.vtt`, 'utf8')
    for (const cue of media.spokenCues) {
      expect(vtt).toContain(cue.text)
      expect(vtt).toContain(cue.start)
    }
    expect((vtt.match(/ --> /g) ?? []).length).toBe(media.spokenCues.length)
  })
})
