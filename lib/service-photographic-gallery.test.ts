import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import gallery from './service-concept-gallery.json'
import { resolveServiceGallery } from './showcase-preview'

const root = process.cwd()
const audit = JSON.parse(readFileSync(path.join(root, 'docs/qa/services-theme-speaking-visuals/service-gallery-audit.json'), 'utf8')) as Array<{
  id: string
  title: string
  serviceType: string
  decision: 'keep' | 'replace'
  sceneCategory?: 'workshop' | 'consulting'
  frames?: Array<{ imageUrl: string; alt: string; sha256: string; sceneCategory: string }>
}>

describe('consulting and workshop gallery audit', () => {
  it('accounts for the 31 current qualifying services and retains the built example', () => {
    expect(audit).toHaveLength(31)
    expect(new Set(audit.map((service) => service.id)).size).toBe(31)
    expect(audit.every((service) => service.serviceType === 'consulting' || service.serviceType === 'workshop' || /workshop|cohort/i.test(service.title))).toBe(true)
    expect(audit.filter((service) => service.decision === 'replace')).toHaveLength(30)
    expect(audit.filter((service) => service.decision === 'keep').map((service) => service.title)).toEqual(['Website UX Refresh'])
    for (const service of audit) {
      const binding = gallery[service.id as keyof typeof gallery]
      expect(binding, service.title).toBeDefined()
      const frames = resolveServiceGallery(service.id, binding.expectedCurrentUrl)
      expect(frames.length, service.title).toBeGreaterThanOrEqual(2)
      for (const frame of frames) {
        expect(frame.imageUrl, service.title).toMatch(/^\/showcases\/.*\.(jpg|jpeg|png|webp)$/i)
        expect(readFileSync(path.join(root, 'public', frame.imageUrl)).byteLength, service.title).toBeGreaterThan(40_000)
      }
    }
  })

  it('binds two distinct, source-traced photographic JPEGs per replacement', () => {
    const hashes: string[] = []
    for (const service of audit.filter((item) => item.decision === 'replace')) {
      expect(service.frames, service.title).toHaveLength(2)
      const binding = gallery[service.id as keyof typeof gallery]
      const frames = resolveServiceGallery(service.id, binding.expectedCurrentUrl)
      expect(frames.map((frame) => frame.role)).toEqual(['hero', 'product-in-use'])
      for (const [index, frame] of frames.entries()) {
        const recorded = service.frames![index]
        expect(frame.imageUrl, service.title).toBe(recorded.imageUrl)
        expect(frame.imageUrl, service.title).toMatch(/^\/showcases\/service-photographic\/.*\.jpg$/)
        expect(frame.status).toBe('illustrative concept')
        expect(frame.label).toBe('Illustrative scene')
        expect(frame.alt).toBe(recorded.alt)
        expect(frame.alt).toMatch(/^Illustrative scene: /)
        expect(recorded.sceneCategory).toBe(service.sceneCategory)
        const file = readFileSync(path.join(root, 'public', frame.imageUrl))
        expect(file.subarray(0, 3).toString('hex')).toBe('ffd8ff')
        expect(file.byteLength).toBeGreaterThan(50_000)
        const hash = createHash('sha256').update(file).digest('hex')
        expect(hash).toBe(recorded.sha256)
        hashes.push(hash)
      }
      expect(frames[0].alt).not.toBe(frames[1].alt)
      if (service.sceneCategory === 'workshop') {
        expect(frames.some((frame) => /laptop/i.test(frame.alt)), service.title).toBe(true)
        expect(frames.every((frame) => !/stage|podium|audience rows/i.test(frame.alt)), service.title).toBe(true)
      } else {
        expect(frames.every((frame) => !/classroom|stage|podium/i.test(frame.alt)), service.title).toBe(true)
      }
    }
    expect(hashes).toHaveLength(60)
    expect(new Set(hashes).size).toBe(60)
  })

  it('preserves the approved Speaking Engagement gallery', () => {
    const frames = resolveServiceGallery('a278e803-9328-490b-bf57-8fbee7d129ee', null)
    expect(frames.map((frame) => frame.imageUrl)).toEqual([
      '/showcases/speaking/vambah-speaking-illustrative-hero.jpg',
      '/showcases/speaking/vambah-speaking-illustrative-qa.jpg',
    ])
  })
})
