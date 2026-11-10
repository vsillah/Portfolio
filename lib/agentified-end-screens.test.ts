import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import illustrated from './agentified-illustrated-bindings.json'
import { AGENTIFIED_END_SCREEN_PATTERN_COMMIT, agentifiedEndScreenBindings, agentifiedEndScreenFor } from './agentified-end-screens'

function finalCaptionEnd(path: string) {
  const timestamps = [...readFileSync(`public${path}`, 'utf8').matchAll(/--> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/g)]
  const match = timestamps.at(-1)
  if (!match) throw new Error(`No captions found for ${path}`)
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000
}

describe('Agentified end-screen bindings', () => {
  it('binds L02-L16 to the approved L01 pattern and exact immutable media identities', () => {
    expect(AGENTIFIED_END_SCREEN_PATTERN_COMMIT).toBe('5570138a0cc4e02c4cea0dca81e1bf977a647a63')
    expect(Object.keys(agentifiedEndScreenBindings)).toEqual(Array.from({ length: 15 }, (_, index) => `L${String(index + 2).padStart(2, '0')}`))
    for (const [id, endScreen] of Object.entries(agentifiedEndScreenBindings)) {
      const media = illustrated.bindings[id as keyof typeof illustrated.bindings]
      expect(endScreen.videoSha256).toBe(media.compositeSha256)
      expect(endScreen.captionsSha256).toBe(media.captionsSha256)
      expect(endScreen.startSeconds).toBe(finalCaptionEnd(media.captions))
      expect(endScreen.endSeconds).toBe(media.durationSeconds)
      expect(endScreen.endSeconds).toBeGreaterThan(endScreen.startSeconds)
      expect(agentifiedEndScreenFor(id, media.compositeSha256, media.captionsSha256)).toBe(endScreen)
    }
  })

  it('fails closed on video, caption, or lesson identity drift', () => {
    const l02 = illustrated.bindings.L02
    expect(agentifiedEndScreenFor('L02', 'drift', l02.captionsSha256)).toBeNull()
    expect(agentifiedEndScreenFor('L02', l02.compositeSha256, 'drift')).toBeNull()
    expect(agentifiedEndScreenFor('L01', illustrated.bindings.L01.compositeSha256, illustrated.bindings.L01.captionsSha256)).toBeNull()
  })

  it('uses sequential next-lesson identities and a course-complete L16 boundary', () => {
    for (let lesson = 2; lesson <= 15; lesson += 1) {
      const id = `L${String(lesson).padStart(2, '0')}` as keyof typeof agentifiedEndScreenBindings
      expect(agentifiedEndScreenBindings[id].nextLessonId).toBe(`L${String(lesson + 1).padStart(2, '0')}`)
      expect(agentifiedEndScreenBindings[id].progress).toBe(lesson)
    }
    expect(agentifiedEndScreenBindings.L16.nextLessonId).toBeNull()
    expect(agentifiedEndScreenBindings.L16.progress).toBe(16)
    expect(agentifiedEndScreenBindings.L16.endSeconds - agentifiedEndScreenBindings.L16.startSeconds).toBeCloseTo(0.087, 3)
  })
})
