import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedL01Media as media } from './agentified-l01-media'
import { expectRenderedFrameHasContent } from './agentified-media-frame-test-helper'

const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const base = 'agentified/workshop/l01-narration-continuity/'
const narrationBase = 'agentified/workshop/l01-continuous-narration/'
const presenterBase = 'agentified/workshop/l01-gray-sweater-replacement/'

describe('approved Agentified L01 continuous-narration binding', () => {
  it('fails closed on drift of every approved source and served asset', () => {
    expect(digest(`${base}agentified-l01-continuous-narration-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`${base}agentified-l01-continuous-narration-captions.srt`)).toBe(media.srtSha256)
    expect(digest(`${base}agentified-l01-continuous-narration-captions.vtt`)).toBe(media.vttSha256)
    expect(digest(`${narrationBase}agentified-l01-continuous-narration-source.mp3`)).toBe(media.narrationSha256)
    expect(digest(`${presenterBase}agentified-l01-gray-sweater-source.mp4`)).toBe(media.sourceSha256)
    expect(digest(`public${media.video}`)).toBe(media.compositeSha256)
    expect(digest(`public${media.captions}`)).toBe(media.vttSha256)

    const receipt = JSON.parse(readFileSync(`${base}validation-receipt.json`, 'utf8'))
    expect(receipt.corrected_composite.duration_seconds).toBeCloseTo(media.durationSeconds, 3)
    expect(receipt.continuity).toMatchObject({
      ordinary_gap_target_seconds: 0.8,
      ordinary_gap_limit_seconds: 2.5,
      removed_pause_count: 36,
      maximum_corrected_ordinary_gap_seconds: 1.8949999999999818,
      guided_work_window: { preserved: true },
    })
    expect(receipt.boundaries).toMatchObject({
      provider_calls: 0,
      narration_rewritten: false,
      source_audio_replaced: false,
      presenter_footage_replaced: false,
      illustrations_replaced: false,
    })
  })

  it('keeps all read-along cues aligned with the approved VTT', () => {
    const vtt = readFileSync(`${base}agentified-l01-continuous-narration-captions.vtt`, 'utf8')
    const normalizedVtt = vtt.replace(/\s+/g, ' ')
    for (const cue of media.spokenCues) {
      expect(normalizedVtt).toContain(cue.text)
      expect(vtt).toContain(cue.start)
    }
    expect(media.spokenCues).toHaveLength(55)
    expect((vtt.match(/ --> /g) ?? []).length).toBe(media.spokenCues.length)
  })

  it('keeps the teaching plate visible outside both presenter windows', () => {
    const composite = `${base}agentified-l01-continuous-narration-composite.mp4`
    for (const timestamp of [14.4, 20, 360, 370]) {
      expectRenderedFrameHasContent(composite, timestamp)
    }
  })

  it('fails closed when an ordinary phrase gap exceeds the continuity budget', () => {
    const receipt = JSON.parse(readFileSync(`${base}validation-receipt.json`, 'utf8'))
    const cues = receipt.corrected_cues as Array<{ start: number; end: number; text: string }>
    const gaps = cues.slice(0, -1).map((cue, index) => ({
      seconds: cues[index + 1].start - cue.end,
      guided: cue.text === 'The point is to see the shape of the work before asking a tool to do it.',
    }))
    expect(Math.max(...gaps.filter(gap => !gap.guided).map(gap => gap.seconds))).toBeLessThanOrEqual(2.5)
    expect(gaps.filter(gap => gap.guided)).toHaveLength(1)
  })
})
