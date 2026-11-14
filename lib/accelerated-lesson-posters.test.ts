import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lessonPosters, l12PortraitPoster } from './accelerated-lesson-posters'
import { lessons } from '../app/service-prototypes/[slug]/AcceleratedLearningPlan'

type LegacyPoster = { kind?: never; lesson: string; lessonBinding: string; approvedLearnerVideo: string; approvedLearnerVideoSha256: string; identityReference: string; identityReferenceSha256: string; avatarSource: string; avatarSourceSha256: string; promptIdentity: string; promptSha256: string; generationProvenance: { tool: string; generatorJobId: string }; samOrBookAsset: string; samOrBookAssetSha256: string; output: string; outputSha256: string; dimensions: number[]; visualReview: { eyesOpen: boolean; mouthState: string; anatomy: string; duplicatePose: boolean } }
type SamPoster = { kind: 'canonical_sam'; lesson: 'L12'; lessonBinding: string; samOrBookAsset: string; samOrBookAssetSha256: string; presenterFrameSource: string; presenterFrameSourceSha256: string; output: string; outputSha256: string; dimensions: number[]; portraitOutput: { path: string; sha256: string; dimensions: number[] } }
const manifest = JSON.parse(readFileSync('docs/qa/accelerated-video-posters/source-map.json', 'utf8')) as { posters: (LegacyPoster | SamPoster)[] }
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
    expect(new Set(manifest.posters.filter((entry): entry is LegacyPoster => entry.kind !== 'canonical_sam').map(({ avatarSourceSha256 }) => avatarSourceSha256)).size).toBe(15)
    for (const [index, entry] of manifest.posters.entries()) {
      const poster = lessonPosters[entry.lesson as keyof typeof lessonPosters]
      const prompt = prompts.prompts[index]
      expect(poster).toBe(entry.lessonBinding)
      expect(`public${poster}`).toBe(entry.output)
      expect(dimensions(readFileSync(entry.output))).toEqual([1280, 720])
      expect(entry.dimensions).toEqual([1280, 720])
      expect(hash(readFileSync(entry.output))).toBe(entry.outputSha256)
      if (entry.kind === 'canonical_sam') {
        expect(entry.samOrBookAssetSha256).toBe('b7ab226d17f5ae4b421936b0ea541646223f55c0121da328e483941175c39ea3')
        expect(entry.outputSha256).toBe('440c7ec3e0941e1cf0140daa862235af42bd6c6e620ba1e5099ca6053681932a')
        expect(entry.portraitOutput.sha256).toBe('42190c63e832a9f9307e7bd8403fc374fb0493feedac54531c511d31c45484b4')
        expect(entry.lessonBinding).toContain(entry.outputSha256.slice(0, 12))
        expect(l12PortraitPoster).toContain(entry.portraitOutput.sha256.slice(0, 12))
        expect(hash(readFileSync(entry.samOrBookAsset))).toBe(entry.samOrBookAssetSha256)
        expect(hash(readFileSync(entry.presenterFrameSource))).toBe(entry.presenterFrameSourceSha256)
        expect(`public${l12PortraitPoster}`).toBe(entry.portraitOutput.path)
        expect(hash(readFileSync(entry.portraitOutput.path))).toBe(entry.portraitOutput.sha256)
        expect(dimensions(readFileSync(entry.portraitOutput.path))).toEqual([390, 844])
        continue
      }
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
