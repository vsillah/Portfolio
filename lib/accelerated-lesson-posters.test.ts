import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lessonPosters, l12PortraitPoster } from './accelerated-lesson-posters'
import { lessons } from '../app/service-prototypes/[slug]/AcceleratedLearningPlan'

type LegacyPoster = { kind?: never; lesson: string; lessonBinding: string; approvedLearnerVideo: string; approvedLearnerVideoSha256: string; identityReference: string; identityReferenceSha256: string; avatarSource: string; avatarSourceSha256: string; promptIdentity: string; promptSha256: string; generationProvenance: { tool: string; generatorJobId: string }; samOrBookAsset: string; samOrBookAssetSha256: string; output: string; outputSha256: string; dimensions: number[]; visualReview: { eyesOpen: boolean; mouthState: string; anatomy: string; duplicatePose: boolean } }
type SamPoster = { kind: 'momentum_focus'; lesson: 'L12'; lessonBinding: string; samOrBookAsset: string; samOrBookAssetSha256: string; presenterFrameSource: string; presenterFrameSourceSha256: string; output: string; outputSha256: string; dimensions: number[]; portraitOutput: { path: string; sha256: string; dimensions: number[] } }
const manifest = JSON.parse(readFileSync('docs/qa/accelerated-video-posters/source-map.json', 'utf8')) as { posters: (LegacyPoster | SamPoster)[] }
const prompts = JSON.parse(readFileSync('docs/qa/accelerated-video-posters/generation-prompts.json', 'utf8')) as { prompts: { id: string; jobId: string; text: string }[] }
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')
const dimensions = (bytes: Buffer): [number, number] => {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')
  if (bytes.toString('ascii', 12, 16) === 'VP8L') {
    expect(bytes[20]).toBe(0x2f)
    return [1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)), 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10))]
  }
  expect(bytes.toString('ascii', 12, 16)).toBe('VP8 ')
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
    expect(new Set(manifest.posters.filter((entry): entry is LegacyPoster => entry.kind !== 'momentum_focus').map(({ avatarSourceSha256 }) => avatarSourceSha256)).size).toBe(15)
    for (const [index, entry] of manifest.posters.entries()) {
      const poster = lessonPosters[entry.lesson as keyof typeof lessonPosters]
      const prompt = prompts.prompts[index]
      expect(poster).toBe(entry.lessonBinding)
      expect(`public${poster}`).toBe(entry.output)
      expect(dimensions(readFileSync(entry.output))).toEqual([1280, 720])
      expect(entry.dimensions).toEqual([1280, 720])
      expect(hash(readFileSync(entry.output))).toBe(entry.outputSha256)
      if (entry.kind === 'momentum_focus') {
        expect(entry.samOrBookAssetSha256).toBe('4b0d7d9b04e479da01a854ce643e34a40209341d50cdf70aa395ee1eff02d8cc')
        expect(entry.outputSha256).toBe('53dd8b6f8e15f1b95e1fbe1a4a2a54a84abac332a38c108109d564321bca2a3d')
        expect(entry.portraitOutput.sha256).toBe('167fd50d0554f3f1564ee68d41ece3e32d5532e976851a5571842372682b8973')
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
