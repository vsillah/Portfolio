import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedL01Media as media } from './agentified-l01-media'
import { expectRenderedFrameHasContent } from './agentified-media-frame-test-helper'

const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const base = 'agentified/workshop/l01-gray-sweater-replacement/'

describe('approved Agentified L01 media binding', () => {
  it('fails closed on drift of every approved source and served asset', () => {
    expect(digest(`${base}agentified-l01-gray-sweater-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`${base}agentified-l01-gray-sweater-captions.srt`)).toBe(media.srtSha256)
    expect(digest(`${base}agentified-l01-gray-sweater-captions.vtt`)).toBe(media.vttSha256)
    expect(digest(`${base}agentified-l01-gray-sweater-source.mp4`)).toBe(media.sourceSha256)
    expect(digest(`public${media.video}`)).toBe(media.compositeSha256)
    expect(digest(`public${media.captions}`)).toBe(media.vttSha256)
    const timeline = JSON.parse(readFileSync(`${base}composite-timeline.json`, 'utf8'))
    expect(timeline.lesson_duration_seconds).toBe(media.durationSeconds)
    expect(timeline.native_speed).toBe(1)
    expect(timeline.approved_closing_card).toEqual({ start: 523, end: 540 })
    expect(timeline.source_background.treatment).toBe('provider_free_chroma_key')
  })

  it('keeps the read-along spoken cues aligned with the approved VTT', () => {
    const vtt = readFileSync(`${base}agentified-l01-gray-sweater-captions.vtt`, 'utf8')
    for (const cue of media.spokenCues) {
      expect(vtt).toContain(cue.text)
      expect(vtt).toContain(cue.start)
    }
    expect((vtt.match(/ --> /g) ?? []).length).toBe(media.spokenCues.length)
  })

  it('keeps the teaching plate visible outside both presenter windows', () => {
    const composite = `${base}agentified-l01-gray-sweater-composite.mp4`
    for (const timestamp of [14.4, 19.5, 523.2, 528]) {
      expectRenderedFrameHasContent(composite, timestamp)
    }
  })
})
