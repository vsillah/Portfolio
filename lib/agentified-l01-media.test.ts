import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedL01Media as media } from './agentified-l01-media'
import { expectRenderedFrameHasContent } from './agentified-media-frame-test-helper'

const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const base = 'agentified/workshop/l01-continuous-narration/'
const presenterBase = 'agentified/workshop/l01-gray-sweater-replacement/'

describe('approved Agentified L01 continuous-narration binding', () => {
  it('fails closed on drift of every approved source and served asset', () => {
    expect(digest(`${base}agentified-l01-continuous-narration-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`${base}agentified-l01-continuous-narration-captions.srt`)).toBe(media.srtSha256)
    expect(digest(`${base}agentified-l01-continuous-narration-captions.vtt`)).toBe(media.vttSha256)
    expect(digest(`${base}agentified-l01-continuous-narration-source.mp3`)).toBe(media.narrationSha256)
    expect(digest(`${presenterBase}agentified-l01-gray-sweater-source.mp4`)).toBe(media.sourceSha256)
    expect(digest(`public${media.video}`)).toBe(media.compositeSha256)
    expect(digest(`public${media.captions}`)).toBe(media.vttSha256)

    const receipt = JSON.parse(readFileSync(`${base}validation-receipt.json`, 'utf8'))
    expect(receipt.composite.duration_seconds).toBe(media.durationSeconds)
    expect(receipt.presenter_source).toMatchObject({
      background_treatment: 'provider_free_studio_reconstruction',
      treatment_parameters: {
        key: 'colorkey=0x00e868:0.28:0.08',
        edge_despill: 'green:mix=0.05:expand=0.02',
        native_presenter_pixels_preserved: true,
      },
      placements: [
        { source_start: 0, source_end: 13.633, sequence_start: 0, sequence_end: 13.633 },
        { source_start: 13.633, source_end: 16.386, sequence_start: 518.84, sequence_end: 521.593 },
      ],
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
    for (const timestamp of [14.4, 20, 523.2, 528]) {
      expectRenderedFrameHasContent(composite, timestamp)
    }
  })
})
