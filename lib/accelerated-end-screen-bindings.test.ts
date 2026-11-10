import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import bindings from './accelerated-end-screen-bindings.json'
import { lessonPosters } from './accelerated-lesson-posters'
import { lessons } from './accelerated-decision-file'

const root = path.resolve(__dirname, '..')
const hash = (url: string) => createHash('sha256').update(readFileSync(path.join(root, 'public', url))).digest('hex')
const seconds = (clock: string) => clock.split(':').map(Number).reduce((total, part) => total * 60 + part, 0)

describe('Accelerated end-screen source binding', () => {
  it('binds all sixteen exact media, captions, final sentence boundaries, and cover identities', () => {
    expect(bindings.lessons.map((item) => item.lessonId)).toEqual(lessons.map((item) => item.id))
    for (const [index, item] of bindings.lessons.entries()) {
      const id = item.lessonId as keyof typeof lessonPosters
      const caption = readFileSync(path.join(root, 'public', item.captionPath), 'utf8')
      const cues = [...caption.matchAll(/(?:\d\d:)?\d\d:\d\d\.\d+ --> ((?:\d\d:)?\d\d:\d\d\.\d+)\n([^\n]+(?:\n(?!\n)[^\n]+)*)/g)]
      const last = cues.at(-1)
      expect(item.videoSha256).toBe(hash(item.videoPath))
      expect(item.captionSha256).toBe(hash(item.captionPath))
      expect(item.posterPath).toBe(lessonPosters[id])
      expect(item.posterSha256).toBe(hash(item.posterPath))
      expect(last?.[1]).toBe(item.finalCaptionEnd)
      expect(last?.[2].replaceAll('\n', ' ')).toBe(item.finalCaptionText)
      expect(item.finalCaptionText).toMatch(/[.!?]$/)
      expect(seconds(item.finalCaptionEnd)).toBe(lessons[index].minutes * 60)
      if (index < 15) {
        const next = bindings.lessons[index + 1]
        expect(next.posterPath).toBe(lessonPosters[next.lessonId as keyof typeof lessonPosters])
        expect(next.posterSha256).toBe(hash(next.posterPath))
      }
    }
  })
})
