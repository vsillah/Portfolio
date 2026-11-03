import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import gallery from './service-concept-gallery.json'

const root = process.cwd()
const qa = path.join(root, 'docs/qa/services-theme-speaking-visuals')
const matrix = JSON.parse(readFileSync(path.join(qa, 'workshop-casting-matrix.json'), 'utf8')) as {
  totalGenerationCalls: number
  rejectedGenerationCount: number
  assets: Array<{
    slug: string; role: string; imageUrl: string; scene: string; setting: string;
    camera: string; facilitationMode: string; deliveryContext: string; castingIntent: string; alt: string;
    wardrobePalette: string; environmentPalette: string; paletteIntent: string
  }>
}
const audit = JSON.parse(readFileSync(path.join(qa, 'service-gallery-audit.json'), 'utf8')) as Array<{
  id: string; slug?: string; title: string; sceneCategory?: string; frames?: Array<{ sha256: string }>
}>
const catalog = JSON.parse(readFileSync(path.join(qa, 'catalog-snapshot.json'), 'utf8')) as Array<{
  id: string; title: string; serviceType: string
}>

describe('workshop photographic casting contract', () => {
  it('covers every workshop or cohort service with two unique, source-traced frames', () => {
    const workshops = catalog.filter((service) => service.serviceType === 'workshop' || /workshop|cohort/i.test(service.title))
    expect(workshops).toHaveLength(5)
    const hashes = new Set<string>()
    for (const service of workshops) {
      const record = audit.find((item) => item.id === service.id)
      expect(record?.sceneCategory, service.title).toBe('workshop')
      const assets = matrix.assets.filter((asset) => asset.slug === record?.slug)
      expect(assets.map((asset) => asset.role), service.title).toEqual(['hero', 'secondary'])
      const binding = gallery[service.id as keyof typeof gallery]
      expect(binding.frames.map((frame) => frame.imageUrl)).toEqual(assets.map((asset) => asset.imageUrl))
      for (const [index, asset] of assets.entries()) {
        const hash = createHash('sha256').update(readFileSync(path.join(root, 'public', asset.imageUrl))).digest('hex')
        expect(hash).toBe(record?.frames?.[index].sha256)
        expect(hashes.has(hash)).toBe(false)
        hashes.add(hash)
        expect(asset.alt).toBe(binding.frames[index].alt)
      }
    }
    expect(hashes.size).toBe(10)
  })

  it('records distinct scene roles, settings, delivery contexts, and casting intent', () => {
    expect(matrix.totalGenerationCalls).toBe(24)
    expect(matrix.rejectedGenerationCount).toBe(14)
    expect(new Set(matrix.assets.map((asset) => asset.scene)).size).toBe(10)
    expect(new Set(matrix.assets.map((asset) => asset.setting)).size).toBe(10)
    for (const asset of matrix.assets) {
      for (const key of ['scene', 'setting', 'camera', 'facilitationMode', 'deliveryContext', 'castingIntent'] as const) {
        expect(asset[key].length, `${asset.slug}:${asset.role} ${key}`).toBeGreaterThan(12)
      }
      expect(asset.castingIntent, `${asset.slug}:${asset.role}`).not.toMatch(/prosthe|robotic|wheelchair|hearing aid|medical device/i)
    }
    const scene = (slug: string) => matrix.assets.filter((asset) => asset.slug === slug).map((asset) => asset.scene).join(' ')
    expect(scene('ai-strategy-half-day')).toMatch(/priorit|ranking/i)
    expect(scene('ai-strategy-full-day')).toMatch(/two-group|synthesis/i)
    expect(scene('ai-strategy-recorded')).toMatch(/independent/i)
    expect(scene('accelerated-cohort-workshop')).toMatch(/prototype|build/i)
    expect(scene('product-innovation-workshop')).toMatch(/participant test|opportunity/i)
    expect(matrix.assets.filter((asset) => asset.slug === 'ai-strategy-recorded').every((asset) => asset.deliveryContext === 'solo asynchronous')).toBe(true)
  })

  it('records varied editorial color without making brand colors a photographic uniform', () => {
    expect(new Set(matrix.assets.map((asset) => asset.wardrobePalette)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(matrix.assets.map((asset) => asset.environmentPalette)).size).toBe(10)
    for (const asset of matrix.assets) {
      expect(asset.wardrobePalette.length).toBeGreaterThan(3)
      expect(asset.environmentPalette.length).toBeGreaterThan(12)
      expect(asset.paletteIntent).toMatch(/brand palette reserved for surrounding UI/i)
      expect(`${asset.wardrobePalette} ${asset.environmentPalette}`).not.toMatch(/navy|gold/i)
    }
  })
})
