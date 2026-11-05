import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lessonPosters } from './accelerated-lesson-posters'
import { lessons } from '../app/service-prototypes/[slug]/AcceleratedLearningPlan'

const manifest = JSON.parse(readFileSync('docs/qa/accelerated-video-posters/source-map.json', 'utf8')) as {
  posters: { lesson: string; lessonBinding: string; approvedLearnerVideo: string; approvedLearnerVideoSha256: string; identityReference: string; identityReferenceSha256: string; avatarSource: string; avatarSourceSha256: string; promptIdentity: string; promptSha256: string; generationProvenance: { tool: string; generatorJobId: string }; samOrBookAsset: string; samOrBookAssetSha256: string; output: string; outputSha256: string; dimensions: number[]; visualReview: { eyesOpen: boolean; mouthState: string; anatomy: string; duplicatePose: boolean } }[]
}
const prompts = JSON.parse(readFileSync('docs/qa/accelerated-video-posters/generation-prompts.json', 'utf8')) as { prompts: { id: string; jobId: string; text: string }[] }
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')
const dimensions = (bytes: Buffer): [number, number] => {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
  expect(bytes.toString('ascii', 8, 16)).toBe('WEBPVP8 ')
  expect(bytes.toString('hex', 23, 26)).toBe('9d012a')
  return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff]
}

describe('Accelerated illustrated lesson posters', () => {
  it('binds sixteen distinct 16:9 covers to the exact approved sources and prompt records', () => {
    expect(Object.keys(lessonPosters)).toEqual(lessons.map(({ id }) => id))
    expect(manifest.posters.map(({ lesson }) => lesson)).toEqual(lessons.map(({ id }) => id))
    expect(prompts.prompts.map(({ id }) => id)).toEqual(lessons.map(({ id }) => `accelerated-${id.toLowerCase()}-illustrated-avatar/v1`))
    expect(new Set(Object.values(lessonPosters)).size).toBe(16)
    expect(new Set(manifest.posters.map(({ outputSha256 }) => outputSha256)).size).toBe(16)
    expect(new Set(manifest.posters.map(({ avatarSourceSha256 }) => avatarSourceSha256)).size).toBe(16)
    for (const [index, entry] of manifest.posters.entries()) {
      const poster = lessonPosters[entry.lesson as keyof typeof lessonPosters]
      const prompt = prompts.prompts[index]
      expect(poster).toBe(entry.lessonBinding)
      expect(`public${poster}`).toBe(entry.output)
      expect(dimensions(readFileSync(entry.output))).toEqual([1280, 720])
      expect(entry.dimensions).toEqual([1280, 720])
      expect(hash(readFileSync(entry.output))).toBe(entry.outputSha256)
      expect(hash(readFileSync(entry.avatarSource))).toBe(entry.avatarSourceSha256)
      expect(hash(readFileSync(entry.identityReference))).toBe(entry.identityReferenceSha256)
      expect(hash(readFileSync(entry.approvedLearnerVideo))).toBe(entry.approvedLearnerVideoSha256)
      expect(hash(readFileSync(entry.samOrBookAsset))).toBe(entry.samOrBookAssetSha256)
      expect(entry.promptIdentity).toBe(prompt.id)
      expect(entry.promptSha256).toBe(hash(prompt.text))
      expect(entry.generationProvenance).toEqual(expect.objectContaining({ tool: 'openai.image_gen.imagegen', generatorJobId: prompt.jobId }))
      expect(entry.visualReview).toEqual({ eyesOpen: true, mouthState: 'intentional; no speech frame', anatomy: 'intact hands and face', duplicatePose: false })
    }
  })
})
