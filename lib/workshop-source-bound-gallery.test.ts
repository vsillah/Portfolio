import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const qa = path.join(root, 'docs/qa/services-theme-speaking-visuals')
const packet = path.join(root, 'docs/qa/workshop-editorial-color-2026-11-02')
const map = JSON.parse(readFileSync(path.join(packet, 'source-to-service-visual-map.json'), 'utf8')) as {
  frames: Array<{
    slug: string; role: string; framework: string; chapter: string; source: string; sourceSha256: string;
    member: string | null; visibleLabels: string[]; artifactPath: string; artifactSha256: string;
    basePhotoPath: string; basePhotoSha256: string; compositeMethod: string; outputPath: string; outputSha256: string
  }>
}
const matrix = JSON.parse(readFileSync(path.join(qa, 'workshop-casting-matrix.json'), 'utf8')) as {
  assets: Array<{ slug: string; role: string; analysisSourcePath: string; analysisSourceSha256: string;
    analysisFramework: string; analysisArtifactSha256: string; analysisCompositeMethod: string; analysisOutputSha256: string }>
}
const inventory = JSON.parse(readFileSync(path.join(qa, 'asset-inventory.json'), 'utf8')) as Array<{
  slug: string; role: string; sha256: string; analysisOutputSha256?: string
}>
const hash = (file: string) => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')
const approvedSource = (source: string) => [
  'accelerated_ebook_leadmagnet.epub',
  'agentified/source-assets/accelerated/accelerated-sam-infographic.png',
].includes(source)
const rejectsGenericAnalysis = (frame: { source: string; framework: string; visibleLabels: string[]; compositeMethod: string }) =>
  approvedSource(frame.source) &&
  frame.framework.trim().length > 8 &&
  frame.visibleLabels.length >= 3 &&
  frame.visibleLabels.every((label) => label.trim().length > 2 && !/^(placeholder|sample|lorem|box \d|generic|blank)$/i.test(label)) &&
  /sharp SVG overlay/.test(frame.compositeMethod)

describe('source-bound workshop analysis gallery', () => {
  it('binds all ten frames to an approved owned source and exact rendered artifact', () => {
    expect(map.frames).toHaveLength(10)
    expect(new Set(map.frames.map((frame) => `${frame.slug}:${frame.role}`)).size).toBe(10)
    for (const frame of map.frames) {
      const key = `${frame.slug}:${frame.role}`
      expect(rejectsGenericAnalysis(frame), key).toBe(true)
      expect(frame.chapter.length, key).toBeGreaterThan(18)
      expect(frame.sourceSha256, key).toBe(hash(frame.source))
      expect(frame.artifactSha256, key).toBe(hash(frame.artifactPath))
      expect(frame.basePhotoSha256, key).toBe(hash(frame.basePhotoPath))
      expect(frame.outputSha256, key).toBe(hash(frame.outputPath))
      const artifact = readFileSync(path.join(root, frame.artifactPath), 'utf8')
      expect(artifact, key).not.toMatch(/placeholder|lorem ipsum|sample data|blank chart|generic diagram/i)
      if (frame.member) {
        const chapter = execFileSync('unzip', ['-p', path.join(root, frame.source), frame.member], { encoding: 'utf8' }).toLowerCase()
        for (const label of frame.visibleLabels) expect(chapter, `${key}: ${label}`).toContain(label.toLowerCase())
      } else {
        expect(frame.source).toMatch(/accelerated-sam-infographic\.png$/)
        expect(frame.visibleLabels).toEqual(['SIGNALS', 'ALIGNMENT', 'MOMENTUM'])
      }
      const asset = matrix.assets.find((item) => `${item.slug}:${item.role}` === key)
      const item = inventory.find((candidate) => `${candidate.slug}:${candidate.role}` === key)
      expect(asset?.analysisSourcePath, key).toBe(frame.source)
      expect(asset?.analysisSourceSha256, key).toBe(frame.sourceSha256)
      expect(asset?.analysisFramework, key).toBe(frame.framework)
      expect(asset?.analysisArtifactSha256, key).toBe(frame.artifactSha256)
      expect(asset?.analysisCompositeMethod, key).toBe(frame.compositeMethod)
      expect(asset?.analysisOutputSha256, key).toBe(frame.outputSha256)
      expect(item?.sha256, key).toBe(frame.outputSha256)
    }
  })

  it('rejects blank, generic, and generated analysis bindings', () => {
    const valid = map.frames[0]
    expect(rejectsGenericAnalysis({ ...valid, source: '/Users/example/generated_images/scene.png' })).toBe(false)
    expect(rejectsGenericAnalysis({ ...valid, visibleLabels: ['Blank', 'Box 1', 'Generic'] })).toBe(false)
    expect(rejectsGenericAnalysis({ ...valid, framework: 'Generic' })).toBe(false)
    expect(rejectsGenericAnalysis({ ...valid, compositeMethod: 'generated diagram text' })).toBe(false)
  })
})
