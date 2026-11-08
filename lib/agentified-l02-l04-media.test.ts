import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedL02L04Media } from './agentified-l02-l04-media'
import { expectRenderedFrameHasContent } from './agentified-media-frame-test-helper'

const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('approved Agentified L02-L04 media', () => {
  it.each(Object.entries(agentifiedL02L04Media))('%s binds the approved composite, captions, and spoken transcript', (id, media) => {
    const base = `public${media.video.slice(0, media.video.lastIndexOf('/') + 1)}`
    const lesson = id.toLowerCase()
    expect(digest(`${base}agentified-${lesson}-native-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`${base}agentified-${lesson}-native-captions.vtt`)).toBe(media.vttSha256)
    expect(digest(`agentified/workshop/l02-l04-native-composite/agentified-${lesson}-native-composite.mp4`)).toBe(media.compositeSha256)
    expect(digest(`agentified/workshop/l02-l04-native-composite/agentified-${lesson}-native-captions.vtt`)).toBe(media.vttSha256)
    const vtt = readFileSync(`${base}agentified-${lesson}-native-captions.vtt`, 'utf8')
    for (const cue of media.spokenCues) expect(vtt).toContain(cue.text)
    expect(media.spokenCues.length).toBeGreaterThan(0)
  })


  it.each([
    ['L02', 16.9, 504.2, 507],
    ['L03', 14.8, 592.2, 597],
    ['L04', 18.3, 597.2, 599],
  ] as const)('%s keeps teaching cards visible at presenter handoffs', (id, afterOpening, afterClosingPresenter, closingCard) => {
    const media = agentifiedL02L04Media[id]
    const composite = `public${media.video}`
    for (const timestamp of [afterOpening, 30, afterClosingPresenter, closingCard]) {
      expectRenderedFrameHasContent(composite, timestamp)
    }
  })
})
