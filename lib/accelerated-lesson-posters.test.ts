import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lessonPosters } from './accelerated-lesson-posters'
import { lessons } from '../app/service-prototypes/[slug]/AcceleratedLearningPlan'

const manifest = JSON.parse(readFileSync('docs/qa/accelerated-video-posters/source-map.json', 'utf8')) as {
  posters: { lesson: string; presenterSource: string; presenterSourceSha256: string; presenterStillSeconds: number; visualReview: { eyesOpen: boolean; mouthState: string; motionBlur: boolean; duplicatePose: boolean }; samOrBookAsset: string; samOrBookAssetSha256: string; output: string; outputSha256: string; dimensions: number[] }[]
}
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const dimensions = (bytes: Buffer): [number, number] => {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
  expect(bytes.toString('ascii', 8, 16)).toBe('WEBPVP8 ')
  expect(bytes.toString('hex', 23, 26)).toBe('9d012a')
  return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff]
}

describe('Accelerated lesson posters', () => {
  it('binds a unique source-backed 16:9 cover to every ready lesson', () => {
    expect(Object.keys(lessonPosters)).toEqual(lessons.map(({ id }) => id))
    expect(manifest.posters.map(({ lesson }) => lesson)).toEqual(lessons.map(({ id }) => id))
    expect(new Set(Object.values(lessonPosters)).size).toBe(16)
    expect(new Set(manifest.posters.map(({ outputSha256 }) => outputSha256)).size).toBe(16)
    expect(new Set(manifest.posters.map(({ presenterStillSeconds }) => presenterStillSeconds)).size).toBe(16)
    for (const entry of manifest.posters) {
      const poster = lessonPosters[entry.lesson as keyof typeof lessonPosters]
      expect(`public${poster}`).toBe(entry.output)
      const bytes = readFileSync(entry.output)
      expect(dimensions(bytes)).toEqual([1280, 720])
      expect(entry.dimensions).toEqual([1280, 720])
      expect(hash(bytes)).toBe(entry.outputSha256)
      expect(entry.visualReview).toEqual({ eyesOpen: true, mouthState: 'composed or slight smile', motionBlur: false, duplicatePose: false })
      expect(hash(readFileSync(entry.presenterSource))).toBe(entry.presenterSourceSha256)
      expect(hash(readFileSync(entry.samOrBookAsset))).toBe(entry.samOrBookAssetSha256)
    }
  })
})
